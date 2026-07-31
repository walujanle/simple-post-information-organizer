import { CLOUD_REQUEST_TIMEOUT_MS as REQUEST_TIMEOUT_MS } from '@/config/constants'
import type { ExportBundle, ImportMode, ImportResult, Preset, PresetMeta } from '@/domain/types'
import type { PresetRepository } from '@/storage/repository'

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

export class CloudPresetRepository implements PresetRepository {
  async list(): Promise<PresetMeta[]> {
    return this.request<PresetMeta[]>('/api/presets')
  }

  async get(id: string): Promise<Preset> {
    return this.request<Preset>(`/api/presets/${encodeURIComponent(id)}`)
  }

  async create(preset: Preset): Promise<Preset> {
    return this.request<Preset>('/api/presets', {
      method: 'POST',
      body: JSON.stringify(preset),
    })
  }

  async update(id: string, preset: Preset): Promise<Preset> {
    return this.request<Preset>(`/api/presets/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(preset),
    })
  }

  async remove(id: string): Promise<void> {
    await this.request<void>(`/api/presets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  async exportAll(): Promise<ExportBundle> {
    return this.request<ExportBundle>('/api/export')
  }

  async importAll(bundle: ExportBundle, mode: ImportMode): Promise<ImportResult> {
    return this.request<ImportResult>(`/api/import?mode=${mode}`, {
      method: 'POST',
      body: JSON.stringify(bundle),
    })
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
    const response = await fetch(path, {
      signal,
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init.headers,
      },
    })

    if (!response.ok) {
      let body: ApiErrorBody | undefined
      try {
        body = (await response.json()) as ApiErrorBody
      } catch {
        body = undefined
      }
      throw new Error(body?.error?.message ?? `Request failed with status ${response.status}`)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }
}

export async function repositoryHealth(): Promise<{ status: string; version: string }> {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const response = await fetch('/api/health', { signal })
  if (!response.ok) throw new Error(`Health check failed with status ${response.status}`)
  return (await response.json()) as { status: string; version: string }
}
