import fs from 'node:fs'
import Redis from 'ioredis'

// Read REDIS_URL from .env
const envText = fs.readFileSync('.env', 'utf-8')
const redisUrlMatch = envText.match(/REDIS_URL=(.+)/)
const redisUrl = redisUrlMatch
  ? redisUrlMatch[1].trim().replace(/['"]/g, '')
  : 'redis://127.0.0.1:6379'

console.log('[test-cache] Connecting to Redis at:', redisUrl)
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 })

redis.on('error', (err) => {
  console.error('[test-cache] Redis connection error:', err.message)
  process.exit(1)
})

const BASE = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '')
let cookie = ''

async function req(path, opts = {}) {
  const headers = { 'content-type': 'application/json', ...(opts.headers || {}) }
  if (cookie) headers.cookie = cookie
  const res = await fetch(BASE + path, { ...opts, headers })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  let body = null
  const text = await res.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: res.status, body }
}

async function runTests() {
  const stamp = Date.now().toString(36)
  const username = `cache_user_${stamp}`
  const password = 'passw0rd!'

  // Flush Redis first to start clean
  console.log('[test-cache] Flushing Redis keys...')
  await redis.flushdb()

  // 1. Register and Login
  console.log('[test-cache] Registering user...')
  await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

  console.log('[test-cache] Logging in...')
  await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

  if (!cookie) {
    throw new Error('Login failed, no cookie received')
  }

  const sessionToken = cookie.split('=')[1]
  console.log('[test-cache] Session token:', sessionToken)

  // 2. Verify Session Caching (Read-Through)
  console.log('[test-cache] Checking session status (should trigger cache write)...')
  await req('/api/auth/session')

  // The session key should now exist in Redis!
  const sessionCacheKey = `pio:sess:${sessionToken}`
  const cachedSession = await redis.get(sessionCacheKey)
  console.log('[test-cache] Redis key', sessionCacheKey, 'exists?', !!cachedSession)
  if (!cachedSession) {
    throw new Error('Session was not cached in Redis!')
  }
  const sessionData = JSON.parse(cachedSession)
  console.log('[test-cache] Cached session data:', sessionData)
  if (sessionData.username !== username) {
    throw new Error('Cached session username mismatch')
  }

  const userId = sessionData.userId

  // 3. Verify Preset List Caching
  console.log('[test-cache] Retrieving presets (should trigger list cache write)...')
  await req('/api/presets')

  const listCacheKey = `pio:u:${userId}:list`
  const cachedList = await redis.get(listCacheKey)
  console.log('[test-cache] Redis key', listCacheKey, 'exists?', !!cachedList)
  if (!cachedList) {
    throw new Error('Preset list was not cached in Redis!')
  }

  // 4. Verify Preset Write-Through & Invalidation
  console.log(
    '[test-cache] Creating a new preset (should invalidate list cache & write to preset cache)...',
  )
  const presetId = `preset_${stamp}`
  const presetPayload = {
    id: presetId,
    name: 'Cache Test Preset',
    sections: [{ key: 'x', value: 'y', sort: 0 }],
    bodyBlocks: [{ label: 'B', contentMd: 'C', sort: 0 }],
  }

  await req('/api/presets', {
    method: 'POST',
    body: JSON.stringify(presetPayload),
  })

  // The list cache key should have been evicted/deleted!
  const listAfterCreate = await redis.get(listCacheKey)
  console.log('[test-cache] Redis list cache key deleted after create?', !listAfterCreate)
  if (listAfterCreate) {
    throw new Error('List cache was not evicted on create!')
  }

  // The preset cache key should have been written!
  const presetCacheKey = `pio:u:${userId}:p:${presetId}`
  const cachedPreset = await redis.get(presetCacheKey)
  console.log('[test-cache] Redis preset cache key exists?', !!cachedPreset)
  if (!cachedPreset) {
    throw new Error('Preset was not cached on create!')
  }

  // 5. Verify Update Invalidation
  console.log('[test-cache] Retrieving list again to recreate cache...')
  await req('/api/presets')

  console.log('[test-cache] Updating preset (should invalidate list and update preset cache)...')
  await req(`/api/presets/${presetId}`, {
    method: 'PUT',
    body: JSON.stringify({ ...presetPayload, name: 'Updated Cache Test Preset' }),
  })

  const listAfterUpdate = await redis.get(listCacheKey)
  console.log('[test-cache] Redis list cache key deleted after update?', !listAfterUpdate)
  if (listAfterUpdate) {
    throw new Error('List cache was not evicted on update!')
  }

  const updatedPresetCached = await redis.get(presetCacheKey)
  const updatedPresetData = JSON.parse(updatedPresetCached)
  console.log(
    '[test-cache] Cached preset name updated?',
    updatedPresetData.name === 'Updated Cache Test Preset',
  )
  if (updatedPresetData.name !== 'Updated Cache Test Preset') {
    throw new Error('Cached preset name was not updated!')
  }

  // 6. Verify Delete Invalidation
  console.log('[test-cache] Retrieving list again to recreate cache...')
  await req('/api/presets')

  console.log('[test-cache] Deleting preset (should invalidate list and preset cache)...')
  await req(`/api/presets/${presetId}`, {
    method: 'DELETE',
  })

  const listAfterDelete = await redis.get(listCacheKey)
  const presetAfterDelete = await redis.get(presetCacheKey)
  console.log('[test-cache] List cache deleted after remove?', !listAfterDelete)
  console.log('[test-cache] Preset cache deleted after remove?', !presetAfterDelete)
  if (listAfterDelete || presetAfterDelete) {
    throw new Error('Cache was not evicted on remove!')
  }

  // 7. Verify Logout Eviction
  console.log('[test-cache] Logging out (should evict session cache)...')
  await req('/api/auth/logout', { method: 'POST' })

  const sessionAfterLogout = await redis.get(sessionCacheKey)
  console.log('[test-cache] Session cache key deleted after logout?', !sessionAfterLogout)
  if (sessionAfterLogout) {
    throw new Error('Session cache key was not evicted on logout!')
  }

  console.log('\nALL CACHING TESTS PASSED!')
  await redis.quit()
  process.exit(0)
}

runTests().catch(async (err) => {
  console.error('[test-cache] TEST FAILED:', err.message)
  await redis.quit()
  process.exit(1)
})
