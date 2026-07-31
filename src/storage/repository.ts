import type { ExportBundle, ImportMode, ImportResult, Preset, PresetMeta } from '@/domain/types'

export interface PresetRepository {
  list(): Promise<PresetMeta[]>
  get(id: string): Promise<Preset>
  create(preset: Preset): Promise<Preset>
  update(id: string, preset: Preset): Promise<Preset>
  remove(id: string): Promise<void>
  exportAll(): Promise<ExportBundle>
  importAll(bundle: ExportBundle, mode: ImportMode): Promise<ImportResult>
}
