import { NextRequest, NextResponse } from 'next/server'
import { getRunStatus } from '@/lib/apify'
import { logUsage } from '@/lib/usage-tracker'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const LOGGED_RUNS_FILE = path.join(DATA_DIR, 'usage_apify_runs.json')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function isAlreadyLogged(runId: string): boolean {
  try {
    if (!fs.existsSync(LOGGED_RUNS_FILE)) return false
    const logged: string[] = JSON.parse(fs.readFileSync(LOGGED_RUNS_FILE, 'utf-8'))
    return logged.includes(runId)
  } catch { return false }
}

function markLogged(runId: string): void {
  try {
    ensureDir()
    const logged: string[] = fs.existsSync(LOGGED_RUNS_FILE)
      ? JSON.parse(fs.readFileSync(LOGGED_RUNS_FILE, 'utf-8'))
      : []
    logged.push(runId)
    // Keep last 1000 run IDs to prevent unbounded growth
    fs.writeFileSync(LOGGED_RUNS_FILE, JSON.stringify(logged.slice(-1000), null, 2), 'utf-8')
  } catch { /* ignore */ }
}

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('runId')
  if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 })
  try {
    const { status, costUsd } = await getRunStatus(runId)

    if (status === 'SUCCEEDED' && !isAlreadyLogged(runId)) {
      await logUsage({
        timestamp: new Date().toISOString(),
        provider: 'apify',
        model: 'apify-scraper',
        feature: 'scraping',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUSD: costUsd ?? 0,
      })
      markLogged(runId)
    }

    return NextResponse.json({ status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
