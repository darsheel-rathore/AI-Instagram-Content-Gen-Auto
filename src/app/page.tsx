'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Reel } from '@/lib/types'
import ReelCard from '@/components/ReelCard'
import MetricsOverview from '@/components/MetricsOverview'
import PerformanceChart from '@/components/PerformanceChart'
import ScrapeProgress from '@/components/ScrapeProgress'
import CompetitorSection from '@/components/CompetitorSection'
import ComparisonView from '@/components/ComparisonView'
import PromptFactory, { type PromptTemplate } from '@/components/PromptFactory'
import {
  RefreshCw, LayoutDashboard, Users2, Lightbulb, AlertCircle,
  Loader2, Sparkles, Filter, Plus, Clock, GitCompare, History,
  SlidersHorizontal, Zap, Wand2, ChevronDown, ChevronRight, Trash2,
} from 'lucide-react'
import clsx from 'clsx'

type Tab = 'mine' | 'competitors' | 'compare' | 'ideas'
type ScrapeState = 'idle' | 'starting' | 'polling' | 'fetching' | 'done' | 'error'
type PerfFilter = 'all' | 'top' | 'mid' | 'low'
type AIProvider = 'anthropic' | 'openai' | 'gemini'
type GenerationRecord = {
  id: string
  generatedAt: string
  ideas: string
  provider?: AIProvider
  promptName?: string
  competitorUsernames?: string[]
}
type SortBy = 'views' | 'likes' | 'comments'

const MAX_SAVED_GENERATIONS = 15

const MODEL_NAMES: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}
const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Claude',
  openai: 'GPT-4o',
  gemini: 'Gemini',
}

const MY_USERNAME = process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'your_username'
const MY_URL = `https://www.instagram.com/${MY_USERNAME}/`

// --- Helpers -----------------------------------------------------------------

async function pollStatus(runId: string): Promise<string> {
  const res = await fetch(`/api/scrape-status?runId=${runId}`)
  const data = await res.json()
  return data.status as string
}

