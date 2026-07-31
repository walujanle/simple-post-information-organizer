import { checkContentLength } from '@/backend/body-limit'
import { resolvePresetStore } from '@/backend/db/factory'
import { apiError, badRequest, json, withAuth } from '@/backend/http'
import { logError } from '@/backend/log'
import { validateExportBundle } from '@/backend/validation'
import { IMPORT_BODY_LIMIT_BYTES } from '@/config/constants'
import type { ImportMode } from '@/domain/types'

export const POST = withAuth(async (context, user) => {
  const modeParam = context.url.searchParams.get('mode')
  const mode: ImportMode = modeParam === 'replace' ? 'replace' : 'merge'

  try {
    const store = await resolvePresetStore(context)

    const bodyCheck = checkContentLength(context.request, IMPORT_BODY_LIMIT_BYTES)
    if (!bodyCheck.ok) return apiError('PAYLOAD_TOO_LARGE', bodyCheck.message, 413)

    const parsed = validateExportBundle(await context.request.json())
    if (!parsed.ok) return apiError('VALIDATION_ERROR', parsed.message, 400)

    return json(await store.importAll(user.userId, parsed.value.presets, mode))
  } catch (err) {
    logError('Import failed:', err)
    return badRequest('Invalid payload or import failed.')
  }
})
