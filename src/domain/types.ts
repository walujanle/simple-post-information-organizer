export type DataSource = 'local' | 'cloud'
export type ThemePreference = 'light' | 'dark' | 'system'
export type ImportMode = 'merge' | 'replace'

export interface Section {
  key: string
  value: string
  sort: number
}

export interface BodyBlock {
  label: string
  contentMd: string
  sort: number
}

export interface Preset {
  id: string
  name: string
  sections: Section[]
  bodyBlocks: BodyBlock[]
  createdAt: string
  updatedAt: string
}

export interface PresetMeta {
  id: string
  name?: string
  updatedAt: string
  sectionKeys?: string[]
}

export interface ExportBundle {
  pioExportVersion: 1
  source: DataSource
  exportedAt: string
  presets: Preset[]
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
}

export interface CloudServerStatus {
  status: 'ok' | 'unavailable'
  version: string
}

export interface AppSettings {
  theme: ThemePreference
  activeSource: DataSource
  lastPresetId?: string
}

export interface RenderIssue {
  type: 'unknown' | 'empty'
  key: string
  pattern?: string
}

export interface RenderContext {
  sections: Section[]
}

export interface RenderResult {
  text: string
  copyText: string
  issues: RenderIssue[]
}
