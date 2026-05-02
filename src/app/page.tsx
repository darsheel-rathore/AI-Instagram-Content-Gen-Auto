'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Reel } from '@/lib/types'
import ReelCard from '@/components/ReelCard'
import MetricsOverview from '@/components/MetricsOverview'
import PerformanceChart from '@/components/PerformanceChart'
import ScrapeProgress from '@/components/ScrapeProgress'
import CompetitorSection from '@/components/CompetitorSection'
import ComparisonView from '@/components/ComparisonView'
import PromptFactory, { type PromptTemplate } from '@/components/PromptFactory'
import PdfSection from '@/components/PdfSection'
import MasterclassTab from '@/components/MasterclassTab'
import StoryTab from '@/components/StoryTab'
import {
  RefreshCw, LayoutDashboard, Users2, Lightbulb, AlertCircle,
  Loader2, Sparkles, Filter, Plus, Clock, GitCompare, History,
  SlidersHorizontal, Zap, Wand2, ChevronDown, ChevronRight, Trash2,
  Settings, LogOut, FileText, BarChart2, Star, GraduationCap, Layers, Download,
} from 'lucide-react'
import clsx from 'clsx'
import type { PdfContent } from '@/lib/pdf-templates'

type Tab = 'mine' | 'competitors' | 'compare' | 'ideas' | 'masterclass' | 'story'
type ScrapeState = 'idle' | 'starting' | 'polling' | 'fetching' | 'done' | 'error'
type PerfFilter = 'all' | 'top' | 'mid' | 'low'
type AIProvider = 'anthropic' | 'openai' | 'gemini'
type GenerationRecord = {
  id: string
  generatedAt: string
  ideas: string
  provider?: AIProvider
  model?: string
  promptName?: string
  competitorUsernames?: string[]
}
type StarredIdea = {
  id: string
  title: string
  content: string
  starredAt: string
  generationId?: string
  provider?: string
  model?: string
  promptName?: string
  competitors?: string[]
}
type SortBy = 'views' | 'likes' | 'comments'

const MAX_SAVED_GENERATIONS = 15

type ModelCost = 'expensive' | 'moderate' | 'cheap'

const PROVIDER_MODELS: Record<AIProvider, { id: string; label: string; cost: ModelCost; description: string }[]> = {
  anthropic: [
    { id: 'claude-opus-4-7',          label: 'Opus 4.7',             cost: 'expensive', description: 'Most capable, slowest'     },
    { id: 'claude-sonnet-4-6',        label: 'Sonnet 4.6',           cost: 'moderate',  description: 'Balanced speed & quality'  },
    { id: 'claude-haiku-4-5-20251001',label: 'Haiku 4.5',            cost: 'cheap',     description: 'Fastest, cheapest'         },
  ],
  openai: [
    { id: 'gpt-4o',                   label: 'GPT-4o',               cost: 'expensive', description: 'Most capable'              },
    { id: 'gpt-4o-mini',              label: 'GPT-4o mini',          cost: 'cheap',     description: 'Fast & affordable'         },
  ],
  gemini: [
    { id: 'gemini-2.5-pro',           label: 'Gemini 2.5 Pro',       cost: 'expensive', description: 'Most capable'              },
    { id: 'gemini-2.5-flash',         label: 'Gemini 2.5 Flash',     cost: 'moderate',  description: 'Balanced'                  },
    { id: 'gemini-2.0-flash-lite',    label: 'Gemini 2.0 Flash Lite',cost: 'cheap',     description: 'Cheapest'                  },
  ],
}

const DEFAULT_MODEL: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Claude',
  openai: 'GPT-4o',
  gemini: 'Gemini',
}

const COST_DOT: Record<ModelCost, string> = {
  expensive: 'bg-rose-500',
  moderate:  'bg-amber-500',
  cheap:     'bg-emerald-500',
}

