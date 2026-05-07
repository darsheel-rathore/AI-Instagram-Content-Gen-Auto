import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getRedis, useRedis } from '@/lib/redis'

const DATA_DIR = process.env.VERCEL ? '/tmp/data' : path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'recycle_bin.json')
const REDIS_KEY = 'recycle_bin'

export interface RecycleBinItem {
  id: string
  type: 'idea' | 'competitor'
  label: string
  data: unknown
  deletedAt: string
}

function fsReadItems(): RecycleBinItem[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(FILE)) return []
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch {
    return []
  }
}

function fsWriteItems(items: RecycleBinItem[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(items, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

async function readItems(): Promise<RecycleBinItem[]> {
  if (useRedis) return (await getRedis().get<RecycleBinItem[]>(REDIS_KEY)) ?? []
  return fsReadItems()
}

async function writeItems(items: RecycleBinItem[]): Promise<void> {
  if (useRedis) {
    await getRedis().set(REDIS_KEY, JSON.stringify(items))
  } else {
    fsWriteItems(items)
  }
}

export async function GET(req: NextRequest) {
  try {
    const daysParam = req.nextUrl.searchParams.get('days')
    const items = await readItems()

    if (!daysParam) return NextResponse.json({ items })

    const days = parseInt(daysParam)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const filtered = items.filter((i) => new Date(i.deletedAt).getTime() > cutoff)
    if (filtered.length !== items.length) await writeItems(filtered)

    return NextResponse.json({ items: filtered })
  } catch {
    return NextResponse.json({ items: [] })
  }
}

export async function POST(req: NextRequest) {
  const item: RecycleBinItem = await req.json()
  try {
    const items = await readItems()
    items.unshift(item)
    await writeItems(items)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  try {
    if (body.all) {
      await writeItems([])
      return NextResponse.json({ ok: true })
    }
    if (body.id) {
      const items = await readItems()
      await writeItems(items.filter((i) => i.id !== body.id))
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Provide id or all:true' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
