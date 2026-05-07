import { NextRequest, NextResponse } from 'next/server'
import { fetchResults, tagPerformance } from '@/lib/apify'
import fs from 'fs'
import path from 'path'

const THUMB_DIR = process.env.VERCEL ? '/tmp/data/thumbnails' : path.join(process.cwd(), 'data', 'thumbnails')

function safeId(id: string): string {
  return id.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80)
}

async function cacheThumbnail(id: string, cdnUrl: string): Promise<string> {
  const sid = safeId(id)
  const file = path.join(THUMB_DIR, `${sid}.jpg`)
  if (fs.existsSync(file)) return `/api/thumbnail/${sid}`
  try {
    const res = await fetch(cdnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return cdnUrl
    const buffer = Buffer.from(await res.arrayBuffer())
    if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true })
    fs.writeFileSync(file, buffer)
    return `/api/thumbnail/${sid}`
  } catch {
    return cdnUrl
  }
}

export async function GET(req: NextRequest) {
  const datasetId = req.nextUrl.searchParams.get('datasetId')
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 30)
  if (!datasetId) return NextResponse.json({ error: 'datasetId required' }, { status: 400 })
  try {
    const reels = await fetchResults(datasetId, limit)
    const tagged = tagPerformance(reels)

    const withLocalThumbs = await Promise.all(
      tagged.map(async (reel) => {
        if (!reel.thumbnailUrl) return reel
        const localUrl = await cacheThumbnail(reel.id, reel.thumbnailUrl)
        return { ...reel, thumbnailUrl: localUrl }
      })
    )

    return NextResponse.json({ reels: withLocalThumbs })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
