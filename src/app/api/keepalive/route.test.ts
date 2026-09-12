import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// @/lib/redis is mocked per-test (not at module scope) because route.ts reads
// `useRedis` at import time — vi.doMock + a fresh dynamic import() per test is
// what lets each test control that value. Same pattern will work for the other
// Redis-backed routes (cache, settings, recycle-bin, usage) as tests are added
// for those.

describe('GET /api/keepalive', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.doUnmock('@/lib/redis')
  })

  it('writes a fresh timestamp to Redis and reports ok when Redis is configured', async () => {
    const setMock = vi.fn().mockResolvedValue('OK')
    vi.doMock('@/lib/redis', () => ({
      useRedis: true,
      getRedis: () => ({ set: setMock }),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(setMock).toHaveBeenCalledTimes(1)
    const [key, value] = setMock.mock.calls[0]
    expect(key).toBe('keepalive')
    expect(new Date(value).toISOString()).toBe(value) // real ISO timestamp
    expect(body).toEqual({ ok: true, pingedAt: value })
  })

  it('skips Redis and reports the reason when Redis is not configured', async () => {
    const setMock = vi.fn()
    vi.doMock('@/lib/redis', () => ({
      useRedis: false,
      getRedis: () => ({ set: setMock }),
    }))

    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(setMock).not.toHaveBeenCalled()
    expect(body).toEqual({ ok: false, reason: 'Redis not configured' })
  })
})
