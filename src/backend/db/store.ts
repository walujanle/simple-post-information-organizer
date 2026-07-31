import type { ExportBundle, ImportResult, Preset, PresetMeta } from '@/domain/types'

export type DbDriver = 'sqlite' | 'postgres' | 'mysql' | 'd1'

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  createdAt: string
}

export interface PresetStore {
  readonly driver: DbDriver

  health(): Promise<{ status: 'ok' | 'unavailable'; version: string; dbDriver: DbDriver }>

  countUsers(): Promise<number>
  findUserByUsername(username: string): Promise<UserRecord | undefined>
  findUserById(id: string): Promise<UserRecord | undefined>
  createUser(user: UserRecord): Promise<void>
  updateUserPassword(userId: string, passwordHash: string): Promise<void>

  list(userId: string): Promise<PresetMeta[]>
  get(userId: string, id: string): Promise<Preset | undefined>
  create(userId: string, preset: Preset): Promise<Preset>
  update(userId: string, id: string, preset: Preset): Promise<Preset>
  remove(userId: string, id: string): Promise<void>
  exportAll(userId: string): Promise<ExportBundle>
  importAll(userId: string, presets: Preset[], mode: 'merge' | 'replace'): Promise<ImportResult>
}
