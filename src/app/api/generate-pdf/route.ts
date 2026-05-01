import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { buildGiveawayHtml, type GiveawayPdfContent } from '@/lib/giveaway-html-template'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { content, brandName, instagramHandle, customCss }: {
    content: GiveawayPdfContent
    brandName?: string
    instagramHandle?: string
    customCss?: string
  } = await req.json()

  if (!content?.title) {
    return NextResponse.json({ error: 'No content provided' }, { status: 400 })
  }

  const brand = brandName?.trim() || 'Medha'
  const handle = instagramHandle?.trim().replace(/^@/, '') || 'themedhachannel'

  try {
    const qrDataUrl = await QRCode.toDataURL(`https://instagram.com/${handle}`, {
      width: 128,
      margin: 1,
      color: { dark: '#0f1729', light: '#ffffff' },
    })

    const html = buildGiveawayHtml(content, qrDataUrl, brand, handle, customCss)

    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    })

    try {
      const page = await browser.newPage()
      await page.setDefaultNavigationTimeout(30_000)
      await page.setContent(html, { waitUntil: 'networkidle0' })

      // Extra wait for Google Fonts to apply
      await new Promise((r) => setTimeout(r, 800))

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      })

      const safe = (content.title ?? 'giveaway')
        .slice(0, 50)
        .replace(/[^a-z0-9\s]/gi, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase()

      return new NextResponse(Buffer.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safe || 'giveaway'}.pdf"`,
        },
      })
    } finally {
      await browser.close()
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}