import { useRedis, getRedis } from '@/lib/redis'
import fs from 'fs'
import path from 'path'

export type Feature =
  | 'transcription'
  | 'analysis'
  | 'content-ideas'
  | 'scraping'
  | 'ppt-generation'
  | 'story-strategy'

export type UsageProvider = 'anthropic' | 'openai' | 'gemini' | 'apify'

export interface UsageEntry {
  id: string
  timestamp: string
  provider: UsageProvider
  model: string
  feature: Feature
  inputTokens: number
  outputTokens: number
  audioSeconds?: number
  estimatedCostUSD: number
}

// Pricing per million tokens (USD)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7':           { input: 15.000, output: 75.00 },
  'claude-sonnet-4-6':         { input: 3.000,  output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.250,  output: 1.25  },
  'gpt-4o':                    { input: 2.500,  output: 10.00 },
  'gpt-4o-mini':               { input: 0.150,  output: 0.60  },
  'gemini-2.5-pro':            { input: 1.250,  output: 10.00 },
  'gemini-2.5-flash':          { input: 0.150,  output: 0.60  },
  'gemini-2.0-flash-lite':     { input: 0.075,  output: 0.30  },
}

const WHISPER_PER_MINUTE = 0.006
const MAX_ENTRIES = 10_000
const REDIS_KEY = 'usage_log'

// ── Filesystem fallback (local dev) ──────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data')
const USAGE_FILE = path.join(DATA_DIR, 'usage_log.json')

function fsReadLogs(): UsageEntry[] {
  try {
    if (!fs.existsSync(USAGE_FILE)) return []
    return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8')) as UsageEntry[]
  } catch { return [] }
}

function fsWriteLogs(entries: UsageEntry[]) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(USAGE_FILE, JSON.stringify(entries, null, 2), 'utf-8')
}

// ── Public API ────────────────────────────────────────────────────────────────

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  audioSeconds?: number,
): number {
  if (model === 'whisper-1' && audioSeconds !== undefined) {
    return (audioSeconds / 60) * WHISPER_PER_MINUTE
  }
  const p = TOKEN_PRICING[model]
  if (!p) return 0
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export async function logUsage(
  entry: Omit<UsageEntry, 'id' | 'estimatedCostUSD'> & { estimatedCostUSD?: number },
): Promise<void> {
  try {
    const cost =
      entry.estimatedCostUSD ??
      estimateCost(entry.model, entry.inputTokens, entry.outputTokens, entry.audioSeconds)
    const record: UsageEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      estimatedCostUSD: cost,
      ...entry,
    }

    if (useRedis) {
      const redis = getRedis()
      const existing = await redis.get<UsageEntry[]>(REDIS_KEY) ?? []
      const updated = [...existing, record].slice(-MAX_ENTRIES)
      await redis.set(REDIS_KEY, JSON.stringify(updated))
    } else {
      const existing = fsReadLogs()
      fsWriteLogs([...existing, record].slice(-MAX_ENTRIES))
    }
  } catch {
    // Never throw — logging must not break the main response flow
  }
}

export async function readUsageLogs(): Promise<UsageEntry[]> {
  try {
    if (useRedis) {
      const data = await getRedis().get<UsageEntry[]>(REDIS_KEY)
      return data ?? []
    }
    return fsReadLogs()
  } catch {
    return []
  }
}
