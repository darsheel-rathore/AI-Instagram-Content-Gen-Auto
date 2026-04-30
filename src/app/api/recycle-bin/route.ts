import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'recycle_bin.json')

export interface RecycleBinItem {
  id: string
  type: 'idea' | 'competitor'
  label: string
  data: unknown
  deletedAt: string
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readItems(): RecycleBinItem[] {
  ensureDir()
  if (!fs.existsSync(FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeItems(items: RecycleBinItem[]) {
  ensureDir()
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2), 'utf-8')
}

// GET — list all items, optionally filtered by TTL days
export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get('days')
  const items = readItems()

  if (!daysParam) return NextResponse.json({ items })

  const days = parseInt(daysParam)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const filtered = items.filter((i) => new Date(i.deletedAt).getTime() > cutoff)
  // auto-clean expired entries
  if (filtered.length !== items.length) writeItems(filtered)

  return NextResponse.json({ items: filtered })
}

// POST — add an item to the bin
export async function POST(req: NextRequest) {
  const item: RecycleBinItem = await req.json()
  const items = readItems()
  items.unshift(item)
  writeItems(items)
  return NextResponse.json({ ok: true })
}

// DELETE — remove one item (body: { id }) or all (body: { all: true })
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  if (body.all) {
    writeItems([])
    return NextResponse.json({ ok: true })
  }
  if (body.id) {
    writeItems(readItems().filter((i) => i.id !== body.id))
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Provide id or all:true' }, { status: 400 })
}
