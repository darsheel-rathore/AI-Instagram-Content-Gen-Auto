import type { Reel, Platform, EntityType } from './types'

const APIFY_TOKEN = process.env.APIFY_TOKEN ?? ''
const BASE = 'https://api.apify.com/v2'

// Apify actor IDs per platform. Swap a value here if a better actor comes along.
const ACTORS: Record<Platform, string> = {
  instagram: 'shu8hvrXbJbY3Eb9W',         // (original Instagram actor)
  reddit:    'automation-lab~reddit-scraper',
  quora:     'automation-lab~quora-scraper',
}

export interface StartScrapeArgs {
  platform: Platform
  entityType: EntityType
  identifier: string                  // raw handle, e.g. "nateherk", "AskReddit"
  limit?: number
  onlyPostsNewerThan?: string         // Instagram only
}

// ── Public entry points ──────────────────────────────────────────────────────

export async function startScrapeRun(args: StartScrapeArgs) {
  const limit = args.limit ?? 30
  switch (args.platform) {
    case 'instagram': return startInstagramScrape(args.identifier, limit, args.onlyPostsNewerThan)
    case 'reddit':    return startRedditScrape(args.entityType, args.identifier, limit)
    case 'quora':     return startQuoraScrape(args.entityType, args.identifier, limit)
  }
}

export async function getRunStatus(runId: string): Promise<{ status: string; costUsd?: number }> {
  const res = await fetch(`${BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`)
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
  const data = await res.json()
  return {
    status: data.data.status as string,
    costUsd: data.data.usageTotalUsd as number | undefined,
  }
}

export async function fetchResults(
  datasetId: string,
  limit = 30,
  platform: Platform = 'instagram',
): Promise<Reel[]> {
  const res = await fetch(
    `${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&format=json`,
  )
  if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`)
  const items = (await res.json()) as Record<string, unknown>[]
  switch (platform) {
    case 'instagram': return items.map(mapInstagramItem)
    case 'reddit':    return items.map(mapRedditItem).filter((r): r is Reel => r !== null)
    case 'quora':     return items.map(mapQuoraItem).filter((r): r is Reel => r !== null)
  }
}

export function tagPerformance(reels: Reel[]): Reel[] {
  if (reels.length === 0) return reels
  // Use likes as the universal "engagement" metric so this also works for
  // Reddit (likes = upvote score) and Quora (likes = upvote count) where
  // views aren't reported.
  const metric = reels[0].views > 0 ? (r: Reel) => r.views : (r: Reel) => r.likes
  const avg = reels.reduce((s, r) => s + metric(r), 0) / reels.length
  if (avg === 0) return reels
  return reels.map((r) => ({
    ...r,
    performance: metric(r) >= avg * 1.4 ? 'top' : metric(r) < avg * 0.6 ? 'low' : 'mid',
  }))
}

// ── Instagram ────────────────────────────────────────────────────────────────

async function startInstagramScrape(username: string, limit: number, onlyPostsNewerThan?: string) {
  const instagramUrl = username.startsWith('http')
    ? username
    : `https://www.instagram.com/${username.replace(/^@/, '')}/`
  const body: Record<string, unknown> = {
    directUrls: [instagramUrl],
    resultsType: 'posts',
    resultsLimit: limit,
    mediaType: 'VIDEO',
    addParentData: false,
  }
  if (onlyPostsNewerThan) body.onlyPostsNewerThan = onlyPostsNewerThan
  return startActor(ACTORS.instagram, body)
}

function mapInstagramItem(item: Record<string, unknown>): Reel {
  return {
    id: (item.id ?? item.url ?? String(Math.random())) as string,
    url: (item.url as string) ?? '',
    timestamp: (item.timestamp as string) ?? '',
    likes: Number(item.likesCount ?? 0),
    views: Number(item.videoPlayCount ?? 0),
    comments: Number(item.commentsCount ?? 0),
    caption: ((item.caption as string) ?? '').slice(0, 600),
    audioUrl: item.audioUrl as string | undefined,
    videoUrl: item.videoUrl as string | undefined,
    thumbnailUrl: (item.displayUrl ?? item.thumbnailUrl) as string | undefined,
    duration: item.videoDuration as number | undefined,
    ownerUsername: (item.ownerUsername as string) ?? '',
    platform: 'instagram',
    entityType: 'user',
  }
}

