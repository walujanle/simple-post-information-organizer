import type { APIContext } from 'astro'
import { resolveCache } from '@/backend/cache/factory'
import { sessionKey } from '@/backend/cache/keys'
import { verifyJwt } from '@/backend/jwt'
import { logError, logWarn } from '@/backend/log'
import { getEnvValue } from '@/backend/runtime'
import { MIN_SESSION_SECRET_LENGTH, SESSION_TTL_SECONDS } from '@/config/constants'

export interface SessionUser {
  userId: string
  username: string
}

export async function getJwtSecret(context: APIContext): Promise<string> {
  const secret = await getEnvValue(context, 'SESSION_SECRET')
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters. See docs/DEPLOYMENT.md.`,
    )
  }
  return secret
}

export async function verifySession(context: APIContext): Promise<SessionUser | undefined> {
  const cookie = context.cookies.get('session')
  if (!cookie) return undefined

  try {
    const cache = await resolveCache(context)
    const cacheKey = sessionKey(cookie.value)
    try {
      const cached = await cache.get(cacheKey)
      if (cached) return JSON.parse(cached) as SessionUser
    } catch (err) {
      logWarn('Session cache read failed, falling back to JWT verification:', err)
    }

    const secret = await getJwtSecret(context)
    const payload = await verifyJwt(cookie.value, secret)
    if (payload && typeof payload.userId === 'string' && typeof payload.username === 'string') {
      const userInfo: SessionUser = { userId: payload.userId, username: payload.username }

      let ttl = SESSION_TTL_SECONDS
      if (typeof payload.exp === 'number') {
        const remaining = payload.exp - Math.floor(Date.now() / 1000)
        if (remaining > 0) ttl = remaining
      }

      try {
        await cache.set(cacheKey, JSON.stringify(userInfo), ttl)
      } catch (err) {
        logWarn('Session cache write failed:', err)
      }

      return userInfo
    }
  } catch (err) {
    logError('Session verification failed:', err)
  }

  return undefined
}

export async function clearSessionCache(context: APIContext, token: string): Promise<void> {
  try {
    const cache = await resolveCache(context)
    await cache.delete(sessionKey(token))
  } catch (err) {
    logWarn('Failed to clear session cache:', err)
  }
}
