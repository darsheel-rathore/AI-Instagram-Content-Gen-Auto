'use client'

import { useState } from 'react'
import type { Reel } from '@/lib/types'
import { Eye, Heart, MessageCircle, Play, Loader2, FileText, ExternalLink, Copy, Check, X, Sparkles } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  reel: Reel
  onTranscribe?: (reel: Reel) => void
  transcribing?: boolean
  onAnalyze?: (reel: Reel) => void
  analyzing?: boolean
}

const PERF_STYLES = {
  top: 'border-amber-500/60 bg-amber-500/5',
  mid: 'border-slate-600/60 bg-slate-800/60',
  low: 'border-rose-500/40 bg-rose-500/5',
}

const PERF_BADGE = {
  top: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  mid: 'bg-slate-600/30 text-slate-400 border border-slate-600/30',
  low: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
}

const PERF_LABEL = { top: 'Top Performer', mid: 'Average', low: 'Underperforming' }

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function ReelCard({ reel, onTranscribe, transcribing, onAnalyze, analyzing }: Props) {
  const [showOverlay, setShowOverlay] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const [triedSource, setTriedSource] = useState(false)

  // Thumbnails are one of two things: a local "/api/thumbnail/<id>" path written
  // by the scrape, or a remote CDN URL. Only the remote one needs the proxy —
  // it exists to attach the Referer header Instagram's CDN demands. Routing a
  // local path through the proxy makes the server fetch() a relative URL, which
  // throws and renders every cached thumbnail as a dead preview.
  const rawThumb = triedSource ? reel.thumbnailSourceUrl : reel.thumbnailUrl
  const thumbSrc = !rawThumb
    ? null
    : rawThumb.startsWith('/')
      ? rawThumb
      : `/api/proxy-image?url=${encodeURIComponent(rawThumb)}`

  const perf = reel.performance ?? 'mid'
  const engRate = reel.views > 0 ? (((reel.likes + reel.comments) / reel.views) * 100).toFixed(1) : '0.0'
  const postedDate = reel.timestamp
    ? new Date(reel.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '-'

  const copyTranscript = () => {
    navigator.clipboard.writeText(reel.transcript ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const analysis = reel.reelAnalysis

  return (
    <>
      {/* Transcript overlay */}
      {showOverlay && reel.transcript && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowOverlay(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-lg w-full shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-white">Transcript</span>
                {reel.transcriptPartial && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                    partial
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyTranscript}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
                >
                  {copied
                    ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
                <button
                  onClick={() => setShowOverlay(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <p className="text-sm text-slate-300 leading-relaxed">{reel.transcript}</p>
            </div>
          </div>
        </div>
      )}

      <div className={clsx('rounded-xl border card-hover flex flex-col', PERF_STYLES[perf])}>
        {/* Thumbnail */}
        <div className="relative aspect-[9/16] max-h-52 rounded-t-xl overflow-hidden bg-slate-800 flex-shrink-0">
          {thumbSrc && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt="reel"
              className="w-full h-full object-cover"
              onError={() => {
                // A cached "/api/thumbnail/<id>" file can vanish (ephemeral disk
                // on Vercel). Retry once against the original CDN URL before
                // giving up, instead of showing a dead preview forever.
                if (!triedSource && reel.thumbnailSourceUrl) setTriedSource(true)
                else setImgFailed(true)
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Play className="w-8 h-8 text-slate-600" />
              {imgFailed && <span className="text-xs text-slate-600">preview unavailable</span>}
            </div>
          )}
          <div className="absolute top-2 right-2">
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', PERF_BADGE[perf])}>
              {PERF_LABEL[perf]}
            </span>
          </div>
          <div className="absolute bottom-2 left-2 text-xs text-white/70 bg-black/50 rounded px-1.5 py-0.5">
            {postedDate}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center px-3 py-2 border-b border-slate-700/50 gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-slate-300 min-w-0">
            <Eye className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span className="text-sm font-semibold">{fmt(reel.views)}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-300">
            <Heart className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span className="text-sm">{fmt(reel.likes)}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-300">
            <MessageCircle className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
            <span className="text-sm">{fmt(reel.comments)}</span>
          </div>
          <span className="text-xs text-amber-400 font-mono">{engRate}%</span>
          {reel.transcript && (
            <button
              onClick={() => setShowOverlay(true)}
              className="ml-auto flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0"
            >
              <FileText className="w-3 h-3" />
              Transcript
            </button>
          )}
        </div>

        {/* Caption - only when no analysis */}
        {!analysis && (
          <div className="px-3 pt-2 pb-1 flex-1">
            <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
              {reel.caption || '(no caption)'}
            </p>
          </div>
        )}

        {/* Analysis breakdown */}
        {analysis && (
          <div className="px-3 pt-2 pb-2 flex-1 space-y-2">
            {Object.entries(analysis).map(([key, value]) => {
              const str = Array.isArray(value) ? value.join(' · ') : String(value ?? '')
              if (!str || str.toLowerCase() === 'none') return null
              return (
                <div key={key}>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider leading-none mb-0.5">
                    {formatKey(key)}
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">{str}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex gap-2 px-3 pb-3 pt-1 border-t border-slate-700/30 mt-auto">
          {!reel.transcript && (reel.audioUrl || reel.videoUrl) && onTranscribe && (
            <button
              onClick={() => onTranscribe(reel)}
              disabled={transcribing}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-600/30 rounded-lg py-1.5 transition-colors disabled:opacity-50"
            >
              {transcribing
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Transcribing...</>
                : <><FileText className="w-3 h-3" /> Transcribe</>}
            </button>
          )}
          {reel.transcript && !analysis && onAnalyze && (
            <button
              onClick={() => onAnalyze(reel)}
              disabled={analyzing}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg py-1.5 transition-colors disabled:opacity-50"
            >
              {analyzing
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</>
                : <><Sparkles className="w-3 h-3" /> Analyze</>}
            </button>
          )}
          <a
            href={reel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors ml-auto"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </>
  )
}
