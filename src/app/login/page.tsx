'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const MY_USERNAME = process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'your_username'

function LoginForm() {
  const params = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        return
      }
      // Full page load so the browser sends the new cookie on the very next request
      window.location.href = params.get('from') ?? '/'
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          required
          className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/60 focus:bg-slate-800 placeholder:text-slate-600 transition-colors"
          placeholder="Enter username"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/60 focus:bg-slate-800 placeholder:text-slate-600 transition-colors"
          placeholder="Enter password"
        />
      </div>

      {error && (
        <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !username || !password}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign in'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand — mirrors the dashboard header identity */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mb-4 ring-2 ring-slate-700/80 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/profile_photo.jpg" alt="Profile" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">Content Dashboard</h1>
          <p className="text-slate-500 text-xs mt-0.5">@{MY_USERNAME}</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">Sign in to continue</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
