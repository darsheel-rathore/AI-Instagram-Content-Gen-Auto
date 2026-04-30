'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, RefreshCw, DollarSign, Zap, Activity,
  Edit2, Check, X, BarChart2, Cpu,
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
  'transcription':  'Transcription',
  'analysis':       'Reel Analysis',
  'content-ideas':  'Content Ideas',
  'pdf-generation': 'PDF Generation',
  'scraping':       'Instagram Scraping',
}

const FEATURE_COLORS: Record<string, string> = {
  'transcription':  '#3b82f6',
  'analysis':       '#8b5cf6',
  'content-ideas':  '#10b981',
  'pdf-generation': '#f59e0b',
  'scraping':       '#f97316',
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

// ─── Daily Bar Chart ──────────────────────────────────────────────────────────

function DailyBarChart({
  byDay,
}: {
  byDay: Record<string, { cost: number; calls: number }>
}) {
  const entries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]))

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center h-36 gap-2">
        <BarChart2 className="w-8 h-8 text-slate-800" />
        <p className="text-sm text-slate-600">No data for this period</p>
      </div>
    )
  }

  const maxCost = Math.max(...entries.map(([, d]) => d.cost), 0.0001)

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-32 w-full overflow-x-auto pb-0 relative">
        {/* Baseline */}
        <div className="absolute bottom-0 left-0 right-0 border-b border-slate-700/40" />
        {entries.map(([day, d]) => {
          const pct = (d.cost / maxCost) * 100
          const label = day.slice(5).replace('-', '/')
          return (
            <div
              key={day}
              className="flex-1 min-w-[18px] max-w-[48px] flex flex-col items-center h-full justify-end group cursor-default"
              title={`${day}\n${fmtCost(d.cost)} · ${d.calls} call${d.calls !== 1 ? 's' : ''}`}
            >
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${pct}%`,
                  minHeight: d.cost > 0 ? 2 : 0,
                  background: 'linear-gradient(to top, #6d28d9, #8b5cf6)',
                  opacity: 0.75,
                }}
              />
            </div>
          )
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-1 mt-1.5 overflow-hidden">
        {entries.map(([day]) => (
          <div key={day} className="flex-1 min-w-[18px] max-w-[48px] text-center">
            <span className="text-[8px] text-slate-600 leading-none">
              {day.slice(5).replace('-', '/')}
            </span>
          </div>
        ))}
      </div>
      {/* Y hint */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-slate-700">$0</span>
        <span className="text-[9px] text-slate-700">{fmtCost(maxCost)}</span>
      </div>
    </div>
  )
}

// ─── Horizontal Bar Row ───────────────────────────────────────────────────────

function HorizBar({
  label,
  cost,
  calls,
  maxCost,
  color,
}: {
  label: string
  cost: number
  calls: number
  maxCost: number
  color: string
}) {
  const pct = maxCost > 0 ? (cost / maxCost) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-xs text-slate-300">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600">{calls} calls</span>
          <span className="text-xs font-medium text-slate-300">{fmtCost(cost)}</span>
        </div>
      </div>
      <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ─── Balance Card ─────────────────────────────────────────────────────────────

function BalanceCard({
  provider,
  saved,
  spent,
  onSave,
}: {
  provider: string
  saved?: { balance: number; label?: string }
  spent: number
  onSave: (provider: string, balance: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState(saved?.balance?.toString() ?? '')
  const [saving, setSaving]   = useState(false)

  const color  = PROVIDER_COLORS[provider] ?? '#64748b'
  const name   = saved?.label ?? PROVIDER_LABELS[provider] ?? provider
  const bal    = saved?.balance
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
      {/* Header */}
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

      {/* Edit row */}
      {editing && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="0.00"
              autoFocus
              className="w-full bg-slate-900/70 border border-slate-700 rounded-lg pl-6 pr-3 py-1.5 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stats */}
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
                style={{
                  width: `${pctUsed}%`,
                  background: pctUsed > 80 ? '#ef4444' : pctUsed > 60 ? '#f59e0b' : color,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700">{pctUsed.toFixed(1)}% used</span>
              <span className={clsx('font-medium', overBudget ? 'text-rose-400' : 'text-emerald-400')}>
                {overBudget
                  ? `${fmtCost(Math.abs(remaining!))} over`
                  : `${fmtCost(remaining!)} left`}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const [period, setPeriod]   = useState<Period>('7d')
  const [data, setData]       = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick]       = useState(0)

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

  // ── Derived ────────────────────────────────────────────────────────────────

  const featureEntries = Object.entries(data?.byFeature ?? {}).sort((a, b) => b[1].cost - a[1].cost)
  const maxFeatureCost = featureEntries[0]?.[1].cost ?? 0

  const providerEntries = Object.entries(data?.byProvider ?? {}).sort((a, b) => b[1].cost - a[1].cost)
  const maxProviderCost = providerEntries[0]?.[1].cost ?? 0

  const totalTokens = (data?.totalInputTokens ?? 0) + (data?.totalOutputTokens ?? 0)
  const inputPct    = totalTokens > 0 ? (data!.totalInputTokens  / totalTokens) * 100 : 50
  const outputPct   = totalTokens > 0 ? (data!.totalOutputTokens / totalTokens) * 100 : 50

  const isEmpty = !loading && data?.totalCalls === 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0a0f1e]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Dashboard</span>
          </a>
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-7">

        {/* ── Period filter ── */}
        <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 w-fit flex-wrap">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={clsx(
                'text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                period === key
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Empty state ── */}
        {isEmpty && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
            <Cpu className="w-10 h-10 text-slate-800 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">No usage tracked yet</p>
            <p className="text-slate-600 text-sm">
              Usage is logged automatically when you transcribe, analyze, generate ideas, or export PDFs.
            </p>
          </div>
        )}

        {/* ── Summary stats ── */}
        {!isEmpty && (
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Total Spend',
                value: data ? fmtCost(data.totalCost) : '—',
                sub: 'estimated',
                icon: DollarSign,
                color: 'text-violet-400',
                bg: 'bg-violet-500/10',
              },
              {
                label: 'Total Tokens',
                value: data ? fmtTokens(totalTokens) : '—',
                sub: data ? `${fmtTokens(data.totalInputTokens)} in · ${fmtTokens(data.totalOutputTokens)} out` : '',
                icon: Zap,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
              },
              {
                label: 'API Calls',
                value: data?.totalCalls?.toLocaleString() ?? '—',
                sub: `across ${Object.keys(data?.byProvider ?? {}).length} provider${Object.keys(data?.byProvider ?? {}).length !== 1 ? 's' : ''}`,
                icon: Activity,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', stat.bg)}>
                    <stat.icon className={clsx('w-3.5 h-3.5', stat.color)} />
                  </div>
                  <span className="text-xs text-slate-500">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
                {stat.sub && <p className="text-xs text-slate-600">{stat.sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* ── Provider balances ── */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Provider Balances
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ALL_PROVIDERS.map((p) => (
              <BalanceCard
                key={p}
                provider={p}
                saved={data?.balances?.[p]}
                spent={data?.byProvider?.[p]?.cost ?? 0}
                onSave={handleSaveBalance}
              />
            ))}
          </div>
          <p className="text-xs text-slate-700 mt-2">
            Enter your credit balance per provider to track remaining budget. Spend is estimated from logged usage.
          </p>
        </div>

        {/* ── Daily spend chart ── */}
        {!isEmpty && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Daily Spend
              </p>
              {data && (
                <span className="text-xs text-slate-600">
                  {Object.keys(data.byDay).length} day{Object.keys(data.byDay).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {data ? (
              <DailyBarChart byDay={data.byDay} />
            ) : (
              <div className="h-36 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* ── Feature + Provider breakdown ── */}
        {!isEmpty && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Feature breakdown */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Usage by Feature
              </p>
              {featureEntries.length > 0 ? (
                <div className="space-y-3.5">
                  {featureEntries.map(([feature, d]) => (
                    <HorizBar
                      key={feature}
                      label={FEATURE_LABELS[feature] ?? feature}
                      cost={d.cost}
                      calls={d.calls}
                      maxCost={maxFeatureCost}
                      color={FEATURE_COLORS[feature] ?? '#6d28d9'}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600">No data</p>
              )}
            </div>

            {/* Provider breakdown */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Usage by Provider
              </p>
              {providerEntries.length > 0 ? (
                <div className="space-y-3.5">
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
          </div>
        )}

        {/* ── Token breakdown ── */}
        {!isEmpty && totalTokens > 0 && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Token Breakdown
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-500">Input (prompt)</span>
                  <span className="text-xs font-semibold text-white">{fmtTokens(data!.totalInputTokens)}</span>
                </div>
                <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-700"
                    style={{ width: `${inputPct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-700 mt-1">{inputPct.toFixed(1)}% of total</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-500">Output (completion)</span>
                  <span className="text-xs font-semibold text-white">{fmtTokens(data!.totalOutputTokens)}</span>
                </div>
                <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-700"
                    style={{ width: `${outputPct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-700 mt-1">{outputPct.toFixed(1)}% of total</p>
              </div>
            </div>
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
