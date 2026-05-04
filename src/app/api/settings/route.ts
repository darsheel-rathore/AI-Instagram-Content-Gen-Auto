import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getRedis, useRedis } from '@/lib/redis'

const DATA_DIR = path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'settings.json')
const REDIS_KEY = 'settings'

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

function fsRead(): AppSettings {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(FILE)) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf-8')) }
  } catch {
    return DEFAULTS
  }
}

function fsWrite(data: AppSettings) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch { /* ignore */ }
}

export async function GET() {
  try {
    if (useRedis) {
      const stored = await getRedis().get<AppSettings>(REDIS_KEY)
      return NextResponse.json({ data: { ...DEFAULTS, ...(stored ?? {}) } })
    }
    return NextResponse.json({ data: fsRead() })
  } catch {
    return NextResponse.json({ data: DEFAULTS })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  try {
    if (useRedis) {
      const existing = await getRedis().get<AppSettings>(REDIS_KEY) ?? {}
      const merged = { ...DEFAULTS, ...existing, ...body }
      await getRedis().set(REDIS_KEY, JSON.stringify(merged))
      return NextResponse.json({ ok: true })
    }
    const existing = fsRead()
    fsWrite({ ...existing, ...body })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
