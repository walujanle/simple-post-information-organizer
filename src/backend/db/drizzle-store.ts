import { and, desc, eq, sql } from 'drizzle-orm'
import { presetKey, presetListKey } from '@/backend/cache/keys'
import type { CacheProvider } from '@/backend/cache/store'
import type { DbDriver, PresetStore, UserRecord } from '@/backend/db/store'
import { logError, logWarn } from '@/backend/log'
import { validatePreset } from '@/backend/validation'
import { APP_VERSION, CACHE_TTL_SECONDS } from '@/config/constants'
import type { ExportBundle, ImportResult, Preset, PresetMeta } from '@/domain/types'

export class DrizzlePresetStore implements PresetStore {
  constructor(
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle database instance is dialect-specific
    readonly db: any,
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle table schema is dialect-specific
    readonly table: any,
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle users table schema is dialect-specific
    readonly usersTable: any,
    readonly driver: DbDriver,
    readonly cache?: CacheProvider,
  ) {}

  async health() {
    try {
      await this.db.select().from(this.table).limit(1)
      return { status: 'ok' as const, version: APP_VERSION, dbDriver: this.driver }
    } catch (err) {
      logError(`Drizzle health check failed for ${this.driver}:`, err)
      return { status: 'unavailable' as const, version: APP_VERSION, dbDriver: this.driver }
    }
  }

  async countUsers(): Promise<number> {
    const rows = await this.db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(this.usersTable)
    return rows[0]?.count ?? 0
  }

  async findUserByUsername(username: string): Promise<UserRecord | undefined> {
    const rows = await this.db
      .select()
      .from(this.usersTable)
      .where(eq(this.usersTable.username, username))
      .limit(1)
    return rows[0]
  }

  async findUserById(id: string): Promise<UserRecord | undefined> {
    const rows = await this.db
      .select()
      .from(this.usersTable)
      .where(eq(this.usersTable.id, id))
      .limit(1)
    return rows[0]
  }

  async createUser(user: UserRecord): Promise<void> {
    await this.db.insert(this.usersTable).values(user)
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .update(this.usersTable)
      .set({ passwordHash })
      .where(eq(this.usersTable.id, userId))
  }

