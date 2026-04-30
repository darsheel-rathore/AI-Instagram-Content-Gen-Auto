'use client'

import { useState, useEffect } from 'react'
import {
  Layers, Plus, Clock, BarChart2, Sparkles, Star, Trash2,
  AlertCircle, Loader2, Camera, MessageCircle, Mail,
  CheckCircle, Circle, ChevronDown, ChevronUp, Edit3, X, Check,
} from 'lucide-react'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

type AIProvider = 'anthropic' | 'openai' | 'gemini'
type ViewTab = 'create' | 'upcoming' | 'history'

interface StoryActivity {
  platform: 'instagram' | 'whatsapp' | 'email'
  type: string
  content: string
  timing?: string
}

interface StoryDay {
  dayOfWeek: string
  label: string
  activities: StoryActivity[]
}

interface WeeklyStrategy {
  summary: string
  weekTheme?: string
  days: StoryDay[]
}

interface PostCampaign {
  rating: number
  reach: number
  notes: string
  completedAt: string
}

interface StoryRecord {
  id: string
  title: string
  description: string
  targetAudience: string
  weekStart: string
  createdAt: string
  prompt?: string
  provider?: string
  model?: string
  strategy?: WeeklyStrategy
  postCampaign?: PostCampaign
  checkedActivities?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_MODELS: Record<AIProvider, { id: string; label: string; cost: string }[]> = {
  anthropic: [
    { id: 'claude-opus-4-7', label: 'Opus 4.7', cost: 'expensive' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', cost: 'moderate' },
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', cost: 'cheap' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o', cost: 'expensive' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', cost: 'cheap' },
  ],
  gemini: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', cost: 'expensive' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', cost: 'moderate' },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', cost: 'cheap' },
  ],
}

const DEFAULT_MODEL: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}

const COST_DOT: Record<string, string> = {
  expensive: 'bg-rose-500',
  moderate: 'bg-amber-500',
  cheap: 'bg-emerald-500',
}

const PLATFORM_STYLES: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  instagram: { label: 'Instagram', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20', icon: <Camera className="w-3 h-3" /> },
  whatsapp:  { label: 'WhatsApp',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <MessageCircle className="w-3 h-3" /> },
  email:     { label: 'Email',     color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', icon: <Mail className="w-3 h-3" /> },
}

const DAY_COLORS = [
  'border-violet-500/30 bg-violet-500/5',
  'border-blue-500/30 bg-blue-500/5',
  'border-pink-500/30 bg-pink-500/5',
  'border-amber-500/30 bg-amber-500/5',
  'border-emerald-500/30 bg-emerald-500/5',
  'border-rose-500/30 bg-rose-500/5',
  'border-sky-500/30 bg-sky-500/5',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProviderModelPicker({
  provider, model, onChange,
}: {
  provider: AIProvider
  model: string
  onChange: (p: AIProvider, m: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {(['anthropic', 'openai', 'gemini'] as AIProvider[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p, DEFAULT_MODEL[p])}
          className={clsx(
            'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
            provider === p
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
              : 'border-slate-700 text-slate-500 hover:text-slate-300',
          )}
        >
          {p === 'anthropic' ? 'Claude' : p === 'openai' ? 'GPT-4o' : 'Gemini'}
        </button>
      ))}
      <select
        value={model}
        onChange={(e) => onChange(provider, e.target.value)}
        className="bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-300 px-2 py-1 focus:outline-none focus:border-violet-500"
      >
        {PROVIDER_MODELS[provider].map((m) => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0',
        COST_DOT[PROVIDER_MODELS[provider].find((m) => m.id === model)?.cost ?? 'cheap'])} />
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          className={clsx('transition-colors', onChange ? 'cursor-pointer' : 'cursor-default')}
        >
          <Star
            className="w-5 h-5"
            fill={(hover || value) >= n ? 'currentColor' : 'none'}
            color={(hover || value) >= n ? '#F59E0B' : '#475569'}
          />
        </button>
      ))}
    </div>
  )
}

