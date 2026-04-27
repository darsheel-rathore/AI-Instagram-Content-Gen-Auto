'use client'

import { useState, useRef } from 'react'
import type { Reel } from '@/lib/types'
import {
  Eye, Heart, MessageCircle, ExternalLink, TrendingUp,
  ChevronDown, ChevronRight, RefreshCw, X, Clock, AlertCircle,
  Play, Loader2, FileText, Volume2, VolumeX, Maximize,
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
}

const SPEEDS = [1, 1.5, 2] as const

function CompetitorReel({ reel, rank, onTranscribe, isTranscribing }: {
  reel: Reel
  rank: number
  onTranscribe: () => void
  isTranscribing: boolean
}) {
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)

  const engRate = reel.views > 0
    ? (((reel.likes + reel.comments) / reel.views) * 100).toFixed(1)
    : '0.0'

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
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      videoRef.current.requestFullscreen()
    }
  }

  const closeModal = () => {
    setPlaying(false)
    setMuted(false)
    setSpeed(1)
  }

  return (
    <>
      {/* ── Video overlay modal ── */}
      {playing && reel.videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative flex flex-col bg-slate-950 rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Video */}
            <video
              ref={videoRef}
              src={reel.videoUrl}
              autoPlay
              className="w-full max-h-[70vh] object-contain bg-black"
            />

            {/* Controls bar */}
            <div className="px-4 py-3 flex items-center justify-between bg-slate-900 border-t border-slate-800">
              {/* Speed */}
              <div className="flex items-center gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSpeed(s)}
                    className={clsx(
                      'text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors',
                      speed === s
                        ? 'bg-white text-slate-900'
                        : 'text-slate-400 hover:text-white',
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMute}
                  className="text-slate-400 hover:text-white transition-colors"
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted
                    ? <VolumeX className="w-4 h-4" />
                    : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Fullscreen"
                >
                  <Maximize className="w-4 h-4" />
                </button>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reel card ── */}
      <div className="flex gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 transition-colors">
        {/* Rank badge */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400">
          {rank}
        </div>

        {/* Thumbnail */}
        {reel.thumbnailUrl ? (
          <button
            onClick={() => { if (reel.videoUrl) setPlaying(true) }}
            className={clsx(
              'relative flex-shrink-0 group',
              reel.videoUrl ? 'cursor-pointer' : 'cursor-default',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/proxy-image?url=${encodeURIComponent(reel.thumbnailUrl)}`}
              alt=""
              className="w-16 h-24 rounded-lg object-cover"
            />
            {reel.videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg">
                <div className="bg-white/90 rounded-full p-1.5">
                  <Play className="w-4 h-4 text-slate-900 fill-slate-900" />
                </div>
              </div>
            )}
          </button>
        ) : (
          <div className="flex-shrink-0 w-16 h-24 rounded-lg bg-slate-700/50" />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Caption */}
          <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
            {reel.caption || '(no caption)'}
          </p>

          {/* Transcript */}
          {reel.transcript && (
            <div className="p-2 rounded-md bg-slate-900/60 border border-slate-700/50">
              <p className="text-[11px] text-slate-500 font-medium mb-0.5 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Transcript
              </p>
              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{reel.transcript}</p>
            </div>
          )}

          {/* Stats row */}
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
            <div className="ml-auto flex items-center gap-2">
              {!reel.transcript && (reel.audioUrl || reel.videoUrl) && (
                <button
                  onClick={onTranscribe}
                  disabled={isTranscribing}
                  className="flex items-center gap-1 text-xs text-slate-600 hover:text-violet-400 transition-colors disabled:opacity-40"
                >
                  {isTranscribing
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Transcribing…</>
                    : <><FileText className="w-3 h-3" /> Transcribe</>}
                </button>
              )}
              <a href={reel.url} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">
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
  onTranscribe, transcribingId,
}: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('views')

  const engRate = (r: Reel) => r.views > 0 ? (r.likes + r.comments) / r.views : 0
  const sorted = [...reels].sort((a, b) =>
    sortBy === 'engagement' ? engRate(b) - engRate(a) : b[sortBy] - a[sortBy]
  )
  const avgViews = reels.length > 0 ? reels.reduce((s, r) => s + r.views, 0) / reels.length : 0
  const avgEng = reels.length > 0
    ? reels.reduce((s, r) => s + (r.views > 0 ? (r.likes + r.comments) / r.views : 0), 0) / reels.length * 100
    : 0

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
      {/* ── Accordion header ── */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-800/60 transition-colors text-left"
      >
        <div className="text-slate-500 flex-shrink-0">
          {isExpanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />}
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
        {/* Action buttons — stopPropagation so they don't toggle the accordion */}
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

      {/* ── Error ── */}
      {error && (
        <div className="mx-5 mb-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Expanded body ── */}
      {isExpanded && (
        <>
          <div className="px-5 py-3 border-t border-slate-700/60">
            <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1 w-fit">
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
          </div>
          <div className="p-4 flex flex-col gap-3 max-h-[600px] overflow-y-auto border-t border-slate-700/60">
            {sorted.map((reel, i) => (
              <CompetitorReel
                key={reel.id}
                reel={reel}
                rank={i + 1}
                onTranscribe={() => onTranscribe(reel)}
                isTranscribing={transcribingId === reel.id}
              />
            ))}
            {reels.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">No data scraped yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
