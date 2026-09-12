import { NextResponse } from 'next/server'
import { useRedis, getRedis } from '@/lib/redis'

// Upstash's free tier auto-deletes a database after 14 days with no commands
// against it. This route exists purely to generate a real Redis command on a
// schedule (see README) so the database never goes inactive. It's exempted
// from Clerk auth in middleware.ts — it has to be hittable by an unauthenticated
// external pinger (cron-job.org, GitHub Actions, etc.), and it does nothing
// sensitive: one small timestamp write.
const REDIS_KEY = 'keepalive'

export async function GET() {
  if (!useRedis) {
    return NextResponse.json({ ok: false, reason: 'Redis not configured' }, { status: 200 })
  }
  const now = new Date().toISOString()
  await getRedis().set(REDIS_KEY, now)
  return NextResponse.json({ ok: true, pingedAt: now })
}
