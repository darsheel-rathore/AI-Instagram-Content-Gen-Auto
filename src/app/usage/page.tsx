'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, RefreshCw, DollarSign, Zap, Activity,
  Edit2, Check, X, Cpu, TrendingUp,
} from 'lucide-react'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | '3d' | '7d' | '15d' | '30d' | 'all'

interface UsageData {
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  totalCalls: number
  byFeature: Record<string, { tokens: number; cost: number; calls: number }>
  byProvider: Record<string, { inputTokens: number; outputTokens: number; cost: number; calls: number }>
  byDay: Record<string, { cost: number; inputTokens: number; outputTokens: number; calls: number }>
  balances: Record<string, { balance: number; currency: string; label?: string }>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '3d',    label: '3 Days' },
  { key: '7d',    label: '7 Days' },
  { key: '15d',   label: '15 Days' },
  { key: '30d',   label: '30 Days' },
  { key: 'all',   label: 'All Time' },
]

const FEATURE_LABELS: Record<string, string> = {
  'transcription':   'Transcription',
  'analysis':        'Reel Analysis',
  'content-ideas':   'Content Ideas',
  'pdf-generation':  'PDF Generation',
  'pdf-giveaway':    'PDF Giveaway',
  'ppt-generation':  'PPT Generation',
  'scraping':        'Instagram Scraping',
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Claude (Anthropic)',
  openai:    'OpenAI',
  gemini:    'Google Gemini',
  apify:     'Apify (Scraping)',
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#8b5cf6',
  openai:    '#10b981',
  gemini:    '#3b82f6',
  apify:     '#f97316',
}

