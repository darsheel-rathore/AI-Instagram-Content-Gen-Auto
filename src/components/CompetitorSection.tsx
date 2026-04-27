'use client'

import { useState } from 'react'
import type { Reel } from '@/lib/types'
import {
  Eye, Heart, MessageCircle, ExternalLink, TrendingUp,
  ChevronDown, ChevronRight, RefreshCw, X, Clock, AlertCircle,
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
}

function CompetitorReel({ reel, rank }: { reel: Reel; rank: number }) {
  const engRate = reel.views > 0
    ? (((reel.likes + reel.comments) / reel.views) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="flex gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 transition-colors">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400">
        {rank}
      </div>
      {reel.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/proxy-image?url=${encodeURIComponent(reel.thumbnailUrl)}`}
          alt=""
          className="flex-shrink-0 w-12 h-16 rounded object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-2">
          {reel.caption || '(no caption)'}
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
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
          <a href={reel.url} target="_blank" rel="noopener noreferrer" className="ml-auto hover:text-slate-300">
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

export default function CompetitorSection({
  username, reels, isExpanded, onToggle, lastSynced, isLoading, error, onResync, onRemove,
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
          <div className="p-4 flex flex-col gap-2.5 max-h-[500px] overflow-y-auto border-t border-slate-700/60">
            {sorted.map((reel, i) => (
              <CompetitorReel key={reel.id} reel={reel} rank={i + 1} />
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
