import type { APIRoute } from 'astro'
import { verifySession } from '@/backend/auth-helper'
import { json } from '@/backend/http'

export const GET: APIRoute = async (context) => {
  const user = await verifySession(context)
  return user
    ? json({ isAuthenticated: true, user: { username: user.username } })
    : json({ isAuthenticated: false })
}
