import type { BodyBlock, ExportBundle, Preset, Section } from '@/domain/types'
import { isRecord } from '@/domain/validate'

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function toSafeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : 0
}

export function validateSection(
  value: unknown,
): { ok: true; value: Section } | { ok: false; message: string } {
  if (!isRecord(value)) return { ok: false, message: 'Section must be an object.' }
  if (!isNonEmptyString(value.key) || !/^[a-z0-9-]+$/.test(value.key)) {
    return { ok: false, message: 'Section key must use lowercase letters, numbers, and dashes.' }
  }
  return {
    ok: true,
    value: {
      key: value.key,
      value: typeof value.value === 'string' ? value.value : '',
      sort: toSafeInteger(value.sort),
    },
  }
}

export function validateBodyBlock(
  value: unknown,
): { ok: true; value: BodyBlock } | { ok: false; message: string } {
  if (!isRecord(value)) return { ok: false, message: 'Body block must be an object.' }
  return {
    ok: true,
    value: {
      label: typeof value.label === 'string' ? value.label : '',
      contentMd: typeof value.contentMd === 'string' ? value.contentMd : '',
      sort: toSafeInteger(value.sort),
    },
  }
}

export function validatePreset(
  value: unknown,
): { ok: true; value: Preset } | { ok: false; message: string } {
  if (!isRecord(value)) return { ok: false, message: 'Preset must be an object.' }
  if (!Array.isArray(value.sections)) return { ok: false, message: 'sections must be an array.' }
  if (!Array.isArray(value.bodyBlocks))
    return { ok: false, message: 'bodyBlocks must be an array.' }

  const validatedSections: Section[] = []
  const keys = new Set<string>()
  for (const item of value.sections) {
    const parsed = validateSection(item)
    if (!parsed.ok) return parsed
    if (keys.has(parsed.value.key)) {
      return { ok: false, message: `Duplicate section key "${parsed.value.key}".` }
    }
    keys.add(parsed.value.key)
    validatedSections.push(parsed.value)
  }

  const validatedBodyBlocks: BodyBlock[] = []
  for (const item of value.bodyBlocks) {
    const parsed = validateBodyBlock(item)
    if (!parsed.ok) return parsed
    validatedBodyBlocks.push(parsed.value)
  }

  const now = new Date().toISOString()
  return {
    ok: true,
    value: {
      id: typeof value.id === 'string' && value.id ? value.id : crypto.randomUUID(),
      name: typeof value.name === 'string' ? value.name : '',
      sections: validatedSections,
      bodyBlocks: validatedBodyBlocks,
      createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    },
  }
}

export function validateExportBundle(
  value: unknown,
): { ok: true; value: ExportBundle } | { ok: false; message: string } {
  if (!isRecord(value)) return { ok: false, message: 'Request body must be an object.' }
  if (value.pioExportVersion !== 1) return { ok: false, message: 'Unsupported export version.' }
  if (!Array.isArray(value.presets)) return { ok: false, message: 'presets must be an array.' }

  const presets: Preset[] = []
  for (const item of value.presets) {
    const parsed = validatePreset(item)
    if (!parsed.ok) return parsed
    presets.push(parsed.value)
  }

  return {
    ok: true,
    value: {
      pioExportVersion: 1,
      source: value.source === 'local' ? 'local' : 'cloud',
      exportedAt:
        typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
      presets,
    },
  }
}
