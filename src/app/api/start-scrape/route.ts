import { NextRequest, NextResponse } from 'next/server'
import { startScrapeRun } from '@/lib/apify'
import type { Platform, EntityType } from '@/lib/types'

interface StartScrapeBody {
  // Legacy field (Instagram-only callers). Either this or { platform, identifier } is required.
  instagramUrl?: string
  platform?: Platform
  entityType?: EntityType
  identifier?: string
  limit?: number
  onlyPostsNewerThan?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StartScrapeBody
    if (!process.env.APIFY_TOKEN) {
      return NextResponse.json({ error: 'APIFY_TOKEN not set in .env.local' }, { status: 500 })
    }

    // Resolve to { platform, entityType, identifier }
    let platform: Platform
    let entityType: EntityType
    let identifier: string
    if (body.platform && body.identifier) {
      platform = body.platform
      entityType = body.entityType ?? 'user'
      identifier = body.identifier
    } else if (body.instagramUrl) {
      platform = 'instagram'
      entityType = 'user'
      identifier = body.instagramUrl
    } else {
      return NextResponse.json(
        { error: 'platform + identifier (or instagramUrl) required' },
        { status: 400 },
      )
    }

    const job = await startScrapeRun({
      platform,
      entityType,
      identifier,
      limit: body.limit ?? 30,
      onlyPostsNewerThan: body.onlyPostsNewerThan,
    })
    return NextResponse.json(job)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
