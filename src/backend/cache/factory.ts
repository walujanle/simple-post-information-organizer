import { MemoryCacheProvider } from '@/backend/cache/memory-store'
import type { CacheProvider } from '@/backend/cache/store'
import { getEnvValue } from '@/backend/runtime'
import { initOnce } from '@/backend/singleton'

export function resolveCache(context: unknown): Promise<CacheProvider> {
  return initOnce('cache', async () => {
    const redisUrl = await getEnvValue(context, 'REDIS_URL')
    if (redisUrl) {
      const { RedisCacheProvider } = await import('./redis-store')
      return new RedisCacheProvider(redisUrl)
    }

    return new MemoryCacheProvider()
  })
}
