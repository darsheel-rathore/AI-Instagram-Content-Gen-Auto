'use client'

import { useClerk } from '@clerk/nextjs'
import { ShieldOff, LogOut } from 'lucide-react'

export default function UnauthorizedPage() {
  const { signOut } = useClerk()

  return (
    <main className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      {/* Subtle red glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 35% at 50% 50%, rgba(244,63,94,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center gap-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-rose-400" />
        </div>

        {/* Message */}
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-white tracking-tight">Access Denied</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Your account doesn&apos;t have admin privileges.
            <br />
            Contact the dashboard owner to get access.
          </p>
        </div>

        {/* Info card */}
        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl px-5 py-4 text-left space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Required</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-slate-800 text-amber-400 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono">
              publicMetadata.role = &quot;admin&quot;
            </code>
          </div>
          <p className="text-xs text-slate-600">
            Set this on your Clerk user via the Clerk Dashboard.
          </p>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ redirectUrl: '/login' })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out and try a different account
        </button>
      </div>
    </main>
  )
}
