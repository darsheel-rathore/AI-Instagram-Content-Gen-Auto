'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Camera, Clock, Database, Trash2,
  Download, Upload, AlertTriangle, Check, Loader2, Shield,
  Info,
} from 'lucide-react'
import clsx from 'clsx'

interface AppSettings {
  instagramUsername: string
  autoSignoutMinutes: number
  recycleBinDays: number
  displayName: string
  myReelsScrapeLimit: number
}

const DEFAULTS: AppSettings = {
  instagramUsername: '',
  autoSignoutMinutes: 0,
  recycleBinDays: 15,
  displayName: 'Content Dashboard',
  myReelsScrapeLimit: 30,
}

const SIGNOUT_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 60, label: '1 hour' },
  { value: 240, label: '4 hours' },
  { value: 1440, label: '24 hours' },
  { value: 10080, label: '7 days' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
      {children}
    </h2>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-slate-900/60 border border-slate-800 rounded-2xl p-5', className)}>
      {children}
    </div>
  )
}

function Row({
  icon, title, description, children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 p-5">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [photoVersion, setPhotoVersion] = useState(0)
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [recycleBinCount, setRecycleBinCount] = useState(0)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [emptyBinConfirm, setEmptyBinConfirm] = useState(false)
  const [clearDone, setClearDone] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importKeys, setImportKeys] = useState<string[]>([])
  const [importError, setImportError] = useState('')
  const [importDone, setImportDone] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const envUsername = process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? ''

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/recycle-bin').then((r) => r.json()),
    ]).then(([s, b]) => {
      if (s?.data) setSettings({ ...DEFAULTS, ...s.data })
      setRecycleBinCount(b?.items?.length ?? 0)
      setLoading(false)
    })
  }, [])

  async function saveSection(section: string, patch: Partial<AppSettings>) {
    setSaving(section)
    setSaved(null)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSettings((prev) => ({ ...prev, ...patch }))
    setSaving(null)
    setSaved(section)
    setTimeout(() => setSaved((v) => (v === section ? null : v)), 2500)
  }

  async function handlePhotoSave() {
    if (!profileFile) return
    setSaving('photo')
    const fd = new FormData()
    fd.append('file', profileFile)
    const res = await fetch('/api/upload-profile', { method: 'POST', body: fd })
    setSaving(null)
    if (res.ok) {
      setProfileFile(null)
      setProfilePreview(null)
      setPhotoVersion(Date.now())
      setSaved('photo')
      setTimeout(() => setSaved((v) => (v === 'photo' ? null : v)), 2500)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setProfileFile(f)
    setProfilePreview(URL.createObjectURL(f))
  }

  async function downloadBackup() {
    setSaving('backup')
    const res = await fetch('/api/backup')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setSaving(null)
  }

  async function clearAllData() {
    setSaving('clear')
    await fetch('/api/backup', { method: 'DELETE' })
    setSaving(null)
    setClearConfirm(false)
    setClearDone(true)
  }

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError('')
    setImportDone(false)
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setImportError('Invalid backup file — expected a JSON object')
          setImportFile(null)
          return
        }
        setImportFile(f)
        setImportKeys(Object.keys(parsed))
      } catch {
        setImportError('Could not parse file — make sure it is a valid JSON backup')
        setImportFile(null)
      }
    }
    reader.readAsText(f)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  async function handleImport() {
    if (!importFile) return
    setImportLoading(true)
    setImportError('')
    try {
      const text = await importFile.text()
      const parsed = JSON.parse(text)
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      if (!res.ok) {
        const err = await res.json()
        setImportError(err.error ?? 'Import failed')
      } else {
        setImportDone(true)
        setImportFile(null)
        setImportKeys([])
      }
    } catch {
      setImportError('Failed to read or import file')
    } finally {
      setImportLoading(false)
    }
  }

  async function emptyRecycleBin() {
    await fetch('/api/recycle-bin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setRecycleBinCount(0)
    setEmptyBinConfirm(false)
  }

  function SaveBtn({
    section,
    onClick,
    disabled,
  }: {
    section: string
    onClick?: () => void
    disabled?: boolean
  }) {
    const isSaving = saving === section
    const isSaved = saved === section
    return (
      <button
        onClick={onClick}
        disabled={disabled || isSaving}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        {isSaved ? (
          <Check className="w-3.5 h-3.5" />
        ) : isSaving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : null}
        {isSaved ? 'Saved' : 'Save'}
      </button>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0f1e]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0a0f1e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <span className="text-slate-700">/</span>
          <h1 className="text-sm font-semibold text-white">Settings</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Profile */}
        <section>
          <SectionLabel>Profile</SectionLabel>
          <Card>
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Avatar picker */}
              <div className="mx-auto sm:mx-0 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative group block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profilePreview ?? `/profile_photo.jpg${photoVersion ? `?v=${photoVersion}` : ''}`}
                    alt="Profile"
                    className="w-24 h-24 rounded-2xl object-cover ring-2 ring-slate-700 group-hover:ring-amber-500/50 transition-all"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    <Camera className="w-5 h-5 text-white" />
                    <span className="text-[11px] text-white font-medium">Change</span>
                  </div>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Fields */}
              <div className="flex-1 min-w-0 w-full space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={settings.displayName}
                    onChange={(e) => setSettings((s) => ({ ...s, displayName: e.target.value }))}
                    placeholder="Content Dashboard"
                    className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/60 transition-colors"
                  />
                </div>

                {profileFile && (
                  <p className="text-xs text-amber-400 flex items-center gap-1.5">
                    <Camera className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{profileFile.name} — click &quot;Save photo&quot; to apply</span>
                  </p>
                )}

                <div className="flex gap-2 flex-wrap">
                  {profileFile && (
                    <button
                      onClick={handlePhotoSave}
                      disabled={saving === 'photo'}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                    >
                      {saving === 'photo' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : saved === 'photo' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : null}
                      Save photo
                    </button>
                  )}
                  <SaveBtn
                    section="name"
                    onClick={() => saveSection('name', { displayName: settings.displayName })}
                  />
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Account */}
        <section>
          <SectionLabel>Account</SectionLabel>
          <Card className="space-y-5">
            {/* Instagram username */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Instagram username
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">
                    @
                  </span>
                  <input
                    type="text"
                    value={settings.instagramUsername}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, instagramUsername: e.target.value }))
                    }
                    placeholder={envUsername || 'your_username'}
                    className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/60 transition-colors"
                  />
                </div>
                <SaveBtn
                  section="account"
                  onClick={() =>
                    saveSection('account', { instagramUsername: settings.instagramUsername })
                  }
                />
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Overrides the Instagram profile used for scraping and display. Takes effect on next
                page load.{' '}
                {envUsername && (
                  <span className="text-slate-700">Env default: @{envUsername}</span>
                )}
              </p>
            </div>

            {/* Scrape limit */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                My Reels — posts to scrape
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={settings.myReelsScrapeLimit}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      myReelsScrapeLimit: Math.max(5, parseInt(e.target.value) || 30),
                    }))
                  }
                  className="w-24 bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:border-amber-500/60 transition-colors"
                />
                <span className="text-sm text-slate-500">posts</span>
                <div className="ml-auto">
                  <SaveBtn
                    section="scrapeLimit"
                    onClick={() =>
                      saveSection('scrapeLimit', {
                        myReelsScrapeLimit: settings.myReelsScrapeLimit,
                      })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Higher limits take longer to scrape (default: 30).
              </p>
            </div>
          </Card>
        </section>

        {/* Session */}
        <section>
          <SectionLabel>Session &amp; Security</SectionLabel>
          <Card>
            <div className="flex items-start gap-3 mb-5">
              <Shield className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Auto sign-out</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign out automatically after a period of inactivity
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
              {SIGNOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSettings((s) => ({ ...s, autoSignoutMinutes: opt.value }))}
                  className={clsx(
                    'py-2.5 rounded-xl text-sm font-medium border transition-all',
                    settings.autoSignoutMinutes === opt.value
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <SaveBtn
              section="session"
              onClick={() =>
                saveSection('session', { autoSignoutMinutes: settings.autoSignoutMinutes })
              }
            />
          </Card>
        </section>

        {/* Data */}
        <section>
          <SectionLabel>Data &amp; Backup</SectionLabel>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl divide-y divide-slate-800">
            <Row
              icon={<Database className="w-4 h-4 text-blue-400" />}
              title="Download backup"
              description="Export all cached reels, ideas, and competitor data as a JSON file"
            >
              <button
                onClick={downloadBackup}
                disabled={saving === 'backup'}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {saving === 'backup' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Export
              </button>
            </Row>

            {/* Import */}
            <div className="p-5 border-t border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <Upload className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Import backup</p>
                  <p className="text-xs text-slate-500 mt-0.5">Restore from a JSON backup file</p>
                  {importFile && (
                    <p className="text-xs text-amber-400 mt-1 truncate">
                      {importFile.name} — {importKeys.length} key{importKeys.length !== 1 ? 's' : ''}: {importKeys.slice(0, 4).join(', ')}{importKeys.length > 4 ? '…' : ''}
                    </p>
                  )}
                  {importError && <p className="text-xs text-rose-400 mt-1">{importError}</p>}
                  {importDone && (
                    <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Imported. Reload the dashboard to see changes.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {importFile ? (
                    <>
                      <button
                        onClick={handleImport}
                        disabled={importLoading}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                      >
                        {importLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Confirm
                      </button>
                      <button
                        onClick={() => { setImportFile(null); setImportKeys([]); setImportError('') }}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1.5 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => importFileRef.current?.click()}
                      className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Import
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={importFileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportFileChange}
              />
            </div>

            <Row
              icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
              title="Clear all data"
              description="Delete all cached reels, ideas, and competitor data. Settings are preserved."
            >
              {clearConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearAllData}
                    disabled={saving === 'clear'}
                    className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {saving === 'clear' ? (
                      <Loader2 className="w-3 h-3 animate-spin inline" />
                    ) : (
                      'Confirm'
                    )}
                  </button>
                  <button
                    onClick={() => setClearConfirm(false)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1.5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setClearDone(false); setClearConfirm(true) }}
                  className="text-sm font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-4 py-2 rounded-xl transition-colors"
                >
                  Clear
                </button>
              )}
            </Row>

            {clearDone && (
              <div className="px-5 py-3 flex items-center gap-2 text-emerald-400 text-xs">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                All data cleared. Reload the dashboard to see changes.
              </div>
            )}
          </div>
        </section>

        {/* Recycle Bin */}
        <section>
          <SectionLabel>Recycle Bin</SectionLabel>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl divide-y divide-slate-800">
            {/* Retention */}
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Retention period</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Items older than this are permanently removed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={settings.recycleBinDays}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      recycleBinDays: Math.max(1, parseInt(e.target.value) || 15),
                    }))
                  }
                  className="w-20 bg-slate-800/80 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:border-amber-500/60 transition-colors"
                />
                <span className="text-sm text-slate-400">days</span>
                <div className="ml-auto">
                  <SaveBtn
                    section="recycleRetention"
                    onClick={() =>
                      saveSection('recycleRetention', { recycleBinDays: settings.recycleBinDays })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Open bin */}
            <Row
              icon={<Trash2 className="w-4 h-4 text-slate-400" />}
              title="Recycle Bin"
              description={`${recycleBinCount} item${recycleBinCount !== 1 ? 's' : ''} stored`}
            >
              <a
                href="/recycle-bin"
                className="text-sm font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 px-4 py-2 rounded-xl transition-colors"
              >
                Open →
              </a>
            </Row>

            {/* Empty bin */}
            <Row
              icon={<Trash2 className="w-4 h-4 text-rose-400" />}
              title="Empty recycle bin"
              description="Permanently delete all items in the bin"
            >
              {emptyBinConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={emptyRecycleBin}
                    className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setEmptyBinConfirm(false)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1.5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => recycleBinCount > 0 && setEmptyBinConfirm(true)}
                  disabled={recycleBinCount === 0}
                  className="text-sm font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-4 py-2 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Empty
                </button>
              )}
            </Row>
          </div>
        </section>

        {/* About */}
        <section>
          <SectionLabel>About</SectionLabel>
          <Card>
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm text-white font-medium">Content Dashboard</p>
                <p className="text-xs text-slate-500">
                  Instagram analytics &amp; content planner
                </p>
                <p className="text-xs text-slate-700 pt-1">
                  Built with Next.js · Recharts · Apify · Anthropic / OpenAI / Gemini
                </p>
              </div>
            </div>
          </Card>
        </section>

      </div>
    </main>
  )
}
