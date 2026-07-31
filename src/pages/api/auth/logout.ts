import type { APIRoute } from 'astro'
import { clearSessionCache } from '@/backend/auth-helper'
import { json } from '@/backend/http'

export const POST: APIRoute = async (context) => {
  const cookie = context.cookies.get('session')
  if (cookie) await clearSessionCache(context, cookie.value)

  context.cookies.delete('session', { path: '/' })
  return json({ status: 'ok' })
}
