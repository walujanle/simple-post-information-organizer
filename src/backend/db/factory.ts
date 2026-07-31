import type { APIContext } from 'astro'
import { resolveCache } from '@/backend/cache/factory'
import type { CacheProvider } from '@/backend/cache/store'
import { DrizzlePresetStore } from '@/backend/db/drizzle-store'
import {
  mysqlPresets,
  mysqlUsers,
  pgPresets,
  pgUsers,
  sqlitePresets,
  sqliteUsers,
} from '@/backend/db/schema'
import type { PresetStore } from '@/backend/db/store'
import { getEnvValue } from '@/backend/runtime'
import { initOnce } from '@/backend/singleton'
import { DEFAULT_SQLITE_PATH } from '@/config/constants'

function initPostgres(databaseUrl: string, cache: CacheProvider): Promise<DrizzlePresetStore> {
  return initOnce('postgres', async () => {
    const { Pool } = await import(/* @vite-ignore */ 'pg')
    const { drizzle } = await import(/* @vite-ignore */ 'drizzle-orm/node-postgres')
    // biome-ignore lint/suspicious/noExplicitAny: dynamic import type
    const pool = new Pool({ connectionString: databaseUrl }) as any
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, created_at VARCHAR(255) NOT NULL);`)
    await pool.query(`CREATE TABLE IF NOT EXISTS presets (
    id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255) NOT NULL, payload TEXT NOT NULL,
    created_at VARCHAR(255) NOT NULL, updated_at VARCHAR(255) NOT NULL);`)
    try {
      await pool.query(
        'CREATE INDEX IF NOT EXISTS presets_updated_at_idx ON presets (updated_at DESC);',
      )
      await pool.query('CREATE INDEX IF NOT EXISTS presets_user_id_idx ON presets (user_id);')
    } catch {}

    const db = drizzle(pool, { schema: { presets: pgPresets, users: pgUsers } })
    return new DrizzlePresetStore(db, pgPresets, pgUsers, 'postgres', cache)
  })
}

function initMysql(databaseUrl: string, cache: CacheProvider): Promise<DrizzlePresetStore> {
  return initOnce('mysql', async () => {
    const { createPool } = await import(/* @vite-ignore */ 'mysql2/promise')
    const { drizzle } = await import(/* @vite-ignore */ 'drizzle-orm/mysql2')
    // biome-ignore lint/suspicious/noExplicitAny: dynamic import type
    const pool = createPool(databaseUrl) as any
    const conn = await pool.getConnection()
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL, created_at VARCHAR(255) NOT NULL);`)
      await conn.query(`CREATE TABLE IF NOT EXISTS presets (
      id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255) NOT NULL, payload LONGTEXT NOT NULL,
      created_at VARCHAR(255) NOT NULL, updated_at VARCHAR(255) NOT NULL);`)
      try {
        await conn.query('CREATE INDEX presets_updated_at_idx ON presets (updated_at DESC);')
        await conn.query('CREATE INDEX presets_user_id_idx ON presets (user_id);')
      } catch {}
    } finally {
      conn.release()
    }

    const db = drizzle(pool, {
      schema: { presets: mysqlPresets, users: mysqlUsers },
      mode: 'default',
    })
    return new DrizzlePresetStore(db, mysqlPresets, mysqlUsers, 'mysql', cache)
  })
}

function initSqlite(sqlitePath: string, cache: CacheProvider): Promise<DrizzlePresetStore> {
  return initOnce('sqlite', async () => {
    const { mkdir } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    try {
      await mkdir(dirname(sqlitePath), { recursive: true })
    } catch {}

    const Database = await import(/* @vite-ignore */ 'better-sqlite3').then((m) => m.default)
    const { drizzle } = await import(/* @vite-ignore */ 'drizzle-orm/better-sqlite3')

    let sqlite: InstanceType<typeof Database>
    try {
      sqlite = new Database(sqlitePath)
    } catch (err) {
      // Serverless platforms have a read-only, ephemeral filesystem, so the
      // default SQLite driver cannot work there. Say so plainly instead of
      // surfacing a native binding error that looks like a build failure.
      throw new Error(
        `SQLite could not open "${sqlitePath}". If this is a serverless deployment, ` +
          'the filesystem is read-only -- set DATABASE_URL to a Postgres or MySQL ' +
          `connection string instead. See docs/DEPLOYMENT.md. Cause: ${
            err instanceof Error ? err.message : String(err)
          }`,
      )
    }
    // biome-ignore lint/suspicious/noExplicitAny: dynamic import type
    const client = sqlite as any
    client.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS presets_updated_at_idx ON presets (updated_at DESC);
  CREATE INDEX IF NOT EXISTS presets_user_id_idx ON presets (user_id);`)

    const db = drizzle(client, { schema: { presets: sqlitePresets, users: sqliteUsers } })
    return new DrizzlePresetStore(db, sqlitePresets, sqliteUsers, 'sqlite', cache)
  })
}

export async function resolvePresetStore(context: APIContext): Promise<PresetStore> {
  const cache = await resolveCache(context)
  const rawDriver = await getEnvValue(context, 'PIO_DB_DRIVER')
  const databaseUrl = (await getEnvValue(context, 'DATABASE_URL')) ?? ''

  let driver = 'sqlite'
  if (rawDriver) {
    driver = rawDriver
  } else if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    driver = 'postgres'
  } else if (databaseUrl.startsWith('mysql://')) {
    driver = 'mysql'
  }

  if (driver === 'postgres' || driver === 'postgresql') return initPostgres(databaseUrl, cache)
  if (driver === 'mysql') return initMysql(databaseUrl, cache)

  const sqlitePath = (await getEnvValue(context, 'PIO_SQLITE_PATH')) ?? DEFAULT_SQLITE_PATH
  return initSqlite(sqlitePath, cache)
}
