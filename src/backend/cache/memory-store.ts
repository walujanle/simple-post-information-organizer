import type { CacheProvider } from '@/backend/cache/store'
import { CACHE_TTL_SECONDS, MEMORY_CACHE_MAX_ENTRIES } from '@/config/constants'

export class MemoryCacheProvider implements CacheProvider {
  private store = new Map<string, { value: string; expiresAt: number }>()

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, ttlSeconds = CACHE_TTL_SECONDS): Promise<void> {
    // Evict oldest entries when at capacity
    if (!this.store.has(key) && this.store.size >= MEMORY_CACHE_MAX_ENTRIES) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
    const expiresAt = Date.now() + ttlSeconds * 1000
    this.store.set(key, { value, expiresAt })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) this.store.delete(key)
  }
}
