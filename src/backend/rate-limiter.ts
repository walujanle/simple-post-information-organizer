import type { APIContext } from 'astro'
import { resolveCache } from '@/backend/cache/factory'
import { rateLimitKey } from '@/backend/cache/keys'
import type { CacheProvider } from '@/backend/cache/store'
import { apiError, getClientIp } from '@/backend/http'
import { RATE_LIMIT_CLEANUP_INTERVAL_MS, RATE_LIMIT_MAX_ENTRIES } from '@/config/constants'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

const inProcessStore = new Map<string, RateLimitEntry>()
let lastCleanup = Date.now()

function checkInProcess(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  if (now - lastCleanup > RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    for (const [k, e] of inProcessStore) {
      if (now > e.resetAt) inProcessStore.delete(k)
    }
    lastCleanup = now
  }
  if (inProcessStore.size >= RATE_LIMIT_MAX_ENTRIES) inProcessStore.clear()

  const entry = inProcessStore.get(key)
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs
    inProcessStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt }
  }
  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

// Best-effort only. The CacheProvider interface offers no atomic increment, so
// concurrent requests can each read the same counter. This is a speed bump, not
// a hard limit -- see docs/SECURITY.md "Rate limiting".
async function checkShared(
  key: string,
  config: RateLimitConfig,
  cache: CacheProvider,
): Promise<RateLimitResult> {
  const now = Date.now()
  const window = Math.floor(now / config.windowMs)
  const windowKey = rateLimitKey(key, window)
  const resetAt = (window + 1) * config.windowMs
  const ttlSeconds = Math.ceil(config.windowMs / 1000) + 1

  const raw = await cache.get(windowKey)
  const count = raw ? Number.parseInt(raw, 10) : 0

  if (count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt }
  }

  await cache.set(windowKey, String(count + 1), ttlSeconds)
  return { allowed: true, remaining: config.maxRequests - count - 1, resetAt }
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 },
  cache?: CacheProvider,
): Promise<RateLimitResult> {
  if (cache) {
    try {
      return await checkShared(key, config, cache)
    } catch {
      // Shared cache unavailable -- degrade to the in-process limiter.
    }
  }
  return checkInProcess(key, config)
}

export const AUTH_RATE_LIMIT: RateLimitConfig = { maxRequests: 5, windowMs: 60_000 }

export async function guardRateLimit(
  context: APIContext,
  scope: string,
  message: string,
  config: RateLimitConfig = AUTH_RATE_LIMIT,
): Promise<Response | null> {
  const cache = await resolveCache(context)
  const { allowed } = await checkRateLimit(`${scope}:${getClientIp(context)}`, config, cache)
  return allowed ? null : apiError('RATE_LIMITED', message, 429)
}
