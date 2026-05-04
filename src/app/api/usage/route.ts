import { NextRequest, NextResponse } from 'next/server'
import { readUsageLogs } from '@/lib/usage-tracker'
import { useRedis, getRedis } from '@/lib/redis'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const BALANCE_FILE = path.join(DATA_DIR, 'usage_balance.json')
const BALANCE_KEY = 'usage_balance'

export interface BalanceEntry {
  balance: number
  currency: 'USD'
  label?: string
}

type Balances = Record<string, BalanceEntry>

// ── Balance helpers ───────────────────────────────────────────────────────────

async function readBalances(): Promise<Balances> {
  try {
    if (useRedis) {
      return (await getRedis().get<Balances>(BALANCE_KEY)) ?? {}
    }
    if (!fs.existsSync(BALANCE_FILE)) return {}
    return JSON.parse(fs.readFileSync(BALANCE_FILE, 'utf-8')) as Balances
  } catch {
    return {}
  }
}

async function writeBalances(balances: Balances) {
  if (useRedis) {
    await getRedis().set(BALANCE_KEY, JSON.stringify(balances))
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(BALANCE_FILE, JSON.stringify(balances, null, 2), 'utf-8')
  }
}

// ── Period filter ─────────────────────────────────────────────────────────────

const PERIOD_MS: Record<string, number> = {
  today: 86_400_000,
  '3d':  3  * 86_400_000,
  '7d':  7  * 86_400_000,
  '15d': 15 * 86_400_000,
  '30d': 30 * 86_400_000,
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period') ?? 'all'
  const allLogs = await readUsageLogs()
  const now = Date.now()

  const filtered =
    period === 'all'
      ? allLogs
      : allLogs.filter(
          (e) => now - new Date(e.timestamp).getTime() <= (PERIOD_MS[period] ?? Infinity),
        )

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCost = 0

  const byFeature: Record<string, { tokens: number; cost: number; calls: number }> = {}
  const byProvider: Record<string, { inputTokens: number; outputTokens: number; cost: number; calls: number }> = {}
  const byDay: Record<string, { cost: number; inputTokens: number; outputTokens: number; calls: number }> = {}

  for (const e of filtered) {
    totalInputTokens += e.inputTokens
    totalOutputTokens += e.outputTokens
    totalCost += e.estimatedCostUSD

    byFeature[e.feature] ??= { tokens: 0, cost: 0, calls: 0 }
    byFeature[e.feature].tokens += e.inputTokens + e.outputTokens
    byFeature[e.feature].cost += e.estimatedCostUSD
    byFeature[e.feature].calls++

    byProvider[e.provider] ??= { inputTokens: 0, outputTokens: 0, cost: 0, calls: 0 }
    byProvider[e.provider].inputTokens += e.inputTokens
    byProvider[e.provider].outputTokens += e.outputTokens
    byProvider[e.provider].cost += e.estimatedCostUSD
    byProvider[e.provider].calls++

    const day = e.timestamp.slice(0, 10)
    byDay[day] ??= { cost: 0, inputTokens: 0, outputTokens: 0, calls: 0 }
    byDay[day].cost += e.estimatedCostUSD
    byDay[day].inputTokens += e.inputTokens
    byDay[day].outputTokens += e.outputTokens
    byDay[day].calls++
  }

  return NextResponse.json({
    totalInputTokens,
    totalOutputTokens,
    totalCost,
    totalCalls: filtered.length,
    byFeature,
    byProvider,
    byDay,
    balances: await readBalances(),
  })
}

export async function POST(req: NextRequest) {
  const { provider, balance, label }: { provider: string; balance: number; label?: string } =
    await req.json()
  const balances = await readBalances()
  balances[provider] = { balance, currency: 'USD', label }
  await writeBalances(balances)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { provider }: { provider: string } = await req.json()
  const balances = await readBalances()
  delete balances[provider]
  await writeBalances(balances)
  return NextResponse.json({ ok: true })
}
