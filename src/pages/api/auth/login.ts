import type { APIRoute } from 'astro'
import bcrypt from 'bcryptjs'
import { getJwtSecret } from '@/backend/auth-helper'
import { resolvePresetStore } from '@/backend/db/factory'
import { badRequest, json, serverError } from '@/backend/http'
import { signJwt } from '@/backend/jwt'
import { logError } from '@/backend/log'
import { guardRateLimit } from '@/backend/rate-limiter'
import { DUMMY_PASSWORD_HASH, SESSION_TTL_SECONDS } from '@/config/constants'

export const POST: APIRoute = async (context) => {
  const limited = await guardRateLimit(
    context,
    'auth:login',
    'Too many login attempts. Try again later.',
  )
  if (limited) return limited

  try {
    const store = await resolvePresetStore(context)
    const { username, password } = await context.request.json()

    if (!username || !password) return badRequest('Username and password are required.')

    const user = await store.findUserByUsername(String(username).trim())

    // Always run a bcrypt compare so an unknown username costs the same as a
    // known one (CWE-203). Do not collapse this into a short-circuit.
    const passwordMatches = await bcrypt.compare(
      String(password),
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    )

    if (!user || !passwordMatches) {
      return json({ error: { message: 'Invalid username or password.' } }, 401)
    }

    const secret = await getJwtSecret(context)
    const token = await signJwt(
      {
        userId: user.id,
        username: user.username,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      },
      secret,
    )

    const isSecure =
      process.env.NODE_ENV === 'production' || !context.url.hostname.includes('localhost')

    context.cookies.set('session', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    })

    return json({ status: 'ok', user: { username: user.username } })
  } catch (err) {
    logError('Login failed:', err)
    return serverError('An error occurred during login.')
  }
}
