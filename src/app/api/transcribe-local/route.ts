import { NextRequest, NextResponse } from 'next/server'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, unlink } from 'fs/promises'
import { logUsage } from '@/lib/usage-tracker'

const WHISPER_API = 'https://api.openai.com/v1/audio/transcriptions'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured on the server.' }, { status: 500 })
  }

  let tmpPath: string | null = null

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const language = formData.get('language') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    const MAX_BYTES = 25 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Whisper's maximum is 25 MB. Try extracting audio-only first.` },
        { status: 413 },
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() ?? 'mp4'
    tmpPath = join(tmpdir(), `local_transcribe_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`)
    await writeFile(tmpPath, buf)

    const blob = new Blob([buf], { type: file.type || 'application/octet-stream' })
    const form = new FormData()
    form.append('file', blob, file.name)
    form.append('model', 'whisper-1')
    form.append('response_format', 'verbose_json')
    if (language && language !== 'auto') form.append('language', language)

    const res = await fetch(WHISPER_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(110_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Whisper API error (${res.status}): ${errText.slice(0, 300)}`)
    }

    const result = await res.json() as { text: string; duration: number }

    await logUsage({
      timestamp: new Date().toISOString(),
      provider: 'openai',
      model: 'whisper-1',
      feature: 'transcription',
      inputTokens: 0,
      outputTokens: 0,
      audioSeconds: Math.round(result.duration),
    })

    return NextResponse.json({
      transcript: result.text.trim(),
      transcribedDuration: Math.round(result.duration),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    if (tmpPath) {
      try { await unlink(tmpPath) } catch { /* ignore cleanup errors */ }
    }
  }
}
