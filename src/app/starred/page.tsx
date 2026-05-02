'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft, Star, FileText, Loader2, AlertCircle,
  ChevronDown, ChevronUp, Download, RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'
import type { PromptTemplate } from '@/components/PromptFactory'
import type { PdfContent } from '@/lib/pdf-templates'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StarredIdea {
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

interface PdfSettings {
  templates?: PromptTemplate[]
  selectedId?: string | null
  provider?: string
  model?: string
  design?: string
}

interface GenerationRecord {
  id: string
  competitorUsernames?: string[]
  promptName?: string
  provider?: string
  model?: string
}

interface PdfCacheEntry {
  content: PdfContent
  design: string
  provider: string
  model: string
  generatedAt: string
}

// ─── Server-side cache helpers ────────────────────────────────────────────────

async function loadCache<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/cache?key=${key}`)
    const json = await res.json()
    return (json.data as T) ?? null
  } catch {
    return null
  }
}

async function saveCache(key: string, data: unknown) {
  await fetch('/api/cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, data }),
  })
}

// ─── Local PDF content cache (localStorage) ───────────────────────────────────

const LS_PDF_CACHE = 'starred_pdf_cache'

function readPdfCache(): Record<string, PdfCacheEntry> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_PDF_CACHE) : null
    return raw ? (JSON.parse(raw) as Record<string, PdfCacheEntry>) : {}
  } catch {
    return {}
  }
}

function writePdfCache(cache: Record<string, PdfCacheEntry>) {
  try {
    localStorage.setItem(LS_PDF_CACHE, JSON.stringify(cache))
  } catch { /* ignore quota errors */ }
}

// ─── Content renderer ─────────────────────────────────────────────────────────

function IdeaContent({ content }: { content: string }) {
  return (
    <div className="space-y-1">
      {content.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />
        const clean = line.replace(/\*\*/g, '').replace(/^#{1,3} /, '').trim()
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2 text-slate-300 text-sm py-0.5">
              <span className="text-emerald-400 flex-shrink-0 mt-0.5">•</span>
              <span
                className="break-words min-w-0"
                dangerouslySetInnerHTML={{
                  __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>'),
                }}
              />
            </div>
          )
        }
        return (
          <p
            key={i}
            className="text-slate-300 text-sm leading-relaxed break-words"
            dangerouslySetInnerHTML={{
              __html: clean.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>'),
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StarredPage() {
  const [ideas, setIdeas]             = useState<StarredIdea[]>([])
  const [pdfSettings, setPdfSettings] = useState<PdfSettings>({})
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState<Set<string>>(new Set())
  const [pdfCache, setPdfCache]       = useState<Record<string, PdfCacheEntry>>({})
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [downloadingFor, setDownloadingFor] = useState<string | null>(null)
  const [pdfErrors, setPdfErrors]     = useState<Record<string, string>>({})

  useEffect(() => {
    // Load PDF content cache from localStorage (client-only, no API cost)
    setPdfCache(readPdfCache())

    Promise.all([
      loadCache<StarredIdea[]>('starred_ideas'),
      loadCache<PdfSettings>('pdf_settings'),
      loadCache<GenerationRecord[]>('content_ideas'),
    ]).then(([starredCache, pdfCacheData, historyCache]) => {
      const historyMap = new Map((historyCache ?? []).map((r) => [r.id, r]))
      const enriched = (starredCache ?? []).map((idea) => {
        if (idea.competitors?.length || !idea.generationId) return idea
        const rec = historyMap.get(idea.generationId)
        if (!rec) return idea
        return {
          ...idea,
          competitors: rec.competitorUsernames ?? idea.competitors,
          promptName: idea.promptName ?? rec.promptName,
          provider: idea.provider ?? rec.provider,
          model: idea.model ?? rec.model,
        }
      })
      setIdeas(enriched)
      setPdfSettings(pdfCacheData ?? {})
      setLoading(false)
    })
  }, [])

  const handleUnstar = (ideaId: string) => {
    setIdeas((prev) => {
      const updated = prev.filter((s) => s.id !== ideaId)
      saveCache('starred_ideas', updated)
      return updated
    })
    // Also evict the PDF cache entry for this idea
    setPdfCache((prev) => {
      const updated = { ...prev }
      delete updated[ideaId]
      writePdfCache(updated)
      return updated
    })
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Download from cache — no AI call
  const handleDownloadPdf = async (idea: StarredIdea) => {
    const cached = pdfCache[idea.id]
    if (!cached || downloadingFor || generatingFor) return
    setDownloadingFor(idea.id)
    setPdfErrors((prev) => { const n = { ...prev }; delete n[idea.id]; return n })
    try {
      await renderAndDownloadPdf(cached.content, idea.title, cached.design)
    } catch (e: unknown) {
      setPdfErrors((prev) => ({
        ...prev,
        [idea.id]: e instanceof Error ? e.message : String(e),
      }))
    } finally {
      setDownloadingFor(null)
    }
  }

  async function renderAndDownloadPdf(data: object, ideaTitle: string, design: string) {
    if (design === 'giveaway' || design.startsWith('pdf_css_')) {
      const brandName       = localStorage.getItem('pdf_giveaway_brand')      ?? 'Medha'
      const instagramHandle = localStorage.getItem('pdf_giveaway_handle')     ?? 'themedhachannel'
      const customCss       = localStorage.getItem('pdf_giveaway_custom_css') ?? undefined
      const whatsappLink    = localStorage.getItem('pdf_giveaway_whatsapp')   ?? undefined
      const website         = localStorage.getItem('pdf_giveaway_website')    ?? undefined
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
      await generateAndDownloadPdf(data as Parameters<typeof generateAndDownloadPdf>[0], design)
    }
  }

  // Generate via AI, cache result, then download
  const handleGeneratePdf = async (idea: StarredIdea) => {
    if (generatingFor || downloadingFor) return
    setGeneratingFor(idea.id)
    setPdfErrors((prev) => { const n = { ...prev }; delete n[idea.id]; return n })
    try {
      const customPrompt = pdfSettings.templates?.find(
        (t) => t.id === pdfSettings.selectedId,
      )?.content
      const design = pdfSettings.design ?? 'executive'
      const provider = pdfSettings.provider ?? 'gemini'
      const model = pdfSettings.model

      const res = await fetch('/api/generate-pdf-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: idea.content,
          customPrompt: customPrompt ?? undefined,
          provider,
          model,
          ideaTitle: idea.title,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error as string)

      // Cache the structured content so future downloads skip the AI call
      const entry: PdfCacheEntry = {
        content: data as PdfContent,
        design,
        provider,
        model: model ?? 'default',
        generatedAt: new Date().toISOString(),
      }
      setPdfCache((prev) => {
        const updated = { ...prev, [idea.id]: entry }
        writePdfCache(updated)
        return updated
      })

      await renderAndDownloadPdf(data, idea.title, design)
    } catch (e: unknown) {
      setPdfErrors((prev) => ({
        ...prev,
        [idea.id]: e instanceof Error ? e.message : String(e),
      }))
    } finally {
      setGeneratingFor(null)
    }
  }

  const sorted = [...ideas].sort((a, b) => b.starredAt.localeCompare(a.starredAt))

  const providerLabel = pdfSettings.provider ?? 'gemini'
  const modelLabel    = pdfSettings.model ?? 'default'
  const designLabel   = pdfSettings.design ?? 'executive'
  const isBusy        = generatingFor !== null || downloadingFor !== null

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0a0f1e]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Dashboard</span>
          </a>
          <div className="w-px h-4 bg-slate-800" />
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
            <span className="text-sm font-semibold text-white">Starred Ideas</span>
          </div>
          {!loading && (
            <span className="text-xs text-slate-600">
              {sorted.length} saved
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && sorted.length === 0 && (
          <div className="text-center py-24 border border-dashed border-slate-800 rounded-2xl">
            <Star className="w-10 h-10 text-slate-800 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">No starred ideas yet</p>
            <p className="text-slate-600 text-sm max-w-xs mx-auto">
              Click the star icon next to any Reel Idea in the Content Ideas tab to save it here.
            </p>
            <a
              href="/?tab=ideas"
              className="mt-6 inline-block bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors text-sm font-medium px-5 py-2.5 rounded-xl"
            >
              Go to Content Ideas
            </a>
          </div>
        )}

        {/* ── Idea list ── */}
        {!loading && sorted.length > 0 && (
          <div className="space-y-3">

            {/* PDF settings summary banner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 mb-5 flex items-center gap-3 flex-wrap">
              <FileText className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
              <span className="text-xs text-slate-500">PDF settings for new generations:</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-slate-800/80 border border-slate-700/50 rounded-md px-2 py-0.5 text-slate-400">
                  {providerLabel}
                </span>
                <span className="text-xs bg-slate-800/80 border border-slate-700/50 rounded-md px-2 py-0.5 text-slate-400">
                  {modelLabel}
                </span>
                <span className="text-xs bg-slate-800/80 border border-slate-700/50 rounded-md px-2 py-0.5 text-slate-400">
                  {designLabel} template
                </span>
              </div>
              <a
                href="/?tab=ideas#pdf-section"
                className="ml-auto text-xs text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
              >
                Edit in Ideas tab →
              </a>
            </div>

            {sorted.map((idea) => {
              const isOpen         = expanded.has(idea.id)
              const isGenerating   = generatingFor === idea.id
              const isDownloading  = downloadingFor === idea.id
              const cached         = pdfCache[idea.id]
              const error          = pdfErrors[idea.id]

              const date = new Date(idea.starredAt).toLocaleDateString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric',
              })
              const shortModel = idea.model
                ?.replace('claude-', 'Claude ')
                .replace('gemini-', 'Gemini ')
                .replace('gpt-', 'GPT-')
                .replace('-latest', '')
              const competitorList = idea.competitors ?? []
              const visibleComps   = competitorList.slice(0, 2)
              const extraComps     = competitorList.length - visibleComps.length

              // Cached PDF metadata for display
              const cachedDate = cached
                ? new Date(cached.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                : null

              return (
                <div
                  key={idea.id}
                  className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden"
                >
                  {/* ── Card header ── */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleExpand(idea.id)}
                      className="flex-1 flex items-center gap-2 min-w-0 text-left"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" />
                      <span className="text-sm font-semibold text-white truncate min-w-0">{idea.title}</span>
                      {/* Timestamp */}
                      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-500 whitespace-nowrap">
                        {date}
                      </span>
                      {/* Model chip */}
                      {shortModel && (
                        <span className="hidden sm:inline-flex flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 whitespace-nowrap">
                          {shortModel}
                        </span>
                      )}
                      {/* Prompt chip */}
                      {idea.promptName && (
                        <span className="hidden md:inline-flex flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 whitespace-nowrap max-w-[120px] truncate">
                          {idea.promptName}
                        </span>
                      )}
                      {/* Creator chips */}
                      {visibleComps.map((c) => (
                        <span key={c} className="hidden sm:inline-flex flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-400 whitespace-nowrap">
                          @{c}
                        </span>
                      ))}
                      {extraComps > 0 && (
                        <span className="hidden sm:inline-flex flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-500 whitespace-nowrap">
                          +{extraComps}
                        </span>
                      )}
                      {isOpen
                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 ml-auto" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 ml-auto" />}
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Unstar */}
                      <button
                        onClick={() => handleUnstar(idea.id)}
                        title="Remove from starred"
                        className="p-1.5 rounded-lg text-amber-500/60 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                      >
                        <Star className="w-3.5 h-3.5" fill="currentColor" />
                      </button>

                      {cached ? (
                        /* ── Cached: Download + Regenerate ── */
                        <>
                          <button
                            onClick={() => handleDownloadPdf(idea)}
                            disabled={isBusy}
                            title={`Download PDF · ${cached.design} · ${cached.provider} · ${cachedDate}`}
                            className={clsx(
                              'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all font-medium',
                              isDownloading
                                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 cursor-not-allowed'
                                : isBusy
                                ? 'border-slate-700 text-slate-600 opacity-50 cursor-not-allowed'
                                : 'border-emerald-700/50 text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/10',
                            )}
                          >
                            {isDownloading
                              ? <><Loader2 className="w-3 h-3 animate-spin" />Downloading...</>
                              : <><Download className="w-3 h-3" />Download PDF</>}
                          </button>
                          <button
                            onClick={() => handleGeneratePdf(idea)}
                            disabled={isBusy}
                            title="Regenerate PDF with current settings (uses AI tokens)"
                            className={clsx(
                              'p-1.5 rounded-lg border transition-all',
                              isGenerating
                                ? 'border-violet-500/50 bg-violet-500/15 text-violet-300 cursor-not-allowed'
                                : isBusy
                                ? 'border-slate-700 text-slate-600 opacity-50 cursor-not-allowed'
                                : 'border-slate-700/60 text-slate-500 hover:border-violet-500/50 hover:text-violet-300 hover:bg-violet-500/10',
                            )}
                          >
                            {isGenerating
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <RefreshCw className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        /* ── Not cached: Generate ── */
                        <button
                          onClick={() => handleGeneratePdf(idea)}
                          disabled={isBusy}
                          title="Generate PDF (uses AI tokens)"
                          className={clsx(
                            'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all font-medium',
                            isGenerating
                              ? 'border-violet-500/50 bg-violet-500/15 text-violet-300 cursor-not-allowed'
                              : isBusy
                              ? 'border-slate-700 text-slate-600 opacity-50 cursor-not-allowed'
                              : 'border-slate-700/60 text-slate-500 hover:border-violet-500/50 hover:text-violet-300 hover:bg-violet-500/10',
                          )}
                        >
                          {isGenerating
                            ? <><Loader2 className="w-3 h-3 animate-spin" />Generating...</>
                            : <><FileText className="w-3 h-3" />Generate PDF</>}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Cached PDF info strip ── */}
                  {cached && (
                    <div className="px-4 pb-2 flex items-center gap-2">
                      <span className="text-[10px] text-slate-600">
                        PDF ready · {cached.design} · {cached.provider} · generated {cachedDate}
                      </span>
                    </div>
                  )}

                  {/* ── Error ── */}
                  {error && (
                    <div className="mx-4 mb-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg px-3 py-2 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* ── Expanded content ── */}
                  {isOpen && (
                    <div className="border-t border-slate-700/40 px-4 py-4">
                      {idea.provider && (
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <span className="text-xs bg-slate-900/60 border border-slate-800 rounded-md px-2 py-0.5 text-slate-500">
                            Generated with {idea.provider}
                            {idea.model ? ` · ${idea.model}` : ''}
                          </span>
                        </div>
                      )}
                      <IdeaContent content={idea.content} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
