import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Regression cover for the bug where a broken Redis connection was reported to
// the dashboard as "no data" — indistinguishable from a key that had simply
// never been written. A read failure must surface as an error, not as null.

const req = (key?: string) =>
  new NextRequest(`http://localhost:3000/api/cache${key ? `?key=${key}` : ''}`)

describe('GET /api/cache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.doUnmock('@/lib/redis')
    vi.restoreAllMocks()
  })

  it('returns the stored value when Redis reads succeed', async () => {
    vi.doMock('@/lib/redis', () => ({
      useRedis: true,
      getRedis: () => ({ get: vi.fn().mockResolvedValue({ reels: [1, 2, 3] }) }),
    }))

    const { GET } = await import('./route')
    const res = await GET(req('my_reels'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { reels: [1, 2, 3] } })
  })

  it('returns data:null for a key that has never been written', async () => {
    vi.doMock('@/lib/redis', () => ({
      useRedis: true,
      getRedis: () => ({ get: vi.fn().mockResolvedValue(null) }),
    }))

    const { GET } = await import('./route')
    const res = await GET(req('never_written'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: null })
  })

  it('surfaces a Redis failure as a 500 instead of masking it as empty data', async () => {
    vi.doMock('@/lib/redis', () => ({
      useRedis: true,
      getRedis: () => ({ get: vi.fn().mockRejectedValue(new Error('WRONGPASS invalid token')) }),
    }))

    const { GET } = await import('./route')
    const res = await GET(req('my_reels'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toContain('WRONGPASS')
    expect(body).not.toHaveProperty('data')
  })

  it('rejects a request with no key', async () => {
    vi.doMock('@/lib/redis', () => ({ useRedis: true, getRedis: () => ({ get: vi.fn() }) }))

    const { GET } = await import('./route')
    const res = await GET(req())

    expect(res.status).toBe(400)
  })
})
