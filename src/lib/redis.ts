import { Redis } from '@upstash/redis'

export const useRedis = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
)

let _client: Redis | null = null

export function getRedis(): Redis {
  if (!_client) {
    _client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _client
}
