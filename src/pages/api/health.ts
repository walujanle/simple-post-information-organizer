import type { APIRoute } from 'astro'
import { resolvePresetStore } from '@/backend/db/factory'
import { json } from '@/backend/http'
import { logError } from '@/backend/log'

export const GET: APIRoute = async (context) => {
  try {
    const store = await resolvePresetStore(context)
    const health = await store.health()
    // dbDriver is deliberately withheld -- see docs/SECURITY.md "Information disclosure".
    return json({ status: health.status, version: health.version })
  } catch (err) {
    logError('Health check failed:', err)
    return json({ status: 'error', message: 'Failed to connect to database.' }, 500)
  }
}
