import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      {/* Subtle radial glow behind the card */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(245,158,11,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-slate-700/80 shadow-lg shadow-black/40">
            <img
              src="/profile_photo.jpg"
              alt="Dashboard"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center">
            <h1 className="text-base font-bold text-white tracking-tight">
              {process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME
                ? `@${process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME}`
                : 'Content Dashboard'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Sign in to continue</p>
          </div>
        </div>

        {/* Clerk SignIn — themed via ClerkProvider appearance in layout.tsx */}
        <SignIn
          routing="hash"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: '!w-full !rounded-2xl !bg-slate-900/70 !border !border-slate-800 !shadow-2xl !shadow-black/60',
            },
          }}
        />
      </div>
    </main>
  )
}
