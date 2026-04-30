import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'settings.json')

export interface AppSettings {
  instagramUsername: string
  autoSignoutMinutes: number
  recycleBinDays: number
  displayName: string
  myReelsScrapeLimit: number
}

const DEFAULTS: AppSettings = {
  instagramUsername: process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? '',
  autoSignoutMinutes: 0,
  recycleBinDays: 15,
  displayName: 'Content Dashboard',
  myReelsScrapeLimit: 30,
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export async function GET() {
  ensureDir()
  if (!fs.existsSync(FILE)) return NextResponse.json({ data: DEFAULTS })
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
    return NextResponse.json({ data: { ...DEFAULTS, ...raw } })
  } catch {
    return NextResponse.json({ data: DEFAULTS })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  ensureDir()
  const existing = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf-8')) : {}
  const merged = { ...DEFAULTS, ...existing, ...body }
  fs.writeFileSync(FILE, JSON.stringify(merged, null, 2), 'utf-8')
  return NextResponse.json({ ok: true })
}
