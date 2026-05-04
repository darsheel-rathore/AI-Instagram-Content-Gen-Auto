import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Use Upstash Redis when env vars are present (production), fall back to
// local filesystem for development so no Redis setup is needed locally.
const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

async function getRedis() {
  const { Redis } = await import('@upstash/redis')
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// ── Filesystem helpers (local dev only) ──────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data')

function fsRead(key: string): unknown | null {
  const file = path.join(DATA_DIR, `${key}.json`)
  if (!fs.existsSync(file)) return null
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return null }
}

function fsWrite(key: string, data: unknown) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(path.join(DATA_DIR, `${key}.json`), JSON.stringify(data, null, 2), 'utf-8')
}

// ── Route handlers ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  try {
    if (useRedis) {
      const redis = await getRedis()
      const data = await redis.get(key)
      return NextResponse.json({ data: data ?? null })
    }
    return NextResponse.json({ data: fsRead(key) })
  } catch {
    return NextResponse.json({ data: null })
  }
}

export async function POST(req: NextRequest) {
  const { key, data } = await req.json()
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  try {
    if (useRedis) {
      const redis = await getRedis()
      await redis.set(key, JSON.stringify(data))
    } else {
      fsWrite(key, data)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
