import { NextRequest, NextResponse } from 'next/server'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, unlink, readFile } from 'fs/promises'

const WHISPER_API = 'https://api.openai.com/v1/audio/transcriptions'

interface WhisperVerbose {
  text: string
  duration: number
}

async function downloadToTemp(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  const tmpPath = join(tmpdir(), `whisper_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`)
  await writeFile(tmpPath, buf)
  return tmpPath
}

async function callWhisper(tmpPath: string, filename: string): Promise<WhisperVerbose> {
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
  return res.json() as Promise<WhisperVerbose>
}

export async function POST(req: NextRequest) {
  const { audioUrl, videoUrl, duration } = await req.json()

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
    const tmpPath = await downloadToTemp(primaryUrl)
    tmpFiles.push(tmpPath)

    // Step 2: run Whisper on the downloaded file
    const filename = videoUrl ? 'video.mp4' : 'audio.mp4'
    let result = await callWhisper(tmpPath, filename)

    // Step 3: if still partial and we have both URLs, retry with the other one
    if (seemsPartial(result.duration) && videoUrl && audioUrl) {
      const fallbackUrl = primaryUrl === videoUrl ? audioUrl : videoUrl
      try {
        const fallbackTmp = await downloadToTemp(fallbackUrl)
        tmpFiles.push(fallbackTmp)
        const fallbackResult = await callWhisper(
          fallbackTmp,
          fallbackUrl === videoUrl ? 'video.mp4' : 'audio.mp4',
        )
        if (fallbackResult.duration > result.duration) result = fallbackResult
      } catch { /* keep primary result */ }
    }

    return NextResponse.json({
      transcript: result.text.trim(),
      transcribedDuration: Math.round(result.duration),
      partial: seemsPartial(result.duration),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    // Step 4: delete all temp files
    for (const f of tmpFiles) {
      try { await unlink(f) } catch { /* ignore cleanup errors */ }
    }
  }
}
