# Deployment

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 24.18.0 | Server runtime in every target, including local dev |
| npm | >= 11 | Ships with Node; usable as the package manager and task runner |
| Bun | >= 1.3.14 | Optional alternative package manager and task runner |

### Package manager choice

Every script is package-manager agnostic — none of them shells out to `npm` or
`bun` by name. Use whichever you prefer:

```sh
npm install     # or: bun install
npm run build   # or: bun run build
```

Both `package-lock.json` and `bun.lock` are committed. If you change
dependencies, refresh both so the two stay in sync.

### Runtime note: Bun is a task runner, not the server runtime

`bun run dev` still executes Astro under **Node**, because the `astro` binary
carries a `#!/usr/bin/env node` shebang. This is why SQLite works normally when
you drive the project with Bun.

Running the built server *directly* under the Bun runtime is not supported when
using the SQLite driver:

```sh
node dist/server/entry.mjs   # supported
bun  dist/server/entry.mjs   # fails with the SQLite driver
```

Bun cannot load `better-sqlite3` ([oven-sh/bun#4290](https://github.com/oven-sh/bun/issues/4290)).
Under the Bun runtime, use the Postgres or MySQL driver instead.

### Why `better-sqlite3` is pinned to 12.x

`better-sqlite3` 13.x removed its `install` script and ships prebuilt binaries in
a `prebuilds/` directory. npm handles that fine, but Bun sees the package's
`binding.gyp` and invokes `node-gyp`, which fails on machines without a C++
toolchain (on Windows, without Visual Studio) and makes `bun install` exit 1.
Version 12.x keeps the `prebuild-install || node-gyp rebuild` install script and
installs cleanly under both package managers. Do not bump this to 13.x until Bun
stops force-building packages that ship prebuilds.

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SESSION_SECRET` | Yes | — | JWT signing key — **minimum 32 characters**. Throws on the first authenticated request if shorter or missing. |
| `PIO_DB_DRIVER` | No | `sqlite` | `sqlite`, `postgres`, or `mysql`. Checked before `DATABASE_URL` prefix detection. |
| `DATABASE_URL` | When PG/MySQL | — | Connection string. Auto-detected from the `postgres://` or `mysql://` prefix if `PIO_DB_DRIVER` is not set. |
| `PIO_SQLITE_PATH` | No | `./data/presets.sqlite` | Custom SQLite file path |
| `REDIS_URL` | No | — | Redis connection URL for distributed session cache |
| `CSP_SCRIPT_ORIGINS` | No | — | Extra `script-src` origins (space or comma separated) |
| `CSP_CONNECT_ORIGINS` | No | — | Extra `connect-src` origins (space or comma separated) |

Copy `.env.example` to `.env` and fill in at minimum `SESSION_SECRET`.

---

## Local Development

### Node + SQLite (default)

```sh
npm install          # or: bun install
cp .env.example .env
# Edit .env: set SESSION_SECRET to a random string (min 32 chars)
npm run dev          # or: bun run dev
```

Open http://localhost:4321

### Node + Postgres

```sh
DATABASE_URL=postgres://user:pass@localhost:5432/spio npm run dev
```

### Node + MySQL

```sh
DATABASE_URL=mysql://user:pass@localhost:3306/spio npm run dev
```

On Windows PowerShell, set the variable first:

```powershell
$env:DATABASE_URL = "postgres://user:pass@localhost:5432/spio"; npm run dev
```

---

## Production (Node Standalone)

```sh
npm run build
node dist/server/entry.mjs
```

The build step runs `biome check --write .` followed by `astro check` before
compiling, so it rewrites formatting fixes in place. Use `npm run ci` for a
read-only lint check in CI pipelines.

---

## Production (Vercel)

Vercel sets `VERCEL=1` in its build environment, and `astro.config.mjs` reads it
to select `@astrojs/vercel` automatically. **No build-command override is
needed** — the default `npm run build` produces the right output there.

### Required environment variables

Set these in the Vercel project settings before the first deploy:

| Variable | Required | Notes |
|----------|----------|-------|
| `SESSION_SECRET` | **Yes** | Minimum 32 characters |
| `DATABASE_URL` | **Yes** | `postgres://…` or `mysql://…`. See below — SQLite cannot work here |
| `REDIS_URL` | Recommended | Without it, cache and rate limiting are per-instance |

### SQLite does not work on Vercel

Serverless functions get a **read-only, ephemeral** filesystem. The default
SQLite driver needs to create and write `./data/presets.sqlite`, which fails —
and any data it did write would vanish when the instance is recycled.

`DATABASE_URL` is therefore mandatory. If you forget it, the driver falls back
to SQLite and the API returns a `500` explaining exactly this, rather than a
native binding error that looks like a build problem.

### Verifying the output before deploying

```sh
npm run build:vercel
ls .vercel/output          # expect: config.json  functions/  static/
```

`.vercel/output/` is the Build Output API directory. If it is missing, the
wrong adapter ran and **every route will 404** — the build still succeeds, so
this is the only way to catch it before deploying. `config.json` should contain
a route mapping `^/$` to `_render`.

### Do not use `vercel deploy --prebuilt` from a non-Linux machine

The traced function bundle (~30 MB) includes native binaries such as
`better-sqlite3` and `sharp`, compiled for the platform that ran the build.
Uploading a Windows or macOS build to Vercel's Linux runtime ships unusable
binaries. Let Vercel build from git, which is the default.

---

## Database

Tables are auto-created on first request (safety net). For Postgres and MySQL,
ensure the user has `CREATE TABLE` permission on first boot, or run schema
creation manually using the statements in `migrations/0001_initial.sql`
(SQLite dialect — adapt DDL for Postgres/MySQL as needed).

---

## Verification

```sh
npm run ci        # read-only lint -- must exit 0
npm run check     # TypeScript / Astro diagnostics
npm run test:unit # render engine
npm run build     # full verify + build
```

`verify` and `build` run the unit suite as part of the gate, so a dependency
bump that breaks the render engine fails the build instead of shipping.

Unit tests need nothing at all:

```sh
npm run test:unit
# Expected: pass 42  fail 0
```

`npm run test:all` runs the unit suite, then boots its own server on a **free
port** and runs the cache and API suites against it. It writes to a scratch
SQLite file (`data/test-run.sqlite`), so it never touches real data.

Point the same suites at another engine with `DATABASE_URL`:

```sh
DATABASE_URL=postgres://postgres@127.0.0.1:5432/scratch npm run test:all
DATABASE_URL=mysql://root@127.0.0.1:3306/scratch      npm run test:all
```

Note that Astro keeps a persistent dev server per project; `test:all` runs
`astro dev stop` first so it cannot silently reuse a stale one. See
[MAINTENANCE.md](MAINTENANCE.md).

---

## Scripts

Run with `npm run <script>` or `bun run <script>`.

| Script | Purpose |
|--------|---------|
| `dev` | Dev server (Node + SQLite) |
| `verify` | Biome check (writes) + Astro check + unit tests |
| `build` | Verify + production build (Node, or Vercel when `VERCEL=1`) |
| `build:vercel` | Verify + force a Vercel build locally, to inspect `.vercel/output/` |
| `preview` | Preview production build locally |
| `check` | TypeScript check |
| `lint` | Biome lint |
| `format` | Biome format (writes) |
| `ci` | Biome CI check (read-only) |
| `test:unit` | Render-engine unit tests (42 assertions, no server needed) |
| `test:api` | 30-assertion API suite (needs a running server) |
| `test:cache` | Cache suite (needs a running server) |
| `test:all` | Unit tests, then boots a server on a free port for the cache + API suites |
