'use client'

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react'
import {
  Mic2, Upload, FileVideo, FileAudio, X, Copy, Download,
  Check, ArrowLeft, Clock, AlignLeft, Loader2, Sparkles,
  AlertCircle, Scissors,
} from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'ru', label: 'Russian' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'tr', label: 'Turkish' },
]

const ACCEPTED = 'video/mp4,video/quicktime,video/webm,video/x-matroska,audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,audio/ogg,audio/webm'

// Vercel serverless body limit is 4.5 MB — stay safely under
const CHUNK_MAX_BYTES = 3.8 * 1024 * 1024

// MIME types that Whisper accepts natively — no ffmpeg needed for these
const WHISPER_NATIVE = new Set([
  'audio/flac', 'audio/mpeg', 'audio/mp3',
  'video/mp4', 'audio/mp4', 'audio/x-m4a',
  'audio/ogg', 'audio/wav', 'audio/x-wav',
  'video/webm', 'audio/webm',
])

// ffmpeg WASM CDN — try unpkg first, fall back to jsdelivr
// NOTE: @ffmpeg/core-st was deprecated and has no 0.12.x release. Use @ffmpeg/core
// (single-threaded by default) matched to the @ffmpeg/ffmpeg lib version.
const WASM_BASE = {
  primary: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/',
  fallback: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(b: number) {
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`
}

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}h ${m}m`
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading-ffmpeg' | 'extracting' | 'transcribing' | 'done' | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

export default function TranscribePage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [language, setLanguage] = useState('auto')
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [duration, setDuration] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [extractProgress, setExtractProgress] = useState(0)
  const [chunkInfo, setChunkInfo] = useState<{ current: number; total: number } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  // ── ffmpeg loader (lazy, singleton) ──────────────────────────────────────

  const getFFmpeg = useCallback(async (): Promise<FFmpeg> => {
    if (ffmpegRef.current) return ffmpegRef.current
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { toBlobURL } = await import('@ffmpeg/util')
    const ff = new FFmpeg()
    ff.on('progress', ({ progress }: { progress: number }) => {
      setExtractProgress(Math.round(Math.min(progress, 1) * 100))
    })

    // Try primary CDN (unpkg), fall back to jsdelivr if it fails
    const tryLoad = async (base: string) => {
      await ff.load({
        coreURL: await toBlobURL(base + 'ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL(base + 'ffmpeg-core.wasm', 'application/wasm'),
      })
    }
    try {
      await tryLoad(WASM_BASE.primary)
    } catch {
      await tryLoad(WASM_BASE.fallback)
    }

    ffmpegRef.current = ff
    return ff
  }, [])

  // ── audio extraction (video → compressed mono MP3) ───────────────────────

  const extractAudio = useCallback(async (ff: FFmpeg, src: File): Promise<Uint8Array> => {
    const { fetchFile } = await import('@ffmpeg/util')
    setExtractProgress(0)
    await ff.writeFile('input', await fetchFile(src))
    await ff.exec([
      '-i', 'input',
      '-vn',           // strip video
      '-ar', '16000',  // 16 kHz — Whisper's native rate
      '-ac', '1',      // mono
      '-b:a', '32k',   // 32 kbps — good for speech, tiny files
      '-f', 'mp3', 'audio.mp3',
    ])
    const data = await ff.readFile('audio.mp3') as Uint8Array
    try { await ff.deleteFile('input') } catch { /* ignore */ }
    try { await ff.deleteFile('audio.mp3') } catch { /* ignore */ }
    return data
  }, [])

  // ── chunk splitter (splits audio into ≤ 3.8 MB segments) ────────────────

  const splitIntoChunks = useCallback(async (ff: FFmpeg, audioData: Uint8Array): Promise<Uint8Array[]> => {
    if (audioData.byteLength <= CHUNK_MAX_BYTES) return [audioData]

    // At 32 kbps: bytes/sec ≈ 4000. Derive segment time that keeps each chunk < 3.8 MB.
    const bytesPerSec = 4000
    const segmentSecs = Math.floor(CHUNK_MAX_BYTES / bytesPerSec) - 10 // 10 s buffer

    await ff.writeFile('full.mp3', audioData)
    await ff.exec([
      '-i', 'full.mp3',
      '-f', 'segment',
      '-segment_time', String(segmentSecs),
      '-c', 'copy',
      'chunk_%03d.mp3',
    ])

    const chunks: Uint8Array[] = []
    let i = 0
    while (true) {
      const name = `chunk_${String(i).padStart(3, '0')}.mp3`
      try {
        const chunk = await ff.readFile(name) as Uint8Array
        chunks.push(chunk)
        try { await ff.deleteFile(name) } catch { /* ignore */ }
        i++
      } catch {
        break
      }
    }

    try { await ff.deleteFile('full.mp3') } catch { /* ignore */ }
    return chunks
  }, [])

  // ── file acceptance ───────────────────────────────────────────────────────

  const acceptFile = useCallback((f: File) => {
    const isVideo = f.type.startsWith('video/')
    const isAudio = f.type.startsWith('audio/')
    if (!isVideo && !isAudio) {
      setError('Unsupported file type. Drop a video (MP4, MOV, WebM) or audio (MP3, WAV, M4A) file.')
      return
    }
    setError('')
    setFile(f)
    setTranscript('')
    setDuration(null)
    setStatus('idle')
    setChunkInfo(null)
  }, [])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }, [acceptFile])

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])

  const onInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) acceptFile(f)
    e.target.value = ''
  }, [acceptFile])

  // ── main transcription pipeline ───────────────────────────────────────────

  const transcribe = useCallback(async () => {
    if (!file) return
    setError('')
    setTranscript('')
    setDuration(null)
    setChunkInfo(null)

    let audioChunks: Blob[]

    // ffmpeg is needed when: file is too big for direct upload, OR format isn't Whisper-native (e.g. MOV, MKV)
    const needsProcessing = file.size > CHUNK_MAX_BYTES || !WHISPER_NATIVE.has(file.type)

    if (needsProcessing) {
      // Step 1 — load ffmpeg WASM (first time downloads ~31 MB)
      setStatus('loading-ffmpeg')
      let ff: FFmpeg
      try {
        ff = await getFFmpeg()
      } catch (e) {
        setError('Failed to load audio processor: ' + (e instanceof Error ? e.message : String(e)))
        setStatus('error')
        return
      }

      // Step 2 — extract & compress audio in browser
      setStatus('extracting')
      let audioData: Uint8Array
      try {
        audioData = await extractAudio(ff, file)
      } catch (e) {
        setError('Audio extraction failed: ' + (e instanceof Error ? e.message : String(e)))
        setStatus('error')
        return
      }

      // Step 3 — split into ≤ 3.8 MB chunks if needed
      const chunks = await splitIntoChunks(ff, audioData)
      // new Uint8Array(c) copies data into a fresh ArrayBuffer — required for Blob ctor
      audioChunks = chunks.map(c => new Blob([new Uint8Array(c)], { type: 'audio/mpeg' }))
    } else {
      // Small audio file — send directly, no ffmpeg needed
      audioChunks = [file]
    }

    // Step 4 — transcribe each chunk via Whisper
    setStatus('transcribing')
    const parts: string[] = []
    let totalDuration = 0

    try {
      for (let i = 0; i < audioChunks.length; i++) {
        if (audioChunks.length > 1) setChunkInfo({ current: i + 1, total: audioChunks.length })

        const form = new FormData()
        form.append('file', new File([audioChunks[i]], `audio_${i}.mp3`, { type: 'audio/mpeg' }))
        if (language !== 'auto') form.append('language', language)

        const res = await fetch('/api/transcribe-local', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Transcription failed')

        parts.push(data.transcript as string)
        totalDuration += (data.transcribedDuration as number) ?? 0
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
      return
    }

    setTranscript(parts.join(' '))
    setDuration(totalDuration || null)
    setChunkInfo(null)
    setStatus('done')
  }, [file, language, getFFmpeg, extractAudio, splitIntoChunks])

  // ── clipboard + download ──────────────────────────────────────────────────

  const copy = useCallback(() => {
    navigator.clipboard.writeText(transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [transcript])

  const download = useCallback(() => {
    const blob = new Blob([transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${file?.name.replace(/\.[^.]+$/, '') ?? 'transcript'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [transcript, file])

  // ── derived values ────────────────────────────────────────────────────────

  const words = transcript ? transcript.trim().split(/\s+/).filter(Boolean).length : 0
  const isAudio = file?.type.startsWith('audio/')
  const needsFFmpeg = !!file && (file.size > CHUNK_MAX_BYTES || !WHISPER_NATIVE.has(file.type))

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0a0f1e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="w-px h-4 bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Mic2 className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <span className="text-sm font-semibold text-white">Local Transcribe</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/60 rounded-lg px-2.5 py-1 border border-slate-700/50">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Powered by Whisper
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Transcribe Your Video</h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            Drop any video or audio file — even 400 MB. Audio is extracted and compressed in your browser before upload, so only a few MB ever leaves your device.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !file && inputRef.current?.click()}
          className={clsx(
            'relative rounded-2xl border-2 border-dashed transition-all duration-200 overflow-hidden',
            file
              ? 'border-slate-700 bg-slate-900/50 cursor-default'
              : dragging
              ? 'border-violet-500/70 bg-violet-500/5 cursor-copy scale-[1.005]'
              : 'border-slate-700 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60 cursor-pointer',
          )}
        >
          {dragging && (
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent pointer-events-none" />
          )}

          <div className="px-8 py-10 flex flex-col items-center text-center">
            {file ? (
              <div className="w-full">
                <div className="flex items-center gap-4">
                  <div className={clsx(
                    'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                    isAudio ? 'bg-amber-500/15' : 'bg-violet-500/15',
                  )}>
                    {isAudio
                      ? <FileAudio className="w-6 h-6 text-amber-400" />
                      : <FileVideo className="w-6 h-6 text-violet-400" />
                    }
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmtSize(file.size)}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); setTranscript(''); setStatus('idle'); setError(''); setChunkInfo(null) }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Pipeline preview badge */}
                {needsFFmpeg && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/40">
                    <Scissors className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                    Audio will be extracted &amp; compressed in your browser before upload
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className={clsx(
                  'w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all',
                  dragging ? 'bg-violet-500/20 scale-110' : 'bg-slate-800',
                )}>
                  <Upload className={clsx('w-6 h-6 transition-colors', dragging ? 'text-violet-400' : 'text-slate-400')} />
                </div>
                <p className="text-sm font-semibold text-white mb-1">
                  {dragging ? 'Drop it here' : 'Drop your file here'}
                </p>
                <p className="text-xs text-slate-500">or click to browse your device</p>
                <p className="text-xs text-slate-600 mt-3 font-mono">
                  MP4 · MOV · WebM · MP3 · WAV · M4A &nbsp;·&nbsp; any size
                </p>
              </>
            )}
          </div>
        </div>

        <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={onInput} />

        {/* Options */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Options</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Language</p>
              <p className="text-xs text-slate-500 mt-0.5">Leave on Auto-detect for best results</p>
            </div>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl text-sm text-white px-3 py-2 outline-none focus:border-violet-500/60 transition-colors appearance-none cursor-pointer min-w-[140px]"
            >
              {LANGUAGES.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Transcribe button */}
        <button
          onClick={transcribe}
          disabled={!file || status === 'loading-ffmpeg' || status === 'extracting' || status === 'transcribing'}
          className={clsx(
            'w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200',
            !file || ['loading-ffmpeg', 'extracting', 'transcribing'].includes(status)
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/20 hover:shadow-amber-400/30 active:scale-[0.99]',
          )}
        >
          {status === 'loading-ffmpeg' || status === 'extracting' || status === 'transcribing' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {status === 'loading-ffmpeg' && 'Loading audio processor…'}
              {status === 'extracting' && 'Extracting audio…'}
              {status === 'transcribing' && (chunkInfo ? `Transcribing part ${chunkInfo.current} of ${chunkInfo.total}…` : 'Transcribing…')}
            </>
          ) : (
            <>
              <Mic2 className="w-4 h-4" />
              Transcribe with Whisper
            </>
          )}
        </button>

        {/* Progress cards */}
        {status === 'loading-ffmpeg' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Loading audio processor</p>
              <p className="text-xs text-slate-500 mt-1">Downloading ffmpeg.wasm (~31 MB). This only happens once — the browser caches it.</p>
            </div>
          </div>
        )}

        {status === 'extracting' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Scissors className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Extracting &amp; compressing audio</p>
                <p className="text-xs text-slate-500 mt-0.5">Running in your browser — nothing uploaded yet</p>
              </div>
              <span className="text-sm font-mono font-bold text-violet-400">{extractProgress}%</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${extractProgress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'transcribing' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 flex flex-col items-center gap-4">
            <div className="flex items-center gap-1">
              {[8, 16, 24, 20, 14, 22, 18, 12, 20, 16].map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-amber-500 animate-pulse"
                  style={{ height: `${h}px`, animationDelay: `${i * 80}ms`, animationDuration: '900ms' }}
                />
              ))}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {chunkInfo ? `Transcribing part ${chunkInfo.current} of ${chunkInfo.total}` : 'Transcribing…'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Sending compressed audio to Whisper</p>
            </div>
          </div>
        )}

        {/* Result */}
        {status === 'done' && transcript && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3 flex-wrap">
              <AlignLeft className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white">Transcript</span>
              <span className="text-xs bg-slate-800 text-slate-400 rounded-full px-2.5 py-0.5 border border-slate-700">
                {words.toLocaleString()} words
              </span>
              {duration !== null && (
                <span className="text-xs bg-slate-800 text-slate-400 rounded-full px-2.5 py-0.5 border border-slate-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmtDuration(duration)}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  {copied
                    ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy</>
                  }
                </button>
                <button
                  onClick={download}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              <p className="text-sm text-slate-300 leading-7 whitespace-pre-wrap">{transcript}</p>
            </div>

            <div className="px-5 py-4 border-t border-slate-800/60 flex items-center justify-between">
              <p className="text-xs text-slate-600">Different language? Change it above and re-run.</p>
              <button
                onClick={transcribe}
                className="text-xs text-slate-400 hover:text-amber-400 transition-colors font-medium"
              >
                Run again →
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
