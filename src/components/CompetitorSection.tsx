'use client'

import { useState, useRef } from 'react'
import type { Reel, ReelAnalysis } from '@/lib/types'
import {
  Eye, Heart, MessageCircle, ExternalLink, TrendingUp,
  ChevronDown, ChevronRight, RefreshCw, X, Clock, AlertCircle,
  Play, Pause, Loader2, FileText, Volume2, VolumeX, Maximize, Mic, Download,
  Copy, Check, Sparkles,
} from 'lucide-react'
import clsx from 'clsx'

type SortKey = 'views' | 'likes' | 'comments' | 'engagement'

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'views',      label: 'Views',      icon: <Eye className="w-3 h-3" />,           color: 'sky' },
  { key: 'likes',      label: 'Likes',      icon: <Heart className="w-3 h-3" />,         color: 'rose' },
  { key: 'comments',   label: 'Comments',   icon: <MessageCircle className="w-3 h-3" />, color: 'violet' },
  { key: 'engagement', label: 'Engagement', icon: <TrendingUp className="w-3 h-3" />,    color: 'amber' },
]

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const ANALYSIS_FIELDS: { key: keyof ReelAnalysis; label: string }[] = [
  { key: 'coreInsight', label: 'Core Insight' },
  { key: 'hook', label: 'Hook' },
  { key: 'whatToCover', label: 'What to Cover' },
  { key: 'ending', label: 'Ending / CTA' },
  { key: 'whyItWorks', label: 'Why it Works' },
  { key: 'connectsToOffer', label: 'Offer' },
]

interface Props {
  username: string
  reels: Reel[]
  isExpanded: boolean
  onToggle: () => void
  lastSynced?: string | null
  isLoading?: boolean
  error?: string
  onResync: () => void
  onRemove: () => void
  onTranscribe: (reel: Reel) => void
  transcribingId: string | null
  transcribeErrors?: Record<string, string>
  onTranscribeAll: () => void
  onStopTranscribeAll: () => void
  transcribeAllProgress: { current: number; total: number } | null
  onAnalyze: (reel: Reel) => void
  analyzingId: string | null
  onAnalyzeAll: () => void
  onStopAnalyzeAll: () => void
  analyzeAllProgress: { current: number; total: number } | null
}

const SPEEDS = [1, 1.5, 2] as const

