# Architecture

## Overview

`simple-post-information-organizer` is an Astro 7 SSR application with Vue 3
islands, Tailwind CSS 4, and a Node standalone server. It organises "post
information" into **Presets** — reusable templates with key/value Sections and
a Markdown body. The body is rendered by substituting `{token}` placeholders
with section values.

Two storage modes:

| Mode | Data lives | Auth required |
|------|-----------|---------------|
| Local | Browser `localStorage` (AES-GCM encrypted) | No |
| Cloud | Server database via REST API | Yes (JWT cookie) |

The user switches modes at runtime; the app falls back to Local automatically
when not authenticated.

---

## Toolchain

The server runtime is **Node.js >= 24.18.0**. Either
**npm** or **Bun >= 1.3.14** can drive the project — no script shells out to a
package manager by name.

`bun run dev` still executes Astro under Node, because the `astro` binary
carries a `#!/usr/bin/env node` shebang. Bun is a package manager and task
runner here, not the server runtime. See [DEPLOYMENT.md](DEPLOYMENT.md) for the
Bun-runtime limitation around `better-sqlite3`.

---

## Runtime & deployment

`output: "server"` means Astro **requires** an adapter, and the adapter must
match the host — each one packages the same application in a different format.
Two are supported:

| Target | Adapter | Output | Selected by |
|--------|---------|--------|-------------|
| Node standalone (default) | `@astrojs/node` | `dist/server/entry.mjs`, started with `node` | default |
| Vercel | `@astrojs/vercel` | `.vercel/output/` (Build Output API) | `VERCEL=1` (set automatically) or `ASTRO_ADAPTER=vercel` |

```js
const target = process.env.ASTRO_ADAPTER ?? (process.env.VERCEL ? 'vercel' : 'node')
```

Vercel sets `VERCEL=1` during its build, so deploying there needs no build
command override. `ASTRO_ADAPTER` forces a target explicitly, which is what
`build:vercel` uses to test the Vercel output locally.

> Deploying with the wrong adapter is silent: the build succeeds, but the host
> finds nothing it can serve. On Vercel that shows up as a **404 on every
> route**, because `@astrojs/node` emits a standalone server Vercel never
> starts, and there is no `index.html` to fall back on (the page is
> `client:only`, so nothing is prerendered).

| Script | Runtime | Database | Cache |
|--------|---------|----------|-------|
| `dev` | Node standalone | SQLite | Redis (if `REDIS_URL`) or in-process Map |
| `build` | Node standalone | any | any |
| `build:vercel` | Vercel serverless | **Postgres or MySQL only** | Redis recommended |

