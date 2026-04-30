'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Trash2, RotateCcw, Clock, Loader2, PackageOpen } from 'lucide-react'

interface RecycleBinItem {
  id: string
  type: 'idea' | 'competitor'
  label: string
  data: unknown
  deletedAt: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const TYPE_STYLE: Record<RecycleBinItem['type'], string> = {
  idea: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  competitor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

const TYPE_LABEL: Record<RecycleBinItem['type'], string> = {
  idea: 'Idea',
  competitor: 'Competitor',
}

export default function RecycleBinPage() {
  const [items, setItems] = useState<RecycleBinItem[]>([])
  const [loading, setLoading] = useState(true)
  const [recycleBinDays, setRecycleBinDays] = useState(15)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [emptyConfirm, setEmptyConfirm] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/recycle-bin').then((r) => r.json()),
    ]).then(([settingsRes, binRes]) => {
      const days = settingsRes?.data?.recycleBinDays ?? 15
      setRecycleBinDays(days)
      // Filter by TTL
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      const all: RecycleBinItem[] = binRes?.items ?? []
      setItems(all.filter((i) => new Date(i.deletedAt).getTime() > cutoff))
      setLoading(false)
    })
  }, [])

  async function restore(item: RecycleBinItem) {
    setRestoring(item.id)
    try {
      if (item.type === 'idea') {
        const res = await fetch('/api/cache?key=content_ideas')
        const { data } = await res.json()
        const ideas = Array.isArray(data) ? data : []
        ideas.unshift(item.data)
        await fetch('/api/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'content_ideas', data: ideas }),
        })
      } else if (item.type === 'competitor') {
        const res = await fetch('/api/cache?key=competitors')
        const { data } = await res.json()
        const accounts = data?.accounts ?? {}
        const comp = item.data as { username: string; reels: unknown[]; fetchedAt: string }
        accounts[comp.username] = comp
        await fetch('/api/cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'competitors', data: { accounts } }),
        })
      }
      await fetch('/api/recycle-bin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      })
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } finally {
      setRestoring(null)
    }
  }

  async function permanentDelete(id: string) {
    setDeleting(id)
    await fetch('/api/recycle-bin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setItems((prev) => prev.filter((i) => i.id !== id))
    setDeleting(null)
  }

  async function emptyAll() {
    await fetch('/api/recycle-bin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setItems([])
    setEmptyConfirm(false)
  }

  return (
    <main className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0a0f1e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/settings"
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </a>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-slate-400" />
              <h1 className="text-sm font-semibold text-white">Recycle Bin</h1>
              {items.length > 0 && (
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              )}
            </div>
          </div>

          {items.length > 0 && (
            emptyConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={emptyAll}
                  className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Confirm empty
                </button>
                <button
                  onClick={() => setEmptyConfirm(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEmptyConfirm(true)}
                className="flex items-center gap-1.5 text-sm text-rose-400 hover:text-rose-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Empty all
              </button>
            )
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* TTL notice */}
        <div className="flex items-center gap-2 text-xs text-slate-600 mb-6">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Items are permanently deleted after {recycleBinDays} days.{' '}
            <a href="/settings#recycle" className="text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">
              Change in Settings
            </a>
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-4 text-center">
            <PackageOpen className="w-12 h-12 text-slate-700" />
            <p className="text-slate-500 text-sm">Recycle bin is empty</p>
            <a
              href="/settings"
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              ← Back to Settings
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const busy = restoring === item.id || deleting === item.id
              return (
                <div
                  key={item.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${TYPE_STYLE[item.type]}`}
                      >
                        {TYPE_LABEL[item.type]}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(item.deletedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium truncate">{item.label}</p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => restore(item)}
                      disabled={busy}
                      title="Restore"
                      className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-40"
                    >
                      {restoring === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Restore
                    </button>
                    <button
                      onClick={() => permanentDelete(item.id)}
                      disabled={busy}
                      title="Delete forever"
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-40"
                    >
                      {deleting === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Delete forever
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