async function startAndWait(
  instagramUrl: string,
  limit: number,
  onStatus: (s: ScrapeState) => void,
  onlyPostsNewerThan?: string,
): Promise<Reel[]> {
  onStatus('starting')
  const startRes = await fetch('/api/start-scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instagramUrl, limit, onlyPostsNewerThan }),
  })
  if (!startRes.ok) {
    const err = await startRes.json()
    throw new Error(err.error ?? 'Failed to start scrape')
  }
  const { runId, datasetId } = await startRes.json()

  onStatus('polling')
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 6_000))
    const status = await pollStatus(runId)
    if (status === 'SUCCEEDED') break
    if (status === 'FAILED' || status === 'ABORTED') throw new Error('Apify run failed')
  }

  onStatus('fetching')
  const res = await fetch(`/api/scrape-results?datasetId=${datasetId}&limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch results')
  const { reels } = await res.json()
  return reels as Reel[]
}

async function saveCache(key: string, data: unknown) {
  await fetch('/api/cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, data }),
  })
}

async function loadCache<T>(key: string): Promise<T | null> {
  const res = await fetch(`/api/cache?key=${key}`)
  const { data } = await res.json()
  return data as T | null
}

function formatGenDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' Â· ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function parseTranscribeError(msg: string): string {
  if (msg.includes('insufficient_quota') || msg.includes('exceeded your current quota')) {
    return 'No OpenAI credits - top up at platform.openai.com/account/billing'
  }
  if (msg.includes('invalid_api_key') || msg.includes('Incorrect API key')) {
    return 'Invalid OpenAI API key - check OPENAI_API_KEY in .env.local'
  }
  if (msg.includes('Audio download failed')) {
    return 'Could not download audio - the URL may have expired. Try re-syncing.'
  }
  return msg.replace('Whisper API error: ', '').slice(0, 120)
}

const SCRAPE_MSG: Record<ScrapeState, string> = {
  idle: '', starting: 'Starting Apify scraper...',
  polling: 'Scraping Instagram reels... (1-3 min)',
  fetching: 'Downloading results...', done: '', error: '',
}

// --- Page ---------------------------------------------------------------------

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('mine')

  // My reels
  const [cacheLoading, setCacheLoading] = useState(true)
  const [myReels, setMyReels] = useState<Reel[]>([])
  const [myLastSynced, setMyLastSynced] = useState<string | null>(null)
  const [myScrapeState, setMyScrapeState] = useState<ScrapeState>('idle')
  const [myError, setMyError] = useState('')
  const [perfFilter, setPerfFilter] = useState<PerfFilter>('all')
  const [transcribingId, setTranscribingId] = useState<string | null>(null)

  // Competitors
  const [competitors, setCompetitors] = useState<Record<string, Reel[]>>({})
  const [compLastSynced, setCompLastSynced] = useState<Record<string, string>>({})
  const [scrapingUsernames, setScrapingUsernames] = useState<Set<string>>(new Set())
  const [compErrors, setCompErrors] = useState<Record<string, string>>({})
  const [newUsername, setNewUsername] = useState('')
  const [expandedCompetitors, setExpandedCompetitors] = useState<Set<string>>(new Set())
  const [compTranscribingId, setCompTranscribingId] = useState<string | null>(null)
  const [compTranscribeErrors, setCompTranscribeErrors] = useState<Record<string, string>>({})
  const [compBulkTranscribing, setCompBulkTranscribing] = useState<Record<string, { current: number; total: number }>>({})
  const compBulkTranscribingRef = useRef<Record<string, boolean>>({})

  // Crawl filters
  const [compFilterReels, setCompFilterReels] = useState(15)
  const [compFilterDays, setCompFilterDays] = useState(30)
  const [compFilterSort, setCompFilterSort] = useState<SortBy>('views')
  const [compCustomReels, setCompCustomReels] = useState('')
  const [compCustomDays, setCompCustomDays] = useState('')
  const compFilterReelsRef = useRef(15)
  const compFilterDaysRef = useRef(30)
  const compFilterSortRef = useRef<SortBy>('views')

  // Ideas
  const [ideasHistory, setIdeasHistory] = useState<GenerationRecord[]>([])
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [ideasError, setIdeasError] = useState('')
  const [selectedCompForIdeas, setSelectedCompForIdeas] = useState<Set<string>>(new Set())

  // Prompt factory
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [noPromptDialog, setNoPromptDialog] = useState(false)

  // AI provider selection + report deletion
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Per-creator reel selection for ideas
  const [selectedCompReelIds, setSelectedCompReelIds] = useState<Record<string, Set<string>>>({})
  const [expandedReelPickers, setExpandedReelPickers] = useState<Set<string>>(new Set())

  const myReelsRef = useRef(myReels)
  const competitorsRef = useRef(competitors)
  const selectedCompForIdeasRef = useRef(selectedCompForIdeas)
  const promptTemplatesRef = useRef(promptTemplates)
  const selectedPromptIdRef = useRef(selectedPromptId)
  const selectedCompReelIdsRef = useRef<Record<string, Set<string>>>({})
  const selectedProviderRef = useRef<AIProvider>('gemini')
  useEffect(() => { myReelsRef.current = myReels }, [myReels])
  useEffect(() => { competitorsRef.current = competitors }, [competitors])
  useEffect(() => { selectedCompForIdeasRef.current = selectedCompForIdeas }, [selectedCompForIdeas])
  useEffect(() => { promptTemplatesRef.current = promptTemplates }, [promptTemplates])
  useEffect(() => { selectedPromptIdRef.current = selectedPromptId }, [selectedPromptId])
  useEffect(() => { selectedCompReelIdsRef.current = selectedCompReelIds }, [selectedCompReelIds])
  useEffect(() => { selectedProviderRef.current = selectedProvider }, [selectedProvider])
  useEffect(() => { compFilterReelsRef.current = compFilterReels }, [compFilterReels])
  useEffect(() => { compFilterDaysRef.current = compFilterDays }, [compFilterDays])
  useEffect(() => { compFilterSortRef.current = compFilterSort }, [compFilterSort])

  // Keep selectedCompForIdeas in sync as competitors are added / removed
  useEffect(() => {
    setSelectedCompForIdeas((prev) => {
      const updated = new Set(Array.from(prev))
      Object.keys(competitors).forEach((u) => updated.add(u))
      Array.from(prev).forEach((u) => { if (!competitors[u]) updated.delete(u) })
      return updated
    })
  }, [competitors])

  // --- Load cache on mount --------------------------------------------------
  useEffect(() => {
    Promise.all([
      loadCache<{ reels: Reel[]; fetchedAt?: string }>('my_reels'),
      loadCache<{ accounts: Record<string, { reels: Reel[]; fetchedAt: string }> }>('competitors'),
      loadCache<GenerationRecord[]>('content_ideas'),
      loadCache<string[]>('competitor_expand_state'),
      loadCache<{ templates: PromptTemplate[]; selectedId: string | null }>('prompt_templates'),
    ]).then(([myCache, compCache, ideasCache, expandCache, promptCache]) => {
      if (myCache?.reels?.length) {
        setMyReels(myCache.reels)
        setMyLastSynced(myCache.fetchedAt ?? null)
        setMyScrapeState('done')
      }
      if (compCache?.accounts) {
        const reels: Record<string, Reel[]> = {}
        const synced: Record<string, string> = {}
        for (const [u, v] of Object.entries(compCache.accounts)) {
          reels[u] = v.reels
          synced[u] = v.fetchedAt
        }
        setCompetitors(reels)
        setCompLastSynced(synced)
      }
      if (ideasCache?.length) {
        setIdeasHistory(ideasCache)
        setSelectedIdeaId(ideasCache[0].id)
      }
      if (expandCache?.length) {
        setExpandedCompetitors(new Set(expandCache))
      }
      if (promptCache?.templates?.length) {
        setPromptTemplates(promptCache.templates)
        setSelectedPromptId(promptCache.selectedId ?? promptCache.templates[0].id)
      }
      setCacheLoading(false)
    })
  }, [])

  // --- Fetch my reels -------------------------------------------------------
  const fetchMyReels = useCallback(async () => {
    setMyError('')
    try {
      const reels = await startAndWait(MY_URL, 30, setMyScrapeState)
      const now = new Date().toISOString()
      setMyReels(reels)
      setMyLastSynced(now)
      setMyScrapeState('done')
      await saveCache('my_reels', { reels, fetchedAt: now })
    } catch (e: unknown) {
      setMyError(e instanceof Error ? e.message : String(e))
      setMyScrapeState('error')
    }
  }, [])

  // --- Fetch a single competitor --------------------------------------------
  const fetchCompetitor = useCallback(async (username: string) => {
    const limit = compFilterReelsRef.current
    const days = compFilterDaysRef.current
    const sortBy = compFilterSortRef.current
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const url = `https://www.instagram.com/${username}/`
    setScrapingUsernames((prev) => new Set(Array.from(prev).concat(username)))
    setCompErrors((prev) => { const n = { ...prev }; delete n[username]; return n })
    try {
      const fetched = await startAndWait(url, limit, () => {}, cutoff)
      const reels = [...fetched].sort((a, b) => {
        const val = (r: Reel) => sortBy === 'views' ? r.views : sortBy === 'likes' ? r.likes : r.comments
        return val(b) - val(a)
      })
      const now = new Date().toISOString()
      setCompetitors((prev) => {
        const updated = { ...prev, [username]: reels }
        // save all to cache
        const accounts: Record<string, { reels: Reel[]; fetchedAt: string }> = {}
        for (const [u, r] of Object.entries(updated)) {
          accounts[u] = { reels: r, fetchedAt: compLastSynced[u] ?? now }
        }
        accounts[username] = { reels, fetchedAt: now }
        saveCache('competitors', { accounts })
        return updated
      })
      setCompLastSynced((prev) => ({ ...prev, [username]: now }))
      setExpandedCompetitors((prev) => {
        const updated = new Set(Array.from(prev))
        updated.add(username)
        saveCache('competitor_expand_state', Array.from(updated))
        return updated
      })
    } catch (e: unknown) {
      setCompErrors((prev) => ({ ...prev, [username]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setScrapingUsernames((prev) => { const n = new Set(Array.from(prev)); n.delete(username); return n })
    }
  }, [compLastSynced])

  const toggleCompetitor = useCallback((username: string) => {
    setExpandedCompetitors((prev) => {
      const updated = new Set(Array.from(prev))
      if (updated.has(username)) updated.delete(username)
      else updated.add(username)
      saveCache('competitor_expand_state', Array.from(updated))
      return updated
    })
  }, [])

  const addCompetitor = useCallback(() => {
    const clean = newUsername.replace('@', '').trim().toLowerCase()
    if (!clean) return
    setNewUsername('')
    if (!competitors[clean]) fetchCompetitor(clean)
  }, [newUsername, competitors, fetchCompetitor])

  const transcribeCompetitorReel = useCallback(async (username: string, reel: Reel) => {
    if (!reel.audioUrl && !reel.videoUrl) return
    setCompTranscribingId(reel.id)
    setCompTranscribeErrors((prev) => { const n = { ...prev }; delete n[reel.id]; return n })
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: reel.audioUrl, videoUrl: reel.videoUrl, duration: reel.duration }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error as string)
      if (data.transcript) {
        setCompetitors((prev) => {
          const updated = {
            ...prev,
            [username]: (prev[username] ?? []).map((r) =>
              r.id === reel.id
                ? { ...r, transcript: data.transcript as string, transcriptPartial: data.partial === true }
                : r
            ),
          }
          const accounts: Record<string, { reels: Reel[]; fetchedAt: string }> = {}
          for (const [u, r] of Object.entries(updated)) {
            accounts[u] = { reels: r, fetchedAt: compLastSynced[u] ?? '' }
          }
          saveCache('competitors', { accounts })
          return updated
        })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setCompTranscribeErrors((prev) => ({ ...prev, [reel.id]: parseTranscribeError(msg) }))
    } finally {
      setCompTranscribingId(null)
    }
  }, [compLastSynced])

  const transcribeAllCompetitorReels = useCallback(async (username: string) => {
    const reels = competitorsRef.current[username] ?? []
    const toTranscribe = reels.filter((r) => !r.transcript && (r.audioUrl || r.videoUrl))

    if (toTranscribe.length === 0) return

    compBulkTranscribingRef.current[username] = true
    setCompBulkTranscribing((prev) => ({ ...prev, [username]: { current: 0, total: toTranscribe.length } }))

    for (let i = 0; i < toTranscribe.length; i++) {
      if (!compBulkTranscribingRef.current[username]) break
      const reel = toTranscribe[i]

      setCompBulkTranscribing((prev) => ({ ...prev, [username]: { current: i + 1, total: toTranscribe.length } }))
      setCompTranscribingId(reel.id)

      setCompTranscribeErrors((prev) => { const n = { ...prev }; delete n[reel.id]; return n })
      try {
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrl: reel.audioUrl, videoUrl: reel.videoUrl, duration: reel.duration }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error as string)
        if (data.transcript) {
          setCompetitors((prev) => {
            const updated = {
              ...prev,
              [username]: (prev[username] ?? []).map((r) =>
                r.id === reel.id
                  ? { ...r, transcript: data.transcript as string, transcriptPartial: data.partial === true }
                  : r
              ),
            }
            const accounts: Record<string, { reels: Reel[]; fetchedAt: string }> = {}
            for (const [u, r] of Object.entries(updated)) {
              accounts[u] = { reels: r, fetchedAt: compLastSynced[u] ?? '' }
            }
            saveCache('competitors', { accounts })
            return updated
          })
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setCompTranscribeErrors((prev) => ({ ...prev, [reel.id]: parseTranscribeError(msg) }))
      }
    }

    delete compBulkTranscribingRef.current[username]
    setCompTranscribingId(null)
    setCompBulkTranscribing((prev) => {
      const updated = { ...prev }
      delete updated[username]
      return updated
    })
  }, [compLastSynced])

  const removeCompetitor = useCallback((username: string) => {
    setCompetitors((prev) => {
      const updated = { ...prev }
      delete updated[username]
      const accounts: Record<string, { reels: Reel[]; fetchedAt: string }> = {}
      for (const [u, r] of Object.entries(updated)) {
        accounts[u] = { reels: r, fetchedAt: compLastSynced[u] ?? '' }
      }
      saveCache('competitors', { accounts })
      return updated
    })
    setCompLastSynced((prev) => { const n = { ...prev }; delete n[username]; return n })
    setExpandedCompetitors((prev) => {
      const updated = new Set(Array.from(prev))
      updated.delete(username)
      saveCache('competitor_expand_state', Array.from(updated))
      return updated
    })
  }, [compLastSynced])

  // --- Prompt factory -------------------------------------------------------
  const savePromptTemplate = useCallback((template: PromptTemplate) => {
    setPromptTemplates((prev) => {
      const exists = prev.some((t) => t.id === template.id)
      const updated = exists
        ? prev.map((t) => t.id === template.id ? template : t)
        : [...prev, template]
      const selId = selectedPromptIdRef.current ?? template.id
      if (!selectedPromptIdRef.current) setSelectedPromptId(template.id)
      saveCache('prompt_templates', { templates: updated, selectedId: selId })
      return updated
    })
  }, [])

  const deletePromptTemplate = useCallback((id: string) => {
    setPromptTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== id)
      const newSel = selectedPromptIdRef.current === id ? (updated[0]?.id ?? null) : selectedPromptIdRef.current
      setSelectedPromptId(newSel)
      saveCache('prompt_templates', { templates: updated, selectedId: newSel })
      return updated
    })
  }, [])

  const selectPromptTemplate = useCallback((id: string) => {
    setSelectedPromptId(id)
    saveCache('prompt_templates', { templates: promptTemplatesRef.current, selectedId: id })
  }, [])

  // --- Transcribe -----------------------------------------------------------
  const handleTranscribe = useCallback(async (reel: Reel) => {
    if (!reel.audioUrl) return
    setTranscribingId(reel.id)
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: reel.audioUrl }),
      })
      const data = await res.json()
      if (data.transcript) {
        setMyReels((prev) => {
          const updated = prev.map((r) => r.id === reel.id ? { ...r, transcript: data.transcript } : r)
          saveCache('my_reels', { reels: updated, fetchedAt: myLastSynced })
          return updated
        })
      }
    } finally {
      setTranscribingId(null)
    }
  }, [myLastSynced])

  // --- Generate ideas -------------------------------------------------------
  const generateIdeas = useCallback(async () => {
    if (promptTemplatesRef.current.length === 0) {
      setNoPromptDialog(true)
      return
    }
    const activePrompt =
      promptTemplatesRef.current.find((t) => t.id === selectedPromptIdRef.current) ??
      promptTemplatesRef.current[0]

    setIdeasLoading(true)
    setIdeasError('')
    try {
      const sel = selectedCompForIdeasRef.current
      const reelSel = selectedCompReelIdsRef.current
      const all = competitorsRef.current
      const allKeys = Object.keys(all)
      const filteredCompetitorReels = (() => {
        if (sel.size === 0) return {}
        const entries = sel.size >= allKeys.length
          ? Object.entries(all)
          : Object.entries(all).filter(([u]) => sel.has(u))
        return Object.fromEntries(
          entries.map(([u, reels]) => {
            const rids = reelSel[u]
            return [u, rids === undefined ? reels : reels.filter((r) => rids.has(r.id))]
          })
        )
      })()
      const includedCompetitors = Object.keys(filteredCompetitorReels)
      const providerSnapshot = selectedProviderRef.current

      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myReels: myReelsRef.current,
          competitorReels: filteredCompetitorReels,
          systemPrompt: activePrompt.content,
          provider: providerSnapshot,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const record: GenerationRecord = {
        id: Date.now().toString(),
        generatedAt: new Date().toISOString(),
        ideas: data.ideas as string,
        provider: providerSnapshot,
        promptName: activePrompt.name,
        competitorUsernames: includedCompetitors,
      }
      setIdeasHistory((prev) => {
        const updated = [record, ...prev].slice(0, MAX_SAVED_GENERATIONS)
        saveCache('content_ideas', updated)
        return updated
      })
      setSelectedIdeaId(record.id)
    } catch (e: unknown) {
      setIdeasError(e instanceof Error ? e.message : String(e))
    } finally {
      setIdeasLoading(false)
    }
  }, [])

  const filteredReels = perfFilter === 'all' ? myReels : myReels.filter((r) => r.performance === perfFilter)
  const competitorUsernames = Object.keys(competitors).reverse()
  const selectedIdea = ideasHistory.find((g) => g.id === selectedIdeaId) ?? ideasHistory[0] ?? null

  // --- Tab nav --------------------------------------------------------------
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'mine', label: 'My Reels', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'competitors', label: 'Competitors', icon: <Users2 className="w-4 h-4" /> },
    { id: 'compare', label: 'Compare', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'ideas', label: 'Content Ideas', icon: <Lightbulb className="w-4 h-4" /> },
  ]

  return (
    <main className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0a0f1e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/profile_photo.jpg"
              alt="Profile"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Content Dashboard</h1>
              <p className="text-xs text-slate-500">@{MY_USERNAME}</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  tab === t.id ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* == MY REELS ========================================================== */}
        {tab === 'mine' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">My Reels</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-slate-500 text-sm">Last 30 days Â· @{MY_USERNAME}</p>
                  {myLastSynced && (
                    <span className="flex items-center gap-1 text-xs text-slate-600">
                      <Clock className="w-3 h-3" /> {timeAgo(myLastSynced)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={fetchMyReels}
                disabled={['starting', 'polling', 'fetching'].includes(myScrapeState)}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={clsx('w-4 h-4', myScrapeState === 'polling' && 'animate-spin')} />
                {myLastSynced ? 'Re-sync' : 'Fetch Reels'}
              </button>
            </div>

            {myScrapeState === 'error' && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-4 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{myError}</span>
              </div>
            )}

            {['starting', 'polling', 'fetching'].includes(myScrapeState) && (
              <ScrapeProgress message={SCRAPE_MSG[myScrapeState]} subtext="Apify is scraping your Instagram profile..." />
            )}

            {myReels.length > 0 && !['starting', 'polling', 'fetching'].includes(myScrapeState) && (
              <>
                <MetricsOverview reels={myReels} />
                <PerformanceChart reels={myReels} />
                <div className="flex items-center gap-2 mb-5">
                  <Filter className="w-4 h-4 text-slate-500" />
                  {(['all', 'top', 'mid', 'low'] as PerfFilter[]).map((f) => {
                    const count = f === 'all' ? myReels.length : myReels.filter((r) => r.performance === f).length
                    return (
                      <button
                        key={f}
                        onClick={() => setPerfFilter(f)}
                        className={clsx(
                          'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                          perfFilter === f
                            ? f === 'top' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : f === 'low' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                              : f === 'mid' ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                              : 'bg-slate-700 border-slate-600 text-white'
                            : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                        )}
                      >
                        {f === 'all' ? 'All' : f === 'top' ? 'Top' : f === 'mid' ? 'Average' : 'Low'} ({count})
                      </button>
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredReels.map((reel) => (
                    <ReelCard key={reel.id} reel={reel} onTranscribe={handleTranscribe} transcribing={transcribingId === reel.id} />
                  ))}
                </div>
                {filteredReels.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-12">No reels match this filter.</p>
                )}
              </>
            )}

            {myScrapeState === 'idle' && myReels.length === 0 && (
              cacheLoading ? (
                <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading saved data...</span>
                </div>
              ) : (
                <div className="text-center py-24 border border-dashed border-slate-700 rounded-2xl">
                  <LayoutDashboard className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-white font-semibold mb-2">No data yet</h3>
                  <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                    Fetch your last 30 days of reels. Results are cached locally - no re-scrape needed on refresh.
                  </p>
                  <button onClick={fetchMyReels} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors">
                    Fetch My Reels
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* == COMPETITORS ======================================================= */}
        {tab === 'competitors' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">Competitors</h2>
              <p className="text-slate-500 text-sm mt-0.5">Add any Instagram username to scrape their reels</p>
            </div>

            {/* Crawl filter panel */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-medium text-slate-400">Crawl Settings</span>
                </div>
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-600" />
                  More reels Â· longer window = more Apify credits consumed
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Reels count */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">Reels</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[5, 10, 15].map((n) => (
                      <button
                        key={n}
                        onClick={() => { setCompFilterReels(n); setCompCustomReels('') }}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                          compFilterReels === n && compCustomReels === ''
                            ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                            : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={compCustomReels}
                      onChange={(e) => {
                        setCompCustomReels(e.target.value)
                        const n = parseInt(e.target.value)
                        if (!isNaN(n) && n > 0) setCompFilterReels(n)
                      }}
                      placeholder="Custom"
                      className="w-20 bg-slate-900/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-violet-500 placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* Date window */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">Window</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {([{ label: '24h', val: 1 }, { label: '3d', val: 3 }, { label: '7d', val: 7 }, { label: '15d', val: 15 }, { label: '30d', val: 30 }] as const).map(({ label, val }) => (
                      <button
                        key={val}
                        onClick={() => { setCompFilterDays(val); setCompCustomDays('') }}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                          compFilterDays === val && compCustomDays === ''
                            ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                            : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={compCustomDays}
                      onChange={(e) => {
                        setCompCustomDays(e.target.value)
                        const n = parseInt(e.target.value)
                        if (!isNaN(n) && n > 0) setCompFilterDays(n)
                      }}
                      placeholder="Days"
                      className="w-16 bg-slate-900/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-violet-500 placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* Sort by */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">Sort by</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['views', 'likes', 'comments'] as SortBy[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setCompFilterSort(s)}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-lg border transition-colors capitalize',
                          compFilterSort === s
                            ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                            : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                    <span className="text-xs text-slate-600">Â· Shares &amp; saves not available via public API</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Add competitor input */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
                  placeholder="username"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 placeholder:text-slate-600"
                />
              </div>
              <button
                onClick={addCompetitor}
                disabled={!newUsername.trim()}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> Add & Scrape
              </button>
            </div>

            {/* Active competitors list */}
            {competitorUsernames.length === 0 && Object.keys(scrapingUsernames).length === 0 && (
              <div className="text-center py-20 border border-dashed border-slate-700 rounded-2xl">
                <Users2 className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">No competitors added</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                  Type a username above and click &quot;Add &amp; Scrape&quot;. Try <span className="text-violet-400">nateherk</span> or <span className="text-violet-400">nick_saraev</span>
                </p>
              </div>
            )}

            {/* In-progress scrapes */}
            {Array.from(scrapingUsernames).map((username) => (
              <div key={username} className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  <span className="text-sm text-violet-300 font-medium">Scraping @{username}...</span>
                  <span className="text-xs text-slate-500">Apify is fetching their reels (1-3 min)</span>
                </div>
              </div>
            ))}

            {/* Competitor sections */}
            {competitorUsernames.length > 0 && (
              <div className="space-y-3">
                {competitorUsernames.map((username) => (
                  <CompetitorSection
                    key={username}
                    username={username}
                    reels={competitors[username] ?? []}
                    isExpanded={expandedCompetitors.has(username)}
                    onToggle={() => toggleCompetitor(username)}
                    lastSynced={compLastSynced[username] ?? null}
                    isLoading={scrapingUsernames.has(username)}
                    error={compErrors[username]}
                    onResync={() => fetchCompetitor(username)}
                    onRemove={() => removeCompetitor(username)}
                    onTranscribe={(reel) => transcribeCompetitorReel(username, reel)}
                    transcribingId={compTranscribingId}
                    transcribeErrors={compTranscribeErrors}
                    onTranscribeAll={() => transcribeAllCompetitorReels(username)}
                    onStopTranscribeAll={() => {
                      delete compBulkTranscribingRef.current[username]
                      setCompBulkTranscribing((prev) => { const n = { ...prev }; delete n[username]; return n })
                    }}
                    transcribeAllProgress={compBulkTranscribing[username] ?? null}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* == COMPARE =========================================================== */}
        {tab === 'compare' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">Compare</h2>
              <p className="text-slate-500 text-sm mt-0.5">Me vs competitors - what&apos;s working, what&apos;s not, content gaps</p>
            </div>
            <ComparisonView myReels={myReels} competitors={competitors} />
          </div>
        )}

        {/* == CONTENT IDEAS ==================================================== */}
        {tab === 'ideas' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Content Ideas</h2>
                <p className="text-slate-500 text-sm mt-0.5">AI strategy based on your performance + competitor data</p>
              </div>
              <button
                onClick={generateIdeas}
                disabled={ideasLoading}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ideasLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  : <><Sparkles className="w-4 h-4" /> {ideasHistory.length > 0 ? 'Generate New' : 'Generate Ideas'}</>}
              </button>
            </div>

            {/* ── AI Provider selector ── */}
            <div className="mb-5 flex items-center gap-3 flex-wrap">
              <span className="text-xs text-slate-500 font-medium flex-shrink-0">AI Provider:</span>
              <div className="flex items-center gap-1.5">
                {(['anthropic', 'openai', 'gemini'] as AIProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedProvider(p)}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                      selectedProvider === p
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                    )}
                  >
                    {PROVIDER_LABELS[p]}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-600 font-mono">{MODEL_NAMES[selectedProvider]}</span>
            </div>

            {/* ── Competitor filter ── */}
            {competitorUsernames.length > 0 && (
              <div className="mb-5 p-4 rounded-xl border border-slate-700/60 bg-slate-800/40">
                <p className="text-xs text-slate-500 font-medium mb-3 flex items-center gap-1.5">
                  <Users2 className="w-3.5 h-3.5" />
                  Include competitor research from:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setSelectedCompForIdeas(
                        selectedCompForIdeas.size >= competitorUsernames.length
                          ? new Set()
                          : new Set(competitorUsernames),
                      )
                    }
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                      selectedCompForIdeas.size >= competitorUsernames.length
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                        : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                    )}
                  >
                    All
                  </button>
                  {competitorUsernames.map((username) => (
                    <button
                      key={username}
                      onClick={() =>
                        setSelectedCompForIdeas((prev) => {
                          const updated = new Set(Array.from(prev))
                          if (updated.has(username)) updated.delete(username)
                          else updated.add(username)
                          return updated
                        })
                      }
                      className={clsx(
                        'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                        selectedCompForIdeas.has(username)
                          ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                          : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                      )}
                    >
                      @{username}
                    </button>
                  ))}
                </div>
                {selectedCompForIdeas.size < competitorUsernames.length && (
                  <p className="text-xs text-slate-600 mt-2">
                    {selectedCompForIdeas.size === 0
                      ? 'No creators selected - ideas will be based on your reels only'
                      : `${selectedCompForIdeas.size} of ${competitorUsernames.length} creators selected`}
                  </p>
                )}

                {/* Per-creator reel pickers */}
                {competitorUsernames
                  .filter((u) => selectedCompForIdeas.has(u) && (competitors[u]?.length ?? 0) > 0)
                  .map((username) => {
                    const reels = competitors[username] ?? []
                    const selected = selectedCompReelIds[username]
                    const selCount = selected === undefined ? reels.length : selected.size
                    const isPartial = selected !== undefined
                    const isExpanded = expandedReelPickers.has(username)

                    return (
                      <div key={username} className="mt-2 rounded-lg border border-slate-700/40 bg-slate-900/20 overflow-hidden">
                        {/* Picker header */}
                        <div className="flex items-center gap-1 px-3 py-1.5">
                          <button
                            onClick={() => setExpandedReelPickers((prev) => {
                              const next = new Set(Array.from(prev))
                              next.has(username) ? next.delete(username) : next.add(username)
                              return next
                            })}
                            className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                          >
                            {isExpanded
                              ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                              : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />}
                            <span className="text-xs text-slate-400">@{username}</span>
                            <span className={clsx(
                              'text-xs ml-1.5',
                              isPartial && selCount === 0 ? 'text-rose-500'
                              : isPartial ? 'text-violet-400'
                              : 'text-slate-600',
                            )}>
                              {selCount}/{reels.length} reels
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              if (selected === undefined) {
                                setSelectedCompReelIds((prev) => ({ ...prev, [username]: new Set() }))
                              } else {
                                setSelectedCompReelIds((prev) => { const n = { ...prev }; delete n[username]; return n })
                              }
                            }}
                            className={clsx(
                              'text-xs px-2 py-0.5 rounded border transition-colors flex-shrink-0',
                              selected === undefined
                                ? 'border-violet-500/40 text-violet-400 hover:bg-violet-500/10'
                                : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600',
                            )}
                          >{selected === undefined ? 'Deselect All' : 'Select All'}</button>
                        </div>

                        {/* Expanded reel list */}
                        {isExpanded && (
                          <div className="border-t border-slate-700/40 max-h-52 overflow-y-auto">
                            {reels.map((reel) => {
                              const isChecked = selected === undefined || selected.has(reel.id)
                              return (
                                <label
                                  key={reel.id}
                                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-800/40 last:border-0"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedCompReelIds((prev) => {
                                        const cur = prev[username]
                                        let next: Set<string>
                                        if (cur === undefined) {
                                          next = new Set(reels.map((r) => r.id).filter((id) => id !== reel.id))
                                        } else if (cur.has(reel.id)) {
                                          next = new Set(Array.from(cur).filter((id) => id !== reel.id))
                                        } else {
                                          next = new Set(Array.from(cur).concat(reel.id))
                                        }
                                        if (next.size === reels.length) {
                                          const updated = { ...prev }
                                          delete updated[username]
                                          return updated
                                        }
                                        return { ...prev, [username]: next }
                                      })
                                    }}
                                    className="w-3.5 h-3.5 flex-shrink-0 accent-violet-500 cursor-pointer"
                                  />
                                  {reel.thumbnailUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={`/api/proxy-image?url=${encodeURIComponent(reel.thumbnailUrl)}`}
                                      alt=""
                                      className="w-7 h-9 rounded object-cover flex-shrink-0 bg-slate-800"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-300">{reel.views.toLocaleString()} views Â· {reel.likes.toLocaleString()} likes</p>
                                    <p className="text-xs text-slate-600 truncate">{reel.caption.slice(0, 100)}</p>
                                  </div>
                                  {reel.transcript && (
                                    <span className="text-xs text-emerald-600/70 flex-shrink-0 font-medium">transcribed</span>
                                  )}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}

            {/* -- Prompt Factory -- */}
            <PromptFactory
              templates={promptTemplates}
              selectedId={selectedPromptId}
              onSelect={selectPromptTemplate}
              onSave={savePromptTemplate}
              onDelete={deletePromptTemplate}
            />

            {(myReels.length === 0 || competitorUsernames.length === 0) && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-4 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  {myReels.length === 0 && 'Fetch your reels first (My Reels tab). '}
                  {competitorUsernames.length === 0 && 'Add competitors (Competitors tab) for better ideas.'}
                </span>
              </div>
            )}

            {ideasError && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-4 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{ideasError}</span>
              </div>
            )}

            {ideasLoading && (
              <ScrapeProgress message="Analyzing your content + competitors..." subtext="AI is reviewing data and generating a strategy" />
            )}

            {/* -- History selector -- */}
            {ideasHistory.length > 0 && !ideasLoading && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border border-slate-700/60 bg-slate-800/40">
                <History className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <select
                  value={selectedIdeaId ?? ''}
                  onChange={(e) => setSelectedIdeaId(e.target.value)}
                  className="flex-1 bg-slate-900/60 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {ideasHistory.map((g, i) => (
                    <option key={g.id} value={g.id}>
                      {[
                        `#${ideasHistory.length - i} - ${formatGenDate(g.generatedAt)}${i === 0 ? ' (latest)' : ''}`,
                        g.provider ? PROVIDER_LABELS[g.provider] : null,
                        g.promptName ? `"${g.promptName}"` : null,
                        g.competitorUsernames?.length ? g.competitorUsernames.map(u => `@${u}`).join(', ') : null,
                      ].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500 flex-shrink-0">{ideasHistory.length}/{MAX_SAVED_GENERATIONS} saved</span>
              </div>
            )}

            {/* -- Selected generation content -- */}
            {selectedIdea && !ideasLoading && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-300">Content Strategy Report</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{formatGenDate(selectedIdea.generatedAt)}</span>
                    {deleteConfirmId === selectedIdea.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">Delete this report?</span>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-xs px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                        >Cancel</button>
                        <button
                          onClick={() => {
                            setIdeasHistory((prev) => {
                              const updated = prev.filter((g) => g.id !== selectedIdea.id)
                              saveCache('content_ideas', updated)
                              setSelectedIdeaId(updated[0]?.id ?? null)
                              return updated
                            })
                            setDeleteConfirmId(null)
                          }}
                          className="text-xs px-2 py-0.5 rounded border border-rose-500/50 text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >Delete</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(selectedIdea.id)}
                        className="p-1 text-slate-600 hover:text-rose-400 transition-colors rounded"
                        title="Delete report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata chips */}
                <div className="flex flex-wrap gap-1.5 mb-5 pb-4 border-b border-emerald-500/10">
                  {selectedIdea.provider && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                      {PROVIDER_LABELS[selectedIdea.provider]} · {MODEL_NAMES[selectedIdea.provider]}
                    </span>
                  )}
                  {selectedIdea.promptName && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300">
                      {selectedIdea.promptName}
                    </span>
                  )}
                  {selectedIdea.competitorUsernames?.map((u) => (
                    <span key={u} className="text-xs px-2 py-0.5 rounded-md bg-slate-700/60 border border-slate-600/40 text-slate-400">
                      @{u}
                    </span>
                  ))}
                  {!selectedIdea.provider && !selectedIdea.promptName && (
                    <span className="text-xs text-slate-600 italic">No metadata recorded for this generation</span>
                  )}
                </div>
                <div className="space-y-1">
                  {selectedIdea.ideas.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-2" />
                    if (line.match(/^\*\*.*\*\*$/) || line.match(/^#{1,3} /)) {
                      return <h3 key={i} className="text-base font-bold text-white mt-5 mb-2 pt-2">{line.replace(/\*\*/g, '').replace(/^#{1,3} /, '')}</h3>
                    }
                    if (line.startsWith('- ') || line.startsWith('-¢ ')) {
                      return (
                        <div key={i} className="flex gap-2 text-slate-300 text-sm py-0.5">
                          <span className="text-emerald-400 flex-shrink-0 mt-0.5">-¢</span>
                          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                        </div>
                      )
                    }
                    return <p key={i} className="text-slate-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                  })}
                </div>
              </div>
            )}

            {ideasHistory.length === 0 && !ideasLoading && (
              <div className="text-center py-24 border border-dashed border-slate-700 rounded-2xl">
                <Lightbulb className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">No ideas yet</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                  Click &ldquo;Generate Ideas&rdquo; - AI will analyze your top performers vs competitors and tell you exactly what to make next.
                </p>
                <button onClick={generateIdeas} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors">
                  Generate Ideas
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* -- No-prompt dialog -- */}
      {noPromptDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setNoPromptDialog(false)}
          />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Wand2 className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">No Prompt Set Up</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Create a prompt in Prompt Factory before generating ideas. Your prompt tells the AI how to think,
                  whose voice to write in, and what kind of content to suggest.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNoPromptDialog(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setNoPromptDialog(false)}
                className="px-4 py-2 text-xs text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
              >
                Set Up Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
