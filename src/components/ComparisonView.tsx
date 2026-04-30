'use client'

import { useState } from 'react'
import type { Reel } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertCircle, ChevronDown, ChevronUp, Target, Zap } from 'lucide-react'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toLocaleString()
}

const THEME_KEYWORDS: Record<string, string[]> = {
  'AI & Tools':     ['ai', 'chatgpt', 'claude', 'gpt', 'llm', 'openai', 'gemini', 'cursor', 'artificial intelligence'],
  'Automation':     ['automate', 'automation', 'n8n', 'zapier', 'make.com', 'workflow', 'no-code', 'agentic'],
  'Business/Money': ['business', 'money', 'income', 'revenue', 'profit', 'earn', 'sales', 'client', 'freelance', 'lpa', 'salary'],
  'Tutorials':      ['how to', 'guide', 'tutorial', 'learn', 'tips', 'tricks', 'step by step', 'beginner'],
  'Content/Reels':  ['content', 'reel', 'video', 'editing', 'creator', 'viral', 'instagram', 'growth', 'followers'],
  'Coding/Dev':     ['code', 'coding', 'developer', 'software', 'app', 'build', 'deploy', 'api', 'tech', 'github'],
  'Productivity':   ['productive', 'save time', 'faster', 'efficient', 'replace', 'hours', 'workflow'],
  'Agency/Clients': ['agency', 'client', 'freelancer', 'retainer', 'proposal', 'leads', 'offer'],
}

function detectThemes(reels: Reel[]): Record<string, number> {
  const text = reels.map((r) => `${r.caption} ${r.transcript ?? ''}`).join(' ').toLowerCase()
  const scores: Record<string, number> = {}
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    scores[theme] = keywords.reduce((s, kw) => s + (text.split(kw).length - 1), 0)
  }
  return scores
}

function detectThemesTopReels(reels: Reel[]): Record<string, number> {
  const avg = reels.length > 0 ? reels.reduce((s, r) => s + r.views, 0) / reels.length : 0
  const topReels = reels.filter((r) => r.views >= avg)
  return detectThemes(topReels.length > 0 ? topReels : reels)
}

const ACCOUNT_COLORS = [
  '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981',
  '#f97316', '#ec4899', '#14b8a6', '#a855f7',
  '#ef4444', '#3b82f6',
]
function colorFor(i: number) { return ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }

const MAX_DEFAULT_COMPETITORS = 3

interface Props {
  myReels: Reel[]
  competitors: Record<string, Reel[]>
  myUsername?: string
}

