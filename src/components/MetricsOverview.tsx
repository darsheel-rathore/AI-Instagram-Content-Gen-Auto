'use client'

import type { Reel } from '@/lib/types'
import { Eye, Heart, MessageCircle, TrendingUp, Zap, ThumbsDown, BarChart2, Star } from 'lucide-react'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toLocaleString()
}

function EngBadge({ pct }: { pct: number }) {
  const { label, cls } =
    pct >= 5 ? { label: 'Excellent', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' } :
    pct >= 3 ? { label: 'Good', cls: 'bg-sky-500/20 text-sky-400 border-sky-500/40' } :
    pct >= 1 ? { label: 'Average', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' } :
               { label: 'Low', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/40' }
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}

export default function MetricsOverview({ reels }: { reels: Reel[] }) {
  if (reels.length === 0) return null

  const totalViews    = reels.reduce((s, r) => s + r.views, 0)
  const totalLikes    = reels.reduce((s, r) => s + r.likes, 0)
  const totalComments = reels.reduce((s, r) => s + r.comments, 0)
  const avgViews      = totalViews / reels.length
  const avgEng        = reels.reduce((s, r) => s + (r.views > 0 ? (r.likes + r.comments) / r.views : 0), 0) / reels.length * 100

  const topReel  = reels.reduce((a, b) => (b.views > a.views ? b : a), reels[0])
  const topCount = reels.filter((r) => r.performance === 'top').length
  const midCount = reels.filter((r) => r.performance === 'mid' || !r.performance).length
  const lowCount = reels.filter((r) => r.performance === 'low').length

  const topPct = Math.round((topCount / reels.length) * 100)
  const midPct = Math.round((midCount / reels.length) * 100)
  const lowPct = 100 - topPct - midPct

  const likeRate = avgViews > 0 ? ((totalLikes / reels.length) / avgViews * 100).toFixed(1) : '0.0'

  return (
    <div className="mb-8 space-y-4">
      {/* ── Hero Banner ──────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-800/90 to-slate-900 p-6 sm:p-7">
        <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-10 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-amber-500/5 blur-2xl" />

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6 sm:divide-x divide-slate-700/50">

          {/* Total Reach */}
          <div className="sm:pr-6">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-sky-400" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Total Reach</span>
            </div>
            <div className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-2 tabular-nums">
              {fmt(totalViews)}
            </div>
            <div className="text-sm text-slate-500 mt-1.5">{reels.length} reels · {fmt(avgViews)} avg / reel</div>
            <div className="mt-4 h-1 rounded-full bg-slate-700/70 overflow-hidden">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400" />
            </div>
          </div>

          {/* Engagement Rate */}
          <div className="sm:px-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Engagement Rate</span>
            </div>
            <div className="flex items-end gap-3 mt-2">
              <div className="text-4xl sm:text-5xl font-black text-white tracking-tight tabular-nums">
                {avgEng.toFixed(2)}%
              </div>
              <div className="pb-1.5"><EngBadge pct={avgEng} /></div>
            </div>
            <div className="text-sm text-slate-500 mt-1.5">{fmt(totalLikes)} likes · {fmt(totalComments)} comments</div>
            {/* Performance distribution bar */}
            <div className="mt-4 flex h-1.5 rounded-full overflow-hidden gap-px">
              {topPct > 0 && (
                <div className="bg-amber-400" style={{ width: `${topPct}%`, borderRadius: midPct === 0 && lowPct === 0 ? '9999px' : '9999px 0 0 9999px' }} title={`Top ${topPct}%`} />
              )}
              {midPct > 0 && (
                <div className="bg-indigo-500" style={{ width: `${midPct}%` }} title={`Average ${midPct}%`} />
              )}
              {lowPct > 0 && (
                <div className="bg-rose-500" style={{ width: `${lowPct}%`, borderRadius: topPct === 0 && midPct === 0 ? '9999px' : '0 9999px 9999px 0' }} title={`Low ${lowPct}%`} />
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {topPct > 0 && <span className="text-[10px] text-amber-400/80 font-medium">{topPct}% top</span>}
              {midPct > 0 && <span className="text-[10px] text-indigo-400/80 font-medium">{midPct}% avg</span>}
              {lowPct > 0 && <span className="text-[10px] text-rose-400/80 font-medium">{lowPct}% low</span>}
            </div>
          </div>

          {/* Peak Reel */}
          <div className="sm:pl-6">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Peak Reel</span>
            </div>
            <div className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-2 tabular-nums">
              {fmt(topReel.views)}
            </div>
            <div className="text-sm text-slate-500 mt-1.5 line-clamp-1">
              {topReel.caption.slice(0, 52)}{topReel.caption.length > 52 ? '…' : ''}
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              <span className="text-[11px] text-amber-400 font-medium">
                {new Date(topReel.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ── Secondary stat cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            icon: <Heart className="w-4 h-4 text-rose-400" />,
            label: 'Total Likes',
            value: fmt(totalLikes),
            sub: `${likeRate}% like rate`,
            accent: 'border-rose-500/25 bg-rose-500/5',
          },
          {
            icon: <MessageCircle className="w-4 h-4 text-sky-400" />,
            label: 'Comments',
            value: fmt(totalComments),
            sub: `${(totalComments / reels.length).toFixed(0)} avg / reel`,
            accent: 'border-sky-500/25 bg-sky-500/5',
          },
          {
            icon: <BarChart2 className="w-4 h-4 text-violet-400" />,
            label: 'Avg Views',
            value: fmt(avgViews),
            sub: `across ${reels.length} reels`,
            accent: 'border-violet-500/25 bg-violet-500/5',
          },
          {
            icon: <Zap className="w-4 h-4 text-amber-400" />,
            label: 'Top Reels',
            value: String(topCount),
            sub: `${topPct}% of content`,
            accent: 'border-amber-500/25 bg-amber-500/5',
          },
          {
            icon: <ThumbsDown className="w-4 h-4 text-red-400" />,
            label: 'Low Reels',
            value: String(lowCount),
            sub: `${lowPct}% of content`,
            accent: 'border-red-500/25 bg-red-500/5',
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border ${s.accent} p-3.5 transition-colors hover:bg-white/5`}>
            <div className="flex items-center gap-1.5 mb-2.5">
              {s.icon}
              <span className="text-[11px] text-slate-500 font-medium">{s.label}</span>
            </div>
            <div className="text-xl font-bold text-white tabular-nums">{s.value}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
