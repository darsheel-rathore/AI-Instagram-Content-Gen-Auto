import { useState, useEffect, useRef } from 'react'
import {
  GraduationCap, Plus, Calendar, Users, DollarSign,
  Sparkles, Download, ChevronDown, ChevronUp, Star, Trash2,
  AlertCircle, Loader2, Clock, MessageCircle, Mail, Camera,
  Upload, CheckCircle, Circle, TrendingUp,
  BarChart2, Edit3, X, Check, Layers, Zap,
} from 'lucide-react'
import clsx from 'clsx'
import { BUILT_IN_TEMPLATES, type PptTemplate, type SlideData } from '@/lib/masterclass-templates'

// ─── Types ────────────────────────────────────────────────────────────────────

type AIProvider = 'anthropic' | 'openai' | 'gemini'
type ViewTab = 'create' | 'current' | 'history'

interface StrategyActivity {
  platform: 'instagram' | 'whatsapp' | 'email'
  type: string
  content: string
  timing?: string
}

interface StrategyDay {
  daysBeforeEvent: number
  label: string
  activities: StrategyActivity[]
}

interface MarketingStrategy {
  summary: string
  days: StrategyDay[]
}

interface PostEvent {
  rating: number
  attendees: number
  earnings: number
  notes: string
  completedAt: string
}

interface MasterclassRecord {
  id: string
  title: string
  description: string
  targetAudience: string
  keyTopics: string
  price?: number
  date: string
  createdAt: string
  pptPrompt?: string
  pptTemplateId?: string
  pptTemplate?: PptTemplate
  pptSlides?: SlideData[]
  pptProvider?: string
  pptModel?: string
  strategyProvider?: string
  strategyModel?: string
  strategy?: MarketingStrategy
  postEvent?: PostEvent
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

const PLATFORM_STYLES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  instagram: { label: 'Instagram', color: 'text-pink-400', icon: <Camera className="w-3 h-3" /> },
  whatsapp: { label: 'WhatsApp', color: 'text-emerald-400', icon: <MessageCircle className="w-3 h-3" /> },
  email: { label: 'Email', color: 'text-sky-400', icon: <Mail className="w-3 h-3" /> },
}

const ONLINE_TEMPLATE_LINKS = [
  { name: 'SlidesGo', url: 'https://slidesgo.com', note: 'Free Google Slides & PPT templates' },
  { name: 'SlidesCarnival', url: 'https://www.slidescarnival.com', note: 'Free presentation templates' },
  { name: 'Canva', url: 'https://www.canva.com/presentations/templates/', note: 'Presentation template gallery' },
  { name: 'SlideModel', url: 'https://slidemodel.com/free-powerpoint-templates/', note: 'Professional PPT templates' },
]

// ─── Small helpers ────────────────────────────────────────────────────────────

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
        <button key={n} onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          className={clsx('transition-colors', onChange ? 'cursor-pointer' : 'cursor-default')}>
          <Star className="w-5 h-5"
            fill={(hover || value) >= n ? 'currentColor' : 'none'}
            color={(hover || value) >= n ? '#F59E0B' : '#475569'} />
        </button>
      ))}
    </div>
  )
}

function actKey(dayIdx: number, actIdx: number) { return `${dayIdx}_${actIdx}` }

