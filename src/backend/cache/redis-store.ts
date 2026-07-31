import Redis from 'ioredis'
import type { CacheProvider } from '@/backend/cache/store'
import { logError } from '@/backend/log'
import { CACHE_TTL_SECONDS } from '@/config/constants'

export class RedisCacheProvider implements CacheProvider {
  private readonly client: Redis

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      showFriendlyErrorStack: false,
      retryStrategy(times) {
        return Math.min(times * 100, 2000)
      },
    })
    this.client.on('error', (err) => {
      logError('Redis Client Error:', err)
    })
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key)
    } catch (err) {
      logError(`Redis get failed for ${key}:`, err)
      return null
    }
  }

  async set(key: string, value: string, ttlSeconds = CACHE_TTL_SECONDS): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttlSeconds)
    } catch (err) {
      logError(`Redis set failed for ${key}:`, err)
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (err) {
      logError(`Redis delete failed for ${key}:`, err)
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    try {
      await this.client.del(...keys)
    } catch (err) {
      logError('Redis deleteMany failed:', err)
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit()
    } catch {
      this.client.disconnect()
    }
  }
}
