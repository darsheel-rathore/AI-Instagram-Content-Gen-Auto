import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Content Dashboard — @${process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'me'}`,
  description: 'Instagram reels analytics, competitor research & content ideas',
  icons: { icon: '/favicon.png' },
}

const clerkTheme = {
  variables: {
    colorPrimary: '#f59e0b',
    colorBackground: '#0a0f1e',
    colorInputBackground: '#0f172a',
    colorInputText: '#f8fafc',
    colorText: '#f8fafc',
    colorTextSecondary: '#64748b',
    colorDanger: '#f43f5e',
    colorSuccess: '#10b981',
    colorNeutral: '#334155',
    borderRadius: '0.75rem',
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
  },
  elements: {
    // Card / modal
    card: 'bg-slate-900/80 border border-slate-800 shadow-2xl shadow-black/60 backdrop-blur-sm',
    cardBox: 'shadow-none',

    // Header
    headerTitle: 'text-white font-bold tracking-tight',
    headerSubtitle: 'text-slate-400',
    logoBox: 'hidden',

    // Form fields
    formFieldLabel: 'text-slate-400 text-xs font-medium',
    formFieldInput: 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-amber-500/60 focus:ring-amber-500/20',
    formFieldInputShowPasswordButton: 'text-slate-400 hover:text-white',

    // Primary button
    formButtonPrimary: 'bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold shadow-lg shadow-amber-500/20 transition-all',

    // Secondary / ghost buttons
    formButtonReset: 'text-amber-400 hover:text-amber-300',
    footerActionLink: 'text-amber-400 hover:text-amber-300',

    // Social buttons
    socialButtonsBlockButton: 'bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600 transition-colors',
    socialButtonsBlockButtonText: 'text-slate-300 font-medium',

    // Divider
    dividerLine: 'bg-slate-700',
    dividerText: 'text-slate-500',

    // Identity preview (MFA / after sign-in state)
    identityPreviewEditButton: 'text-amber-400 hover:text-amber-300',
    identityPreviewText: 'text-slate-300',

    // OTP / code input
    otpCodeFieldInput: 'bg-slate-800 border-slate-700 text-white',

    // Alert / error box
    alertText: 'text-rose-300',
    alertIcon: 'text-rose-400',

    // Footer
    footer: 'hidden',
    footerPages: 'hidden',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkTheme}>
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
