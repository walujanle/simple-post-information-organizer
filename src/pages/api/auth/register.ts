import type { APIRoute } from 'astro'
import bcrypt from 'bcryptjs'
import { resolvePresetStore } from '@/backend/db/factory'
import { badRequest, json, serverError } from '@/backend/http'
import { logError } from '@/backend/log'
import { guardRateLimit } from '@/backend/rate-limiter'
import {
  BCRYPT_COST,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
} from '@/config/constants'

export const POST: APIRoute = async (context) => {
  const limited = await guardRateLimit(
    context,
    'auth:register',
    'Too many registration attempts. Try again later.',
  )
  if (limited) return limited

  try {
    const store = await resolvePresetStore(context)
    const { username, password } = await context.request.json()

    if (!username || typeof username !== 'string' || username.trim().length < MIN_USERNAME_LENGTH) {
      return badRequest(`Username must be at least ${MIN_USERNAME_LENGTH} characters long.`)
    }
    if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
    }

    const trimmedUsername = username.trim()
    if (trimmedUsername.length > MAX_USERNAME_LENGTH) {
      return badRequest(`Username must be at most ${MAX_USERNAME_LENGTH} characters long.`)
    }

    // Hash before the duplicate check so both outcomes cost the same (CWE-203).
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

    if (await store.findUserByUsername(trimmedUsername)) {
      return badRequest('Registration failed. Please try different credentials.')
    }

    await store.createUser({
      id: crypto.randomUUID(),
      username: trimmedUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
    })

    return json({ status: 'ok', message: 'Account created successfully.' })
  } catch (err) {
    logError('Register failed:', err)
    return serverError('Failed to create account.')
  }
}
