import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: `Content Dashboard — @${process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'me'}`,
  description: 'Instagram reels analytics, competitor research & content ideas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
