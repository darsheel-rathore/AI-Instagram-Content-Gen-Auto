'use client'

import { useState } from 'react'
import type { Reel } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return String(Math.round(n))
}

type Metric = 'views' | 'likes' | 'comments' | 'engagement'

const METRIC_CONFIG: Record<Metric, {
  label: string
  accent: string
  from: string
  fmt: (n: number) => string
}> = {
  views:      { label: 'Views',      accent: '#38bdf8', from: '#0ea5e9', fmt: fmtNum },
  likes:      { label: 'Likes',      accent: '#fb7185', from: '#e11d48', fmt: fmtNum },
  comments:   { label: 'Comments',   accent: '#a78bfa', from: '#7c3aed', fmt: (n) => String(Math.round(n)) },
  engagement: { label: 'Eng. Rate',  accent: '#fbbf24', from: '#d97706', fmt: (n) => n.toFixed(2) + '%' },
}

const PERF_COLOR = { top: '#f59e0b', mid: '#6366f1', low: '#f43f5e' }

// Reel-count windows for the chart. Anything larger than the number of reels
// actually loaded is disabled rather than hidden, so the row doesn't reflow
// every time a re-sync changes the count.
const REEL_WINDOWS = [7, 14, 21, 30, 60] as const
type ReelWindow = (typeof REEL_WINDOWS)[number] | 'all'

interface Entry {
  name: string
  views: number
  likes: number
  comments: number
  engagement: number
  caption: string
  performance: string
}

function CustomTooltip({
  active, payload, activeMetric,
}: {
  active?: boolean
  payload?: { payload: Entry }[]
  activeMetric: Metric
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const cfg = METRIC_CONFIG[activeMetric]
  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3.5 text-xs max-w-64 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.accent }} />
        <span className="font-semibold text-white">{d.name}</span>
        <span className="ml-auto font-bold tabular-nums" style={{ color: cfg.accent }}>
          {cfg.fmt(d[activeMetric])}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <span className="text-sky-400">Views</span>      <span className="text-white font-medium text-right tabular-nums">{fmtNum(d.views)}</span>
        <span className="text-rose-400">Likes</span>     <span className="text-white font-medium text-right tabular-nums">{fmtNum(d.likes)}</span>
        <span className="text-violet-400">Comments</span><span className="text-white font-medium text-right tabular-nums">{d.comments}</span>
        <span className="text-amber-400">Eng. Rate</span><span className="text-white font-medium text-right tabular-nums">{d.engagement.toFixed(2)}%</span>
      </div>
      {d.caption && (
        <p className="text-slate-500 mt-2.5 leading-relaxed border-t border-slate-700/60 pt-2 line-clamp-2">
          {d.caption}
        </p>
      )}
    </div>
  )
}

export default function PerformanceChart({ reels }: { reels: Reel[] }) {
  const [metric, setMetric] = useState<Metric>('views')
  const [reelWindow, setReelWindow] = useState<ReelWindow>('all')
  if (reels.length === 0) return null

  const cfg = METRIC_CONFIG[metric]

  const sorted = [...reels].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  // Windowing keeps chronological order and takes the most RECENT n reels —
  // #1 is then the oldest reel still in view, not the oldest overall.
  const visible = reelWindow === 'all' ? sorted : sorted.slice(-reelWindow)
  const data: Entry[] = visible.map((r, i) => ({
    name: `#${i + 1}`,
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    engagement: r.views > 0 ? ((r.likes + r.comments) / r.views) * 100 : 0,
    caption: r.caption.slice(0, 80),
    performance: r.performance ?? 'mid',
  }))

  const maxVal  = Math.max(...data.map((d) => d[metric]))
  const avgVal  = data.reduce((s, d) => s + d[metric], 0) / data.length

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/80 p-5 sm:p-6 mb-8">
      {/* Background glow accent */}
      <div
        className="pointer-events-none absolute -top-8 right-0 w-80 h-52 rounded-full blur-3xl opacity-[0.07] transition-all duration-700"
        style={{ background: cfg.from }}
      />

      {/* Header row */}
      <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Performance by Reel</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronological order · color = performance tier
            {reelWindow !== 'all' && ` · last ${data.length} of ${reels.length}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reel-count window */}
          <div className="flex items-center gap-0.5 bg-slate-800/80 rounded-lg p-1 border border-slate-700/50 flex-shrink-0">
            {REEL_WINDOWS.map((n) => {
              const active = reelWindow === n
              const disabled = n >= reels.length
              return (
                <button
                  key={n}
                  onClick={() => setReelWindow(n)}
                  disabled={disabled}
                  title={disabled ? `Only ${reels.length} reels loaded` : `Last ${n} reels`}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 tabular-nums ${
                    active
                      ? 'bg-slate-200 text-slate-900 font-semibold shadow-sm'
                      : disabled
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/40'
                  }`}
                >
                  {n}
                </button>
              )
            })}
            <button
              onClick={() => setReelWindow('all')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                reelWindow === 'all'
                  ? 'bg-slate-200 text-slate-900 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/40'
              }`}
            >
              All
            </button>
          </div>

          {/* Metric switcher */}
          <div className="flex items-center gap-0.5 bg-slate-800/80 rounded-lg p-1 border border-slate-700/50 flex-shrink-0">
            {(Object.keys(METRIC_CONFIG) as Metric[]).map((m) => {
              const active = metric === m
              const c = METRIC_CONFIG[m]
              return (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    active ? 'text-slate-900 font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/40'
                  }`}
                  style={active ? { background: c.accent } : {}}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barCategoryGap="30%" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cfg.accent} />
              <stop offset="100%" stopColor={cfg.from} stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="barGradientPeak" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cfg.accent} stopOpacity={1} />
              <stop offset="100%" stopColor={cfg.from} stopOpacity={0.9} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={cfg.fmt}
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            content={<CustomTooltip activeMetric={metric} />}
            cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 4 }}
          />
          <ReferenceLine
            y={avgVal}
            stroke={cfg.accent}
            strokeDasharray="5 4"
            strokeOpacity={0.45}
            label={{
              value: `avg ${cfg.fmt(avgVal)}`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: cfg.accent,
              opacity: 0.75,
            }}
          />
          <Bar dataKey={metric} radius={[5, 5, 0, 0]} maxBarSize={44}>
            {data.map((d, i) => {
              const isPeak = d[metric] === maxVal
              return (
                <Cell
                  key={i}
                  fill={isPeak ? 'url(#barGradientPeak)' : PERF_COLOR[d.performance as keyof typeof PERF_COLOR]}
                  opacity={isPeak ? 1 : 0.72}
                  stroke={isPeak ? cfg.accent : 'none'}
                  strokeWidth={isPeak ? 1 : 0}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-slate-800">
        {(['top', 'mid', 'low'] as const).map((p) => (
          <div key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: PERF_COLOR[p] }} />
            {p === 'top' ? 'Top performer' : p === 'mid' ? 'Average' : 'Low performer'}
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
          <span
            className="w-5 inline-block border-t-2 border-dashed"
            style={{ borderColor: cfg.accent, opacity: 0.5 }}
          />
          Avg {cfg.label.toLowerCase()}
        </div>
      </div>
    </div>
  )
}