Serverless deployment has a hard constraint: the filesystem is read-only and
ephemeral, so the SQLite driver cannot be used. `DATABASE_URL` is mandatory on
Vercel. See [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Directory map

```
src/
├── middleware.ts            # Security headers, CSP nonce, 15 s timeout
├── config/
│   └── constants.ts         # Every tunable value + APP_VERSION (from package.json)
├── domain/                  # Pure logic -- no framework, no I/O
│   ├── types.ts             # All shared interfaces (pioExportVersion field)
│   ├── validate.ts          # Type-guard validators (client + server)
│   └── render.ts            # Template engine + markdown renderer + FORMAT_REFERENCE
├── backend/                 # Server-only
│   ├── runtime.ts           # process.env + .env file loader
│   ├── singleton.ts         # initOnce() -- promise-memoised lazy init (CWE-362 guard)
│   ├── http.ts              # json/apiError/withAuth/getClientIp -- the API vocabulary
│   ├── log.ts               # Single source of the "[pio]" log prefix
│   ├── jwt.ts               # HS256 sign/verify (Web Crypto -- edge compatible)
│   ├── auth-helper.ts       # getJwtSecret, verifySession (cache-first), clearSessionCache
│   ├── rate-limiter.ts      # Shared-cache + in-process limiter, guardRateLimit()
│   ├── validation.ts        # Result-typed API validators
│   ├── body-limit.ts        # Content-Length guard
│   ├── cache/
│   │   ├── store.ts         # CacheProvider interface
│   │   ├── keys.ts          # Single source of the "pio:" cache-key prefix
│   │   ├── factory.ts       # Redis -> Memory priority chain
│   │   ├── memory-store.ts  # In-process Map, max 2 000 entries, LRU eviction
│   │   └── redis-store.ts   # ioredis adapter
│   └── db/
│       ├── store.ts         # PresetStore interface (presets + users) + UserRecord
│       ├── schema.ts        # Drizzle schemas: SQLite, Postgres, MySQL
│       ├── drizzle-store.ts # All CRUD, caching, atomic import transactions
│       └── factory.ts       # Driver detection: PG -> MySQL -> SQLite
├── storage/                 # Client-only (browser)
│   ├── repository.ts        # PresetRepository interface
│   ├── local.ts             # localStorage + AES-GCM (v2 payload), module-level cache
│   ├── cloud.ts             # fetch() wrapper, 30 s AbortSignal timeout
│   ├── secure.ts            # encryptForStorage / decryptFromStorage (Web Crypto)
│   └── settings.ts          # AppSettings in localStorage
├── composables/
│   ├── usePostInformationApp.ts  # Root orchestrator (all state + actions)
│   ├── useDocumentEditor.ts      # Section/body state + debounced render pipeline
│   └── useClipboard.ts           # Copy-to-clipboard
├── components/
│   ├── AppIcon.vue
│   ├── AppModal.vue         # Native <dialog> wrapper: focus trap, Esc, focus restore
│   └── layout/              # Vue 3 SFC layout components
├── pages/
│   ├── index.astro          # Single page shell (client:only)
│   └── api/
│       ├── health.ts        # GET -- DB ping, returns { status, version } only
│       ├── export.ts        # GET -- ExportBundle (auth required)
│       ├── import.ts        # POST -- bundle import, mode=merge|replace
│       ├── auth/{register,login,logout,session,change-password}.ts
│       └── presets/{index,[id]}.ts
└── styles/global.css
migrations/0001_initial.sql  # Canonical schema (SQLite dialect)
scripts/
├── test-render.mjs          # 42 unit tests -- template engine + XSS regression
├── test-api.mjs             # 30-assertion end-to-end API suite
├── test-cache.mjs           # Cache read/write/invalidation suite
└── run-all-tests.mjs        # Unit -> server on a free port -> cache + API
```

---

## Domain model

```
Preset
  id:         UUID string
  name:       string
  sections:   Section[]      { key: /^[a-z0-9-]+$/, value, sort }
  bodyBlocks: BodyBlock[]    { label, contentMd, sort }
  createdAt:  ISO string
  updatedAt:  ISO string

ExportBundle
  pioExportVersion: 1
  source:     "local" | "cloud"
  exportedAt: ISO string
  presets:    Preset[]
```

> `bodyBlocks` is an array to allow future multi-block editing. Today only
> `bodyBlocks[0]` is read and written, by `useDocumentEditor`.

The database stores each preset as a single JSON `payload` blob (`TEXT`) — no
relational decomposition of sections or bodyBlocks. The schema is identical
across SQLite, Postgres and MySQL. See [MAINTENANCE.md](MAINTENANCE.md) for
why this is deliberate.

---

## Data flow

### Local mode

```
usePostInformationApp
  -> LocalPresetRepository.readAll()
      -> localStorage.getItem("spio:local:presets")
          -> JSON.parse -> detect EncryptedPayload { v: 2 }
              -> decryptFromStorage (AES-GCM, Web Crypto)
                  -> filter isValidPreset -> Preset[]
```

Writes encrypt before storing. A module-level cache avoids re-decrypting
unchanged data.

### Cloud mode

```
usePostInformationApp
  -> CloudPresetRepository -> fetch("/api/presets/...")
      -> middleware.ts (nonce, headers, 15 s timeout)
          -> withAuth -> verifySession (cache-first: pio:sess:{token})
              -> resolvePresetStore -> DrizzlePresetStore
                  -> DB query (SQLite / PG / MySQL)
```

---

## Database driver detection

`src/backend/db/factory.ts` selects a driver per request:

1. `PIO_DB_DRIVER` (explicit override: `sqlite`, `postgres`, `mysql`)
2. A `DB` binding exposing `.prepare()` → **D1** (auto-detected on Workers)
3. `DATABASE_URL` prefix: `postgres://` / `postgresql://` → Postgres; `mysql://` → MySQL
4. Default: **SQLite** (`PIO_SQLITE_PATH`, default `./data/presets.sqlite`)

The explicit override is checked first and wins over D1 auto-detection.

Each driver's initialisation runs through `initOnce()` from
`src/backend/singleton.ts`, which memoises the *promise*. A plain
`if (instance) return instance` guard is unsafe here: the factory awaits, so
two concurrent cold-start requests would each build a connection pool and leak
whichever lost the assignment race (CWE-362). A rejected initialisation is
evicted so a later request can retry.

Tables and indexes are created on first use with `CREATE TABLE IF NOT EXISTS`
on all three drivers, so a fresh database needs no manual step. `migrations/0001_initial.sql` remains the canonical
schema of record.

---

## Cache layer

`src/backend/cache/factory.ts` priority chain (also `initOnce`-guarded, since
creating a Redis client opens a socket):

1. **Redis** — `REDIS_URL` env var (`ioredis`)
2. **Memory** — in-process `Map`, max 2 000 entries, LRU eviction

Keys are built in `src/backend/cache/keys.ts` — the single place the `pio:`
prefix is defined:

- `pio:sess:{token}` — session shortcut (TTL = JWT remaining lifetime)
- `pio:u:{userId}:list` — preset list (TTL `CACHE_TTL_SECONDS`)
- `pio:u:{userId}:p:{id}` — single preset (TTL `CACHE_TTL_SECONDS`)
- `rl:{scope}:{ip}:{window}` — rate-limit counter

Entries are invalidated on every write, delete and import.

---

## API layer

`src/backend/http.ts` holds the whole HTTP vocabulary, so routes contain only
their own logic:

| Helper | Purpose |
|--------|---------|
| `json(data, status)` | JSON response with the correct content type |
| `noContent()` | `204` |
| `apiError(code, message, status)` | Coded error envelope |
| `badRequest` / `serverError` / `unauthorized` | Common shapes |
| `getClientIp(context)` | Workers throws on `clientAddress`; Node does not |
| `withAuth(handler)` | Rejects unauthenticated requests before the handler runs |

`withAuth` is the important one: authentication is structural rather than
copy-pasted, so a new protected route cannot forget the check.

---

## Auth flow

```
POST /api/auth/register
  -> rate-check (5/min/IP, best-effort)
  -> bcrypt.hash(password)              <- always first (CWE-203)
  -> store.findUserByUsername()
  -> store.createUser()

POST /api/auth/login
  -> rate-check (5/min/IP)
  -> store.findUserByUsername()
  -> bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
  -> signJwt (HS256, 4 h)
  -> Set-Cookie: session=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=14400
     (Secure added when NODE_ENV=production or the host is not localhost)

Every protected request
  -> withAuth -> verifySession
      -> cache.get("pio:sess:{token}")   <- fast path
      -> verifyJwt (Web Crypto HMAC-SHA256) <- fallback
      -> cache.set (TTL = JWT remaining)

POST /api/auth/change-password
  -> rate-check -> verifySession -> bcrypt.compare(current)
  -> store.updateUserPassword()
  -> clearSessionCache(old token) + issue a fresh cookie   <- session rotation

POST /api/auth/logout
  -> clearSessionCache(token) + cookies.delete("session")
```

---

## Template render engine

`src/domain/render.ts` — `renderTemplate(template, context)`:

- Escapes `{{` / `}}` to private-use Unicode before the regex pass, so a literal
  `{{name}}` renders as `{name}` and never matches as a token
- Pattern: `{key}` or `{key:format}`; formats are `lowercase`, `uppercase`,
  `capitalized`, `trim`
- Section values may themselves contain `{token}` references, resolved
  recursively with cycle detection (a cycle stops at the raw value)
- Unknown token → `«unknown:key»` + a `RenderIssue`; empty value → `«empty:key»`
- `copyText` strips `«empty:…»` and rewrites `«unknown:key»` → `unknown-key`
- `markdownToSafeHtml()` escapes all input **before** constructing any tag, then
  emits only `h1`–`h3`, `ul`, `li`, `p`, `strong`, `code`
- `FORMAT_REFERENCE` is exported from this module and drives the format modal

This is the most intricate code in the project and the most valuable to keep
working. `scripts/test-render.mjs` covers it with 42 unit tests, including a
test asserting that every `FORMAT_REFERENCE` row still matches real engine
output — so the UI cannot silently start lying — and XSS regression tests for
`markdownToSafeHtml`.

### Render performance

`renderTemplate` and `markdownToSafeHtml` both walk the entire body, which can
reach `MAX_BODY_CHARS` (100 000). Running them per keystroke would dominate
input latency, so `useDocumentEditor` snapshots the body and sections into
`renderInput` on a `PREVIEW_DEBOUNCE_MS` (120 ms) trailing debounce. The
textarea stays bound synchronously — only the preview is debounced. Loading a
preset commits the snapshot immediately rather than waiting for the timer.

---

## Search engines

`index.astro` mounts the app with `client:only="vue"` because it requires
`localStorage`, IndexedDB, the clipboard and blob downloads — none of which
exist during SSR. Crawlers therefore receive an empty body.

This is intentional. The app is private and single-account, so `public/robots.txt`
disallows indexing outright rather than leaving crawl behaviour ambiguous. Do
not add SSR "for SEO".

---

## Accessibility

- Modals are native `<dialog>` elements via `AppModal.vue`, which supplies the
  focus trap, `Esc` handling, focus restore and `::backdrop` for free, plus
  implicit `role="dialog"` / `aria-modal`. Each is labelled with
  `aria-labelledby`.
- Section key/value inputs in the desktop table carry `aria-label`, because a
  `<th>` does not name a form control. The mobile card view uses real
  `<label for>` associations.
- The page provides a skip link, and focus outlines are never removed.

---

## Key design decisions

- **`pioExportVersion`** namespaces the export bundle to this application, so
  a bundle produced by an unrelated tool cannot be imported by mistake.
- **Preset as blob** avoids migrations for domain changes; payloads are
  validated on read.
- **`PresetRepository`** lets Local and Cloud implementations be swapped by a
  computed ref in `usePostInformationApp` with no component changes.
- **`PresetStore` owns user records too**, so auth routes never touch Drizzle
  directly and the persistence layer stays behind one interface.
- **Custom JWT and markdown renderer** avoid two dependencies that would
  otherwise need security patching forever.
- **Constants in one module** (`src/config/constants.ts`), including
  `APP_VERSION` read from `package.json`, so `/api/health` cannot drift from
  the real version.
- **Package-manager agnostic scripts**: no script names `npm` or `bun`.

See [MAINTENANCE.md](MAINTENANCE.md) for limitations that are deliberate.