async function downloadPptx(slides: SlideData[], template: PptTemplate, fileName: string) {
  const res = await fetch('/api/generate-pptx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slides, template, fileName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Download failed' }))
    throw new Error((err as { error?: string }).error ?? 'Download failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${fileName}.pptx`; a.click(); URL.revokeObjectURL(url)
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MasterclassTab() {
  const [activeTab, setActiveTab] = useState<ViewTab>('create')
  const [masterclasses, setMasterclasses] = useState<MasterclassRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Form
  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [description, setDescription] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [keyTopics, setKeyTopics] = useState('')
  const [price, setPrice] = useState('')

  // PPT
  const [selectedTemplateId, setSelectedTemplateId] = useState('executive')
  const [pptPrompt, setPptPrompt] = useState('')
  const [pptProvider, setPptProvider] = useState<AIProvider>('gemini')
  const [pptModel, setPptModel] = useState(DEFAULT_MODEL.gemini)
  const [generatedSlides, setGeneratedSlides] = useState<SlideData[] | null>(null)
  const [generatingPpt, setGeneratingPpt] = useState(false)
  const [pptError, setPptError] = useState('')
  const [downloadingPpt, setDownloadingPpt] = useState(false)
  const [expandedSlides, setExpandedSlides] = useState(false)
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<PptTemplate[]>([])
  const importRef = useRef<HTMLInputElement>(null)

  // Strategy
  const [strategyProvider, setStrategyProvider] = useState<AIProvider>('gemini')
  const [strategyModel, setStrategyModel] = useState(DEFAULT_MODEL.gemini)
  const [generatedStrategy, setGeneratedStrategy] = useState<MarketingStrategy | null>(null)
  const [generatingStrategy, setGeneratingStrategy] = useState(false)
  const [strategyError, setStrategyError] = useState('')
  const [expandedStratDays, setExpandedStratDays] = useState<Set<number>>(new Set([0, 1]))

  // Save
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // History / post-event editing
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [peRating, setPeRating] = useState(0)
  const [peAttendees, setPeAttendees] = useState('')
  const [peEarnings, setPeEarnings] = useState('')
  const [peNotes, setPeNotes] = useState('')
  const [savingPe, setSavingPe] = useState(false)
  const [pptDownloadErrors, setPptDownloadErrors] = useState<Record<string, string>>({})

  // ─── Load ──────────────────────────────────────────────────────────────────

  async function reload() {
    try {
      const res = await fetch('/api/masterclass')
      const data = await res.json()
      setMasterclasses(data.masterclasses ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    try {
      const saved = localStorage.getItem('mc_custom_templates')
      if (saved) setCustomTemplates(JSON.parse(saved) as PptTemplate[])
    } catch { /* ignore */ }
  }, [])

  // ─── Derived ───────────────────────────────────────────────────────────────

  const allTemplates = [...BUILT_IN_TEMPLATES, ...customTemplates]
  const selectedTemplate = allTemplates.find((t) => t.id === selectedTemplateId) ?? BUILT_IN_TEMPLATES[0]

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const upcoming = masterclasses.filter((m) => new Date(m.date) >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past = masterclasses.filter((m) => new Date(m.date) < today).sort((a, b) => b.date.localeCompare(a.date))

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleGeneratePpt() {
    if (!title.trim()) { setPptError('Enter a title first'); return }
    setGeneratingPpt(true); setPptError('')
    try {
      const res = await fetch('/api/generate-ppt-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, targetAudience, keyTopics, price: price ? Number(price) : undefined, customPrompt: pptPrompt, provider: pptProvider, model: pptModel }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error as string)
      setGeneratedSlides(data.slides as SlideData[]); setExpandedSlides(true)
    } catch (e: unknown) { setPptError(e instanceof Error ? e.message : String(e)) }
    finally { setGeneratingPpt(false) }
  }

  async function handleDownloadPpt(slides: SlideData[], template: PptTemplate, fileName: string, errKey = 'create') {
    setDownloadingPpt(true)
    setPptDownloadErrors((prev) => { const n = { ...prev }; delete n[errKey]; return n })
    try { await downloadPptx(slides, template, fileName) }
    catch (e: unknown) { setPptDownloadErrors((prev) => ({ ...prev, [errKey]: e instanceof Error ? e.message : String(e) })) }
    finally { setDownloadingPpt(false) }
  }

  async function handleGenerateStrategy() {
    if (!title.trim()) { setStrategyError('Enter a title first'); return }
    setGeneratingStrategy(true); setStrategyError('')
    try {
      const res = await fetch('/api/generate-masterclass-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, targetAudience, keyTopics, date: eventDate || undefined, price: price ? Number(price) : undefined, provider: strategyProvider, model: strategyModel }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error as string)
      setGeneratedStrategy(data.strategy as MarketingStrategy)
    } catch (e: unknown) { setStrategyError(e instanceof Error ? e.message : String(e)) }
    finally { setGeneratingStrategy(false) }
  }

  async function handleSave() {
    if (!title.trim()) { setSaveError('Title is required'); return }
    if (!eventDate) { setSaveError('Event date is required'); return }
    setSaving(true); setSaveError('')
    try {
      const id = `mc_${Date.now()}`
      await fetch('/api/masterclass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, title, description, targetAudience, keyTopics,
          price: price ? Number(price) : undefined, date: eventDate,
          pptPrompt, pptTemplateId: selectedTemplateId, pptTemplate: selectedTemplate,
          pptSlides: generatedSlides ?? undefined, pptProvider, pptModel,
          strategyProvider, strategyModel, strategy: generatedStrategy ?? undefined,
        }),
      })
      await reload()
      setTitle(''); setEventDate(''); setDescription(''); setTargetAudience('')
      setKeyTopics(''); setPrice(''); setPptPrompt('')
      setGeneratedSlides(null); setGeneratedStrategy(null)
      setPptError(''); setStrategyError('')
      setActiveTab(new Date(eventDate) >= today ? 'current' : 'history')
    } catch (e: unknown) { setSaveError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await fetch('/api/masterclass', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setMasterclasses((prev) => prev.filter((m) => m.id !== id))
  }

  async function handleToggleActivity(mc: MasterclassRecord, key: string) {
    const checked = mc.checkedActivities ?? []
    const updated = checked.includes(key) ? checked.filter((k) => k !== key) : [...checked, key]
    const updatedMc = { ...mc, checkedActivities: updated }
    setMasterclasses((prev) => prev.map((m) => m.id === mc.id ? updatedMc : m))
    await fetch('/api/masterclass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedMc) })
  }

  async function handleSavePostEvent(id: string) {
    if (!peRating) return
    setSavingPe(true)
    try {
      const mc = masterclasses.find((m) => m.id === id); if (!mc) return
      const updated = { ...mc, postEvent: { rating: peRating, attendees: Number(peAttendees) || 0, earnings: Number(peEarnings) || 0, notes: peNotes, completedAt: new Date().toISOString() } }
      await fetch('/api/masterclass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      setMasterclasses((prev) => prev.map((m) => m.id === id ? updated : m)); setEditingId(null)
    } finally { setSavingPe(false) }
  }

  function startEditing(mc: MasterclassRecord) {
    setEditingId(mc.id); setPeRating(mc.postEvent?.rating ?? 0)
    setPeAttendees(mc.postEvent?.attendees?.toString() ?? ''); setPeEarnings(mc.postEvent?.earnings?.toString() ?? ''); setPeNotes(mc.postEvent?.notes ?? '')
  }

  function handleImportTemplate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as PptTemplate
        if (!json.id || !json.name || !json.colors) throw new Error()
        const t: PptTemplate = { ...json, id: `custom_${Date.now()}`, isCustom: true }
        const updated = [...customTemplates, t]
        setCustomTemplates(updated); localStorage.setItem('mc_custom_templates', JSON.stringify(updated)); setSelectedTemplateId(t.id)
      } catch { alert('Invalid template JSON. Export a built-in template first to see the format.') }
    }
    reader.readAsText(file); e.target.value = ''
  }

  function handleExportTemplate(t: PptTemplate) {
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `template_${t.id}.json`; a.click(); URL.revokeObjectURL(url)
  }

  function toggleCard(id: string) {
    setExpandedCards((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function toggleStratDay(i: number) {
    setExpandedStratDays((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n })
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function daysUntil(dateStr: string) {
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86_400_000)
    if (diff === 0) return 'Today!'
    if (diff === 1) return '1 day away'
    return `${diff} days away`
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page heading + actions */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-violet-400" />
            Masterclass
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Plan, launch, and track your masterclasses</p>
        </div>
        {activeTab !== 'create' && (
          <button
            onClick={() => {
              setActiveTab('create'); setTitle(''); setEventDate(''); setDescription('')
              setTargetAudience(''); setKeyTopics(''); setPrice(''); setPptPrompt('')
              setGeneratedSlides(null); setGeneratedStrategy(null); setSaveError(''); setPptError(''); setStrategyError('')
            }}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> New Masterclass
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1 w-fit mb-8">
        {([
          { id: 'create' as ViewTab, label: 'New', icon: <Plus className="w-3.5 h-3.5" /> },
          { id: 'current' as ViewTab, label: `Upcoming (${upcoming.length})`, icon: <Clock className="w-3.5 h-3.5" /> },
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

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      )}

      {/* ══════════════════ CREATE ══════════════════ */}
      {!loading && activeTab === 'create' && (
        <div className="space-y-8">

          {/* Event Details */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-violet-400" /> Event Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 mb-1.5 block">Masterclass Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Instagram Growth Masterclass"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Event Date *</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Price (₹, optional)</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 999"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Target Audience</label>
                <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Aspiring content creators"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Key Topics (comma-separated)</label>
                <input value={keyTopics} onChange={(e) => setKeyTopics(e.target.value)}
                  placeholder="e.g. Reels strategy, Hashtags, Growth"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 mb-1.5 block">Description (helps AI create better content)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what participants will learn, outcomes, and what makes this unique..."
                  rows={3} className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none" />
              </div>
            </div>
          </section>

          {/* PPT */}
          <section className="border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" /> PowerPoint Presentation
            </h3>

            {/* Template picker */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">Template</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowTemplateBrowser(!showTemplateBrowser)}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    Browse Online
                  </button>
                  <button onClick={() => importRef.current?.click()}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Import JSON
                  </button>
                  <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportTemplate} />
                </div>
              </div>

              {showTemplateBrowser && (
                <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">Free Template Resources</span>
                    <button onClick={() => setShowTemplateBrowser(false)}><X className="w-4 h-4 text-slate-500 hover:text-white" /></button>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Find a template, then export a built-in theme as JSON, edit its colors, and import it here.</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {ONLINE_TEMPLATE_LINKS.map((link) => (
                      <a key={link.name} href={link.url} target="_blank" rel="noreferrer"
                        className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 hover:border-violet-500/40 transition-colors">
                        <p className="text-xs font-medium text-violet-300">{link.name} ↗</p>
                        <p className="text-xs text-slate-600 mt-0.5">{link.note}</p>
                      </a>
                    ))}
                  </div>
                  <div className="border-t border-slate-800 pt-3">
                    <p className="text-xs text-slate-600 mb-2">Export a built-in theme as JSON starting point:</p>
                    <div className="flex flex-wrap gap-2">
                      {BUILT_IN_TEMPLATES.map((t) => (
                        <button key={t.id} onClick={() => handleExportTemplate(t)}
                          className="text-xs text-slate-500 hover:text-violet-300 underline underline-offset-2 transition-colors">
                          Export {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {allTemplates.map((t) => (
                  <button key={t.id} onClick={() => setSelectedTemplateId(t.id)}
                    className={clsx('rounded-xl border p-2.5 text-left transition-all',
                      selectedTemplateId === t.id
                        ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30'
                        : 'border-slate-700/60 hover:border-slate-600')}>
                    <div className="w-full h-7 rounded-lg mb-1.5 border border-slate-700/40" style={{ background: t.preview }} />
                    <p className="text-xs font-medium text-white truncate">{t.name}</p>
                    {t.isCustom && <span className="text-xs text-violet-400">Custom</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-slate-500 mb-1.5 block">Additional slide instructions (optional)</label>
              <textarea value={pptPrompt} onChange={(e) => setPptPrompt(e.target.value)}
                placeholder="e.g. Include a pricing slide, add interactive exercises..."
                rows={2} className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none" />
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1.5 block">AI Model</label>
              <ProviderModelPicker provider={pptProvider} model={pptModel} onChange={(p, m) => { setPptProvider(p); setPptModel(m) }} />
            </div>

            <div className="flex items-center flex-wrap gap-3">
              <button onClick={handleGeneratePpt} disabled={generatingPpt}
                className={clsx('flex items-center gap-2 text-sm px-4 py-2 rounded-xl border font-medium transition-all',
                  generatingPpt ? 'border-violet-500/50 bg-violet-500/15 text-violet-300 cursor-not-allowed' : 'border-violet-500/40 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30')}>
                {generatingPpt ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4" />Generate Slides</>}
              </button>
              {generatedSlides && (
                <button onClick={() => handleDownloadPpt(generatedSlides, selectedTemplate, title || 'masterclass')} disabled={downloadingPpt}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 font-medium transition-all disabled:opacity-50">
                  {downloadingPpt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download .pptx
                </button>
              )}
            </div>

            {pptError && <div className="mt-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-3 py-2 text-xs"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{pptError}</div>}
            {pptDownloadErrors.create && <div className="mt-2 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-3 py-2 text-xs"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{pptDownloadErrors.create}</div>}

            {generatedSlides && (
              <div className="mt-4">
                <button onClick={() => setExpandedSlides(!expandedSlides)}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-2">
                  {expandedSlides ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {generatedSlides.length} slides generated
                </button>
                {expandedSlides && (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {generatedSlides.map((slide, i) => (
                      <div key={i} className="flex items-start gap-2.5 rounded-lg bg-slate-800/40 px-3 py-2">
                        <span className="text-xs text-slate-600 w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white truncate">{slide.title}</p>
                          {slide.subtitle && <p className="text-xs text-slate-500 truncate">{slide.subtitle}</p>}
                          {slide.points?.length ? <p className="text-xs text-slate-600 mt-0.5">{slide.points.length} bullet points</p> : null}
                        </div>
                        <span className={clsx('text-xs rounded-md px-1.5 py-0.5 flex-shrink-0',
                          slide.type === 'title' ? 'bg-violet-500/20 text-violet-400' :
                          slide.type === 'section' ? 'bg-blue-500/20 text-blue-400' :
                          slide.type === 'closing' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-700/60 text-slate-500')}>{slide.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Strategy */}
          <section className="border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Marketing Strategy
            </h3>
            <p className="text-xs text-slate-600 mb-4">Day-by-day plan for Instagram, WhatsApp, and Email</p>

            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1.5 block">AI Model</label>
              <ProviderModelPicker provider={strategyProvider} model={strategyModel} onChange={(p, m) => { setStrategyProvider(p); setStrategyModel(m) }} />
            </div>

            <button onClick={handleGenerateStrategy} disabled={generatingStrategy}
              className={clsx('flex items-center gap-2 text-sm px-4 py-2 rounded-xl border font-medium transition-all',
                generatingStrategy ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 cursor-not-allowed' : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20')}>
              {generatingStrategy ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Zap className="w-4 h-4" />Generate Strategy</>}
            </button>

            {strategyError && <div className="mt-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-3 py-2 text-xs"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{strategyError}</div>}

            {generatedStrategy && (
              <div className="mt-4">
                {generatedStrategy.summary && <p className="text-sm text-slate-400 mb-4 border-l-2 border-amber-500/40 pl-3">{generatedStrategy.summary}</p>}
                <StrategyTimeline strategy={generatedStrategy} expandedDays={expandedStratDays} onToggleDay={toggleStratDay} />
              </div>
            )}
          </section>

          {/* Save */}
          <section className="border-t border-slate-800 pt-6">
            {saveError && <div className="mb-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-3 py-2 text-xs"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{saveError}</div>}
            <button onClick={handleSave} disabled={saving}
              className={clsx('flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-medium transition-all',
                saving ? 'bg-violet-600/50 text-violet-300 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500 text-white')}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Check className="w-4 h-4" />Save Masterclass</>}
            </button>
            <p className="text-xs text-slate-600 mt-2">Future dates → Upcoming tab. Past dates → History tab.</p>
          </section>
        </div>
      )}

      {/* ══════════════════ UPCOMING ══════════════════ */}
      {!loading && activeTab === 'current' && (
        upcoming.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-slate-800 rounded-2xl max-w-lg">
            <Clock className="w-10 h-10 text-slate-800 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">No upcoming masterclasses</p>
            <p className="text-slate-600 text-sm mb-6">Create one with a future event date.</p>
            <button onClick={() => setActiveTab('create')}
              className="text-sm bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors px-4 py-2 rounded-xl">
              Create Masterclass
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {upcoming.map((mc) => (
              <UpcomingCard
                key={mc.id}
                mc={mc}
                allTemplates={allTemplates}
                isExpanded={expandedCards.has(mc.id)}
                onToggleExpand={() => toggleCard(mc.id)}
                onToggleActivity={(key) => handleToggleActivity(mc, key)}
                onDelete={() => handleDelete(mc.id)}
                onDownloadPpt={async () => {
                  if (!mc.pptSlides) return
                  const tmpl = allTemplates.find((t) => t.id === mc.pptTemplateId) ?? mc.pptTemplate ?? BUILT_IN_TEMPLATES[0]
                  await handleDownloadPpt(mc.pptSlides, tmpl, mc.title, mc.id)
                }}
                downloadingPpt={downloadingPpt}
                pptDownloadError={pptDownloadErrors[mc.id]}
                daysUntil={daysUntil}
                fmt={fmt}
                expandedStratDays={expandedStratDays}
                onToggleStratDay={toggleStratDay}
              />
            ))}
          </div>
        )
      )}

      {/* ══════════════════ HISTORY ══════════════════ */}
      {!loading && activeTab === 'history' && (
        past.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-slate-800 rounded-2xl max-w-lg">
            <BarChart2 className="w-10 h-10 text-slate-800 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">No past masterclasses yet</p>
            <p className="text-slate-600 text-sm">Completed events appear here once their date passes.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {past.map((mc) => {
              const isEditing = editingId === mc.id
              const isExpanded = expandedCards.has(mc.id)
              return (
                <div key={mc.id} className="rounded-2xl border border-slate-700/60 bg-slate-800/30 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <button onClick={() => toggleCard(mc.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{mc.title}</p>
                        <p className="text-xs text-slate-500">{fmt(mc.date)}</p>
                      </div>
                    </button>
                    {mc.postEvent && <StarRating value={mc.postEvent.rating} />}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => isEditing ? setEditingId(null) : startEditing(mc)}
                        title={mc.postEvent ? 'Edit review' : 'Add post-event review'}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(mc.id)}
                        className="p-1.5 rounded-lg text-slate-700 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {mc.postEvent && (
                    <div className="flex items-center gap-4 px-5 py-2.5 bg-slate-900/30 border-t border-slate-800/60 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400"><Users className="w-3 h-3 text-violet-400" />{mc.postEvent.attendees} joined</div>
                      {mc.postEvent.earnings > 0 && <div className="flex items-center gap-1.5 text-xs text-slate-400"><TrendingUp className="w-3 h-3 text-emerald-400" />₹{mc.postEvent.earnings.toLocaleString()}</div>}
                      {mc.postEvent.notes && <p className="text-xs text-slate-600 truncate max-w-xs">{mc.postEvent.notes}</p>}
                    </div>
                  )}

                  {isEditing && (
                    <div className="px-5 py-4 border-t border-slate-800/60 bg-slate-900/20">
                      <p className="text-sm font-medium text-white mb-3">Post-Event Review</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-slate-500 mb-1.5 block">Rating</label>
                          <StarRating value={peRating} onChange={setPeRating} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Attendees</label>
                          <input type="number" value={peAttendees} onChange={(e) => setPeAttendees(e.target.value)}
                            placeholder="How many people joined?"
                            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Revenue (₹)</label>
                          <input type="number" value={peEarnings} onChange={(e) => setPeEarnings(e.target.value)}
                            placeholder="Total earnings"
                            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-slate-500 mb-1 block">Notes</label>
                          <textarea value={peNotes} onChange={(e) => setPeNotes(e.target.value)}
                            placeholder="How did it go? What would you do differently?"
                            rows={2} className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSavePostEvent(mc.id)} disabled={!peRating || savingPe}
                          className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                          {savingPe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Review
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-sm px-3 py-1.5 text-slate-500 hover:text-white transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="border-t border-slate-800/60 px-5 py-4 space-y-4">
                      {mc.description && <p className="text-sm text-slate-400">{mc.description}</p>}
                      {mc.keyTopics && (
                        <div className="flex flex-wrap gap-1.5">
                          {mc.keyTopics.split(',').map((t, i) => (
                            <span key={i} className="text-xs bg-slate-800/60 border border-slate-700/60 rounded-full px-2.5 py-0.5 text-slate-400">{t.trim()}</span>
                          ))}
                        </div>
                      )}
                      {mc.pptSlides && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-400" />
                            {mc.pptSlides.length} slides{mc.pptTemplate ? ` · ${mc.pptTemplate.name}` : ''}
                          </span>
                          <button
                            onClick={async () => {
                              if (!mc.pptSlides) return
                              const tmpl = allTemplates.find((t) => t.id === mc.pptTemplateId) ?? mc.pptTemplate ?? BUILT_IN_TEMPLATES[0]
                              await handleDownloadPpt(mc.pptSlides, tmpl, mc.title, mc.id)
                            }}
                            disabled={downloadingPpt}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50">
                            {downloadingPpt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} .pptx
                          </button>
                        </div>
                      )}
                      {pptDownloadErrors[mc.id] && (
                        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-3 py-2 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{pptDownloadErrors[mc.id]}
                        </div>
                      )}
                      {mc.strategy && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" />Marketing Strategy</p>
                          <StrategyTimeline strategy={mc.strategy} expandedDays={expandedStratDays} onToggleDay={toggleStratDay} compact />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

// ─── Strategy Timeline ────────────────────────────────────────────────────────

function StrategyTimeline({
  strategy, expandedDays, onToggleDay, checkedActivities, onToggleActivity, compact,
}: {
  strategy: MarketingStrategy
  expandedDays: Set<number>
  onToggleDay: (i: number) => void
  checkedActivities?: string[]
  onToggleActivity?: (key: string) => void
  compact?: boolean
}) {
  return (
    <div className="space-y-2">
      {strategy.days.map((day, dayIdx) => {
        const isOpen = expandedDays.has(dayIdx)
        return (
          <div key={dayIdx} className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
            <button onClick={() => onToggleDay(dayIdx)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/30 transition-colors">
              <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                day.daysBeforeEvent === 0 ? 'bg-amber-500/20 text-amber-400' :
                day.daysBeforeEvent < 0 ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-violet-500/20 text-violet-400')}>
                {day.daysBeforeEvent === 0 ? 'D' : day.daysBeforeEvent < 0 ? `+${Math.abs(day.daysBeforeEvent)}` : `D-${day.daysBeforeEvent}`}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{day.label}</p>
                <p className="text-xs text-slate-600">{day.activities.length} activities</p>
              </div>
              {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600" />}
            </button>
            {isOpen && (
              <div className="border-t border-slate-800/60 px-4 py-3 space-y-3">
                {day.activities.map((act, actIdx) => {
                  const key = actKey(dayIdx, actIdx)
                  const isChecked = checkedActivities?.includes(key) ?? false
                  const ps = PLATFORM_STYLES[act.platform] ?? PLATFORM_STYLES.instagram
                  return (
                    <div key={actIdx} className={clsx('flex items-start gap-3', isChecked && 'opacity-60')}>
                      {onToggleActivity && (
                        <button onClick={() => onToggleActivity(key)} className="mt-0.5 flex-shrink-0">
                          {isChecked ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-700" />}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={clsx('flex items-center gap-1 text-xs font-medium', ps.color)}>{ps.icon}{ps.label}</span>
                          <span className="text-xs text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded">{act.type}</span>
                          {act.timing && <span className="text-xs text-slate-700">{act.timing}</span>}
                        </div>
                        <p className={clsx('text-xs text-slate-400 leading-relaxed', isChecked && 'line-through')}>
                          {compact ? act.content.slice(0, 100) + (act.content.length > 100 ? '…' : '') : act.content}
                        </p>
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

// ─── Upcoming Card ────────────────────────────────────────────────────────────

function UpcomingCard({
  mc, allTemplates, isExpanded, onToggleExpand, onToggleActivity, onDelete,
  onDownloadPpt, downloadingPpt, pptDownloadError, daysUntil, fmt,
  expandedStratDays, onToggleStratDay,
}: {
  mc: MasterclassRecord
  allTemplates: PptTemplate[]
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleActivity: (key: string) => void
  onDelete: () => void
  onDownloadPpt: () => void
  downloadingPpt: boolean
  pptDownloadError?: string
  daysUntil: (d: string) => string
  fmt: (d: string) => string
  expandedStratDays: Set<number>
  onToggleStratDay: (i: number) => void
}) {
  const checkedCount = mc.checkedActivities?.length ?? 0
  const totalActivities = mc.strategy?.days.reduce((s, d) => s + d.activities.length, 0) ?? 0
  const label = daysUntil(mc.date)

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-semibold text-white truncate">{mc.title}</h3>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0',
              label === 'Today!' ? 'bg-amber-500/20 text-amber-300' : 'bg-violet-500/20 text-violet-300')}>
              {label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmt(mc.date)}</span>
            {mc.price && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />₹{mc.price}</span>}
            {mc.targetAudience && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{mc.targetAudience}</span>}
            {totalActivities > 0 && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle className="w-3 h-3" />{checkedCount}/{totalActivities} done</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {mc.pptSlides && (
            <button onClick={onDownloadPpt} disabled={downloadingPpt}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50">
              {downloadingPpt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} .pptx
            </button>
          )}
          <button onClick={onToggleExpand} className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-700 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {pptDownloadError && (
        <div className="mx-5 mb-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-3 py-2 text-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{pptDownloadError}
        </div>
      )}

      {isExpanded && (
        <div className="border-t border-violet-500/10 px-5 py-4 space-y-4">
          {mc.description && <p className="text-sm text-slate-400">{mc.description}</p>}
          {mc.keyTopics && (
            <div className="flex flex-wrap gap-1.5">
              {mc.keyTopics.split(',').map((t, i) => (
                <span key={i} className="text-xs bg-slate-800/60 border border-slate-700/60 rounded-full px-2.5 py-0.5 text-slate-400">{t.trim()}</span>
              ))}
            </div>
          )}
          {mc.pptSlides && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              {mc.pptSlides.length} slides
              {(allTemplates.find((t) => t.id === mc.pptTemplateId) ?? mc.pptTemplate)?.name &&
                ` · ${(allTemplates.find((t) => t.id === mc.pptTemplateId) ?? mc.pptTemplate)?.name}`}
            </p>
          )}
          {mc.strategy && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />Marketing Checklist
              </p>
              <StrategyTimeline
                strategy={mc.strategy}
                expandedDays={expandedStratDays}
                onToggleDay={onToggleStratDay}
                checkedActivities={mc.checkedActivities}
                onToggleActivity={onToggleActivity}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
