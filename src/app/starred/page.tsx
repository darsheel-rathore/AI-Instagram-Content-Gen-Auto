'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft, Star, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import type { PromptTemplate } from '@/components/PromptFactory'

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

// ─── Cache helpers ────────────────────────────────────────────────────────────

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

  useEffect(() => {
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
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const sorted = [...ideas].sort((a, b) => b.starredAt.localeCompare(a.starredAt))

  const providerLabel = pdfSettings.provider ?? 'gemini'
  const modelLabel    = pdfSettings.model ?? 'default'
  const designLabel   = pdfSettings.design ?? 'executive'

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0a0f1e]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : (window.location.href = '/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
          <span className="text-sm font-semibold text-white">Starred Ideas</span>
          {ideas.length > 0 && (
            <span className="ml-1 text-xs text-slate-500">({ideas.length})</span>
          )}
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
            <span>{designLabel}</span>
            <span>·</span>
            <span>{providerLabel}</span>
            <span>·</span>
            <span className="truncate max-w-24">{modelLabel}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── Starred Ideas ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">Starred Ideas</h2>
            <a
              href="/?tab=ideas#pdf-section"
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Edit in Ideas tab →
            </a>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 text-slate-500 py-12 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <Star className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No starred ideas yet — star ideas from the Content Ideas tab.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((idea) => {
                const isOpen = expanded.has(idea.id)
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

                return (
                  <div
                    key={idea.id}
                    className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => toggleExpand(idea.id)}
                        className="flex-1 flex items-center gap-2 min-w-0 text-left"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" />
                        <span className="text-sm font-semibold text-white truncate min-w-0">{idea.title}</span>
                        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-500 whitespace-nowrap">
                          {date}
                        </span>
                        {shortModel && (
                          <span className="hidden sm:inline-flex flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 whitespace-nowrap">
                            {shortModel}
                          </span>
                        )}
                        {idea.promptName && (
                          <span className="hidden md:inline-flex flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 whitespace-nowrap max-w-[120px] truncate">
                            {idea.promptName}
                          </span>
                        )}
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
                      <button
                        onClick={() => handleUnstar(idea.id)}
                        title="Remove from starred"
                        className="p-1.5 rounded-lg text-amber-500/60 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors flex-shrink-0"
                      >
                        <Star className="w-3.5 h-3.5" fill="currentColor" />
                      </button>
                    </div>

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
    </div>
  )
}
