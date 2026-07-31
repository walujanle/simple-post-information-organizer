import type { BodyBlock, ExportBundle, Preset, Section } from '@/domain/types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isValidSectionShape(value: unknown): value is Section {
  if (!isRecord(value)) return false
  if (!isString(value.key) || !/^[a-z0-9-]*$/.test(value.key)) return false
  if (!isString(value.value)) return false
  if (typeof value.sort !== 'number') return false
  return true
}

function isValidBodyBlockShape(value: unknown): value is BodyBlock {
  if (!isRecord(value)) return false
  if (!isString(value.label)) return false
  if (!isString(value.contentMd)) return false
  if (typeof value.sort !== 'number') return false
  return true
}

export function isValidPreset(value: unknown): value is Preset {
  if (!isRecord(value)) return false
  if (!isString(value.id) || !value.id) return false
  if (value.name !== undefined && !isString(value.name)) return false
  if (!isString(value.createdAt) || !isString(value.updatedAt)) return false
  if (!Array.isArray(value.sections) || !Array.isArray(value.bodyBlocks)) return false
  if (!value.sections.every(isValidSectionShape)) return false
  if (!value.bodyBlocks.every(isValidBodyBlockShape)) return false
  return true
}

export function isValidExportBundle(value: unknown): value is ExportBundle {
  if (!isRecord(value)) return false
  if (value.pioExportVersion !== 1) return false
  if (!Array.isArray(value.presets)) return false
  return value.presets.every(isValidPreset)
}
