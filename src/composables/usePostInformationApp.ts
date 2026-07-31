import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useClipboard } from '@/composables/useClipboard'
import { useDocumentEditor } from '@/composables/useDocumentEditor'
import { IMPORT_BODY_LIMIT_BYTES as MAX_IMPORT_BYTES } from '@/config/constants'
import type {
  CloudServerStatus,
  DataSource,
  ImportMode,
  PresetMeta,
  ThemePreference,
} from '@/domain/types'
import { isValidExportBundle } from '@/domain/validate'
import { CloudPresetRepository, repositoryHealth } from '@/storage/cloud'
import { LocalPresetRepository } from '@/storage/local'
import type { PresetRepository } from '@/storage/repository'
import { applyTheme, loadSettings, saveSettings } from '@/storage/settings'

export function usePostInformationApp() {
  const { copyText } = useClipboard()
  const settings = reactive(loadSettings())

  const isAuthenticated = ref(false)
  const currentUser = ref<string | undefined>()
  const authModalOpen = ref(false)
  const authModalMode = ref<'login' | 'register' | 'change-password'>('login')
  const authError = ref<string | undefined>()
  const isAuthLoading = ref(false)
  const cloudServerStatus = ref<CloudServerStatus | undefined>()

  const presets = ref<PresetMeta[]>([])
  const activePresetId = ref<string | undefined>(settings.lastPresetId)
  const statusMessage = ref('Ready.')
  const errorMessage = ref('')
  const importFile = ref<HTMLInputElement | null>(null)
  const importMode = ref<ImportMode>('merge')
  const editor = useDocumentEditor()

  const cloudHealthy = computed(
    () => isAuthenticated.value && cloudServerStatus.value?.status === 'ok',
  )
  const activeSource = computed<DataSource>({
    get: () => (settings.activeSource === 'cloud' && isAuthenticated.value ? 'cloud' : 'local'),
    set: (source) => {
      if (source === 'cloud' && !isAuthenticated.value) {
        authModalMode.value = 'login'
        authModalOpen.value = true
      } else {
        settings.activeSource = source
      }
    },
  })

  const repository = computed<PresetRepository>(() => {
    if (activeSource.value === 'cloud') return new CloudPresetRepository()
    return new LocalPresetRepository('local')
  })

  watch(
    settings,
    () => {
      saveSettings(settings)
      applyTheme(settings.theme)
    },
    { deep: true },
  )
  watch(activeSource, async () => {
    await refreshPresets()
  })

  watch(cloudHealthy, (healthy) => {
    if (!healthy && settings.activeSource === 'cloud') {
      statusMessage.value = 'Cloud connection lost. Switched to Local storage.'
    }
  })

  onMounted(async () => {
    applyTheme(settings.theme)
    await checkSession()
    await refreshPresets()
    if (settings.lastPresetId) await loadPreset(settings.lastPresetId)
  })

  async function checkSession(): Promise<void> {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        if (data.isAuthenticated) {
          isAuthenticated.value = true
          currentUser.value = data.user.username
          try {
            const health = await repositoryHealth()
            cloudServerStatus.value = { status: 'ok', version: health.version }
          } catch {
            cloudServerStatus.value = { status: 'unavailable', version: 'unknown' }
          }
        } else {
          isAuthenticated.value = false
          currentUser.value = undefined
          cloudServerStatus.value = undefined
        }
      }
    } catch {
      isAuthenticated.value = false
      currentUser.value = undefined
      cloudServerStatus.value = undefined
    }
  }

  async function login(u: string, p: string): Promise<void> {
    isAuthLoading.value = true
    authError.value = undefined
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'Invalid username or password')
      }
      const data = await response.json()
      isAuthenticated.value = true
      currentUser.value = data.user.username
      try {
        const health = await repositoryHealth()
        cloudServerStatus.value = { status: 'ok', version: health.version }
      } catch {
        cloudServerStatus.value = { status: 'unavailable', version: 'unknown' }
      }
      settings.activeSource = 'cloud'
      authModalOpen.value = false
      await refreshPresets()
      statusMessage.value = `Logged in as ${currentUser.value}. Switched to Cloud storage.`
    } catch (err) {
      authError.value = err instanceof Error ? err.message : 'Login failed'
    } finally {
      isAuthLoading.value = false
    }
  }

  async function register(u: string, p: string): Promise<void> {
    isAuthLoading.value = true
    authError.value = undefined
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'Registration failed')
      }
      await login(u, p)
    } catch (err) {
      authError.value = err instanceof Error ? err.message : 'Registration failed'
    } finally {
      isAuthLoading.value = false
    }
  }

  async function changePassword(current: string, newPass: string): Promise<void> {
    isAuthLoading.value = true
    authError.value = undefined
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'Failed to change password')
      }
      authModalOpen.value = false
      statusMessage.value = 'Password changed successfully.'
    } catch (err) {
      authError.value = err instanceof Error ? err.message : 'Failed to change password'
    } finally {
      isAuthLoading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    isAuthenticated.value = false
    currentUser.value = undefined
    cloudServerStatus.value = undefined
    settings.activeSource = 'local'
    statusMessage.value = 'Logged out. Switched to Local storage.'
  }

  async function refreshPresets(): Promise<void> {
    try {
      errorMessage.value = ''
      presets.value = await repository.value.list()
      statusMessage.value = `${presets.value.length} preset(s) loaded from ${activeSource.value}.`
    } catch (error) {
      handleError(error, 'Unable to load presets')
      if (activeSource.value === 'cloud') activeSource.value = 'local'
    }
  }

  async function loadPreset(id: string): Promise<void> {
    try {
      const preset = await repository.value.get(id)
      editor.replaceDocument(preset)
      activePresetId.value = preset.id
      settings.lastPresetId = preset.id
      statusMessage.value = 'Loaded.'
    } catch (error) {
      handleError(error, 'Unable to load preset')
    }
  }

  async function saveCurrentPreset(): Promise<void> {
    if (editor.allProblems.value.length > 0) {
      errorMessage.value = 'Fix section validation problems before saving.'
      return
    }
    try {
      const rawPreset = JSON.parse(
        JSON.stringify(editor.documentPreset),
      ) as import('@/domain/types').Preset
      const saved = activePresetId.value
        ? await repository.value.update(activePresetId.value, rawPreset)
        : await repository.value.create({
            ...rawPreset,
            id: crypto.randomUUID(),
          })
      editor.replaceDocument(saved)
      activePresetId.value = saved.id
      settings.lastPresetId = saved.id
      await refreshPresets()
      statusMessage.value = 'Saved.'
    } catch (error) {
      handleError(error, 'Unable to save preset')
    }
  }

  async function deletePreset(id: string): Promise<void> {
    try {
      await repository.value.remove(id)
      if (activePresetId.value === id) newDocument()
      await refreshPresets()
      statusMessage.value = 'Deleted.'
    } catch (error) {
      handleError(error, 'Unable to delete preset')
    }
  }

  async function duplicatePreset(): Promise<void> {
    if (activePresetId.value) await loadPreset(activePresetId.value)
    activePresetId.value = undefined
    settings.lastPresetId = undefined
    editor.documentPreset.id = crypto.randomUUID()
    statusMessage.value = 'Duplicated as new draft.'
  }

  function newDocument(): void {
    const now = new Date().toISOString()
    editor.replaceDocument({
      id: crypto.randomUUID(),
      name: '',
      sections: [],
      bodyBlocks: [],
      createdAt: now,
      updatedAt: now,
    })
    activePresetId.value = undefined
    settings.lastPresetId = undefined
    statusMessage.value = 'New blank document.'
  }

  async function exportActiveSource(): Promise<void> {
    try {
      const bundle = await repository.value.exportAll()
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `spio-backup-${activeSource.value}-${Date.now()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      statusMessage.value = `Exported ${bundle.presets.length} preset(s).`
    } catch (error) {
      handleError(error, 'Unable to export data')
    }
  }

  function openImportPicker(): void {
    importFile.value?.click()
  }

  async function importActiveSource(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) {
      errorMessage.value = `Import file too large (max ${(MAX_IMPORT_BYTES / 1024 / 1024).toFixed(0)}MB).`
      return
    }
    try {
      const raw = JSON.parse(await file.text()) as unknown
      if (!isValidExportBundle(raw)) throw new Error('Invalid or unsupported export bundle format.')
      if (importMode.value === 'replace') await exportActiveSource()
      const result = await repository.value.importAll(raw, importMode.value)
      await refreshPresets()
      statusMessage.value = `Import complete: ${result.created} created, ${result.updated} updated.`
    } catch (error) {
      handleError(error, 'Unable to import data')
    } finally {
      input.value = null as unknown as string
    }
  }

  async function pushLocalToCloud(): Promise<void> {
    if (!isAuthenticated.value) return
    await transfer(
      new LocalPresetRepository('local'),
      new CloudPresetRepository(),
      'local',
      'cloud',
    )
  }

  async function pullCloudToLocal(): Promise<void> {
    if (!isAuthenticated.value) return
    await transfer(
      new CloudPresetRepository(),
      new LocalPresetRepository('local'),
      'cloud',
      'local',
    )
  }

  async function transfer(
    from: PresetRepository,
    to: PresetRepository,
    source: DataSource,
    target: DataSource,
  ): Promise<void> {
    try {
      const bundle = await from.exportAll()
      const result = await to.importAll({ ...bundle, source }, importMode.value)
      await refreshPresets()
      statusMessage.value = `Transferred ${source} → ${target}: ${result.created} created, ${result.updated} updated.`
    } catch (error) {
      handleError(error, `Unable to transfer ${source} to ${target}`)
    }
  }

  function updateTheme(theme: ThemePreference): void {
    settings.theme = theme
  }

  function updateSource(source: DataSource): void {
    activeSource.value = source
  }

  const copyBodyRaw = () => copyText(editor.renderedBodySource.value)
  const copyBodyRendered = () => copyText(editor.renderedBodyCopySource.value)

  function downloadBody(): void {
    const blob = new Blob([editor.renderedBodyCopySource.value], {
      type: 'text/markdown',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `body-${Date.now()}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleError(error: unknown, fallback: string): void {
    errorMessage.value = error instanceof Error ? `${fallback}: ${error.message}` : fallback
  }

  function clearError(): void {
    errorMessage.value = ''
  }

  return {
    documentPreset: editor.documentPreset,
    sortedSections: editor.sortedSections,
    bodyText: editor.bodyText,
    tokenList: editor.tokenList,
    renderedBodyHtml: editor.renderedBodyHtml,
    renderedBodySource: editor.renderedBodySource,
    renderedBodyCopySource: editor.renderedBodyCopySource,
    sectionProblems: editor.sectionProblems,
    allProblems: editor.allProblems,
    getRowKey: editor.getRowKey,
    addSection: editor.addSection,
    removeSection: editor.removeSection,
    updateSectionKey: editor.updateSectionKey,
    updateSectionValue: editor.updateSectionValue,
    moveSectionUp: editor.moveSectionUp,
    moveSectionDown: editor.moveSectionDown,
    presets,
    activePresetId,
    loadPreset,
    saveCurrentPreset,
    deletePreset,
    duplicatePreset,
    newDocument,
    refreshPresets,
    activeSource,
    cloudHealthy,
    isAuthenticated,
    currentUser,
    authModalOpen,
    authModalMode,
    authError,
    isAuthLoading,
    cloudServerStatus,
    login,
    register,
    changePassword,
    logout,
    updateSource,
    exportActiveSource,
    importActiveSource,
    openImportPicker,
    pushLocalToCloud,
    pullCloudToLocal,
    settings,
    importFile,
    importMode,
    statusMessage,
    errorMessage,
    copyText,
    copyBodyRaw,
    copyBodyRendered,
    downloadBody,
    updateTheme,
    clearError,
  }
}
