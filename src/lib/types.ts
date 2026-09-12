export type ReelAnalysis = Record<string, string>

// Platforms we support for competitor scraping
export type Platform = 'instagram' | 'reddit' | 'quora'

// What kind of entity an identifier refers to on its platform.
//   instagram: always 'user'
//   reddit:    'user' (u/foo) or 'subreddit' (r/foo)
//   quora:     'user' or 'topic'
export type EntityType = 'user' | 'subreddit' | 'topic'

export interface Reel {
  id: string
  url: string
  timestamp: string
  likes: number
  views: number
  comments: number
  caption: string
  audioUrl?: string
  videoUrl?: string
  thumbnailUrl?: string
  // Original CDN URL, kept alongside the cached "/api/thumbnail/<id>" path so a
  // missing cache file (Vercel wipes /tmp on every cold start and redeploy) can
  // fall back to the source instead of rendering a dead preview.
  thumbnailSourceUrl?: string
  duration?: number
  ownerUsername: string
  transcript?: string
  transcriptPartial?: boolean
  reelAnalysis?: ReelAnalysis
  performance?: 'top' | 'mid' | 'low'
  // Platform metadata — undefined means legacy Instagram for backward compat
  platform?: Platform
  entityType?: EntityType
  // Optional extras populated by non-Instagram scrapers
  authorName?: string  // Reddit/Quora author display name
  authorBio?: string   // Quora author credentials line
  subreddit?: string   // Reddit subreddit name when scraping a user
}

export interface ScrapeJob {
  runId: string
  datasetId: string
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'READY'
}

export type Tab = 'mine' | 'competitors' | 'ideas'

// ── Competitor key helpers ───────────────────────────────────────────────────
// Keys in the competitors state map use a compound format:
//   "instagram/user/nateherk"     → new Instagram entries
//   "reddit/user/spez"            → Reddit user
//   "reddit/subreddit/AskReddit"  → Reddit subreddit
//   "quora/user/Richard-Socher"   → Quora user
//   "quora/topic/Machine-Learning" → Quora topic / space
// Legacy entries (no slash) are treated as instagram/user/<key>.

export interface CompetitorRef {
  platform: Platform
  entityType: EntityType
  identifier: string
}

export function makeCompetitorKey(ref: CompetitorRef): string {
  return `${ref.platform}/${ref.entityType}/${ref.identifier}`
}

export function parseCompetitorKey(key: string): CompetitorRef {
  // Split on first two slashes only, so identifiers that accidentally contain
  // slashes (e.g. a pasted URL) survive intact rather than being misclassified
  // as legacy Instagram data.
  const i1 = key.indexOf('/')
  const i2 = i1 >= 0 ? key.indexOf('/', i1 + 1) : -1
  if (i1 > 0 && i2 > i1) {
    const platform = key.slice(0, i1)
    const entityType = key.slice(i1 + 1, i2)
    if ((platform === 'instagram' || platform === 'reddit' || platform === 'quora') &&
        (entityType === 'user' || entityType === 'subreddit' || entityType === 'topic')) {
      return {
        platform: platform as Platform,
        entityType: entityType as EntityType,
        identifier: key.slice(i2 + 1),
      }
    }
  }
  // Legacy: bare username = Instagram user
  return { platform: 'instagram', entityType: 'user', identifier: key }
}

// Pretty label for a competitor key, used in headers and dropdowns.
//   instagram/user/nateherk    → @nateherk
//   reddit/user/spez           → u/spez
//   reddit/subreddit/AskReddit → r/AskReddit
//   quora/user/Richard-Socher  → Richard Socher
//   quora/topic/AI             → AI
export function competitorDisplayLabel(key: string): string {
  const ref = parseCompetitorKey(key)
  if (ref.platform === 'reddit' && ref.entityType === 'subreddit') return `r/${ref.identifier}`
  if (ref.platform === 'reddit' && ref.entityType === 'user') return `u/${ref.identifier}`
  if (ref.platform === 'quora' && ref.entityType === 'topic') return ref.identifier.replace(/-/g, ' ')
  if (ref.platform === 'quora' && ref.entityType === 'user') return ref.identifier.replace(/-/g, ' ')
  return `@${ref.identifier}`
}
