import { NextRequest, NextResponse } from 'next/server'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, unlink, readFile, stat } from 'fs/promises'

const WHISPER_API = 'https://api.openai.com/v1/audio/transcriptions'

interface WhisperVerbose {
  text: string
  duration: number
}

function log(msg: string) {
  console.log(`[transcribe ${new Date().toISOString()}] ${msg}`)
}

// Instagram CDN URLs contain an `oe` param — Unix expiry as hex (e.g. oe=680F1A2B)
function logInstagramUrlExpiry(url: string) {
  try {
    const oe = new URL(url).searchParams.get('oe')
    if (!oe) { log(`   URL expiry (oe): not present in URL`); return }
    const expiryMs = parseInt(oe, 16) * 1000
    const expiry = new Date(expiryMs)
    const diffMs = expiryMs - Date.now()
    const diffMin = Math.round(diffMs / 60_000)
    if (diffMs < 0) {
      log(`   URL expiry (oe): ❌ EXPIRED at ${expiry.toISOString()} — ${Math.abs(diffMin)}m ago`)
    } else {
      log(`   URL expiry (oe): ✓ valid until ${expiry.toISOString()} — ${diffMin}m from now`)
    }
  } catch {
    log(`   URL expiry (oe): could not parse`)
  }
}

async function downloadToTemp(url: string, label: string): Promise<string> {
  log(`⬇  Downloading ${label} — ${url.slice(0, 80)}…`)
  logInstagramUrlExpiry(url)
  const t0 = Date.now()

  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })

  if (!res.ok) {
    // Log response details to diagnose 403 / other failures
    const body = await res.text().catch(() => '(unreadable)')
    log(`   ❌ HTTP ${res.status} ${res.statusText}`)
    log(`   Response headers: content-type=${res.headers.get('content-type') ?? 'none'} | x-fb-debug=${res.headers.get('x-fb-debug') ?? 'none'} | retry-after=${res.headers.get('retry-after') ?? 'none'}`)
    log(`   Response body (first 300 chars): ${body.slice(0, 300)}`)
    const msg = res.status === 403
      ? 'Video URL has expired — please Re-sync this creator to get a fresh download link'
      : `Download failed (${res.status})`
    throw new Error(msg)
  }

  const contentLength = res.headers.get('content-length')
  log(`   Server Content-Length: ${contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB` : 'unknown'}`)

  const buf = Buffer.from(await res.arrayBuffer())
  const tmpPath = join(tmpdir(), `whisper_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`)
  await writeFile(tmpPath, buf)

  const fileStat = await stat(tmpPath)
  log(`   Downloaded in ${((Date.now() - t0) / 1000).toFixed(1)}s — actual file: ${(fileStat.size / 1024 / 1024).toFixed(2)} MB → ${tmpPath}`)

  return tmpPath
}

async function callWhisper(tmpPath: string, filename: string, expectedSecs?: number): Promise<WhisperVerbose> {
  const fileStat = await stat(tmpPath)
  log(`🎙  Sending to Whisper — file: ${(fileStat.size / 1024 / 1024).toFixed(2)} MB, name: ${filename}`)
  const t0 = Date.now()

  const buf = await readFile(tmpPath)
  const blob = new Blob([buf], { type: 'video/mp4' })
  const form = new FormData()
  form.append('file', blob, filename)
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')

  const res = await fetch(WHISPER_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(180_000),
  })
  if (!res.ok) throw new Error(`Whisper API error: ${await res.text()}`)

  const result = await res.json() as WhisperVerbose
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  if (expectedSecs) {
    const pct = ((result.duration / expectedSecs) * 100).toFixed(1)
    const status = result.duration < expectedSecs * 0.85 ? '⚠  PARTIAL' : '✓  COMPLETE'
    log(`   ${status} — Whisper got ${result.duration.toFixed(1)}s of ${expectedSecs}s expected (${pct}%) in ${elapsed}s`)
  } else {
    log(`   Whisper done — transcribed ${result.duration.toFixed(1)}s in ${elapsed}s`)
  }

  log(`   Transcript preview: "${result.text.slice(0, 120).replace(/\n/g, ' ')}"`)

  return result
}

export async function POST(req: NextRequest) {
  const { audioUrl, videoUrl, duration } = await req.json()

  log(`━━━ New request — expected duration: ${duration ?? 'unknown'}s`)
  log(`   videoUrl: ${videoUrl ? videoUrl.slice(0, 80) + '…' : 'none'}`)
  log(`   audioUrl: ${audioUrl ? audioUrl.slice(0, 80) + '…' : 'none'}`)

  // Prefer videoUrl — it contains the complete audio+video track.
  // audioUrl is Instagram's DASH audio-only stream which can end before the video does.
  const primaryUrl = videoUrl || audioUrl
  if (!primaryUrl) return NextResponse.json({ error: 'audioUrl or videoUrl required' }, { status: 400 })
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env.local' }, { status: 500 })
  }

  const seemsPartial = (transcribedSecs: number) =>
    typeof duration === 'number' && duration > 5 && transcribedSecs < duration * 0.85

  const tmpFiles: string[] = []

  try {
    // Step 1: download full .mp4 to local temp file
    // Try videoUrl first; if it fails (e.g. 403 expired URL), fall back to audioUrl
    let tmpPath: string
    let filename: string

    if (videoUrl) {
      try {
        tmpPath = await downloadToTemp(videoUrl, 'videoUrl (primary)')
        filename = 'video.mp4'
      } catch (videoErr) {
        const errMsg = videoErr instanceof Error ? videoErr.message : String(videoErr)
        log(`⚠  videoUrl failed (${errMsg}) — trying audioUrl as fallback`)
        if (!audioUrl) throw videoErr
        tmpPath = await downloadToTemp(audioUrl, 'audioUrl (fallback after video failure)')
        filename = 'audio.mp4'
      }
    } else {
      tmpPath = await downloadToTemp(audioUrl!, 'audioUrl (primary)')
      filename = 'audio.mp4'
    }
    tmpFiles.push(tmpPath)

    // Step 2: run Whisper on the downloaded file
    let result = await callWhisper(tmpPath, filename, duration)

    // Step 3: if still partial and we have both URLs, retry with the other one
    if (seemsPartial(result.duration) && videoUrl && audioUrl) {
      const fallbackUrl = primaryUrl === videoUrl ? audioUrl : videoUrl
      const fallbackLabel = fallbackUrl === videoUrl ? 'videoUrl (fallback)' : 'audioUrl (fallback)'
      log(`🔄 Primary was partial — trying ${fallbackLabel}`)
      try {
        const fallbackTmp = await downloadToTemp(fallbackUrl, fallbackLabel)
        tmpFiles.push(fallbackTmp)
        const fallbackResult = await callWhisper(
          fallbackTmp,
          fallbackUrl === videoUrl ? 'video.mp4' : 'audio.mp4',
          duration,
        )
        if (fallbackResult.duration > result.duration) {
          log(`   Fallback is better (${fallbackResult.duration.toFixed(1)}s > ${result.duration.toFixed(1)}s) — using fallback`)
          result = fallbackResult
        } else {
          log(`   Fallback not better (${fallbackResult.duration.toFixed(1)}s ≤ ${result.duration.toFixed(1)}s) — keeping primary`)
        }
      } catch (err) {
        log(`   Fallback failed: ${err instanceof Error ? err.message : String(err)} — keeping primary`)
      }
    }

    const finalPartial = seemsPartial(result.duration)
    log(`✅ Done — final: ${result.duration.toFixed(1)}s transcribed, partial=${finalPartial}, text length=${result.text.length} chars`)

    return NextResponse.json({
      transcript: result.text.trim(),
      transcribedDuration: Math.round(result.duration),
      partial: finalPartial,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log(`❌ Error: ${msg}`)
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    // Step 4: delete all temp files
    for (const f of tmpFiles) {
      try { await unlink(f) } catch { /* ignore cleanup errors */ }
    }
    log(`🗑  Temp files cleaned up`)
  }
}