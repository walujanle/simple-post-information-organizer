import { resolvePresetStore } from '@/backend/db/factory'
import { json, serverError, withAuth } from '@/backend/http'
import { logError } from '@/backend/log'

export const GET = withAuth(async (context, user) => {
  try {
    const store = await resolvePresetStore(context)
    return json(await store.exportAll(user.userId))
  } catch (err) {
    logError('Export failed:', err)
    return serverError('Failed to export presets.')
  }
})
