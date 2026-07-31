import type { APIContext, APIRoute } from 'astro'
import { type SessionUser, verifySession } from '@/backend/auth-helper'

const JSON_HEADERS = { 'content-type': 'application/json' } as const

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

export function apiError(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status)
}

export const badRequest = (message: string) => json({ error: { message } }, 400)
export const serverError = (message: string) => json({ error: { message } }, 500)
export const unauthorized = () => apiError('UNAUTHORIZED', 'Sign in to access cloud storage.', 401)

// Cloudflare Workers throws on `clientAddress`; Node returns the string.
export function getClientIp(context: APIContext): string {
  try {
    return context.clientAddress ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export function withAuth(
  handler: (context: APIContext, user: SessionUser) => Promise<Response>,
): APIRoute {
  return async (context) => {
    const user = await verifySession(context)
    if (!user) return unauthorized()
    return handler(context, user)
  }
}
