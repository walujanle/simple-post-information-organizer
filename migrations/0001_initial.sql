-- Migration 0001: Initial schema
-- Applied via: wrangler d1 execute <db-name> --remote --file=migrations/0001_initial.sql
--
-- Tables are also auto-created on cold start by src/backend/db/factory.ts
-- as a safety net, but manual migration is the canonical path.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS presets_updated_at_idx ON presets (updated_at DESC);
CREATE INDEX IF NOT EXISTS presets_user_id_idx ON presets (user_id);
