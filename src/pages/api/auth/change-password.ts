import type { APIRoute } from 'astro'
import bcrypt from 'bcryptjs'
import { clearSessionCache, getJwtSecret, verifySession } from '@/backend/auth-helper'
import { resolvePresetStore } from '@/backend/db/factory'
import { badRequest, json, serverError, unauthorized } from '@/backend/http'
import { signJwt } from '@/backend/jwt'
import { logError } from '@/backend/log'
import { guardRateLimit } from '@/backend/rate-limiter'
import { BCRYPT_COST, MIN_PASSWORD_LENGTH, SESSION_TTL_SECONDS } from '@/config/constants'

export const POST: APIRoute = async (context) => {
  const limited = await guardRateLimit(
    context,
    'auth:change-password',
    'Too many attempts. Try again later.',
  )
  if (limited) return limited

  const loggedInUser = await verifySession(context)
  if (!loggedInUser) return unauthorized()

  try {
    const store = await resolvePresetStore(context)
    const { currentPassword, newPassword } = await context.request.json()

    if (!currentPassword || !newPassword) return badRequest('All fields are required.')
    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return badRequest(`New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
    }

    const user = await store.findUserById(loggedInUser.userId)
    if (!user || !(await bcrypt.compare(String(currentPassword), user.passwordHash))) {
      return badRequest('Incorrect current password.')
    }

    await store.updateUserPassword(user.id, await bcrypt.hash(String(newPassword), BCRYPT_COST))

    // Rotate this session so the caller's cookie is not left holding a token
    // minted under the old password. Other devices keep their tokens until they
    // expire -- see docs/SECURITY.md "Session revocation".
    const oldCookie = context.cookies.get('session')
    if (oldCookie) await clearSessionCache(context, oldCookie.value)

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

    return json({ status: 'ok', message: 'Password changed successfully.' })
  } catch (err) {
    logError('Change password failed:', err)
    return serverError('Failed to update password.')
  }
}
