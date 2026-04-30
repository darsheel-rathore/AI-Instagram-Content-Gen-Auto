import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'stories.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readAll(): unknown[] {
  try {
    if (!fs.existsSync(FILE)) return []
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as unknown[]
  } catch { return [] }
}

function writeAll(data: unknown[]) {
  ensureDir()
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export async function GET() {
  return NextResponse.json({ stories: readAll() })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { id?: string; [k: string]: unknown }
  const all = readAll() as Array<{ id: string; [k: string]: unknown }>
  const existing = all.findIndex((m) => m.id === body.id)
  if (existing >= 0) {
    all[existing] = { ...all[existing], ...body }
  } else {
    all.push({ ...body, id: body.id ?? `st_${Date.now()}`, createdAt: new Date().toISOString() })
  }
  writeAll(all)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  const all = (readAll() as Array<{ id: string }>).filter((m) => m.id !== id)
  writeAll(all)
  return NextResponse.json({ ok: true })
}
