import { checkContentLength } from '@/backend/body-limit'
import { resolvePresetStore } from '@/backend/db/factory'
import { apiError, badRequest, json, noContent, serverError, withAuth } from '@/backend/http'
import { logError } from '@/backend/log'
import { validatePreset } from '@/backend/validation'
import { PRESET_BODY_LIMIT_BYTES } from '@/config/constants'
import type { Preset } from '@/domain/types'

export const GET = withAuth(async (context, user) => {
  const { id } = context.params
  if (!id) return badRequest('ID parameter is required.')

  try {
    const store = await resolvePresetStore(context)
    const preset = await store.get(user.userId, id)
    if (!preset) return apiError('RESOURCE_NOT_FOUND', 'Preset not found.', 404)
    return json(preset)
  } catch (err) {
    logError('Get preset failed:', err)
    return serverError('Failed to retrieve preset.')
  }
})

export const PUT = withAuth(async (context, user) => {
  const { id } = context.params
  if (!id) return badRequest('ID parameter is required.')

  try {
    const store = await resolvePresetStore(context)

    const bodyCheck = checkContentLength(context.request, PRESET_BODY_LIMIT_BYTES)
    if (!bodyCheck.ok) return apiError('PAYLOAD_TOO_LARGE', bodyCheck.message, 413)

    const parsed = validatePreset(await context.request.json())
    if (!parsed.ok) return apiError('VALIDATION_ERROR', parsed.message, 400)

    const now = new Date().toISOString()
    const preset: Preset = {
      ...parsed.value,
      createdAt: parsed.value.createdAt || now,
      updatedAt: now,
    }

    return json(await store.update(user.userId, id, preset))
  } catch (err) {
    logError('Update preset failed:', err)
    return badRequest('Invalid payload or failed to update preset.')
  }
})

export const DELETE = withAuth(async (context, user) => {
  const { id } = context.params
  if (!id) return badRequest('ID parameter is required.')

  try {
    const store = await resolvePresetStore(context)
    await store.remove(user.userId, id)
    return noContent()
  } catch (err) {
    logError('Delete preset failed:', err)
    return serverError('Failed to delete preset.')
  }
})