// ── Reddit ───────────────────────────────────────────────────────────────────

async function startRedditScrape(entityType: EntityType, identifier: string, limit: number) {
  const cleanId = identifier.replace(/^(u\/|r\/|@)/, '')
  const url = entityType === 'subreddit'
    ? `https://www.reddit.com/r/${cleanId}/`
    : `https://www.reddit.com/user/${cleanId}/`
  const body = {
    urls: [url],
    sort: 'top',
    timeFilter: 'month',
    maxPostsPerSource: limit,
    includeComments: false,
  }
  return startActor(ACTORS.reddit, body)
}

function mapRedditItem(item: Record<string, unknown>): Reel | null {
  // Actor emits both posts and comments. Keep only posts.
  if (item.type && item.type !== 'post') return null
  const score = Number(item.score ?? 0)
  const permalink = (item.permalink as string) ?? ''
  const fullUrl = permalink.startsWith('http')
    ? permalink
    : `https://www.reddit.com${permalink}`
  const title = (item.title as string) ?? ''
  const selfText = (item.selfText as string) ?? ''
  // Reddit selftext can be long-form — keep up to 8000 chars so the
  // "expand" UI has real content to show. Truncated only to guard against
  // pathological posts.
  const caption = (selfText.length > 0 ? `${title}\n\n${selfText}` : title).slice(0, 8000)
  return {
    id: (item.id as string) ?? permalink ?? String(Math.random()),
    url: (item.url as string) ?? fullUrl,
    timestamp: (item.createdAt as string) ?? '',
    likes: score,
    views: 0,
    comments: Number(item.numComments ?? 0),
    caption,
    thumbnailUrl: (item.thumbnail as string) || undefined,
    ownerUsername: (item.author as string) ?? '',
    platform: 'reddit',
    entityType: item.subreddit ? 'subreddit' : 'user',
    authorName: (item.author as string) ?? undefined,
    subreddit: (item.subreddit as string) ?? undefined,
  }
}

// ── Quora ────────────────────────────────────────────────────────────────────

async function startQuoraScrape(entityType: EntityType, identifier: string, limit: number) {
  const cleanId = identifier.replace(/^@/, '')
  const url = entityType === 'topic'
    ? `https://www.quora.com/topic/${cleanId}`
    : `https://www.quora.com/profile/${cleanId}`
  const cookies = process.env.QUORA_COOKIES
  if (!cookies) {
    throw new Error(
      'Quora scraping requires QUORA_COOKIES in .env.local — paste your Quora session cookies (see README).',
    )
  }
  const body: Record<string, unknown> = {
    startUrls: [url],
    maxQuestions: limit,
    scrapeAnswers: true,
    maxAnswersPerQuestion: 10,
    cookies,
    proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
  }
  return startActor(ACTORS.quora, body)
}

function mapQuoraItem(item: Record<string, unknown>): Reel | null {
  // Actor emits answer records; we surface them as the unit of competitor content.
  if (item.type && item.type !== 'answer') return null
  const id =
    (item.answerId as string) ??
    (item.questionId as string) ??
    String(Math.random())
  const text = (item.text as string) ?? ''
  const questionTitle = (item.questionTitle as string) ?? ''
  // Quora answers are usually long — keep generous headroom for the expand UI.
  const caption = (questionTitle ? `${questionTitle}\n\n${text}` : text).slice(0, 8000)
  return {
    id,
    url: (item.answerUrl as string) ?? (item.questionUrl as string) ?? '',
    timestamp: (item.createdAt as string) ?? '',
    likes: Number(item.upvotes ?? 0),
    views: 0,
    comments: Number(item.numComments ?? 0),
    caption,
    ownerUsername: (item.authorName as string) ?? '',
    platform: 'quora',
    entityType: 'user',
    authorName: (item.authorName as string) ?? undefined,
    authorBio: (item.authorBio as string) ?? undefined,
  }
}

// ── Shared ───────────────────────────────────────────────────────────────────

async function startActor(actorId: string, input: Record<string, unknown>) {
  const res = await fetch(`${BASE}/acts/${actorId}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Apify start failed (${res.status}): ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  return {
    runId: data.data.id as string,
    datasetId: data.data.defaultDatasetId as string,
  }
}
