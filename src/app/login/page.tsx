import fs from 'fs'
import path from 'path'
import LoginForm from './LoginForm'

const MY_USERNAME = process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'your_username'

function getSettings(): { displayName: string; instagramUsername: string } {
  try {
    const file = path.join(process.cwd(), 'data', 'settings.json')
    if (fs.existsSync(file)) {
      const s = JSON.parse(fs.readFileSync(file, 'utf-8'))
      return {
        displayName: s.displayName || 'Content Dashboard',
        instagramUsername: s.instagramUsername || MY_USERNAME,
      }
    }
  } catch {
    // fall through to defaults
  }
  return { displayName: 'Content Dashboard', instagramUsername: MY_USERNAME }
}

export default function LoginPage() {
  const { displayName, instagramUsername } = getSettings()

  return (
    <main className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand — mirrors the dashboard header identity */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mb-4 ring-2 ring-slate-700/80 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/profile_photo.jpg" alt="Profile" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">{displayName}</h1>
          <p className="text-slate-500 text-xs mt-0.5">@{instagramUsername}</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">
            Sign in to continue
          </p>
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