const ALL_PROVIDERS = ['anthropic', 'openai', 'gemini', 'apify']

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtCost(n: number): string {
  if (n === 0) return '$0.00'
  if (n < 0.001) return `$${n.toFixed(5)}`
  if (n < 0.01)  return `$${n.toFixed(4)}`
  return `$${n.toFixed(3)}`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── SVG Line Area Chart ──────────────────────────────────────────────────────

function makeSmoothPath(xs: number[], ys: number[]): string {
  if (xs.length === 0) return ''
  if (xs.length === 1) return `M ${xs[0]} ${ys[0]}`
  let d = `M ${xs[0]} ${ys[0]}`
  for (let i = 0; i < xs.length - 1; i++) {
    const p0 = { x: xs[Math.max(0, i - 1)],            y: ys[Math.max(0, i - 1)] }
    const p1 = { x: xs[i],                              y: ys[i] }
    const p2 = { x: xs[i + 1],                          y: ys[i + 1] }
    const p3 = { x: xs[Math.min(xs.length - 1, i + 2)], y: ys[Math.min(xs.length - 1, i + 2)] }
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

function LineAreaChart({
  byDay,
}: {
  byDay: Record<string, { cost: number; inputTokens: number; outputTokens: number; calls: number }>
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const entries = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, d]) => ({ day, ...d }))

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <TrendingUp className="w-8 h-8 text-slate-800" />
        <p className="text-sm text-slate-600">No data for this period</p>
      </div>
    )
  }

  const W = 800
  const H = 220
  const PAD = { top: 24, right: 56, bottom: 36, left: 56 }
  const CW = W - PAD.left - PAD.right
  const CH = H - PAD.top - PAD.bottom

  const maxCost  = Math.max(...entries.map((d) => d.cost), 0.0001)
  const maxCalls = Math.max(...entries.map((d) => d.calls), 1)

  const pts = entries.map((d, i) => ({
    ...d,
    x:      entries.length === 1 ? PAD.left + CW / 2 : PAD.left + (i / (entries.length - 1)) * CW,
    yCost:  PAD.top + (1 - d.cost / maxCost) * CH,
    yCalls: PAD.top + (1 - d.calls / maxCalls) * CH,
  }))

  const xs          = pts.map((p) => p.x)
  const costLinePath  = makeSmoothPath(xs, pts.map((p) => p.yCost))
  const callsLinePath = makeSmoothPath(xs, pts.map((p) => p.yCalls))
  const areaPath = `${costLinePath} L ${pts[pts.length - 1].x},${PAD.top + CH} L ${pts[0].x},${PAD.top + CH} Z`

  const gridLevels = [0, 0.25, 0.5, 0.75, 1]
  const xStep      = Math.max(1, Math.ceil(entries.length / 7))
  const hovered    = hoverIdx !== null ? pts[hoverIdx] : null

  // Tooltip horizontal position: avoid edges
  function tooltipLeft(xSvgPct: number): string {
    if (xSvgPct < 0.2) return '0px'
    if (xSvgPct > 0.8) return 'auto'
    return `${xSvgPct * 100}%`
  }
  function tooltipRight(xSvgPct: number): string {
    if (xSvgPct > 0.8) return '0px'
    return 'auto'
  }
  function tooltipTransform(xSvgPct: number): string {
    if (xSvgPct < 0.2 || xSvgPct > 0.8) return 'none'
    return 'translateX(-50%)'
  }

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 240 }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const xSvg = ((e.clientX - rect.left) / rect.width) * W
          let best = 0, bestDist = Infinity
          pts.forEach((p, i) => {
            const dist = Math.abs(p.x - xSvg)
            if (dist < bestDist) { bestDist = dist; best = i }
          })
          setHoverIdx(best)
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#8b5cf6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lineGlowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#6d28d9" />
            <stop offset="50%"  stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLevels.map((t) => {
          const y = PAD.top + t * CH
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke="#1e293b" strokeWidth="1" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#475569" fontSize="10" fontFamily="monospace">
                {fmtCost(maxCost * (1 - t))}
              </text>
              <text x={W - PAD.right + 8} y={y + 4} textAnchor="start" fill="#92400e" fontSize="9" fontFamily="monospace" opacity="0.7">
                {Math.round(maxCalls * (1 - t))}
              </text>
            </g>
          )
        })}

        {/* Axis labels */}
        <text x={PAD.left - 8} y={PAD.top - 8} textAnchor="end" fill="#6d28d9" fontSize="8.5" fontFamily="sans-serif">cost ($)</text>
        <text x={W - PAD.right + 8} y={PAD.top - 8} textAnchor="start" fill="#92400e" fontSize="8.5" fontFamily="sans-serif">calls</text>

        {/* Area */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Calls line (dashed amber) */}
        <path d={callsLinePath} fill="none" stroke="#f59e0b" strokeWidth="1.5"
          strokeDasharray="5 4" strokeOpacity="0.55" />

        {/* Cost line glow */}
        <path d={costLinePath} fill="none" stroke="#6d28d9" strokeWidth="5" strokeOpacity="0.15" />
        {/* Cost line */}
        <path d={costLinePath} fill="none" stroke="url(#lineGlowGrad)" strokeWidth="2.5" />

        {/* Cost dots */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.yCost} r="5" fill="#7c3aed" opacity="0.15" />
            <circle cx={p.x} cy={p.yCost} r="3"   fill="#a78bfa" stroke="#0a0f1e" strokeWidth="1.5" />
          </g>
        ))}

        {/* Calls dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.yCalls} r="2.5" fill="#f59e0b" stroke="#0a0f1e" strokeWidth="1" opacity="0.6" />
        ))}

        {/* X axis labels */}
        {pts.filter((_, i) => i % xStep === 0).map((p, i) => (
          <text key={i} x={p.x} y={H - 6} textAnchor="middle" fill="#475569" fontSize="9.5" fontFamily="sans-serif">
            {p.day.slice(5).replace('-', '/')}
          </text>
        ))}

        {/* Hover vertical guide */}
        {hovered && (
          <>
            <line
              x1={hovered.x} y1={PAD.top} x2={hovered.x} y2={PAD.top + CH}
              stroke="#a78bfa" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.45"
            />
            <circle cx={hovered.x} cy={hovered.yCost}  r="6" fill="none" stroke="#a78bfa" strokeWidth="2" />
            <circle cx={hovered.x} cy={hovered.yCalls} r="5" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
          </>
        )}
      </svg>

      {/* Floating tooltip */}
      {hovered && (
        <div
          className="absolute top-2 pointer-events-none z-20"
          style={{
            left:      tooltipLeft(hovered.x / W),
            right:     tooltipRight(hovered.x / W),
            transform: tooltipTransform(hovered.x / W),
          }}
        >
          <div className="bg-[#0d1424] border border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-2xl min-w-[120px]">
            <p className="text-[10px] text-slate-500 mb-1.5 font-medium tracking-wide">{hovered.day}</p>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
              <span className="text-xs font-bold text-violet-300 tabular-nums">{fmtCost(hovered.cost)}</span>
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-300">{hovered.calls} call{hovered.calls !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />
              <span className="text-[10px] text-slate-500 tabular-nums">
                {fmtTokens((hovered.inputTokens ?? 0) + (hovered.outputTokens ?? 0))} tok
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 rounded-full" style={{ background: 'linear-gradient(to right, #6d28d9, #a78bfa)' }} />
          <span className="text-[10px] text-slate-500">Cost (left axis)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="32" height="4" viewBox="0 0 32 4">
            <line x1="0" y1="2" x2="32" y2="2" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.6" />
          </svg>
          <span className="text-[10px] text-slate-500">API Calls (right axis)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

// VIBGYOR heat scale: highest cost → Red, lowest → Violet
const HEAT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6']

function DonutChart({
  entries,
  total,
}: {
  entries: [string, { cost: number; calls: number }][]
  total: number
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  const CX = 64, CY = 64, MR = 42, SW = 16
  const CIRC = 2 * Math.PI * MR
  const GAP  = 2.5
  const POP  = 6   // SVG units to translate outward on hover

  let accumulated = 0
  const segments = entries.map(([feature, d], idx) => {
    const pct   = total > 0 ? d.cost / total : 0
    const color = HEAT_COLORS[Math.min(idx, HEAT_COLORS.length - 1)]

    // Mid-angle of this segment in radians (12-o'clock = start, clockwise)
    const midFrac    = accumulated + pct / 2
    const midRad     = (midFrac * 2 * Math.PI) - Math.PI / 2
    const dx         = Math.cos(midRad) * POP
    const dy         = Math.sin(midRad) * POP

    const seg = { feature, cost: d.cost, calls: d.calls, pct, offset: accumulated, color, dx, dy }
    accumulated += pct
    return seg
  })

  const totalCalls = segments.reduce((s, g) => s + g.calls, 0)
  const hovSeg     = hovered ? segments.find((s) => s.feature === hovered) ?? null : null

  if (!segments.length) {
    return <div className="flex items-center justify-center h-32"><p className="text-sm text-slate-600">No data</p></div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Donut + center label row */}
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <svg
            width="128" height="128" viewBox="0 0 128 128"
            style={{ overflow: 'visible' }}
          >
            {/* Track ring */}
            <circle cx={CX} cy={CY} r={MR} fill="none" stroke="#1e293b" strokeWidth={SW} />

            {/* Segments */}
            {segments.map((seg) => {
              const dash       = Math.max(0, seg.pct * CIRC - GAP)
              const dashOffset = CIRC * 0.25 - seg.offset * CIRC
              const isHov      = hovered === seg.feature
              const isDim      = hovered !== null && !isHov
              return (
                <circle
                  key={seg.feature}
                  cx={CX} cy={CY} r={MR}
                  fill="none"
                  strokeDasharray={`${dash} ${CIRC}`}
                  strokeDashoffset={dashOffset}
                  style={{
                    stroke:       seg.color,
                    strokeWidth:  isHov ? SW + 5 : SW,
                    opacity:      isDim ? 0.15 : 1,
                    transform:    isHov
                      ? `translate(${seg.dx}px, ${seg.dy}px)`
                      : 'translate(0px, 0px)',
                    filter:       isHov ? `drop-shadow(0 0 7px ${seg.color}cc)` : 'none',
                    transition:   'transform 0.22s ease, opacity 0.22s ease, stroke-width 0.22s ease, filter 0.22s ease',
                    cursor:       'pointer',
                  }}
                  onMouseEnter={() => setHovered(seg.feature)}
                  onMouseLeave={() => setHovered(null)}
                />
              )
            })}

            {/* Center text — updates on hover */}
            <text x={CX} y={CY - 10} textAnchor="middle" fill="white"
              fontSize={hovSeg ? '11' : '13'} fontWeight="700" fontFamily="monospace">
              {hovSeg ? fmtCost(hovSeg.cost) : fmtCost(total)}
            </text>
            <text x={CX} y={CY + 4} textAnchor="middle" fill="#64748b" fontSize="7.5" fontFamily="sans-serif">
              {hovSeg
                ? (FEATURE_LABELS[hovSeg.feature] ?? hovSeg.feature).replace(' ', '\n')
                : 'total spend'}
            </text>
            <text x={CX} y={CY + 16} textAnchor="middle" fill="#475569" fontSize="7.5" fontFamily="sans-serif">
              {hovSeg ? `${hovSeg.calls} calls` : `${totalCalls} calls`}
            </text>
            {hovSeg && (
              <text x={CX} y={CY + 27} textAnchor="middle" fill={hovSeg.color} fontSize="7" fontFamily="sans-serif">
                {(hovSeg.pct * 100).toFixed(1)}% of spend
              </text>
            )}
          </svg>
        </div>

        {/* Percentage label beside donut */}
        {hovSeg && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: hovSeg.color }}>
              {FEATURE_LABELS[hovSeg.feature] ?? hovSeg.feature}
            </p>
            <p className="text-xl font-bold text-white tabular-nums mt-0.5">{fmtCost(hovSeg.cost)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{hovSeg.calls} calls · {(hovSeg.pct * 100).toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* Legend rows */}
      <div className="space-y-1">
        {segments.map((seg) => {
          const isHov = hovered === seg.feature
          const isDim = hovered !== null && !isHov
          return (
            <div
              key={seg.feature}
              className="rounded-lg px-2 py-1.5 cursor-pointer select-none"
              style={{
                opacity:    isDim ? 0.3 : 1,
                transform:  isHov ? 'translateX(5px)' : 'translateX(0)',
                background: isHov ? `${seg.color}14` : 'transparent',
                borderLeft: isHov ? `2px solid ${seg.color}` : '2px solid transparent',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={() => setHovered(seg.feature)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center gap-2 min-w-0 mb-1">
                <div
                  className="flex-shrink-0 rounded-sm"
                  style={{
                    width:     isHov ? 10 : 8,
                    height:    isHov ? 10 : 8,
                    background: seg.color,
                    boxShadow:  isHov ? `0 0 6px ${seg.color}` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                />
                <span className={clsx(
                  'text-[11px] truncate flex-1 min-w-0 transition-colors duration-200',
                  isHov ? 'text-white font-semibold' : 'text-slate-400',
                )}>
                  {FEATURE_LABELS[seg.feature] ?? seg.feature}
                </span>
                <span className={clsx(
                  'text-[11px] flex-shrink-0 tabular-nums transition-colors duration-200',
                  isHov ? 'font-bold' : 'font-semibold text-slate-300',
                )} style={{ color: isHov ? seg.color : undefined }}>
                  {fmtCost(seg.cost)}
                </span>
              </div>
              <div className="h-1 bg-slate-900/80 rounded-full overflow-hidden ml-4">
                <div
                  className="h-full rounded-full"
                  style={{
                    width:     `${seg.pct * 100}%`,
                    background: seg.color,
                    boxShadow:  isHov ? `0 0 8px ${seg.color}99` : 'none',
                    transition: 'box-shadow 0.2s ease',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Token Split Bar ──────────────────────────────────────────────────────────

function TokenSplitBar({ input, output }: { input: number; output: number }) {
  const total    = input + output
  const inputPct = total > 0 ? (input / output) * 100 : 50
  const iPct     = total > 0 ? (input  / total) * 100 : 50
  const oPct     = 100 - iPct

  return (
    <div className="space-y-4">
      {/* Split bar */}
      <div className="flex h-5 rounded-lg overflow-hidden gap-px">
        <div
          className="flex items-center justify-center transition-all duration-700"
          style={{ width: `${iPct}%`, background: 'linear-gradient(to right, #2563eb, #3b82f6)' }}
        >
          {iPct > 15 && <span className="text-[8px] text-white font-semibold tracking-wide">IN</span>}
        </div>
        <div
          className="flex items-center justify-center transition-all duration-700"
          style={{ width: `${oPct}%`, background: 'linear-gradient(to right, #7c3aed, #a78bfa)' }}
        >
          {oPct > 15 && <span className="text-[8px] text-white font-semibold tracking-wide">OUT</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-[11px] text-slate-500">Input (prompt)</span>
          </div>
          <p className="text-xl font-bold text-white tabular-nums leading-tight">{fmtTokens(input)}</p>
          <p className="text-xs text-slate-600 mt-0.5">{iPct.toFixed(1)}% of total</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
            <span className="text-[11px] text-slate-500">Output (completion)</span>
          </div>
          <p className="text-xl font-bold text-white tabular-nums leading-tight">{fmtTokens(output)}</p>
          <p className="text-xs text-slate-600 mt-0.5">{oPct.toFixed(1)}% of total</p>
        </div>
      </div>

      {/* Ratio chip */}
      {input > 0 && output > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
          <span className="text-[10px] text-slate-600">I/O ratio</span>
          <span className="text-[10px] font-medium text-slate-400 tabular-nums">
            {(inputPct / 100).toFixed(1)}× more input than output
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Horizontal Bar (enhanced) ────────────────────────────────────────────────

function HorizBar({
  label, cost, calls, maxCost, color,
}: {
  label: string; cost: number; calls: number; maxCost: number; color: string
}) {
  const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-xs text-slate-300 truncate">{label}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className="text-[11px] text-slate-600">{calls} calls</span>
          <span className="text-xs font-semibold text-slate-200 tabular-nums">{fmtCost(cost)}</span>
        </div>
      </div>
      <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${color}99, ${color})`,
            boxShadow: `0 0 8px ${color}55`,
          }}
        />
      </div>
    </div>
  )
}

// ─── Balance Card ─────────────────────────────────────────────────────────────

function BalanceCard({
  provider, saved, spent, onSave,
}: {
  provider: string
  saved?: { balance: number; label?: string }
  spent: number
  onSave: (provider: string, balance: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [input,   setInput]   = useState(saved?.balance?.toString() ?? '')
  const [saving,  setSaving]  = useState(false)

  const color      = PROVIDER_COLORS[provider] ?? '#64748b'
  const name       = saved?.label ?? PROVIDER_LABELS[provider] ?? provider
  const bal        = saved?.balance
  const remaining  = bal !== undefined ? bal - spent : undefined
  const pctUsed    = bal !== undefined && bal > 0 ? Math.min(100, (spent / bal) * 100) : 0
  const overBudget = remaining !== undefined && remaining < 0

  const handleSave = async () => {
    const v = parseFloat(input)
    if (isNaN(v) || v < 0) return
    setSaving(true)
    await onSave(provider, v)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-sm font-semibold text-slate-200">{name}</span>
        </div>
        <button
          onClick={() => { setEditing(!editing); setInput(saved?.balance?.toString() ?? '') }}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          <Edit2 className="w-3 h-3" />
          {bal !== undefined ? 'Edit' : 'Set credit'}
        </button>
      </div>

      {editing && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
            <input
              type="number" min="0" step="0.01"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="0.00"
              autoFocus
              className="w-full bg-slate-900/70 border border-slate-700 rounded-lg pl-6 pr-3 py-1.5 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors disabled:opacity-50">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setEditing(false)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Credit balance</span>
          <span className="text-slate-400">{bal !== undefined ? fmtCost(bal) : '—'}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">Estimated spend</span>
          <span className="text-rose-400">{fmtCost(spent)}</span>
        </div>
        {bal !== undefined && (
          <>
            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pctUsed}%`, background: pctUsed > 80 ? '#ef4444' : pctUsed > 60 ? '#f59e0b' : color }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700">{pctUsed.toFixed(1)}% used</span>
              <span className={clsx('font-medium', overBudget ? 'text-rose-400' : 'text-emerald-400')}>
                {overBudget ? `${fmtCost(Math.abs(remaining!))} over` : `${fmtCost(remaining!)} left`}
              </span>
            </div>
          </>
        )}
        {bal === undefined && spent > 0 && (
          <p className="text-xs text-slate-700 italic">Set a credit balance to track remaining</p>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-slate-800/60', className)} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="w-7 h-7 rounded-lg" />
              <SkeletonBlock className="w-20 h-3" />
            </div>
            <SkeletonBlock className="w-24 h-7" />
            <SkeletonBlock className="w-32 h-3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-3">
            <SkeletonBlock className="w-full h-3" />
            <SkeletonBlock className="w-full h-3" />
            <SkeletonBlock className="w-full h-2" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
        <SkeletonBlock className="w-32 h-3 mb-4" />
        <SkeletonBlock className="w-full h-56" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-4">
            <SkeletonBlock className="w-28 h-3" />
            <SkeletonBlock className="w-full h-32" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('7d')
  const [data,   setData]   = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick,   setTick]   = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/usage?period=${period}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [period, tick])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveBalance = async (provider: string, balance: number) => {
    await fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, balance }),
    })
    setTick((t) => t + 1)
  }

  const featureEntries  = Object.entries(data?.byFeature  ?? {}).sort((a, b) => b[1].cost - a[1].cost)
  const providerEntries = Object.entries(data?.byProvider ?? {}).sort((a, b) => b[1].cost - a[1].cost)
  const maxFeatureCost  = featureEntries[0]?.[1].cost  ?? 0
  const maxProviderCost = providerEntries[0]?.[1].cost ?? 0

  const totalTokens = (data?.totalInputTokens ?? 0) + (data?.totalOutputTokens ?? 0)
  const isEmpty     = !loading && data?.totalCalls === 0

  const avgCostPerCall = data && data.totalCalls > 0
    ? data.totalCost / data.totalCalls : 0

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0a0f1e]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <div className="w-px h-4 bg-slate-800" />
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Token & Cost Usage</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setTick((t) => t + 1)}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-7">

        {/* ── Period filter ── */}
        <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 w-fit flex-wrap">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={clsx(
                'text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                period === key ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Skeleton ── */}
        {data === null && <LoadingSkeleton />}

        {/* ── Empty state ── */}
        {data !== null && isEmpty && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
            <Cpu className="w-10 h-10 text-slate-800 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">No usage tracked yet</p>
            <p className="text-slate-600 text-sm">
              Usage is logged automatically when you transcribe, analyze, generate ideas, or export PDFs.
            </p>
          </div>
        )}

        {/* ── Summary stats — 4 cards ── */}
        {data !== null && !isEmpty && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Spend',
                value: fmtCost(data.totalCost),
                sub: 'estimated cost',
                icon: DollarSign,
                color: 'text-violet-400',
                bg: 'bg-violet-500/10',
              },
              {
                label: 'Total Tokens',
                value: fmtTokens(totalTokens),
                sub: `${fmtTokens(data.totalInputTokens)} in · ${fmtTokens(data.totalOutputTokens)} out`,
                icon: Zap,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
              },
              {
                label: 'API Calls',
                value: data.totalCalls.toLocaleString(),
                sub: `${Object.keys(data.byProvider).length} provider${Object.keys(data.byProvider).length !== 1 ? 's' : ''}`,
                icon: Activity,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
              },
              {
                label: 'Avg Cost / Call',
                value: fmtCost(avgCostPerCall),
                sub: 'per API request',
                icon: TrendingUp,
                color: 'text-sky-400',
                bg: 'bg-sky-500/10',
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', stat.bg)}>
                    <stat.icon className={clsx('w-3.5 h-3.5', stat.color)} />
                  </div>
                  <span className="text-xs text-slate-500">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
                <p className="text-xs text-slate-600">{stat.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Provider balances ── */}
        {data !== null && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Provider Balances</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {ALL_PROVIDERS.map((p) => (
                <BalanceCard
                  key={p}
                  provider={p}
                  saved={data.balances?.[p]}
                  spent={data.byProvider?.[p]?.cost ?? 0}
                  onSave={handleSaveBalance}
                />
              ))}
            </div>
            <p className="text-xs text-slate-700 mt-2">
              Enter your credit balance per provider to track remaining budget.
            </p>
          </div>
        )}

        {/* ── Line area chart ── */}
        {data !== null && !isEmpty && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Daily Activity</p>
              <span className="text-xs text-slate-600">
                {Object.keys(data.byDay).length} day{Object.keys(data.byDay).length !== 1 ? 's' : ''}
              </span>
            </div>
            <LineAreaChart byDay={data.byDay} />
          </div>
        )}

        {/* ── Bottom 3-col grid ── */}
        {data !== null && !isEmpty && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Cost by feature — donut */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Cost by Feature</p>
              <DonutChart
                entries={featureEntries as [string, { cost: number; calls: number }][]}
                total={data.totalCost}
              />
            </div>

            {/* Provider breakdown */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Cost by Provider</p>
              {providerEntries.length > 0 ? (
                <div className="space-y-4">
                  {providerEntries.map(([provider, d]) => (
                    <HorizBar
                      key={provider}
                      label={PROVIDER_LABELS[provider] ?? provider}
                      cost={d.cost}
                      calls={d.calls}
                      maxCost={maxProviderCost}
                      color={PROVIDER_COLORS[provider] ?? '#6d28d9'}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No data</p>
              )}
            </div>

            {/* Token split */}
            {totalTokens > 0 && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Token Breakdown</p>
                <TokenSplitBar input={data.totalInputTokens} output={data.totalOutputTokens} />
              </div>
            )}
          </div>
        )}

        {/* ── Footnote ── */}
        <p className="text-xs text-slate-700 text-center pb-4">
          AI costs estimated from published token pricing; Whisper billed at $0.006/min.
          Apify costs are the exact USD from each completed scrape run.
          Always verify totals in your provider dashboard.
        </p>

      </div>
    </div>
  )
}
