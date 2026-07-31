import { mysqlTable, text as mysqlText, varchar } from 'drizzle-orm/mysql-core'
import { pgTable, text as pgText } from 'drizzle-orm/pg-core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const sqliteUsers = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
})

export const sqlitePresets = sqliteTable('presets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  payload: text('payload').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const pgUsers = pgTable('users', {
  id: pgText('id').primaryKey(),
  username: pgText('username').unique().notNull(),
  passwordHash: pgText('password_hash').notNull(),
  createdAt: pgText('created_at').notNull(),
})

export const pgPresets = pgTable('presets', {
  id: pgText('id').primaryKey(),
  userId: pgText('user_id').notNull(),
  payload: pgText('payload').notNull(),
  createdAt: pgText('created_at').notNull(),
  updatedAt: pgText('updated_at').notNull(),
})

export const mysqlUsers = mysqlTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: varchar('created_at', { length: 255 }).notNull(),
})

export const mysqlPresets = mysqlTable('presets', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  payload: mysqlText('payload').notNull(),
  createdAt: varchar('created_at', { length: 255 }).notNull(),
  updatedAt: varchar('updated_at', { length: 255 }).notNull(),
})