function actKey(dayIdx: number, actIdx: number) { return `${dayIdx}_${actIdx}` }

function StrategyTimeline({
  strategy,
  checkedActivities = [],
  onToggle,
  expandedDays,
  onToggleDay,
}: {
  strategy: WeeklyStrategy
  checkedActivities?: string[]
  onToggle?: (key: string) => void
  expandedDays: Set<number>
  onToggleDay: (i: number) => void
}) {
  return (
    <div className="space-y-3">
      {strategy.weekTheme && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Week theme</span>
          <span className="px-2.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-medium">
            {strategy.weekTheme}
          </span>
        </div>
      )}
      {strategy.days.map((day, di) => {
        const isOpen = expandedDays.has(di)
        const doneCount = day.activities.filter((_, ai) => checkedActivities.includes(actKey(di, ai))).length
        return (
          <div key={di} className={clsx('rounded-xl border overflow-hidden', DAY_COLORS[di % DAY_COLORS.length])}>
            <button
              onClick={() => onToggleDay(di)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-10">{day.dayOfWeek.slice(0, 3).toUpperCase()}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{day.dayOfWeek}</p>
                  <p className="text-xs text-slate-500">{day.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {onToggle && (
                  <span className="text-xs text-slate-600">{doneCount}/{day.activities.length} done</span>
                )}
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30 pt-3">
                {day.activities.map((act, ai) => {
                  const key = actKey(di, ai)
                  const isDone = checkedActivities.includes(key)
                  const ps = PLATFORM_STYLES[act.platform] ?? PLATFORM_STYLES.instagram
                  return (
                    <div
                      key={ai}
                      className={clsx(
                        'rounded-lg border p-3 transition-opacity',
                        ps.bg,
                        isDone && 'opacity-60',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {onToggle && (
                          <button onClick={() => onToggle(key)} className="mt-0.5 flex-shrink-0">
                            {isDone
                              ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                              : <Circle className="w-4 h-4 text-slate-600" />}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={clsx('flex items-center gap-1 text-xs font-semibold', ps.color)}>
                              {ps.icon}{ps.label}
                            </span>
                            <span className="text-xs text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
                              {act.type}
                            </span>
                            {act.timing && (
                              <span className="text-xs text-slate-600 ml-auto">{act.timing}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{act.content}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StoryTab() {
  const [activeTab, setActiveTab] = useState<ViewTab>('create')
  const [stories, setStories] = useState<StoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [prompt, setPrompt] = useState('')

  // Strategy generation
  const [provider, setProvider] = useState<AIProvider>('gemini')
  const [model, setModel] = useState(DEFAULT_MODEL.gemini)
  const [generatedStrategy, setGeneratedStrategy] = useState<WeeklyStrategy | null>(null)
  const [generating, setGenerating] = useState(false)
  const [strategyError, setStrategyError] = useState('')
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0, 1, 2]))

  // Save
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // History / post-campaign
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [expandedCardDays, setExpandedCardDays] = useState<Record<string, Set<number>>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [peRating, setPeRating] = useState(0)
  const [peReach, setPeReach] = useState('')
  const [peNotes, setPeNotes] = useState('')
  const [savingPe, setSavingPe] = useState(false)

  // ─── Load ──────────────────────────────────────────────────────────────────

  async function reload() {
    try {
      const res = await fetch('/api/story')
      const data = await res.json()
      setStories(data.stories ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  // ─── Derived ───────────────────────────────────────────────────────────────

  const today = new Date(); today.setHours(0, 0, 0, 0)

  function weekEnd(weekStartStr: string): Date {
    const d = new Date(weekStartStr)
    d.setDate(d.getDate() + 7)
    return d
  }

  const upcoming = stories
    .filter((s) => weekEnd(s.weekStart) >= today)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  const past = stories
    .filter((s) => weekEnd(s.weekStart) < today)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function resetForm() {
    setTitle(''); setDescription(''); setTargetAudience(''); setWeekStart(''); setPrompt('')
    setGeneratedStrategy(null); setStrategyError(''); setSaveError('')
    setExpandedDays(new Set([0, 1, 2]))
  }

  async function handleGenerateStrategy() {
    if (!title.trim()) { setStrategyError('Enter a campaign title first'); return }
    setGenerating(true); setStrategyError('')
    try {
      const res = await fetch('/api/generate-story-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, targetAudience, weekStart: weekStart || undefined, customPrompt: prompt || undefined, provider, model }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error as string)
      setGeneratedStrategy(data.strategy as WeeklyStrategy)
      setExpandedDays(new Set([0, 1, 2]))
    } catch (e: unknown) {
      setStrategyError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!title.trim()) { setSaveError('Campaign title is required'); return }
    if (!weekStart) { setSaveError('Week start date is required'); return }
    setSaving(true); setSaveError('')
    try {
      const id = `st_${Date.now()}`
      await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title, description, targetAudience, weekStart, prompt: prompt || undefined, provider, model, strategy: generatedStrategy ?? undefined }),
      })
      await reload()
      resetForm()
      setActiveTab(weekEnd(weekStart) >= today ? 'upcoming' : 'history')
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch('/api/story', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setStories((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleToggleActivity(story: StoryRecord, key: string) {
    const checked = story.checkedActivities ?? []
    const updated = checked.includes(key) ? checked.filter((k) => k !== key) : [...checked, key]
    const updatedStory = { ...story, checkedActivities: updated }
    setStories((prev) => prev.map((s) => s.id === story.id ? updatedStory : s))
    await fetch('/api/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedStory) })
  }

  async function handleSavePostCampaign(id: string) {
    if (!peRating) return
    setSavingPe(true)
    try {
      const story = stories.find((s) => s.id === id)
      if (!story) return
      const updated = { ...story, postCampaign: { rating: peRating, reach: Number(peReach) || 0, notes: peNotes, completedAt: new Date().toISOString() } }
      await fetch('/api/story', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      setStories((prev) => prev.map((s) => s.id === id ? updated : s))
      setEditingId(null)
    } finally {
      setSavingPe(false)
    }
  }

  function startEditing(story: StoryRecord) {
    setEditingId(story.id)
    setPeRating(story.postCampaign?.rating ?? 0)
    setPeReach(story.postCampaign?.reach?.toString() ?? '')
    setPeNotes(story.postCampaign?.notes ?? '')
  }

  function toggleCard(id: string) {
    setExpandedCards((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function getCardDays(id: string): Set<number> {
    return expandedCardDays[id] ?? new Set([0])
  }

  function toggleCardDay(id: string, i: number) {
    setExpandedCardDays((prev) => {
      const cur = new Set(prev[id] ?? [0])
      if (cur.has(i)) cur.delete(i); else cur.add(i)
      return { ...prev, [id]: cur }
    })
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function weekRange(weekStartStr: string) {
    const start = new Date(weekStartStr)
    const end = new Date(weekStartStr); end.setDate(end.getDate() + 6)
    return `${fmt(start.toISOString())} – ${fmt(end.toISOString())}`
  }

  function daysUntil(weekStartStr: string) {
    const d = new Date(weekStartStr); d.setHours(0, 0, 0, 0)
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86_400_000)
    if (diff <= 0 && weekEnd(weekStartStr) >= today) return 'This week'
    if (diff === 1) return 'Starts tomorrow'
    if (diff > 1) return `Starts in ${diff} days`
    return 'Past'
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page heading */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-pink-400" />
            Story Strategy
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Plan weekly story campaigns for Instagram, WhatsApp & Email</p>
        </div>
        {activeTab !== 'create' && (
          <button
            onClick={() => { setActiveTab('create'); resetForm() }}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:bg-pink-500/30 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1 w-fit mb-8">
        {([
          { id: 'create' as ViewTab, label: 'New', icon: <Plus className="w-3.5 h-3.5" /> },
          { id: 'upcoming' as ViewTab, label: `Upcoming (${upcoming.length})`, icon: <Clock className="w-3.5 h-3.5" /> },
          { id: 'history' as ViewTab, label: `History (${past.length})`, icon: <BarChart2 className="w-3.5 h-3.5" /> },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === t.id ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── CREATE ─────────────────────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <div className="space-y-8">

          {/* Campaign details */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-white">Campaign Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Campaign Title <span className="text-rose-400">*</span></label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Product Launch Week, Ramadan Campaign"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Week Start Date <span className="text-rose-400">*</span></label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">What is this campaign about?</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the campaign goal, product/service being promoted, key messages..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500/50 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Target Audience</label>
              <input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Working professionals aged 25-35, fitness enthusiasts, new mothers"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500/50"
              />
            </div>
          </div>

          {/* Strategy generation */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-white">Generate Weekly Strategy</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Additional Instructions (optional)</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. Focus more on Q&A and Polls, include countdown stories 3 days before launch, keep WhatsApp messages short and punchy..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500/50 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">AI Model</label>
              <ProviderModelPicker
                provider={provider}
                model={model}
                onChange={(p, m) => { setProvider(p); setModel(m) }}
              />
            </div>

            {strategyError && (
              <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {strategyError}
              </div>
            )}

            <button
              onClick={handleGenerateStrategy}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:bg-pink-500/30 transition-colors font-medium text-sm disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Generating strategy…' : 'Generate Weekly Strategy'}
            </button>

            {/* Generated strategy preview */}
            {generatedStrategy && (
              <div className="mt-2 space-y-4">
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-4 py-3">
                  <p className="text-xs text-slate-400 leading-relaxed">{generatedStrategy.summary}</p>
                </div>
                <StrategyTimeline
                  strategy={generatedStrategy}
                  expandedDays={expandedDays}
                  onToggleDay={(i) => setExpandedDays((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                />
              </div>
            )}
          </div>

          {/* Save */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Save Campaign</p>
                <p className="text-xs text-slate-500 mt-0.5">Save to track and check off activities throughout the week</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {saveError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5" />{saveError}
                  </div>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── UPCOMING ───────────────────────────────────────────────────────── */}
      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-slate-800 rounded-2xl">
              <Layers className="w-10 h-10 text-slate-800 mx-auto mb-3" />
              <p className="text-slate-400 font-medium mb-1">No upcoming campaigns</p>
              <p className="text-slate-600 text-sm mb-4">Create a new story campaign to get started</p>
              <button
                onClick={() => { setActiveTab('create'); resetForm() }}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:bg-pink-500/30 transition-colors"
              >
                <Plus className="w-4 h-4" /> New Campaign
              </button>
            </div>
          ) : (
            upcoming.map((story) => {
              const isOpen = expandedCards.has(story.id)
              const totalActs = story.strategy?.days.reduce((s, d) => s + d.activities.length, 0) ?? 0
              const doneActs = (story.checkedActivities ?? []).length
              const pct = totalActs > 0 ? Math.round((doneActs / totalActs) * 100) : 0
              return (
                <div key={story.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-base font-bold text-white">{story.title}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                            {daysUntil(story.weekStart)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{weekRange(story.weekStart)}</p>
                        {story.description && (
                          <p className="text-sm text-slate-400 mt-2 line-clamp-2">{story.description}</p>
                        )}
                        {totalActs > 0 && (
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>Progress</span>
                              <span>{doneActs}/{totalActs} activities done ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-pink-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {story.strategy && (
                          <button
                            onClick={() => toggleCard(story.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                          >
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(story.id)}
                          className="p-2 rounded-lg text-slate-700 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {isOpen && story.strategy && (
                    <div className="border-t border-slate-800 p-5 space-y-3">
                      <p className="text-xs text-slate-500 leading-relaxed mb-3">{story.strategy.summary}</p>
                      <StrategyTimeline
                        strategy={story.strategy}
                        checkedActivities={story.checkedActivities}
                        onToggle={(key) => handleToggleActivity(story, key)}
                        expandedDays={getCardDays(story.id)}
                        onToggleDay={(i) => toggleCardDay(story.id, i)}
                      />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── HISTORY ────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
            </div>
          ) : past.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-slate-800 rounded-2xl">
              <BarChart2 className="w-10 h-10 text-slate-800 mx-auto mb-3" />
              <p className="text-slate-400 font-medium mb-1">No past campaigns yet</p>
              <p className="text-slate-600 text-sm">Completed campaigns will appear here</p>
            </div>
          ) : (
            past.map((story) => {
              const isOpen = expandedCards.has(story.id)
              const isEditing = editingId === story.id
              return (
                <div key={story.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-base font-bold text-white">{story.title}</h3>
                          {story.postCampaign && (
                            <StarRating value={story.postCampaign.rating} />
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{weekRange(story.weekStart)}</p>
                        {story.description && (
                          <p className="text-sm text-slate-400 mt-1.5 line-clamp-2">{story.description}</p>
                        )}
                        {story.postCampaign && (
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            {story.postCampaign.reach > 0 && (
                              <span>Reach: <span className="text-slate-300">{story.postCampaign.reach.toLocaleString()}</span></span>
                            )}
                            {story.postCampaign.notes && (
                              <span className="truncate max-w-xs text-slate-500 italic">{story.postCampaign.notes}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => { startEditing(story); if (!isOpen) toggleCard(story.id) }}
                          className="p-2 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                          title="Add review"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {story.strategy && (
                          <button
                            onClick={() => toggleCard(story.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                          >
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(story.id)}
                          className="p-2 rounded-lg text-slate-700 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-800 p-5 space-y-5">
                      {/* Post-campaign review */}
                      {isEditing ? (
                        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-4">
                          <p className="text-sm font-semibold text-white">Campaign Review</p>
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400">Overall Rating</label>
                            <StarRating value={peRating} onChange={setPeRating} />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400">Total Reach / Impressions</label>
                            <input
                              type="number"
                              value={peReach}
                              onChange={(e) => setPeReach(e.target.value)}
                              placeholder="e.g. 5000"
                              className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-slate-400">Notes & Learnings</label>
                            <textarea
                              value={peNotes}
                              onChange={(e) => setPeNotes(e.target.value)}
                              rows={3}
                              placeholder="What worked well? What to improve next time?"
                              className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSavePostCampaign(story.id)}
                              disabled={savingPe || !peRating}
                              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
                            >
                              {savingPe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              Save Review
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : story.postCampaign && (
                        <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-400">Campaign Review</p>
                            <StarRating value={story.postCampaign.rating} />
                          </div>
                          {story.postCampaign.reach > 0 && (
                            <p className="text-xs text-slate-500">Reach: <span className="text-slate-300 font-medium">{story.postCampaign.reach.toLocaleString()}</span></p>
                          )}
                          {story.postCampaign.notes && (
                            <p className="text-xs text-slate-400 italic leading-relaxed">{story.postCampaign.notes}</p>
                          )}
                        </div>
                      )}

                      {/* Strategy */}
                      {story.strategy && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Weekly Strategy</p>
                          <p className="text-xs text-slate-500 leading-relaxed mb-3">{story.strategy.summary}</p>
                          <StrategyTimeline
                            strategy={story.strategy}
                            expandedDays={getCardDays(story.id)}
                            onToggleDay={(i) => toggleCardDay(story.id, i)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