function CompetitorReel({ reel, rank, onTranscribe, isTranscribing, transcribeError, onAnalyze, isAnalyzing, analyzeAllRunning }: {
  reel: Reel
  rank: number
  onTranscribe: () => void
  isTranscribing: boolean
  transcribeError?: string
  onAnalyze: () => void
  isAnalyzing: boolean
  analyzeAllRunning: boolean
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const engRate = reel.views > 0
    ? (((reel.likes + reel.comments) / reel.views) * 100).toFixed(1)
    : '0.0'

  const wordCount = reel.transcript
    ? reel.transcript.split(/\s+/).filter(Boolean).length
    : 0

  const copyTranscript = () => {
    navigator.clipboard.writeText(reel.transcript ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openModal = () => {
    if (!reel.videoUrl) return
    setModalOpen(true)
    setCurrentTime(0)
    setVideoDuration(0)
    setSpeed(1)
    setMuted(false)
  }

  const closeModal = () => {
    setModalOpen(false)
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const togglePlayPause = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) videoRef.current.play()
    else videoRef.current.pause()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value)
    if (videoRef.current) videoRef.current.currentTime = t
    setCurrentTime(t)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setMuted(videoRef.current.muted)
  }

  const changeSpeed = (s: number) => {
    setSpeed(s)
    if (videoRef.current) videoRef.current.playbackRate = s
  }

  const toggleFullscreen = () => {
    if (!videoRef.current) return
    if (document.fullscreenElement) document.exitFullscreen()
    else videoRef.current.requestFullscreen()
  }

  return (
    <>
      {/* Transcript overlay */}
      {transcriptOpen && reel.transcript && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setTranscriptOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-lg w-full shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-white">Transcript</span>
                <span className="text-slate-600 text-xs">{wordCount} words</span>
                {reel.transcriptPartial && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                    partial
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyTranscript}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
                >
                  {copied
                    ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
                <button
                  onClick={() => setTranscriptOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <p className="text-sm text-slate-300 leading-relaxed">{reel.transcript}</p>
            </div>
          </div>
        </div>
      )}

      {/* Video overlay modal */}
      {modalOpen && reel.videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative flex flex-col bg-slate-950 rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={videoRef}
              src={reel.videoUrl}
              autoPlay
              className="w-full max-h-[70vh] object-contain bg-black"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
              onLoadedMetadata={() => setVideoDuration(videoRef.current?.duration ?? 0)}
            />

            <div className="px-4 pt-3 pb-3 bg-slate-900 border-t border-slate-800 space-y-2">
              {/* Seek bar */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 tabular-nums w-8 text-right flex-shrink-0">
                  {fmtTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 1}
                  step={0.25}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1 rounded-full bg-slate-700 appearance-none cursor-pointer accent-white"
                />
                <span className="text-[11px] text-slate-600 tabular-nums w-8 flex-shrink-0">
                  {fmtTime(videoDuration)}
                </span>
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlayPause}
                  className="text-white hover:text-slate-300 transition-colors flex-shrink-0"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying
                    ? <Pause className="w-4 h-4 fill-white" />
                    : <Play className="w-4 h-4 fill-white" />}
                </button>

                <div className="flex items-center gap-0.5 ml-1">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={clsx(
                        'text-xs px-2 py-0.5 rounded-md font-semibold transition-colors',
                        speed === s ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white',
                      )}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  <button onClick={toggleMute} className="text-slate-400 hover:text-white transition-colors" title={muted ? 'Unmute' : 'Mute'}>
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <a
                    href={reel.videoUrl}
                    download={`reel-${reel.id}.mp4`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-emerald-400 transition-colors"
                    title="Download video"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button onClick={toggleFullscreen} className="text-slate-400 hover:text-white transition-colors" title="Fullscreen">
                    <Maximize className="w-4 h-4" />
                  </button>
                  <button onClick={closeModal} className="text-slate-400 hover:text-white transition-colors" title="Close">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â"€â"€ Reel card â€" items-start keeps thumbnail pinned to the top â"€â"€ */}
      <div className="flex gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 transition-colors items-start">
        {/* Rank badge */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400">
          {rank}
        </div>

        {/* Thumbnail â€" fixed w-16 h-24 so duration badge is always within bounds */}
        <div className="relative flex-shrink-0 w-16 h-24">
          {reel.thumbnailUrl ? (
            <button
              onClick={openModal}
              className={clsx(
                'absolute inset-0 group',
                reel.videoUrl ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(reel.thumbnailUrl)}`}
                alt=""
                className="w-full h-full rounded-lg object-cover"
              />
              {/* Play hover overlay â€" hidden while transcribing */}
              {reel.videoUrl && !isTranscribing && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg">
                  <div className="bg-white/90 rounded-full p-1.5">
                    <Play className="w-4 h-4 text-slate-900 fill-slate-900" />
                  </div>
                </div>
              )}
              {/* Transcribing overlay */}
              {isTranscribing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-violet-900/70 rounded-lg gap-1">
                  <Loader2 className="w-5 h-5 text-violet-200 animate-spin" />
                </div>
              )}
            </button>
          ) : (
            <div className="absolute inset-0 rounded-lg bg-slate-700/50 flex items-center justify-center">
              {isTranscribing && <Loader2 className="w-5 h-5 text-violet-300 animate-spin" />}
            </div>
          )}
          {/* Duration badge â€" always within the fixed container */}
          {reel.duration != null && !isTranscribing && (
            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded font-semibold tabular-nums leading-none pointer-events-none">
              {fmtTime(reel.duration)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Caption - only when no analysis */}
          {!reel.reelAnalysis && (
            <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
              {reel.caption || '(no caption)'}
            </p>
          )}

          {/* Transcription progress text */}
          {isTranscribing && (
            <div className="flex items-center gap-1.5 text-[11px] text-violet-400">
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
              <span>Transcribing with Whisper AI...</span>
            </div>
          )}

          {/* Analysis breakdown */}
          {reel.reelAnalysis && (
            <div className="space-y-1.5">
              {ANALYSIS_FIELDS.map(({ key, label }) => {
                const value = reel.reelAnalysis![key]
                if (!value || (key === 'connectsToOffer' && value.toLowerCase() === 'none')) return null
                return (
                  <div key={key}>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider leading-none mb-0.5">
                      {label}
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{value}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Transcription error */}
          {transcribeError && (
            <div className="flex items-start gap-1.5 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-2 py-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="leading-relaxed">{transcribeError}</span>
            </div>
          )}

          {/* Stats + action buttons */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-auto">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-sky-400" /> {fmt(reel.views)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-rose-400" /> {fmt(reel.likes)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3 text-violet-400" /> {fmt(reel.comments)}
            </span>
            <span className="text-amber-400">{engRate}%</span>
            {reel.transcript && (
              <button
                onClick={() => setTranscriptOpen(true)}
                className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                <FileText className="w-3 h-3" /> Transcript
              </button>
            )}
            <div className="ml-auto flex items-center gap-2.5">
              {/* Transcribe button - only when no transcript yet */}
              {!reel.transcript && (reel.audioUrl || reel.videoUrl) && !isTranscribing && (
                <button
                  onClick={onTranscribe}
                  className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  <FileText className="w-3 h-3" /> Transcribe
                </button>
              )}
              {/* Analyze button - when transcript exists but no analysis */}
              {reel.transcript && !reel.reelAnalysis && !isAnalyzing && !analyzeAllRunning && (
                <button
                  onClick={onAnalyze}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Sparkles className="w-3 h-3" /> Analyze
                </button>
              )}
              {isAnalyzing && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Analyzing...
                </span>
              )}
              <a
                href={reel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-500 hover:text-sky-400 transition-colors"
                title="Open on Instagram"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function CompetitorSection({
  username, reels, isExpanded, onToggle, lastSynced, isLoading, error, onResync, onRemove,
  onTranscribe, transcribingId, transcribeErrors, onTranscribeAll, onStopTranscribeAll, transcribeAllProgress,
  onAnalyze, analyzingId, onAnalyzeAll, onStopAnalyzeAll, analyzeAllProgress,
}: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('views')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showAnalyzeConfirm, setShowAnalyzeConfirm] = useState(false)

  const engRate = (r: Reel) => r.views > 0 ? (r.likes + r.comments) / r.views : 0
  const sorted = [...reels].sort((a, b) =>
    sortBy === 'engagement' ? engRate(b) - engRate(a) : b[sortBy] - a[sortBy]
  )
  const avgViews = reels.length > 0 ? reels.reduce((s, r) => s + r.views, 0) / reels.length : 0
  const avgEng = reels.length > 0
    ? reels.reduce((s, r) => s + (r.views > 0 ? (r.likes + r.comments) / r.views : 0), 0) / reels.length * 100
    : 0

  const transcribable = reels.filter((r) => !r.transcript && (r.audioUrl || r.videoUrl))
  const analyzable = reels.filter((r) => r.transcript && !r.reelAnalysis)
  const estimatedMinutes = Math.max(1, Math.ceil(transcribable.length * 30 / 60))
  const estimatedAnalyzeSeconds = Math.max(1, Math.ceil(analyzable.length * 8))

  return (
    <>
      {/* â"€â"€ Analyze all confirmation dialog â"€â"€ */}
      {showAnalyzeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowAnalyzeConfirm(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Analyze all transcribed reels?</h3>
                <p className="text-slate-500 text-xs mt-0.5">@{username}</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-2">
              This will analyze{' '}
              <span className="text-white font-semibold">
                {analyzable.length} reel{analyzable.length !== 1 ? 's' : ''}
              </span>{' '}
              using your selected AI — one at a time, sequentially.
            </p>
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-amber-300 text-xs leading-relaxed">
                Estimated ~{estimatedAnalyzeSeconds}s (~8s per reel).{' '}
                <strong>Don&apos;t navigate away</strong> — analysis will stop if you leave this page.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAnalyzeConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowAnalyzeConfirm(false); onAnalyzeAll() }}
                className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
              >
                Analyze {analyzable.length} reels
              </button>
            </div>
          </div>
        </div>
      )}

      {/* â"€â"€ Transcribe all confirmation dialog â"€â"€ */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Mic className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Transcribe all reels?</h3>
                <p className="text-slate-500 text-xs mt-0.5">@{username}</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-2">
              This will transcribe{' '}
              <span className="text-white font-semibold">
                {transcribable.length} reel{transcribable.length !== 1 ? 's' : ''}
              </span>{' '}
              using OpenAI Whisper â€" one at a time, sequentially.
            </p>
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-amber-300 text-xs leading-relaxed">
                Estimated ~{estimatedMinutes} min (~30s per reel).{' '}
                <strong>Don&apos;t navigate away</strong> â€" transcription will stop if you leave this page.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); onTranscribeAll() }}
                className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
              >
                Transcribe {transcribable.length} reels
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
        {/* â"€â"€ Accordion header â"€â"€ */}
        <button
          onClick={onToggle}
          className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-800/60 transition-colors text-left"
        >
          <div className="text-slate-500 flex-shrink-0">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-white">@{username}</span>
            <span className="text-xs text-slate-500">{reels.length} reels</span>
            <span className="text-xs">
              <span className="text-amber-400 font-bold">{fmt(avgViews)}</span>
              <span className="text-slate-500"> avg views</span>
            </span>
            <span className="text-xs">
              <span className="text-emerald-400 font-bold">{avgEng.toFixed(1)}%</span>
              <span className="text-slate-500"> avg eng</span>
            </span>
            {lastSynced && (
              <span className="flex items-center gap-1 text-xs text-slate-600">
                <Clock className="w-3 h-3" /> {timeAgo(lastSynced)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onResync}
              disabled={isLoading}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={clsx('w-3 h-3', isLoading && 'animate-spin')} />
              Re-sync
            </button>
            <button
              onClick={onRemove}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-rose-400 transition-colors"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          </div>
        </button>

        {/* â"€â"€ Scrape error â"€â"€ */}
        {error && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-xs">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* â"€â"€ Expanded body â"€â"€ */}
        {isExpanded && (
          <>
            {/* Sort bar + Transcribe All */}
            <div className="px-5 py-3 border-t border-slate-700/60 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortBy(opt.key)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      sortBy === opt.key
                        ? opt.color === 'sky'    ? 'bg-sky-500/20 text-sky-300'
                        : opt.color === 'rose'   ? 'bg-rose-500/20 text-rose-300'
                        : opt.color === 'violet' ? 'bg-violet-500/20 text-violet-300'
                        : 'bg-amber-500/20 text-amber-300'
                        : 'text-slate-500 hover:text-slate-300',
                    )}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {analyzable.length > 0 && !analyzeAllProgress && (
                  <button
                    onClick={() => setShowAnalyzeConfirm(true)}
                    disabled={!!analyzingId || !!transcribeAllProgress}
                    className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/40 hover:border-amber-400/60 hover:bg-amber-500/10 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-3 h-3" />
                    Analyze All ({analyzable.length})
                  </button>
                )}
                {transcribable.length > 0 && !transcribeAllProgress && (
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={!!transcribingId || !!analyzeAllProgress}
                    className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 border border-violet-500/40 hover:border-violet-400/60 hover:bg-violet-500/10 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Mic className="w-3 h-3" />
                    Transcribe All ({transcribable.length})
                  </button>
                )}
              </div>
            </div>

            {/* Bulk analyze progress banner */}
            {analyzeAllProgress && (
              <div className="mx-5 mb-1 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg p-3 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">
                    Analyzing {analyzeAllProgress.current} of {analyzeAllProgress.total} reels...
                  </span>
                  <span className="text-slate-500 ml-2">Don&apos;t navigate away</span>
                </div>
                <div className="flex-shrink-0 w-24">
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${(analyzeAllProgress.current / analyzeAllProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={onStopAnalyzeAll}
                  title="Stop analysis"
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-400/50 hover:bg-rose-500/10 transition-colors"
                >
                  <X className="w-3 h-3" /> Stop
                </button>
              </div>
            )}

            {/* Bulk transcription progress banner */}
            {transcribeAllProgress && (
              <div className="mx-5 mb-1 flex items-center gap-3 bg-violet-500/10 border border-violet-500/30 text-violet-300 rounded-lg p-3 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">
                    Transcribing {transcribeAllProgress.current} of {transcribeAllProgress.total} reels...
                  </span>
                  <span className="text-slate-500 ml-2">Don&apos;t navigate away</span>
                </div>
                <div className="flex-shrink-0 w-24">
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-violet-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${(transcribeAllProgress.current / transcribeAllProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
                <button
                  onClick={onStopTranscribeAll}
                  title="Stop transcription"
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-400/50 hover:bg-rose-500/10 transition-colors"
                >
                  <X className="w-3 h-3" /> Stop
                </button>
              </div>
            )}

            {/* Reel list */}
            <div className="p-4 flex flex-col gap-3 max-h-[600px] overflow-y-auto border-t border-slate-700/60">
              {sorted.map((reel, i) => (
                <CompetitorReel
                  key={reel.id}
                  reel={reel}
                  rank={i + 1}
                  onTranscribe={() => onTranscribe(reel)}
                  isTranscribing={transcribingId === reel.id}
                  transcribeError={transcribeErrors?.[reel.id]}
                  onAnalyze={() => onAnalyze(reel)}
                  isAnalyzing={analyzingId === reel.id}
                  analyzeAllRunning={analyzeAllProgress !== null}
                />
              ))}
              {reels.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6">No data scraped yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