export default function ComparisonView({ myReels, competitors, myUsername = process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'me' }: Props) {
  const [showAll, setShowAll] = useState(false)

  const allCompetitorEntries = Object.entries(competitors).reverse()
  const hasMore = allCompetitorEntries.length > MAX_DEFAULT_COMPETITORS
  const visibleEntries = showAll ? allCompetitorEntries : allCompetitorEntries.slice(0, MAX_DEFAULT_COMPETITORS)

  const allAccounts = [
    { username: myUsername, reels: myReels, isMe: true },
    ...visibleEntries.map(([username, reels]) => ({ username, reels, isMe: false })),
  ].filter((a) => a.reels.length > 0)

  if (allAccounts.length < 2) {
    return (
      <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-5 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>Fetch your reels and at least one competitor to see the comparison.</span>
      </div>
    )
  }

  // ─── Metrics ────────────────────────────────────────────────────────────────
  const metrics = allAccounts.map((a, i) => {
    const avg = a.reels.reduce((s, r) => s + r.views, 0) / a.reels.length
    const avgEng = a.reels.reduce((s, r) => s + (r.views > 0 ? (r.likes + r.comments) / r.views : 0), 0) / a.reels.length * 100
    const topReel = a.reels.reduce((best, r) => r.views > best.views ? r : best, a.reels[0])
    return { ...a, avgViews: avg, avgEng, topReel, color: colorFor(i) }
  })

  const meMetrics = metrics[0]
  const chartData = metrics.map((m) => ({
    name: `@${m.username}`,
    views: Math.round(m.avgViews),
    color: m.color,
  }))

  // ─── Theme analysis ──────────────────────────────────────────────────────────
  // Absolute keyword mention counts from top-performing reels only
  const accountThemes = metrics.map((m) => ({
    username: m.username,
    isMe: m.isMe,
    color: m.color,
    themes: detectThemesTopReels(m.reels),
  }))

  // Build theme rows sorted by total mentions across all accounts, drop zero-signal themes
  const themeRows = Object.keys(THEME_KEYWORDS)
    .map((theme) => {
      const scores = accountThemes.map((a) => ({ username: a.username, score: a.themes[theme] ?? 0, color: a.color, isMe: a.isMe }))
      const total = scores.reduce((s, x) => s + x.score, 0)
      return { theme, scores, total }
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)

  // Flat data for the grouped bar chart (one row = one theme, one Bar series = one account)
  const themeChartData = themeRows.slice(0, 7).map(({ theme, scores }) => {
    const row: Record<string, string | number> = { theme }
    for (const s of scores) row[s.username] = s.score
    return row
  })

  // ─── Strengths & Gaps ───────────────────────────────────────────────────────
  const myThemes = accountThemes[0].themes
  const competitorThemes: Record<string, number> = {}
  for (const a of accountThemes.slice(1)) {
    for (const [theme, score] of Object.entries(a.themes)) {
      competitorThemes[theme] = (competitorThemes[theme] ?? 0) + score
    }
  }
  const numCompetitors = accountThemes.length - 1

  // Strengths: themes where YOU have the most content
  const strengths = Object.keys(THEME_KEYWORDS)
    .filter((t) => (myThemes[t] ?? 0) > 0)
    .sort((a, b) => (myThemes[b] ?? 0) - (myThemes[a] ?? 0))
    .slice(0, 4)

  // Gaps: themes competitors cover heavily but you don't
  const gaps = Object.keys(THEME_KEYWORDS)
    .filter((t) => {
      const compAvg = numCompetitors > 0 ? (competitorThemes[t] ?? 0) / numCompetitors : 0
      return compAvg > 3 && (myThemes[t] ?? 0) < compAvg * 0.5
    })
    .sort((a, b) => (competitorThemes[b] ?? 0) - (competitorThemes[a] ?? 0))
    .slice(0, 4)

  return (
    <div className="space-y-6">

      {/* ── Show all toggle ── */}
      {hasMore && (
        <div className="flex items-center justify-between bg-slate-800/40 border border-slate-700/60 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-400">
            Showing <span className="text-white font-semibold">{showAll ? allCompetitorEntries.length : Math.min(MAX_DEFAULT_COMPETITORS, allCompetitorEntries.length)}</span> of <span className="text-white font-semibold">{allCompetitorEntries.length}</span> competitors
          </p>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium"
          >
            {showAll
              ? <><ChevronUp className="w-3.5 h-3.5" /> Show fewer</>
              : <><ChevronDown className="w-3.5 h-3.5" /> Show all {allCompetitorEntries.length} creators</>}
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div key={m.username} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 mb-3 min-w-0">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: m.color }} />
              <span className={`font-semibold text-sm truncate ${m.isMe ? 'text-amber-300' : 'text-slate-300'}`}>
                @{m.username} {m.isMe && <span className="text-xs text-slate-500 ml-1">(you)</span>}
              </span>
            </div>
            <div className="text-2xl font-black text-white tracking-tight">{fmt(m.avgViews)}</div>
            <div className="text-xs text-slate-500 mb-2">avg views / reel</div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-emerald-400 font-medium">{m.avgEng.toFixed(1)}%</span>
              <span className="text-slate-600 text-xs">eng. rate</span>
            </div>
            {i > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                {m.avgViews > meMetrics.avgViews ? (
                  <div className="flex items-center gap-1 text-xs text-rose-400">
                    <TrendingUp className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{Math.round(((m.avgViews - meMetrics.avgViews) / meMetrics.avgViews) * 100)}% more views</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <TrendingDown className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">You&apos;re ahead by {Math.round(((meMetrics.avgViews - m.avgViews) / m.avgViews) * 100)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Avg views bar chart (fixed: one Bar + Cell per account) ── */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Avg Views per Reel</h3>
        <p className="text-xs text-slate-500 mb-4">Average views across all reels for each account</p>
        <ResponsiveContainer width="100%" height={Math.max(160, metrics.length * 44)}>
          <BarChart data={chartData} layout="vertical" barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={140} />
            <Tooltip
              formatter={(v: number) => [fmt(v), 'Avg Views']}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 2 }}
              itemStyle={{ color: '#94a3b8' }}
              cursor={{ fill: 'rgba(148,163,184,0.06)' }}
            />
            <Bar dataKey="views" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {chartData.map((entry, i) => (
                <Cell key={entry.name} fill={colorFor(i)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Content theme breakdown — grouped bar chart ── */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-sm font-semibold text-slate-300">Content Theme Breakdown</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Keyword mentions in captions + transcripts of each account&apos;s top-performing reels
            </p>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {accountThemes.map((a, i) => (
              <div key={a.username} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: colorFor(i) }} />
                <span className="text-xs text-slate-400">@{a.username}{a.isMe ? ' (you)' : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {themeChartData.length === 0 ? (
          <p className="text-xs text-slate-500 italic mt-4">
            No theme signals detected — works best when reels have English captions or transcripts.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, themeChartData.length * 52)}>
            <BarChart data={themeChartData} layout="vertical" barGap={2} barCategoryGap="32%" margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="theme"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={115}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [`${value} mention${value !== 1 ? 's' : ''}`, `@${name}`]}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              {accountThemes.map((a, i) => (
                <Bar key={a.username} dataKey={a.username} name={a.username} fill={colorFor(i)} radius={[0, 3, 3, 0]} maxBarSize={13} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Strengths & Gaps ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Strengths */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-emerald-300">What you post most about</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Topics that appear most in <span className="text-slate-400">your</span> top-performing reels. These are your niche pillars.
          </p>
          {strengths.length > 0 ? (
            <div className="space-y-3">
              {strengths.map((t, i) => {
                const score = myThemes[t] ?? 0
                const maxScore = myThemes[strengths[0]] ?? 1
                return (
                  <div key={t}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300 font-medium">{t}</span>
                      <span className="text-xs text-slate-500">{score} mentions</span>
                    </div>
                    <div className="h-1.5 bg-slate-700/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500/60 rounded-full"
                        style={{ width: `${(score / maxScore) * 100}%` }}
                      />
                    </div>
                    {i === 0 && <p className="text-xs text-emerald-600 mt-0.5">Your strongest theme</p>}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No theme signals found. Add captions or transcripts to your reels for this to work.</p>
          )}
        </div>

        {/* Gaps */}
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-rose-300">Topics competitors win that you don&apos;t cover</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Themes where competitors post heavily but your reels rarely touch. These are content opportunities.
          </p>
          {gaps.length > 0 ? (
            <div className="space-y-3">
              {gaps.map((t) => {
                const compAvg = numCompetitors > 0 ? Math.round((competitorThemes[t] ?? 0) / numCompetitors) : 0
                const mine = myThemes[t] ?? 0
                return (
                  <div key={t}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300 font-medium">{t}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500/60 flex-shrink-0" />
                        <span className="text-slate-400">Competitors avg: <span className="text-rose-300 font-medium">{compAvg} mentions</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-slate-600 flex-shrink-0" />
                        <span className="text-slate-400">You: <span className="text-slate-300 font-medium">{mine}</span></span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No significant gaps detected — you&apos;re keeping up across all topics competitors cover.</p>
          )}
        </div>

      </div>

      {/* ── Top reel per account ── */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/60">
          <h3 className="text-sm font-semibold text-slate-300">Top Reel per Account</h3>
        </div>
        <div className="divide-y divide-slate-700/40">
          {metrics.map((m) => (
            <div key={m.username} className="flex gap-4 p-4 items-start">
              <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: m.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-200 truncate">@{m.username}</span>
                  {m.isMe && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded flex-shrink-0">you</span>}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-2">{m.topReel.caption || '(no caption)'}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="text-white font-semibold">{fmt(m.topReel.views)} views</span>
                  <span>❤️ {fmt(m.topReel.likes)}</span>
                  <a href={m.topReel.url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline ml-auto">View →</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
