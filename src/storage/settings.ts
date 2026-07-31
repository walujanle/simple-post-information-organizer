import type { AppSettings, ThemePreference } from '@/domain/types'

const SETTINGS_KEY = 'spio:settings'

const defaultSettings: AppSettings = {
  theme: 'system',
  activeSource: 'local',
}

export function loadSettings(): AppSettings {
  return readJson(SETTINGS_KEY, defaultSettings)
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function applyTheme(theme: ThemePreference): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
    return fallback
  } catch {
    return fallback
  }
}
