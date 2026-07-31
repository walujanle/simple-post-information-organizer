import type {
  DataSource,
  ExportBundle,
  ImportMode,
  ImportResult,
  Preset,
  PresetMeta,
} from '@/domain/types'
import { isValidPreset } from '@/domain/validate'
import type { PresetRepository } from '@/storage/repository'
import { decryptFromStorage, encryptForStorage } from '@/storage/secure'

const LOCAL_PRESETS_KEY = 'spio:local:presets'

let cachedRaw: string | null = null
let cachedPresets: Preset[] | null = null

interface EncryptedPayload {
  v: 2
  data: { ciphertext: string; iv: string }
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return typeof value === 'object' && value !== null && (value as Record<string, unknown>).v === 2
}

export class LocalPresetRepository implements PresetRepository {
  constructor(private readonly source: DataSource = 'local') {}

  async list(): Promise<PresetMeta[]> {
    const all = await this.readAll()
    return all
      .map((p) => ({
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        sectionKeys: p.sections.map((s) => s.key).filter(Boolean),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<Preset> {
    const all = await this.readAll()
    const preset = all.find((item) => item.id === id)
    if (!preset) throw new Error('Preset not found')
    return structuredClone(preset)
  }

  async create(preset: Preset): Promise<Preset> {
    const presets = await this.readAll()
    const now = new Date().toISOString()
    const next = { ...structuredClone(preset), createdAt: preset.createdAt || now, updatedAt: now }
    presets.push(next)
    await this.writeAll(presets)
    return next
  }

  async update(id: string, preset: Preset): Promise<Preset> {
    const presets = await this.readAll()
    const index = presets.findIndex((item) => item.id === id)
    const now = new Date().toISOString()
    const next = { ...structuredClone(preset), id, updatedAt: now }

    if (index >= 0) {
      next.createdAt = presets[index]?.createdAt ?? preset.createdAt ?? now
      presets[index] = next
    } else {
      next.createdAt = preset.createdAt || now
      presets.push(next)
    }

    await this.writeAll(presets)
    return next
  }

  async remove(id: string): Promise<void> {
    const presets = await this.readAll()
    await this.writeAll(presets.filter((preset) => preset.id !== id))
  }

  async exportAll(): Promise<ExportBundle> {
    return {
      pioExportVersion: 1,
      source: this.source,
      exportedAt: new Date().toISOString(),
      presets: await this.readAll(),
    }
  }

  async importAll(bundle: ExportBundle, mode: ImportMode): Promise<ImportResult> {
    const current = mode === 'replace' ? [] : await this.readAll()
    const byId = new Map(current.map((preset) => [preset.id, preset]))
    let created = 0
    let updated = 0

    for (const preset of bundle.presets) {
      if (byId.has(preset.id)) updated += 1
      else created += 1
      byId.set(preset.id, structuredClone(preset))
    }

    await this.writeAll([...byId.values()])
    return { created, updated, skipped: 0 }
  }

  private async readAll(): Promise<Preset[]> {
    try {
      const raw = localStorage.getItem(LOCAL_PRESETS_KEY)
      if (!raw) {
        cachedRaw = null
        cachedPresets = []
        return []
      }
      if (raw === cachedRaw && cachedPresets) {
        return cachedPresets
      }

      const parsed = JSON.parse(raw) as unknown
      let presets: Preset[] = []

      if (Array.isArray(parsed)) {
        presets = parsed.filter(isValidPreset)
      } else if (isEncryptedPayload(parsed)) {
        const decrypted = await decryptFromStorage(parsed.data)
        if (decrypted) {
          const decryptedParsed = JSON.parse(decrypted) as unknown
          if (Array.isArray(decryptedParsed)) {
            presets = decryptedParsed.filter(isValidPreset)
          }
        }
      }

      cachedRaw = raw
      cachedPresets = presets
      return presets
    } catch {
      return []
    }
  }

  private async writeAll(presets: Preset[]): Promise<void> {
    const plaintext = JSON.stringify(presets)
    const encrypted = await encryptForStorage(plaintext)
    const payload: EncryptedPayload = { v: 2, data: encrypted }
    const raw = JSON.stringify(payload)
    localStorage.setItem(LOCAL_PRESETS_KEY, raw)
    cachedRaw = raw
    cachedPresets = presets
  }
}
