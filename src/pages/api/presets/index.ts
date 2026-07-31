import { checkContentLength } from '@/backend/body-limit'
import { resolvePresetStore } from '@/backend/db/factory'
import { apiError, badRequest, json, serverError, withAuth } from '@/backend/http'
import { logError } from '@/backend/log'
import { validatePreset } from '@/backend/validation'
import { PRESET_BODY_LIMIT_BYTES } from '@/config/constants'
import type { Preset } from '@/domain/types'

export const GET = withAuth(async (context, user) => {
  try {
    const store = await resolvePresetStore(context)
    return json(await store.list(user.userId))
  } catch (err) {
    logError('List presets failed:', err)
    return serverError('Failed to list presets.')
  }
})

export const POST = withAuth(async (context, user) => {
  try {
    const store = await resolvePresetStore(context)

    const bodyCheck = checkContentLength(context.request, PRESET_BODY_LIMIT_BYTES)
    if (!bodyCheck.ok) return apiError('PAYLOAD_TOO_LARGE', bodyCheck.message, 413)

    const parsed = validatePreset(await context.request.json())
    if (!parsed.ok) return apiError('VALIDATION_ERROR', parsed.message, 400)

    const now = new Date().toISOString()
    const preset: Preset = {
      ...parsed.value,
      id: parsed.value.id || crypto.randomUUID(),
      createdAt: parsed.value.createdAt || now,
      updatedAt: now,
    }

    return json(await store.create(user.userId, preset), 201)
  } catch (err) {
    logError('Create preset failed:', err)
    return badRequest('Invalid payload or failed to create preset.')
  }
})
