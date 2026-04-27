import { NextRequest, NextResponse } from 'next/server'

const WHISPER_API = 'https://api.openai.com/v1/audio/transcriptions'

interface WhisperVerbose {
  text: string
  duration: number
}

async function downloadBlob(url: string, mimeType: string): Promise<Blob> {
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const buf = await res.arrayBuffer()
  return new Blob([buf], { type: mimeType })
}

async function callWhisper(blob: Blob, filename: string): Promise<WhisperVerbose> {
  const form = new FormData()
  form.append('file', blob, filename)
  form.append('model', 'whisper-1')
  // verbose_json returns { text, duration } so we know exactly how many seconds were transcribed
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

  const primaryUrl = audioUrl || videoUrl
  if (!primaryUrl) return NextResponse.json({ error: 'audioUrl or videoUrl required' }, { status: 400 })
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env.local' }, { status: 500 })
  }

  // A result is "partial" if Whisper processed < 85% of the expected video duration.
  // Instagram's audioUrl is a DASH audio-only stream that sometimes ends earlier than
  // the video — the videoUrl contains the complete combined audio+video track.
  const seemsPartial = (transcribedSecs: number) =>
    typeof duration === 'number' && duration > 5 && transcribedSecs < duration * 0.85

  try {
    // Step 1: try the audio URL first (smaller file → faster and cheaper)
    let result = await callWhisper(
      await downloadBlob(primaryUrl, 'audio/mp4'),
      'audio.mp4',
    )

    // Step 2: if partial and we have a video fallback, retry with the full video track
    if (seemsPartial(result.duration) && videoUrl && audioUrl) {
      try {
        const videoResult = await callWhisper(
          await downloadBlob(videoUrl, 'video/mp4'),
          'video.mp4',
        )
        // Only swap if video gave us more transcript coverage
        if (videoResult.duration > result.duration) {
          result = videoResult
        }
      } catch {
        // If video fallback also fails, keep the audio result
      }
    }

    return NextResponse.json({
      transcript: result.text.trim(),
      transcribedDuration: Math.round(result.duration),
      partial: seemsPartial(result.duration),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
