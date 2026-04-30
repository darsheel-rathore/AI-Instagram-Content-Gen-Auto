'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Check } from 'lucide-react'
import clsx from 'clsx'
import PromptFactory, { type PromptTemplate } from './PromptFactory'
import { PDF_TEMPLATES } from '@/lib/pdf-templates'

type AIProvider = 'anthropic' | 'openai' | 'gemini'
type ModelCost = 'expensive' | 'moderate' | 'cheap'

const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Claude',
  openai: 'GPT-4o',
  gemini: 'Gemini',
}

const PROVIDER_MODELS: Record<AIProvider, { id: string; label: string; cost: ModelCost; description: string }[]> = {
  anthropic: [
    { id: 'claude-opus-4-7',           label: 'Opus 4.7',              cost: 'expensive', description: 'Most capable, slowest'    },
    { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6',            cost: 'moderate',  description: 'Balanced speed & quality' },
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',             cost: 'cheap',     description: 'Fastest, cheapest'        },
  ],
  openai: [
    { id: 'gpt-4o',      label: 'GPT-4o',      cost: 'expensive', description: 'Most capable'    },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', cost: 'cheap',     description: 'Fast & affordable' },
  ],
  gemini: [
    { id: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro',        cost: 'expensive', description: 'Most capable'  },
    { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',      cost: 'moderate',  description: 'Balanced'      },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', cost: 'cheap',     description: 'Cheapest'      },
  ],
}

const DEFAULT_MODEL: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}

const COST_DOT: Record<ModelCost, string> = {
  expensive: 'bg-rose-500',
  moderate: 'bg-amber-500',
  cheap: 'bg-emerald-500',
}

interface Props {
  selectedDesign: string
  onDesignChange: (id: string) => void
  provider: AIProvider
  model: string
  onProviderChange: (p: AIProvider) => void
  onModelChange: (m: string) => void
  templates: PromptTemplate[]
  selectedPromptId: string | null
  onPromptSelect: (id: string) => void
  onPromptSave: (t: PromptTemplate) => void
  onPromptDelete: (id: string) => void
}

export default function PdfSection({
  selectedDesign,
  onDesignChange,
  provider,
  model,
  onProviderChange,
  onModelChange,
  templates,
  selectedPromptId,
  onPromptSelect,
  onPromptSave,
  onPromptDelete,
}: Props) {
  const [open, setOpen] = useState(false)

  const currentTemplate = PDF_TEMPLATES.find((t) => t.id === selectedDesign) ?? PDF_TEMPLATES[0]

  return (
    <div className="mb-5 rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
      {/* ── Header ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-300">PDF Export</span>
          <span className="text-xs text-slate-600">·</span>
          {/* Color swatch for selected template */}
          <span
            className="inline-flex w-3 h-3 rounded-sm flex-shrink-0"
            style={{ background: currentTemplate.colors.header }}
          />
          <span className="text-xs text-slate-400 truncate">{currentTemplate.name}</span>
        </div>
        <div className="flex-shrink-0 ml-3">
          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </button>

      {/* ── Body ── */}
      {open && (
        <div className="border-t border-slate-700/60 p-4 space-y-5">

          {/* Template picker */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Design Template</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 lg:grid-cols-5">
              {PDF_TEMPLATES.map((tmpl) => {
                const isSelected = selectedDesign === tmpl.id
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => onDesignChange(tmpl.id)}
                    className={clsx(
                      'relative rounded-xl border overflow-hidden text-left transition-all group',
                      isSelected
                        ? 'border-violet-500/70 ring-1 ring-violet-500/40 shadow-lg shadow-violet-500/10'
                        : 'border-slate-700/60 hover:border-slate-600',
                    )}
                  >
                    {/* Template visual preview */}
                    <div className="w-full" style={{ aspectRatio: '3/4', background: tmpl.colors.bg }}>
                      {/* Header band */}
                      <div
                        className="w-full"
                        style={{ height: '35%', background: tmpl.colors.header, position: 'relative' }}
                      >
                        {/* Accent bar at bottom of header */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 3,
                            background: tmpl.colors.accent,
                          }}
                        />
                        {/* Title lines mock */}
                        <div className="px-2 pt-2 space-y-1">
                          <div style={{ height: 3, width: '70%', background: 'rgba(255,255,255,0.85)', borderRadius: 2 }} />
                          <div style={{ height: 2, width: '50%', background: 'rgba(255,255,255,0.4)', borderRadius: 2 }} />
                        </div>
                      </div>
                      {/* Body content mock */}
                      <div className="px-2 py-2 space-y-2">
                        {[100, 85, 90, 75].map((w, i) => (
                          <div key={i} className="space-y-0.5">
                            <div style={{ height: 2, width: `${w * 0.35}%`, background: tmpl.colors.accent, borderRadius: 1 }} />
                            <div style={{ height: 1.5, width: `${w}%`, background: tmpl.colors.text + '55', borderRadius: 1 }} />
                            <div style={{ height: 1.5, width: `${w * 0.8}%`, background: tmpl.colors.text + '35', borderRadius: 1 }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Label */}
                    <div
                      className="px-2 py-1.5 border-t border-slate-700/40"
                      style={{ background: 'rgba(15,20,40,0.8)' }}
                    >
                      <p className="text-xs font-semibold text-slate-200 truncate">{tmpl.name}</p>
                      <p className="text-xs text-slate-500 truncate leading-tight">{tmpl.description}</p>
                    </div>

                    {/* Selected check */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shadow-md">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-700/50" />

          {/* AI / Model selector */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">AI Model for PDF</p>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                <div className="flex items-center gap-0.5 bg-slate-800/70 rounded-lg p-0.5 flex-shrink-0">
                  {(['anthropic', 'openai', 'gemini'] as AIProvider[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => { onProviderChange(p); onModelChange(DEFAULT_MODEL[p]) }}
                      className={clsx(
                        'text-xs px-3 py-1.5 rounded-md font-medium transition-all',
                        provider === p
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-300',
                      )}
                    >
                      {PROVIDER_LABELS[p]}
                    </button>
                  ))}
                </div>
                <div className="w-px h-4 bg-slate-700/80 hidden sm:block flex-shrink-0" />
                <div className="flex items-center gap-1 flex-wrap">
                  {PROVIDER_MODELS[provider].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onModelChange(m.id)}
                      title={m.description}
                      className={clsx(
                        'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all',
                        model === m.id
                          ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                          : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800',
                      )}
                    >
                      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', COST_DOT[m.cost])} />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-700/50" />

          {/* Prompt Factory */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">PDF Prompt</p>
            <PromptFactory
              templates={templates}
              selectedId={selectedPromptId}
              onSelect={onPromptSelect}
              onSave={onPromptSave}
              onDelete={onPromptDelete}
            />
          </div>
        </div>
      )}
    </div>
  )
}