  async list(userId: string): Promise<PresetMeta[]> {
    const cacheKey = presetListKey(userId)
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey)
        if (cached) {
          return JSON.parse(cached) as PresetMeta[]
        }
      } catch (err) {
        logWarn('Cache read failed in list(), falling back to database:', err)
      }
    }

    const rows = await this.db
      .select({
        id: this.table.id,
        payload: this.table.payload,
        updatedAt: this.table.updatedAt,
      })
      .from(this.table)
      .where(eq(this.table.userId, userId))
      .orderBy(desc(this.table.updatedAt))
    // biome-ignore lint/suspicious/noExplicitAny: row mapping
    const list = rows.map((r: any) => {
      try {
        const payload = JSON.parse(r.payload)
        const name = typeof payload.name === 'string' ? payload.name : ''
        const sections = Array.isArray(payload.sections) ? payload.sections : []
        return {
          id: r.id,
          name,
          updatedAt: r.updatedAt,
          sectionKeys: (sections as Record<string, unknown>[])
            .map((s) => s?.key)
            .filter((k): k is string => typeof k === 'string' && k !== ''),
        }
      } catch (err) {
        logError(`Failed to parse preset payload for id ${r.id}:`, err)
        return {
          id: r.id,
          name: 'Corrupted Preset',
          updatedAt: r.updatedAt,
          sectionKeys: [],
        }
      }
    })

    if (this.cache) {
      try {
        await this.cache.set(cacheKey, JSON.stringify(list), CACHE_TTL_SECONDS)
      } catch (err) {
        logWarn('Cache write failed in list():', err)
      }
    }
    return list
  }

  async get(userId: string, id: string): Promise<Preset | undefined> {
    const cacheKey = presetKey(userId, id)
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey)
        if (cached) {
          return JSON.parse(cached) as Preset
        }
      } catch (err) {
        logWarn('Cache read failed in get(), falling back to database:', err)
      }
    }

    const rows = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId)))
      .limit(1)
    const row = rows[0]
    const preset = row ? this.parsePreset(JSON.parse(row.payload)) : undefined

    if (this.cache && preset) {
      try {
        await this.cache.set(cacheKey, JSON.stringify(preset), CACHE_TTL_SECONDS)
      } catch (err) {
        logWarn('Cache write failed in get():', err)
      }
    }
    return preset
  }

  async create(userId: string, preset: Preset): Promise<Preset> {
    await this.db.insert(this.table).values({
      id: preset.id,
      userId: userId,
      payload: JSON.stringify(preset),
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    })
    if (this.cache) {
      try {
        await this.cache.delete(presetListKey(userId))
        await this.cache.set(
          presetKey(userId, preset.id),
          JSON.stringify(preset),
          CACHE_TTL_SECONDS,
        )
      } catch (err) {
        logWarn('Cache write failed in create():', err)
      }
    }
    return preset
  }

  async update(userId: string, id: string, preset: Preset): Promise<Preset> {
    const next = { ...preset, id }
    const values = {
      id,
      userId: userId,
      payload: JSON.stringify(next),
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    }

    if (this.driver === 'mysql') {
      await this.db
        .insert(this.table)
        .values(values)
        .onDuplicateKeyUpdate({
          set: {
            payload: values.payload,
            updatedAt: values.updatedAt,
          },
        })
    } else {
      await this.db
        .insert(this.table)
        .values(values)
        .onConflictDoUpdate({
          target: this.table.id,
          set: {
            payload: values.payload,
            updatedAt: values.updatedAt,
          },
        })
    }

    if (this.cache) {
      try {
        await this.cache.delete(presetListKey(userId))
        await this.cache.set(presetKey(userId, id), JSON.stringify(next), CACHE_TTL_SECONDS)
      } catch (err) {
        logWarn('Cache write failed in update():', err)
      }
    }
    return next
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId)))

    if (this.cache) {
      try {
        await this.cache.delete(presetListKey(userId))
        await this.cache.delete(presetKey(userId, id))
      } catch (err) {
        logWarn('Cache delete failed in remove():', err)
      }
    }
  }

  async exportAll(userId: string): Promise<ExportBundle> {
    const rows = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.userId, userId))
      .orderBy(desc(this.table.updatedAt))
    return {
      pioExportVersion: 1 as const,
      source: 'cloud' as const,
      exportedAt: new Date().toISOString(),
      // biome-ignore lint/suspicious/noExplicitAny: row mapping
      presets: rows.map((r: any) => this.parsePreset(JSON.parse(r.payload))),
    }
  }

  async importAll(
    userId: string,
    presets: Preset[],
    mode: 'merge' | 'replace',
  ): Promise<ImportResult> {
    if (this.driver === 'sqlite') {
      // biome-ignore lint/suspicious/noExplicitAny: transaction scope
      const result = this.db.transaction((tx: any) => {
        if (mode === 'replace') {
          tx.delete(this.table).where(eq(this.table.userId, userId)).run()
        }

        let created = 0
        let updated = 0

        const existingRows = tx
          .select({ id: this.table.id })
          .from(this.table)
          .where(eq(this.table.userId, userId))
          .all()
        // biome-ignore lint/suspicious/noExplicitAny: row mapping
        const existingIds = new Set(existingRows.map((r: any) => r.id))

        for (const preset of presets) {
          const isUpdate = mode === 'merge' && existingIds.has(preset.id)
          if (isUpdate) {
            updated++
          } else {
            created++
          }

          const values = {
            id: preset.id,
            userId: userId,
            payload: JSON.stringify(preset),
            createdAt: preset.createdAt,
            updatedAt: preset.updatedAt,
          }

          tx.insert(this.table)
            .values(values)
            .onConflictDoUpdate({
              target: this.table.id,
              set: {
                payload: values.payload,
                updatedAt: values.updatedAt,
              },
            })
            .run()
        }

        return { created, updated, skipped: 0 }
      })
      if (this.cache) {
        await this.invalidateCacheForImport(userId, presets)
      }
      return result
    }

    if (this.driver === 'd1') {
      const existingRows = await this.db
        .select({ id: this.table.id })
        .from(this.table)
        .where(eq(this.table.userId, userId))
      // biome-ignore lint/suspicious/noExplicitAny: row mapping
      const existingIds = new Set(existingRows.map((r: any) => r.id))

      let created = 0
      let updated = 0
      const stmts = []
      if (mode === 'replace') {
        stmts.push(this.db.delete(this.table).where(eq(this.table.userId, userId)))
      }
      for (const preset of presets) {
        if (mode === 'merge' && existingIds.has(preset.id)) {
          updated++
        } else {
          created++
        }
        const values = {
          id: preset.id,
          userId: userId,
          payload: JSON.stringify(preset),
          createdAt: preset.createdAt,
          updatedAt: preset.updatedAt,
        }
        stmts.push(
          this.db
            .insert(this.table)
            .values(values)
            .onConflictDoUpdate({
              target: this.table.id,
              set: { payload: values.payload, updatedAt: values.updatedAt },
            }),
        )
      }
      await this.db.batch(stmts)
      if (this.cache) {
        await this.invalidateCacheForImport(userId, presets)
      }
      return { created, updated, skipped: 0 }
    }
    // biome-ignore lint/suspicious/noExplicitAny: transaction scope
    const result = await this.db.transaction(async (tx: any) => {
      if (mode === 'replace') {
        await tx.delete(this.table).where(eq(this.table.userId, userId))
      }

      let created = 0
      let updated = 0

      const existingRows = await tx
        .select({ id: this.table.id })
        .from(this.table)
        .where(eq(this.table.userId, userId))
      // biome-ignore lint/suspicious/noExplicitAny: row mapping
      const existingIds = new Set(existingRows.map((r: any) => r.id))

      for (const preset of presets) {
        const isUpdate = mode === 'merge' && existingIds.has(preset.id)
        if (isUpdate) {
          updated++
        } else {
          created++
        }

        const values = {
          id: preset.id,
          userId: userId,
          payload: JSON.stringify(preset),
          createdAt: preset.createdAt,
          updatedAt: preset.updatedAt,
        }

        if (this.driver === 'mysql') {
          await tx
            .insert(this.table)
            .values(values)
            .onDuplicateKeyUpdate({
              set: {
                payload: values.payload,
                updatedAt: values.updatedAt,
              },
            })
        } else {
          await tx
            .insert(this.table)
            .values(values)
            .onConflictDoUpdate({
              target: this.table.id,
              set: {
                payload: values.payload,
                updatedAt: values.updatedAt,
              },
            })
        }
      }

      return { created, updated, skipped: 0 }
    })
    if (this.cache) {
      await this.invalidateCacheForImport(userId, presets)
    }
    return result
  }

  private async invalidateCacheForImport(userId: string, presets: Preset[]): Promise<void> {
    if (!this.cache) return
    try {
      const keys = [presetListKey(userId)]
      for (const preset of presets) {
        keys.push(presetKey(userId, preset.id))
      }
      await this.cache.deleteMany(keys)
    } catch (err) {
      logWarn('Cache deleteMany failed in importAll():', err)
    }
  }

  private parsePreset(payload: unknown): Preset {
    const parsed = validatePreset(payload)
    if (!parsed.ok) throw new Error(parsed.message)
    return parsed.value
  }
}
