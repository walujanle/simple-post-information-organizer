export interface CacheProvider {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
  deleteMany(keys: string[]): Promise<void>
}
