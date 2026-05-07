import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { useRedis, getRedis } from '@/lib/redis'

const DATA_DIR = path.join(process.cwd(), 'data')
// Keys that are user preferences — preserved on clear
const PRESERVE_ON_CLEAR = new Set(['settings', 'recycle_bin'])

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

// GET — export all data as a downloadable JSON file
export async function GET() {
  const backup: Record<string, unknown> = {}

  if (useRedis) {
    const redis = getRedis()
    const keys = await redis.keys('*')
    for (const key of keys) {
      backup[key] = await redis.get(key)
    }
  } else {
    if (fs.existsSync(DATA_DIR)) {
      for (const f of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
        const key = f.replace('.json', '')
        try {
          backup[key] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'))
        } catch {
          // skip corrupted file
        }
      }
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="dashboard-backup-${date}.json"`,
    },
  })
}

// POST — import a backup (body is the full backup JSON object)
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 })
  }

  const imported: string[] = []

  try {
    for (const [key, data] of Object.entries(body as Record<string, unknown>)) {
      // Guard against path traversal
      if (!key || key.includes('/') || key.includes('\\') || key.includes('..')) continue
      if (useRedis) {
        await getRedis().set(key, JSON.stringify(data))
      } else {
        ensureDir()
        fs.writeFileSync(path.join(DATA_DIR, `${key}.json`), JSON.stringify(data, null, 2), 'utf-8')
      }
      imported.push(key)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error during import'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, imported })
}

// DELETE — clear all data (preserves settings and recycle bin)
export async function DELETE() {
  const deleted: string[] = []

  if (useRedis) {
    const redis = getRedis()
    const keys = await redis.keys('*')
    const toDelete = keys.filter((k) => !PRESERVE_ON_CLEAR.has(k))
    if (toDelete.length > 0) {
      await redis.del(...toDelete)
      deleted.push(...toDelete)
    }
  } else {
    if (!fs.existsSync(DATA_DIR)) return NextResponse.json({ ok: true, deleted: [] })
    for (const f of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
      const key = f.replace('.json', '')
      if (PRESERVE_ON_CLEAR.has(key)) continue
      fs.unlinkSync(path.join(DATA_DIR, f))
      deleted.push(key)
    }
  }

  return NextResponse.json({ ok: true, deleted })
}
