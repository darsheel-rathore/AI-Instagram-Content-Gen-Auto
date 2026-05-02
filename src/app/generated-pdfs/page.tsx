'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft, FileText, Download, RefreshCw, Trash2,
  Loader2, AlertCircle,
} from 'lucide-react'
import clsx from 'clsx'
import type { PromptTemplate } from '@/components/PromptFactory'
import { loadPdfRecords, savePdfRecords, type PdfRecord } from '@/lib/pdf-records'

interface PdfSettings {
  templates?: PromptTemplate[]
  provider?: string
  model?: string
  design?: string
}

async function loadCache<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/cache?key=${key}`)
    const json = await res.json()
    return (json.data as T) ?? null
  } catch {
    return null
  }
}

export default function GeneratedPdfsPage() {
  const [pdfRecords, setPdfRecords]           = useState<PdfRecord[]>([])
  const [pdfSettings, setPdfSettings]         = useState<PdfSettings>({})
  const [downloadingId, setDownloadingId]     = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId]   = useState<string | null>(null)
  const [recordErrors, setRecordErrors]       = useState<Record<string, string>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    setPdfRecords(loadPdfRecords())
    loadCache<PdfSettings>('pdf_settings').then((s) => setPdfSettings(s ?? {}))
  }, [])

  const isBusy = downloadingId !== null || regeneratingId !== null

  async function downloadRecord(record: PdfRecord) {
    if (isBusy) return
    setDownloadingId(record.id)
    setRecordErrors((prev) => { const n = { ...prev }; delete n[record.id]; return n })
    try {
      await callGeneratePdfApi(record.content, record.id)
    } catch (e: unknown) {
      setRecordErrors((prev) => ({ ...prev, [record.id]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setDownloadingId(null)
    }
  }

  async function regenerateRecord(record: PdfRecord) {
    if (isBusy) return
    setRegeneratingId(record.id)
    setRecordErrors((prev) => { const n = { ...prev }; delete n[record.id]; return n })
    try {
      const prompt = pdfSettings.templates?.find((t) => t.id === record.promptId)?.content
      if (!prompt) throw new Error('Original prompt template not found — it may have been deleted')
      const res = await fetch('/api/generate-pdf-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ctaText: record.ctaText,
          customPrompt: prompt,
          provider: record.provider,
          model: record.model,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error as string)

      const updated: PdfRecord = { ...record, content: data, generatedAt: new Date().toISOString() }
      setPdfRecords((prev) => {
        const next = prev.map((r) => (r.id === record.id ? updated : r))
        savePdfRecords(next)
        return next
      })
      await callGeneratePdfApi(updated.content, updated.id)
    } catch (e: unknown) {
      setRecordErrors((prev) => ({ ...prev, [record.id]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setRegeneratingId(null)
    }
  }

  async function callGeneratePdfApi(content: PdfRecord['content'], recordId: string) {
    const brandName       = localStorage.getItem('pdf_giveaway_brand')      ?? 'Medha'
    const instagramHandle = localStorage.getItem('pdf_giveaway_handle')     ?? 'themedhachannel'
    const customCss       = localStorage.getItem('pdf_giveaway_custom_css') ?? undefined
    const whatsappLink    = localStorage.getItem('pdf_giveaway_whatsapp')   ?? undefined
    const website         = localStorage.getItem('pdf_giveaway_website')    ?? undefined
    const linktree        = localStorage.getItem('pdf_giveaway_linktree')   ?? undefined
    const pdfRes = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, brandName, instagramHandle, customCss, whatsappLink, website, linktree }),
    })
    if (!pdfRes.ok) {
      const err = await pdfRes.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'PDF generation failed')
    }
    const blob = await pdfRes.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safe = (content.title ?? recordId).slice(0, 50).replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, '-').toLowerCase()
    a.href = url
    a.download = `${safe || 'guide'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  function deleteRecord(id: string) {
    setPdfRecords((prev) => {
      const next = prev.filter((r) => r.id !== id)
      savePdfRecords(next)
      return next
    })
    setConfirmDeleteId(null)
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">

      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0a0f1e]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </a>
          <div className="h-4 w-px bg-slate-700" />
          <FileText className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Generated PDFs</span>
          {pdfRecords.length > 0 && (
            <span className="ml-1 text-xs text-slate-500">({pdfRecords.length})</span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {pdfRecords.length === 0 ? (
          <div className="text-center py-24 rounded-2xl border border-dashed border-slate-700/60 text-slate-600">
            <FileText className="w-10 h-10 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No PDFs generated yet.</p>
            <p className="text-xs mt-1.5">
              Go to <a href="/?tab=ideas" className="text-violet-400 hover:text-violet-300 transition-colors">Content Ideas → PDF Export</a>, enter a topic and click Generate PDF.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pdfRecords.map((record, idx) => {
              const isDownloading  = downloadingId === record.id
              const isRegenerating = regeneratingId === record.id
              const err            = recordErrors[record.id]
              const confirming     = confirmDeleteId === record.id
              const num            = pdfRecords.length - idx

              const date = new Date(record.generatedAt).toLocaleDateString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric',
              })
              const time = new Date(record.generatedAt).toLocaleTimeString(undefined, {
                hour: '2-digit', minute: '2-digit',
              })

              return (
                <div
                  key={record.id}
                  className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap">
                    {/* Number */}
                    <span className="flex-shrink-0 text-xs font-mono text-slate-600 w-6 text-right">
                      #{num}
                    </span>

                    {/* Meta */}
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/50 text-slate-400 whitespace-nowrap">
                        {date} {time}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 whitespace-nowrap max-w-[140px] truncate">
                        {record.promptTitle}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 whitespace-nowrap">
                        {record.provider} · {record.model?.split('-').slice(-2).join('-')}
                      </span>
                      <span className="text-xs text-slate-400 truncate min-w-0 italic">
                        {record.ctaText.length > 60 ? record.ctaText.slice(0, 60) + '…' : record.ctaText}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Download */}
                      <button
                        onClick={() => downloadRecord(record)}
                        disabled={isBusy}
                        title="Download PDF (no AI call)"
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
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Downloading…</>
                          : <><Download className="w-3 h-3" />Download</>}
                      </button>

                      {/* Regenerate */}
                      <button
                        onClick={() => regenerateRecord(record)}
                        disabled={isBusy}
                        title="Regenerate with AI then download"
                        className={clsx(
                          'p-1.5 rounded-lg border transition-all',
                          isRegenerating
                            ? 'border-violet-500/50 bg-violet-500/15 text-violet-300 cursor-not-allowed'
                            : isBusy
                            ? 'border-slate-700 text-slate-600 opacity-50 cursor-not-allowed'
                            : 'border-slate-700/60 text-slate-500 hover:border-violet-500/50 hover:text-violet-300 hover:bg-violet-500/10',
                        )}
                      >
                        {isRegenerating
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>

                      {/* Delete */}
                      {confirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteRecord(record.id)}
                            className="text-xs px-2 py-1.5 rounded-lg border border-rose-500/50 bg-rose-500/15 text-rose-400 font-medium hover:bg-rose-500/25 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs px-2 py-1.5 rounded-lg border border-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(record.id)}
                          disabled={isBusy}
                          title="Delete this PDF record"
                          className={clsx(
                            'p-1.5 rounded-lg border transition-all',
                            isBusy
                              ? 'border-slate-700 text-slate-700 opacity-50 cursor-not-allowed'
                              : 'border-slate-700/60 text-slate-600 hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/10',
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Error */}
                  {err && (
                    <div className="mx-4 mb-3 flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg px-3 py-2 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{err}</span>
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