const ENV_USERNAME = process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'your_username'

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
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
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
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab')
    return (t as Tab) ?? 'mine'
  })

  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      setTimeout(() => {
        const el = document.querySelector(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [])

  // My reels
  const [cacheLoading, setCacheLoading] = useState(true)
  const [myReels, setMyReels] = useState<Reel[]>([])
  const [myLastSynced, setMyLastSynced] = useState<string | null>(null)
  const [myScrapeState, setMyScrapeState] = useState<ScrapeState>('idle')
  const [myError, setMyError] = useState('')
  const [perfFilter, setPerfFilter] = useState<PerfFilter>('all')
  const [transcribingId, setTranscribingId] = useState<string | null>(null)
  const [analyzingMyReelId, setAnalyzingMyReelId] = useState<string | null>(null)

  // Competitors
  const [competitors, setCompetitors] = useState<Record<string, Reel[]>>({})
  const [compLastSynced, setCompLastSynced] = useState<Record<string, string>>({})
  const [scrapingUsernames, setScrapingUsernames] = useState<Set<string>>(new Set())
  const [compErrors, setCompErrors] = useState<Record<string, string>>({})
  const [newUsername, setNewUsername] = useState('')
  const [expandedCompetitors, setExpandedCompetitors] = useState<Set<string>>(new Set())
  const [compTranscribingId, setCompTranscribingId] = useState<string | null>(null)
  const [analyzingCompReelId, setAnalyzingCompReelId] = useState<string | null>(null)
  const [compTranscribeErrors, setCompTranscribeErrors] = useState<Record<string, string>>({})
  const [compBulkTranscribing, setCompBulkTranscribing] = useState<Record<string, { current: number; total: number }>>({})
  const compBulkTranscribingRef = useRef<Record<string, boolean>>({})
  const [compBulkAnalyzing, setCompBulkAnalyzing] = useState<Record<string, { current: number; total: number }>>({})
  const compBulkAnalyzingRef = useRef<Record<string, boolean>>({})
  const [compAnalyzeErrors, setCompAnalyzeErrors] = useState<Record<string, string>>({})

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
  const [showPromptSizeConfirm, setShowPromptSizeConfirm] = useState(false)
  const [promptSizeEstimate, setPromptSizeEstimate] = useState(0)
  const [promptSizeCounts, setPromptSizeCounts] = useState({ myCount: 0, compReelCount: 0, creatorCount: 0 })

  // AI provider + model selection
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('gemini')
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL['gemini'])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Analysis settings (competitors tab)
  const [analysisPromptTemplates, setAnalysisPromptTemplates] = useState<PromptTemplate[]>([])
  const [selectedAnalysisPromptId, setSelectedAnalysisPromptId] = useState<string | null>(null)
  const [selectedAnalysisProvider, setSelectedAnalysisProvider] = useState<AIProvider>('gemini')
  const [selectedAnalysisModel, setSelectedAnalysisModel] = useState<string>(DEFAULT_MODEL['gemini'])

  // Ideas data sources
  const [ideaDataSources, setIdeaDataSources] = useState<Set<string>>(new Set(['analysis']))

  // Data inclusion toggles (which datasets to send to the AI)
  const [includeMyTopReels, setIncludeMyTopReels] = useState(true)
  const [includeMyLowReels, setIncludeMyLowReels] = useState(true)
  const [includeCompetitorData, setIncludeCompetitorData] = useState(true)

  // PDF export settings
  const [pdfPromptTemplates, setPdfPromptTemplates] = useState<PromptTemplate[]>([])
  const [selectedPdfPromptId, setSelectedPdfPromptId] = useState<string | null>(null)
  const [pdfProvider, setPdfProvider] = useState<AIProvider>('gemini')
  const [pdfModel, setPdfModel] = useState<string>(DEFAULT_MODEL['gemini'])
  const [selectedPdfDesign, setSelectedPdfDesign] = useState<string>('executive')
  const [generatingPdfFor, setGeneratingPdfFor] = useState<string | null>(null)
  const [downloadingPdfFor, setDownloadingPdfFor] = useState<string | null>(null)
  const [pdfContentCache, setPdfContentCache] = useState<Record<string, object>>({})
  const [pdfErrors, setPdfErrors] = useState<Record<string, string>>({})

  // Starred ideas
  const [starredIdeas, setStarredIdeas] = useState<StarredIdea[]>([])

  // Per-creator reel selection for ideas
  const [selectedCompReelIds, setSelectedCompReelIds] = useState<Record<string, Set<string>>>({})
  const [expandedReelPickers, setExpandedReelPickers] = useState<Set<string>>(new Set())

  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Dynamic settings loaded from settings.json
  const [myUsername, setMyUsername] = useState(ENV_USERNAME)
  const [displayName, setDisplayName] = useState('Content Dashboard')
  const [autoSignoutMins, setAutoSignoutMins] = useState(0)
  const myUsernameRef = useRef(ENV_USERNAME)
  const myScrapeLimitRef = useRef(30)

  const myReelsRef = useRef(myReels)
  const competitorsRef = useRef(competitors)
  const selectedCompForIdeasRef = useRef(selectedCompForIdeas)
  const promptTemplatesRef = useRef(promptTemplates)
  const selectedPromptIdRef = useRef(selectedPromptId)
  const selectedCompReelIdsRef = useRef<Record<string, Set<string>>>({})
  const selectedProviderRef = useRef<AIProvider>('gemini')
  const selectedModelRef = useRef<string>(DEFAULT_MODEL['gemini'])
  const analysisPromptTemplatesRef = useRef<PromptTemplate[]>([])
  const selectedAnalysisPromptIdRef = useRef<string | null>(null)
  const selectedAnalysisProviderRef = useRef<AIProvider>('gemini')
  const selectedAnalysisModelRef = useRef<string>(DEFAULT_MODEL['gemini'])
  const ideaDataSourcesRef = useRef<Set<string>>(new Set(['analysis']))
  const pdfPromptTemplatesRef = useRef<PromptTemplate[]>([])
  const selectedPdfPromptIdRef = useRef<string | null>(null)
  const pdfProviderRef = useRef<AIProvider>('gemini')
  const pdfModelRef = useRef<string>(DEFAULT_MODEL['gemini'])
  const selectedPdfDesignRef = useRef<string>('executive')
  const includeMyTopReelsRef = useRef(true)
  const includeMyLowReelsRef = useRef(true)
  const includeCompetitorDataRef = useRef(true)
  const starredIdeasRef = useRef<StarredIdea[]>([])
  useEffect(() => { starredIdeasRef.current = starredIdeas }, [starredIdeas])
  useEffect(() => { myReelsRef.current = myReels }, [myReels])
  useEffect(() => { competitorsRef.current = competitors }, [competitors])
  useEffect(() => { selectedCompForIdeasRef.current = selectedCompForIdeas }, [selectedCompForIdeas])
  useEffect(() => { promptTemplatesRef.current = promptTemplates }, [promptTemplates])
  useEffect(() => { selectedPromptIdRef.current = selectedPromptId }, [selectedPromptId])
  useEffect(() => { selectedCompReelIdsRef.current = selectedCompReelIds }, [selectedCompReelIds])
  useEffect(() => { selectedProviderRef.current = selectedProvider }, [selectedProvider])
  useEffect(() => { selectedModelRef.current = selectedModel }, [selectedModel])
  useEffect(() => { analysisPromptTemplatesRef.current = analysisPromptTemplates }, [analysisPromptTemplates])
  useEffect(() => { selectedAnalysisPromptIdRef.current = selectedAnalysisPromptId }, [selectedAnalysisPromptId])
  useEffect(() => { selectedAnalysisProviderRef.current = selectedAnalysisProvider }, [selectedAnalysisProvider])
  useEffect(() => { selectedAnalysisModelRef.current = selectedAnalysisModel }, [selectedAnalysisModel])
  useEffect(() => { ideaDataSourcesRef.current = ideaDataSources }, [ideaDataSources])
  useEffect(() => { includeMyTopReelsRef.current = includeMyTopReels }, [includeMyTopReels])
  useEffect(() => { includeMyLowReelsRef.current = includeMyLowReels }, [includeMyLowReels])
  useEffect(() => { includeCompetitorDataRef.current = includeCompetitorData }, [includeCompetitorData])
  useEffect(() => { pdfPromptTemplatesRef.current = pdfPromptTemplates }, [pdfPromptTemplates])
  useEffect(() => { selectedPdfPromptIdRef.current = selectedPdfPromptId }, [selectedPdfPromptId])
  useEffect(() => { pdfProviderRef.current = pdfProvider }, [pdfProvider])
  useEffect(() => { pdfModelRef.current = pdfModel }, [pdfModel])
  useEffect(() => { selectedPdfDesignRef.current = selectedPdfDesign }, [selectedPdfDesign])
  useEffect(() => { compFilterReelsRef.current = compFilterReels }, [compFilterReels])
  useEffect(() => { compFilterDaysRef.current = compFilterDays }, [compFilterDays])
  useEffect(() => { compFilterSortRef.current = compFilterSort }, [compFilterSort])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto sign-out on inactivity
  useEffect(() => {
    if (!autoSignoutMins) return
    let timer: ReturnType<typeof setTimeout>
    const ms = autoSignoutMins * 60 * 1000
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/login'
      }, ms)
    }
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => document.removeEventListener(e, reset))
    }
  }, [autoSignoutMins])

  // Keep selectedCompForIdeas in sync: only prune competitors that were removed, never auto-add
  useEffect(() => {
    setSelectedCompForIdeas((prev) => {
      const pruned = new Set(Array.from(prev).filter((u) => competitors[u]))
      return pruned.size === prev.size ? prev : pruned
    })
  }, [competitors])

  // Persist creator + reel selection whenever it changes (after cache has loaded)
  useEffect(() => {
    if (cacheLoading) return
    const selReelIds: Record<string, string[]> = {}
    for (const [u, ids] of Object.entries(selectedCompReelIds)) {
      selReelIds[u] = Array.from(ids)
    }
    saveCache('idea_selection', { selectedComps: Array.from(selectedCompForIdeas), selectedReelIds: selReelIds })
  }, [selectedCompForIdeas, selectedCompReelIds, cacheLoading])

  // --- Load cache on mount --------------------------------------------------
  useEffect(() => {
    Promise.all([
      loadCache<{ reels: Reel[]; fetchedAt?: string }>('my_reels'),
      loadCache<{ accounts: Record<string, { reels: Reel[]; fetchedAt: string }> }>('competitors'),
      loadCache<GenerationRecord[]>('content_ideas'),
      loadCache<string[]>('competitor_expand_state'),
      loadCache<{ templates: PromptTemplate[]; selectedId: string | null }>('prompt_templates'),
      loadCache<{ templates: PromptTemplate[]; selectedId: string | null; provider: AIProvider; model?: string }>('analysis_settings'),
      loadCache<{ selectedComps: string[]; selectedReelIds: Record<string, string[]> }>('idea_selection'),
      loadCache<{ instagramUsername?: string; autoSignoutMinutes?: number; myReelsScrapeLimit?: number; displayName?: string }>('settings'),
      loadCache<{ templates?: PromptTemplate[]; selectedId?: string | null; provider?: AIProvider; model?: string; design?: string }>('pdf_settings'),
      loadCache<StarredIdea[]>('starred_ideas'),
    ]).then(([myCache, compCache, ideasCache, expandCache, promptCache, analysisCache, ideaSelCache, settingsCache, pdfCache, starredCache]) => {
      if (settingsCache?.instagramUsername) {
        setMyUsername(settingsCache.instagramUsername)
        myUsernameRef.current = settingsCache.instagramUsername
      }
      if (settingsCache?.myReelsScrapeLimit) {
        myScrapeLimitRef.current = settingsCache.myReelsScrapeLimit
      }
      if (settingsCache?.displayName) setDisplayName(settingsCache.displayName)
      setAutoSignoutMins(settingsCache?.autoSignoutMinutes ?? 0)
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
      if (analysisCache?.templates?.length) {
        setAnalysisPromptTemplates(analysisCache.templates)
        setSelectedAnalysisPromptId(analysisCache.selectedId ?? analysisCache.templates[0].id)
      }
      if (analysisCache?.provider) {
        setSelectedAnalysisProvider(analysisCache.provider)
        setSelectedAnalysisModel(analysisCache.model ?? DEFAULT_MODEL[analysisCache.provider])
      }
      if (ideaSelCache?.selectedComps) {
        setSelectedCompForIdeas(new Set(ideaSelCache.selectedComps))
      }
      if (ideaSelCache?.selectedReelIds) {
        const hydrated: Record<string, Set<string>> = {}
        for (const [u, ids] of Object.entries(ideaSelCache.selectedReelIds)) {
          hydrated[u] = new Set(ids)
        }
        setSelectedCompReelIds(hydrated)
      }
      if (pdfCache?.templates?.length) {
        setPdfPromptTemplates(pdfCache.templates)
        setSelectedPdfPromptId(pdfCache.selectedId ?? pdfCache.templates[0].id)
      }
      if (pdfCache?.provider) {
        setPdfProvider(pdfCache.provider)
        setPdfModel(pdfCache.model ?? DEFAULT_MODEL[pdfCache.provider])
      }
      if (pdfCache?.design) setSelectedPdfDesign(pdfCache.design)
      if (starredCache?.length) setStarredIdeas(starredCache)
      try {
        const raw = localStorage.getItem('main_pdf_cache')
        if (raw) setPdfContentCache(JSON.parse(raw) as Record<string, object>)
      } catch { /* ignore */ }
      setCacheLoading(false)
    })
  }, [])

  // --- Fetch my reels -------------------------------------------------------
  const fetchMyReels = useCallback(async () => {
    setMyError('')
    try {
      const reels = await startAndWait(`https://www.instagram.com/${myUsernameRef.current}/`, myScrapeLimitRef.current, setMyScrapeState)
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
        let reelAnalysis = undefined
        try {
          const systemPrompt = (analysisPromptTemplatesRef.current.find((t) => t.id === selectedAnalysisPromptIdRef.current) ?? analysisPromptTemplatesRef.current[0])?.content
          const provider = selectedAnalysisProviderRef.current
          const model = selectedAnalysisModelRef.current
          const aRes = await fetch('/api/analyze-reel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: data.transcript, ...(systemPrompt && { systemPrompt }), provider, model }),
          })
          const aData = await aRes.json()
          if (aData.analysis) reelAnalysis = aData.analysis
        } catch { /* analysis failure doesn't block transcript save */ }
        setCompetitors((prev) => {
          const updated = {
            ...prev,
            [username]: (prev[username] ?? []).map((r) =>
              r.id === reel.id
                ? { ...r, transcript: data.transcript as string, transcriptPartial: data.partial === true, ...(reelAnalysis && { reelAnalysis }) }
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
          let reelAnalysis = undefined
          try {
            const systemPrompt = (analysisPromptTemplatesRef.current.find((t) => t.id === selectedAnalysisPromptIdRef.current) ?? analysisPromptTemplatesRef.current[0])?.content
            const provider = selectedAnalysisProviderRef.current
            const model = selectedAnalysisModelRef.current
            const aRes = await fetch('/api/analyze-reel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transcript: data.transcript, ...(systemPrompt && { systemPrompt }), provider, model }),
            })
            const aData = await aRes.json()
            if (aData.analysis) reelAnalysis = aData.analysis
          } catch { /* analysis failure doesn't block transcript save */ }
          setCompetitors((prev) => {
            const updated = {
              ...prev,
              [username]: (prev[username] ?? []).map((r) =>
                r.id === reel.id
                  ? { ...r, transcript: data.transcript as string, transcriptPartial: data.partial === true, ...(reelAnalysis && { reelAnalysis }) }
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

  const analyzeAllCompetitorReels = useCallback(async (username: string) => {
    const reels = competitorsRef.current[username] ?? []
    const toAnalyze = reels.filter((r) => r.transcript && !r.reelAnalysis)
    if (toAnalyze.length === 0) return

    compBulkAnalyzingRef.current[username] = true
    setCompBulkAnalyzing((prev) => ({ ...prev, [username]: { current: 0, total: toAnalyze.length } }))

    for (let i = 0; i < toAnalyze.length; i++) {
      if (!compBulkAnalyzingRef.current[username]) break
      const reel = toAnalyze[i]
      setCompBulkAnalyzing((prev) => ({ ...prev, [username]: { current: i + 1, total: toAnalyze.length } }))
      setAnalyzingCompReelId(reel.id)

      const systemPrompt = (analysisPromptTemplatesRef.current.find((t) => t.id === selectedAnalysisPromptIdRef.current) ?? analysisPromptTemplatesRef.current[0])?.content
      const provider = selectedAnalysisProviderRef.current
      const model = selectedAnalysisModelRef.current

      try {
        const res = await fetch('/api/analyze-reel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: reel.transcript, ...(systemPrompt && { systemPrompt }), provider, model }),
        })
        const data = await res.json()
        if (data.analysis) {
          setCompetitors((prev) => {
            const updated = {
              ...prev,
              [username]: (prev[username] ?? []).map((r) =>
                r.id === reel.id ? { ...r, reelAnalysis: data.analysis } : r
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
      } catch { /* continue on per-reel error */ }
    }

    delete compBulkAnalyzingRef.current[username]
    setAnalyzingCompReelId(null)
    setCompBulkAnalyzing((prev) => {
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

  const handleAnalyzeCompReel = useCallback(async (username: string, reel: Reel) => {
    if (!reel.transcript) return
    setAnalyzingCompReelId(reel.id)
    const systemPrompt = (analysisPromptTemplatesRef.current.find((t) => t.id === selectedAnalysisPromptIdRef.current) ?? analysisPromptTemplatesRef.current[0])?.content
    const provider = selectedAnalysisProviderRef.current
    const model = selectedAnalysisModelRef.current
    try {
      const res = await fetch('/api/analyze-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: reel.transcript, ...(systemPrompt && { systemPrompt }), provider, model }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error as string)
      if (data.analysis) {
        setCompAnalyzeErrors((prev) => { const n = { ...prev }; delete n[reel.id]; return n })
        setCompetitors((prev) => {
          const updated = {
            ...prev,
            [username]: (prev[username] ?? []).map((r) =>
              r.id === reel.id ? { ...r, reelAnalysis: data.analysis } : r
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
      setCompAnalyzeErrors((prev) => ({ ...prev, [reel.id]: msg }))
    } finally {
      setAnalyzingCompReelId(null)
    }
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

  // --- Analysis prompt factory (competitors tab) ----------------------------
  const saveAnalysisPromptTemplate = useCallback((template: PromptTemplate) => {
    setAnalysisPromptTemplates((prev) => {
      const exists = prev.some((t) => t.id === template.id)
      const updated = exists ? prev.map((t) => t.id === template.id ? template : t) : [...prev, template]
      const selId = selectedAnalysisPromptIdRef.current ?? template.id
      if (!selectedAnalysisPromptIdRef.current) setSelectedAnalysisPromptId(template.id)
      saveCache('analysis_settings', { templates: updated, selectedId: selId, provider: selectedAnalysisProviderRef.current, model: selectedAnalysisModelRef.current })
      return updated
    })
  }, [])

  const deleteAnalysisPromptTemplate = useCallback((id: string) => {
    setAnalysisPromptTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== id)
      const newSel = selectedAnalysisPromptIdRef.current === id ? (updated[0]?.id ?? null) : selectedAnalysisPromptIdRef.current
      setSelectedAnalysisPromptId(newSel)
      saveCache('analysis_settings', { templates: updated, selectedId: newSel, provider: selectedAnalysisProviderRef.current, model: selectedAnalysisModelRef.current })
      return updated
    })
  }, [])

  const selectAnalysisPromptTemplate = useCallback((id: string) => {
    setSelectedAnalysisPromptId(id)
    saveCache('analysis_settings', { templates: analysisPromptTemplatesRef.current, selectedId: id, provider: selectedAnalysisProviderRef.current, model: selectedAnalysisModelRef.current })
  }, [])

  const setAnalysisProvider = useCallback((p: AIProvider) => {
    const defaultModel = DEFAULT_MODEL[p]
    setSelectedAnalysisProvider(p)
    setSelectedAnalysisModel(defaultModel)
    saveCache('analysis_settings', { templates: analysisPromptTemplatesRef.current, selectedId: selectedAnalysisPromptIdRef.current, provider: p, model: defaultModel })
  }, [])

  const setAnalysisModel = useCallback((m: string) => {
    setSelectedAnalysisModel(m)
    saveCache('analysis_settings', { templates: analysisPromptTemplatesRef.current, selectedId: selectedAnalysisPromptIdRef.current, provider: selectedAnalysisProviderRef.current, model: m })
  }, [])

  // --- PDF prompt factory ---------------------------------------------------
  const savePdfPromptTemplate = useCallback((template: PromptTemplate) => {
    setPdfPromptTemplates((prev) => {
      const exists = prev.some((t) => t.id === template.id)
      const updated = exists ? prev.map((t) => t.id === template.id ? template : t) : [...prev, template]
      const selId = selectedPdfPromptIdRef.current ?? template.id
      if (!selectedPdfPromptIdRef.current) setSelectedPdfPromptId(template.id)
      saveCache('pdf_settings', { templates: updated, selectedId: selId, provider: pdfProviderRef.current, model: pdfModelRef.current, design: selectedPdfDesignRef.current })
      return updated
    })
  }, [])

  const deletePdfPromptTemplate = useCallback((id: string) => {
    setPdfPromptTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== id)
      const newSel = selectedPdfPromptIdRef.current === id ? (updated[0]?.id ?? null) : selectedPdfPromptIdRef.current
      setSelectedPdfPromptId(newSel)
      saveCache('pdf_settings', { templates: updated, selectedId: newSel, provider: pdfProviderRef.current, model: pdfModelRef.current, design: selectedPdfDesignRef.current })
      return updated
    })
  }, [])

  const selectPdfPromptTemplate = useCallback((id: string) => {
    setSelectedPdfPromptId(id)
    saveCache('pdf_settings', { templates: pdfPromptTemplatesRef.current, selectedId: id, provider: pdfProviderRef.current, model: pdfModelRef.current, design: selectedPdfDesignRef.current })
  }, [])

  const changePdfProvider = useCallback((p: AIProvider) => {
    const m = DEFAULT_MODEL[p]
    setPdfProvider(p)
    setPdfModel(m)
    saveCache('pdf_settings', { templates: pdfPromptTemplatesRef.current, selectedId: selectedPdfPromptIdRef.current, provider: p, model: m, design: selectedPdfDesignRef.current })
  }, [])

  const changePdfModel = useCallback((m: string) => {
    setPdfModel(m)
    saveCache('pdf_settings', { templates: pdfPromptTemplatesRef.current, selectedId: selectedPdfPromptIdRef.current, provider: pdfProviderRef.current, model: m, design: selectedPdfDesignRef.current })
  }, [])

  const changePdfDesign = useCallback((id: string) => {
    setSelectedPdfDesign(id)
    saveCache('pdf_settings', { templates: pdfPromptTemplatesRef.current, selectedId: selectedPdfPromptIdRef.current, provider: pdfProviderRef.current, model: pdfModelRef.current, design: id })
  }, [])

  // --- Generate PDF (AI call → cache → download) ----------------------------
  async function handleGeneratePdf(sectionContent: string, ideaTitle: string) {
    if (generatingPdfFor || downloadingPdfFor) return
    setGeneratingPdfFor(ideaTitle)
    setPdfErrors((prev) => { const n = { ...prev }; delete n[ideaTitle]; return n })
    try {
      const isGiveaway = selectedPdfDesignRef.current === 'giveaway'
      const customPrompt = pdfPromptTemplatesRef.current.find((t) => t.id === selectedPdfPromptIdRef.current)?.content
      const res = await fetch('/api/generate-pdf-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: sectionContent,
          customPrompt: customPrompt ?? undefined,
          provider: pdfProviderRef.current,
          model: pdfModelRef.current,
          ideaTitle,
          template: isGiveaway ? 'giveaway' : 'standard',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error as string)

      // Persist the structured content so the next download skips the AI call
      const cacheKey = `${selectedIdeaId ?? ''}_${ideaTitle}`
      setPdfContentCache((prev) => {
        const updated = { ...prev, [cacheKey]: data }
        try { localStorage.setItem('main_pdf_cache', JSON.stringify(updated)) } catch { /* ignore */ }
        return updated
      })

      await renderAndDownloadPdf(data, ideaTitle, isGiveaway)
    } catch (e: unknown) {
      setPdfErrors((prev) => ({ ...prev, [ideaTitle]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setGeneratingPdfFor(null)
    }
  }

  // --- Download PDF (cached content, no AI call) ----------------------------
  async function handleDownloadPdf(ideaTitle: string) {
    const cacheKey = `${selectedIdeaId ?? ''}_${ideaTitle}`
    const cached = pdfContentCache[cacheKey]
    if (!cached || downloadingPdfFor || generatingPdfFor) return
    setDownloadingPdfFor(ideaTitle)
    setPdfErrors((prev) => { const n = { ...prev }; delete n[ideaTitle]; return n })
    try {
      const isGiveaway = selectedPdfDesignRef.current === 'giveaway'
      await renderAndDownloadPdf(cached, ideaTitle, isGiveaway)
    } catch (e: unknown) {
      setPdfErrors((prev) => ({ ...prev, [ideaTitle]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setDownloadingPdfFor(null)
    }
  }

  // --- Shared render helper (giveaway = Puppeteer, else jsPDF) --------------
  async function renderAndDownloadPdf(data: object, ideaTitle: string, isGiveaway: boolean) {
    if (isGiveaway) {
      const brandName       = localStorage.getItem('pdf_giveaway_brand')    ?? 'Medha'
      const instagramHandle = localStorage.getItem('pdf_giveaway_handle')   ?? 'themedhachannel'
      const customCss       = localStorage.getItem('pdf_giveaway_custom_css') ?? undefined
      const whatsappLink    = localStorage.getItem('pdf_giveaway_whatsapp') ?? undefined
      const website         = localStorage.getItem('pdf_giveaway_website')  ?? undefined
      const pdfRes = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: data, brandName, instagramHandle, customCss, whatsappLink, website }),
      })
      if (!pdfRes.ok) {
        const err = await pdfRes.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'PDF generation failed')
      }
      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safe = ideaTitle.slice(0, 50).replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, '-').toLowerCase()
      a.href = url
      a.download = `${safe || 'giveaway'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const { generateAndDownloadPdf } = await import('@/lib/pdf-templates')
      await generateAndDownloadPdf(data as PdfContent, selectedPdfDesignRef.current)
    }
  }

  // --- Toggle star ----------------------------------------------------------
  function handleToggleStar(ideaTitle: string, sectionContent: string) {
    const selectedIdea = ideasHistory.find((r) => r.id === selectedIdeaId)
    setStarredIdeas((prev) => {
      const alreadyStarred = prev.some((s) => s.title === ideaTitle && s.generationId === selectedIdeaId)
      let updated: StarredIdea[]
      if (alreadyStarred) {
        updated = prev.filter((s) => !(s.title === ideaTitle && s.generationId === selectedIdeaId))
      } else {
        updated = [
          ...prev,
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title: ideaTitle,
            content: sectionContent,
            starredAt: new Date().toISOString(),
            generationId: selectedIdeaId ?? undefined,
            provider: selectedIdea?.provider,
            model: selectedIdea?.model,
            promptName: selectedIdea?.promptName,
            competitors: selectedIdea?.competitorUsernames,
          },
        ]
      }
      saveCache('starred_ideas', updated)
      return updated
    })
  }

  // --- Transcribe -----------------------------------------------------------
  const handleTranscribe = useCallback(async (reel: Reel) => {
    if (!reel.audioUrl && !reel.videoUrl) return
    setTranscribingId(reel.id)
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: reel.audioUrl, videoUrl: reel.videoUrl, duration: reel.duration }),
      })
      const data = await res.json()
      if (data.transcript) {
        let reelAnalysis = undefined
        try {
          const aRes = await fetch('/api/analyze-reel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: data.transcript }),
          })
          const aData = await aRes.json()
          if (aData.analysis) reelAnalysis = aData.analysis
        } catch { /* analysis failure doesn't block transcript save */ }
        setMyReels((prev) => {
          const updated = prev.map((r) =>
            r.id === reel.id
              ? { ...r, transcript: data.transcript as string, transcriptPartial: data.partial === true, ...(reelAnalysis && { reelAnalysis }) }
              : r
          )
          saveCache('my_reels', { reels: updated, fetchedAt: myLastSynced })
          return updated
        })
      }
    } finally {
      setTranscribingId(null)
    }
  }, [myLastSynced])

  const handleAnalyzeMyReel = useCallback(async (reel: Reel) => {
    if (!reel.transcript) return
    setAnalyzingMyReelId(reel.id)
    try {
      const res = await fetch('/api/analyze-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: reel.transcript }),
      })
      const data = await res.json()
      if (data.analysis) {
        setMyReels((prev) => {
          const updated = prev.map((r) => r.id === reel.id ? { ...r, reelAnalysis: data.analysis } : r)
          saveCache('my_reels', { reels: updated, fetchedAt: myLastSynced })
          return updated
        })
      }
    } finally {
      setAnalyzingMyReelId(null)
    }
  }, [myLastSynced])

  // --- Generate ideas -------------------------------------------------------
  function handleStartGenerate() {
    if (promptTemplates.length === 0) { setNoPromptDialog(true); return }
    const template = promptTemplates.find((t) => t.id === selectedPromptId) ?? promptTemplates[0]
    const systemChars = template?.content.length ?? 0
    const perReel = ideaDataSources.has('analysis') ? 280 : ideaDataSources.has('transcript') ? 420 : 220

    // My reels: top 5 + bottom 3, filtered by toggle
    const myCount = (includeMyTopReels ? Math.min(5, myReels.length) : 0)
                  + (includeMyLowReels ? Math.min(3, myReels.length) : 0)

    // Mirror exactly the filtering generateIdeas does so the count matches what's actually sent
    const sel = selectedCompForIdeas
    const allKeys = Object.keys(competitors)
    let compReelCount = 0
    let creatorCount = 0
    if (includeCompetitorData && sel.size > 0) {
      const entries = sel.size >= allKeys.length
        ? Object.entries(competitors)
        : Object.entries(competitors).filter(([u]) => sel.has(u))
      for (const [u, reels] of entries) {
        const rids = selectedCompReelIds[u]
        const filtered = rids === undefined ? reels : reels.filter((r) => rids.has(r.id))
        if (filtered.length > 0) creatorCount++
        compReelCount += Math.min(3, filtered.length)
      }
    }

    const est = systemChars + 120 + (myCount + compReelCount) * perReel
    setPromptSizeEstimate(est)
    setPromptSizeCounts({ myCount, compReelCount, creatorCount })
    setShowPromptSizeConfirm(true)
  }

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
      const modelSnapshot = selectedModelRef.current

      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myReels: myReelsRef.current,
          competitorReels: filteredCompetitorReels,
          systemPrompt: activePrompt.content,
          provider: providerSnapshot,
          model: modelSnapshot,
          dataSources: Array.from(ideaDataSourcesRef.current),
          includeTopReels: includeMyTopReelsRef.current,
          includeLowReels: includeMyLowReelsRef.current,
          includeCompetitorData: includeCompetitorDataRef.current,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const record: GenerationRecord = {
        id: Date.now().toString(),
        generatedAt: new Date().toISOString(),
        ideas: data.ideas as string,
        provider: providerSnapshot,
        model: modelSnapshot,
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
    { id: 'masterclass', label: 'Masterclass', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'story', label: 'Story', icon: <Layers className="w-4 h-4" /> },
  ]

  return (
    <main className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0a0f1e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">

          {/* Left: Tab navigation */}
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

          {/* Right: Profile avatar + dropdown */}
          <div className="relative flex-shrink-0" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-800/70 transition-colors group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white leading-tight tracking-tight">{displayName}</p>
                <p className="text-xs text-slate-500">@{myUsername}</p>
              </div>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/profile_photo.jpg"
                  alt="Profile"
                  className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-700 group-hover:ring-slate-500 transition-all"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0a0f1e]" />
              </div>
              <ChevronDown className={clsx('w-3.5 h-3.5 text-slate-500 transition-transform duration-200 flex-shrink-0', profileOpen && 'rotate-180')} />
            </button>

            {/* Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50">
                {/* Identity */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/profile_photo.jpg" alt="Profile" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                    <p className="text-xs text-slate-500 truncate">@{myUsername}</p>
                  </div>
                </div>
                {/* Actions */}
                <div className="p-1.5 flex flex-col gap-0.5">
                  <a
                    href="/starred"
                    onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <Star className="w-4 h-4 flex-shrink-0" />
                    <span>Starred Ideas</span>
                    {starredIdeas.length > 0 && (
                      <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.5 leading-none">
                        {starredIdeas.length}
                      </span>
                    )}
                  </a>
                  <a
                    href="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-4 h-4 flex-shrink-0" />
                    <span>Settings</span>
                  </a>
                  <a
                    href="/usage"
                    onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <BarChart2 className="w-4 h-4 flex-shrink-0" />
                    <span>Token Usage</span>
                  </a>
                  <button
                    onClick={async () => {
                      setProfileOpen(false)
                      await fetch('/api/auth/logout', { method: 'POST' })
                      window.location.href = '/login'
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

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
                  <p className="text-slate-500 text-sm">Last 30 days · @{myUsername}</p>
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
                    <ReelCard key={reel.id} reel={reel} onTranscribe={handleTranscribe} transcribing={transcribingId === reel.id} onAnalyze={handleAnalyzeMyReel} analyzing={analyzingMyReelId === reel.id} />
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
                  More reels · longer window = more Apify credits consumed
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
                    <span className="text-xs text-slate-600">· Shares &amp; saves not available via public API</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis settings */}
            <PromptFactory
              templates={analysisPromptTemplates}
              selectedId={selectedAnalysisPromptId}
              onSelect={selectAnalysisPromptTemplate}
              onSave={saveAnalysisPromptTemplate}
              onDelete={deleteAnalysisPromptTemplate}
            />
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500 font-medium w-20 flex-shrink-0">Analysis AI:</span>
                <div className="flex items-center gap-1.5">
                  {(['anthropic', 'openai', 'gemini'] as AIProvider[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setAnalysisProvider(p)}
                      className={clsx(
                        'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                        selectedAnalysisProvider === p
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                      )}
                    >
                      {PROVIDER_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500 font-medium w-20 flex-shrink-0">Model:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PROVIDER_MODELS[selectedAnalysisProvider].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setAnalysisModel(m.id)}
                      className={clsx(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
                        selectedAnalysisModel === m.id
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                      )}
                    >
                      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', COST_DOT[m.cost])} />
                      {m.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-600 hidden sm:flex items-center gap-2.5">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />expensive</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />moderate</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />cheap</span>
                </span>
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
                    onAnalyze={(reel) => handleAnalyzeCompReel(username, reel)}
                    analyzingId={analyzingCompReelId}
                    analyzeErrors={compAnalyzeErrors}
                    onAnalyzeAll={() => analyzeAllCompetitorReels(username)}
                    onStopAnalyzeAll={() => {
                      delete compBulkAnalyzingRef.current[username]
                      setCompBulkAnalyzing((prev) => { const n = { ...prev }; delete n[username]; return n })
                    }}
                    analyzeAllProgress={compBulkAnalyzing[username] ?? null}
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
            <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Content Ideas</h2>
                <p className="text-slate-500 text-sm mt-0.5">AI strategy based on your performance + competitor data</p>
              </div>
              <button
                onClick={handleStartGenerate}
                disabled={ideasLoading}
                className="flex-shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ideasLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  : <><Sparkles className="w-4 h-4" /> {ideasHistory.length > 0 ? 'Generate New' : 'Generate Ideas'}</>}
              </button>
            </div>

            {/* ── Generation config card ── */}
            <div className="mb-5 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              {/* Row 1: Provider tabs + Model pills */}
              <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                {/* Provider segmented control */}
                <div className="flex items-center gap-0.5 bg-slate-800/70 rounded-lg p-0.5 flex-shrink-0">
                  {(['anthropic', 'openai', 'gemini'] as AIProvider[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setSelectedProvider(p); setSelectedModel(DEFAULT_MODEL[p]) }}
                      className={clsx(
                        'text-xs px-3 py-1.5 rounded-md font-medium transition-all',
                        selectedProvider === p
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-300',
                      )}
                    >
                      {PROVIDER_LABELS[p]}
                    </button>
                  ))}
                </div>

                <div className="w-px h-4 bg-slate-700/80 hidden sm:block flex-shrink-0" />

                {/* Model pills — auto-updates when provider changes */}
                <div className="flex items-center gap-1 flex-wrap">
                  {PROVIDER_MODELS[selectedProvider].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      title={m.description}
                      className={clsx(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all',
                        selectedModel === m.id
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800',
                      )}
                    >
                      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', COST_DOT[m.cost])} />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-800" />

              {/* Row 2: Context toggles */}
              <div className="flex items-center gap-1 px-4 py-3 flex-wrap">
                <span className="text-xs text-slate-600 font-medium mr-2 flex-shrink-0">Context</span>
                {(['analysis', 'transcript', 'caption'] as const).map((src) => {
                  const active = ideaDataSources.has(src)
                  return (
                    <button
                      key={src}
                      onClick={() => setIdeaDataSources((prev) => {
                        const next = new Set(prev)
                        if (next.has(src)) next.delete(src)
                        else next.add(src)
                        return next
                      })}
                      className={clsx(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors',
                        active
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/60',
                      )}
                    >
                      <span className={clsx(
                        'w-1.5 h-1.5 rounded-full border flex-shrink-0 transition-colors',
                        active ? 'bg-emerald-400 border-emerald-400' : 'border-slate-600',
                      )} />
                      {src === 'analysis' ? 'Analysis' : src === 'transcript' ? 'Transcript' : 'Caption'}
                    </button>
                  )
                })}
                <button
                  onClick={() => setIdeaDataSources((prev) => {
                    const all = new Set(['analysis', 'transcript', 'caption'])
                    const isAll = all.size === prev.size && Array.from(all).every((s) => prev.has(s))
                    return isAll ? new Set<string>() : all
                  })}
                  className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors px-1"
                >
                  {ideaDataSources.size === 3 ? 'none' : 'all'}
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-800" />

              {/* Row 3: Data source toggles */}
              <div className="flex items-center gap-1 px-4 py-3 flex-wrap">
                <span className="text-xs text-slate-600 font-medium mr-2 flex-shrink-0">Data</span>
                {([
                  { key: 'top', label: 'Top Reels', active: includeMyTopReels, set: setIncludeMyTopReels },
                  { key: 'low', label: 'Low Reels', active: includeMyLowReels, set: setIncludeMyLowReels },
                  { key: 'comp', label: 'Competitors', active: includeCompetitorData, set: setIncludeCompetitorData },
                ] as const).map(({ key, label, active, set }) => (
                  <button
                    key={key}
                    onClick={() => set((v) => !v)}
                    className={clsx(
                      'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors',
                      active
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/60',
                    )}
                  >
                    <span className={clsx(
                      'w-1.5 h-1.5 rounded-full border flex-shrink-0 transition-colors',
                      active ? 'bg-amber-400 border-amber-400' : 'border-slate-600',
                    )} />
                    {label}
                  </button>
                ))}
              </div>
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
                                    <p className="text-xs text-slate-300">{reel.views.toLocaleString()} views · {reel.likes.toLocaleString()} likes</p>
                                    <p className="text-xs text-slate-600 truncate">{reel.caption.slice(0, 100)}</p>
                                  </div>
                                  {reel.reelAnalysis ? (
                                    <span className="text-xs text-amber-500/70 flex-shrink-0 font-medium">analyzed</span>
                                  ) : reel.transcript ? (
                                    <span className="text-xs text-emerald-600/70 flex-shrink-0 font-medium">transcribed</span>
                                  ) : null}
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

            {/* -- PDF Export section -- */}
            <div id="pdf-section">
            <PdfSection
              selectedDesign={selectedPdfDesign}
              onDesignChange={changePdfDesign}
              provider={pdfProvider}
              model={pdfModel}
              onProviderChange={changePdfProvider}
              onModelChange={changePdfModel}
              templates={pdfPromptTemplates}
              selectedPromptId={selectedPdfPromptId}
              onPromptSelect={selectPdfPromptTemplate}
              onPromptSave={savePdfPromptTemplate}
              onPromptDelete={deletePdfPromptTemplate}
            />
            </div>

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
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
                <History className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <select
                  value={selectedIdeaId ?? ''}
                  onChange={(e) => setSelectedIdeaId(e.target.value)}
                  className="flex-1 min-w-0 bg-slate-900/60 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-emerald-300 truncate">Content Strategy Report</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <span className="text-xs text-slate-500">{formatGenDate(selectedIdea.generatedAt)}</span>
                    {deleteConfirmId === selectedIdea.id ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-400">Delete this report?</span>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-xs px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                        >Cancel</button>
                        <button
                          onClick={async () => {
                            // Move to recycle bin before removing from history
                            await fetch('/api/recycle-bin', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                id: `idea_${selectedIdea.id}`,
                                type: 'idea',
                                label: selectedIdea.promptName
                                  ? `${selectedIdea.promptName} — ${new Date(selectedIdea.generatedAt).toLocaleDateString()}`
                                  : `Ideas — ${new Date(selectedIdea.generatedAt).toLocaleDateString()}`,
                                data: selectedIdea,
                                deletedAt: new Date().toISOString(),
                              }),
                            })
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
                      {PROVIDER_LABELS[selectedIdea.provider]} · {selectedIdea.model ?? DEFAULT_MODEL[selectedIdea.provider]}
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
                <div className="space-y-1 overflow-x-hidden">
                  {(() => {
                    const lines = selectedIdea.ideas.split('\n')
                    return lines.map((line, i) => {
                      if (!line.trim()) return <div key={i} className="h-2" />
                      const cleanText = line.replace(/\*\*/g, '').replace(/^#{1,3} /, '').trim()
                      const isReelIdea = /^reel\s*idea\s*#?\d+/i.test(cleanText)
                      if (line.match(/^\*\*.*\*\*$/) || line.match(/^#{1,3} /) || isReelIdea) {

                        if (isReelIdea) {
                          const getSectionContent = () => {
                            const nextIdx = lines.findIndex((l, j) => {
                              if (j <= i) return false
                              const ct = l.replace(/\*\*/g, '').replace(/^#{1,3} /, '').trim()
                              return /^reel\s*idea\s*#?\d+/i.test(ct)
                            })
                            return lines.slice(i, nextIdx === -1 ? undefined : nextIdx).join('\n')
                          }
                          const isGenerating   = generatingPdfFor === cleanText
                          const isDownloading  = downloadingPdfFor === cleanText
                          const isBusy         = generatingPdfFor !== null || downloadingPdfFor !== null
                          const pdfCacheKey    = `${selectedIdeaId ?? ''}_${cleanText}`
                          const hasCachedPdf   = !!pdfContentCache[pdfCacheKey]
                          const isStarred = starredIdeas.some(
                            (s) => s.title === cleanText && s.generationId === selectedIdeaId
                          )
                          const ideaError = pdfErrors[cleanText]
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between gap-3 mt-5 mb-1 pt-2 group/idea">
                                <h3 className="text-base font-bold text-white break-words min-w-0">{cleanText}</h3>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {/* Star button */}
                                  <button
                                    onClick={() => handleToggleStar(cleanText, getSectionContent())}
                                    title={isStarred ? 'Remove from starred' : 'Star this idea'}
                                    className={clsx(
                                      'flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-all',
                                      isStarred
                                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                                        : 'border-slate-700/60 text-slate-500 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/10',
                                    )}
                                  >
                                    <Star className="w-3 h-3" fill={isStarred ? 'currentColor' : 'none'} />
                                  </button>
                                  {/* PDF button(s) */}
                                  {hasCachedPdf ? (
                                    <>
                                      <button
                                        onClick={() => handleDownloadPdf(cleanText)}
                                        disabled={isBusy}
                                        title="Download cached PDF (no AI call)"
                                        className={clsx(
                                          'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all font-medium',
                                          isDownloading
                                            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 cursor-not-allowed'
                                            : isBusy
                                            ? 'border-slate-700 text-slate-600 cursor-not-allowed opacity-50'
                                            : 'border-emerald-700/50 text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/10',
                                        )}
                                      >
                                        {isDownloading
                                          ? <><Loader2 className="w-3 h-3 animate-spin" />Downloading...</>
                                          : <><Download className="w-3 h-3" />Download PDF</>}
                                      </button>
                                      <button
                                        onClick={() => handleGeneratePdf(getSectionContent(), cleanText)}
                                        disabled={isBusy}
                                        title="Regenerate PDF (uses AI tokens)"
                                        className={clsx(
                                          'p-1.5 rounded-lg border transition-all',
                                          isGenerating
                                            ? 'border-violet-500/50 bg-violet-500/15 text-violet-300 cursor-not-allowed'
                                            : isBusy
                                            ? 'border-slate-700 text-slate-600 cursor-not-allowed opacity-50'
                                            : 'border-slate-700/60 text-slate-500 hover:border-violet-500/50 hover:text-violet-300 hover:bg-violet-500/10',
                                        )}
                                      >
                                        {isGenerating
                                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          : <RefreshCw className="w-3.5 h-3.5" />}
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleGeneratePdf(getSectionContent(), cleanText)}
                                      disabled={isBusy}
                                      title="Generate PDF for this idea (uses AI tokens)"
                                      className={clsx(
                                        'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all font-medium',
                                        isGenerating
                                          ? 'border-violet-500/50 bg-violet-500/15 text-violet-300 cursor-not-allowed'
                                          : isBusy
                                          ? 'border-slate-700 text-slate-600 cursor-not-allowed opacity-50'
                                          : 'border-slate-700/60 text-slate-500 hover:border-violet-500/50 hover:text-violet-300 hover:bg-violet-500/10',
                                      )}
                                    >
                                      {isGenerating
                                        ? <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
                                        : <><FileText className="w-3 h-3" />PDF</>}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {ideaError && (
                                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg px-3 py-2 mb-2 text-xs">
                                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span>{ideaError}</span>
                                </div>
                              )}
                            </div>
                          )
                        }

                        return <h3 key={i} className="text-base font-bold text-white mt-5 mb-2 pt-2 break-words">{cleanText}</h3>
                      }
                      if (line.startsWith('- ') || line.startsWith('• ')) {
                        return (
                          <div key={i} className="flex gap-2 text-slate-300 text-sm py-0.5">
                            <span className="text-emerald-400 flex-shrink-0 mt-0.5">•</span>
                            <span className="break-words min-w-0" dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                          </div>
                        )
                      }
                      return <p key={i} className="text-slate-300 text-sm leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                    })
                  })()}
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
                <button onClick={handleStartGenerate} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors">
                  Generate Ideas
                </button>
              </div>
            )}

          </div>
        )}

        {/* == MASTERCLASS ======================================================= */}
        {tab === 'masterclass' && <MasterclassTab />}
        {tab === 'story' && <StoryTab />}

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

      {/* -- Prompt size confirm -- */}
      {showPromptSizeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setShowPromptSizeConfirm(false)}
          />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Confirm prompt size</h3>
                <p className="text-xs text-slate-400 mt-1">Estimated total characters being sent to the AI:</p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 mb-4 text-center">
              <span className="text-2xl font-bold text-white tabular-nums">{promptSizeEstimate.toLocaleString()}</span>
              <span className="text-slate-500 text-sm ml-1.5">chars</span>
              <p className="text-xs text-slate-600 mt-1">
                system prompt · {promptSizeCounts.myCount} my reels · {promptSizeCounts.compReelCount} competitor reel{promptSizeCounts.compReelCount !== 1 ? 's' : ''} from {promptSizeCounts.creatorCount} creator{promptSizeCounts.creatorCount !== 1 ? 's' : ''}
              </p>
            </div>

            {promptSizeEstimate > 60_000 && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-amber-300 text-xs leading-relaxed">
                  Large prompt — may hit model context limits or cost more. Consider trimming your system prompt or reducing data sources.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPromptSizeConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowPromptSizeConfirm(false); generateIdeas() }}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
