# Security

## Authentication

- Passwords hashed with **bcrypt** (cost `BCRYPT_COST` = 10, ~100 ms/hash)
- Sessions use **HS256 JWT** signed with `SESSION_SECRET` (minimum 32 characters, enforced on first use)
- Cookie: `HttpOnly`, `SameSite=Lax`, 4-hour expiry (`Max-Age=14400`), path `/`.
  The `Secure` flag is set when `NODE_ENV=production` **or** the request host is
  not `localhost`, so plain-HTTP local development still works.
- Session verification is **cache-first** (`pio:sess:{token}` in Redis or the
  in-process memory cache; TTL = the JWT's remaining lifetime), falling back to a
  full JWT verification on a miss.
- The session cache entry is deleted on logout.

All tunable values live in `src/config/constants.ts`.

## Session revocation — known limitation

`POST /api/auth/change-password` updates the stored hash and **rotates the
calling session** (old cache entry dropped, fresh cookie issued). JWTs already
issued to *other* devices remain valid until they expire — at most 4 hours.

This is an accepted trade-off. Revoking them would require either a database
lookup on every request (defeating the cache-first session path) or a schema
migration to carry a token epoch. For a single-account app with a 4-hour token
neither is worth it. See [MAINTENANCE.md](MAINTENANCE.md).

## Rate limiting — best-effort, not atomic

Auth endpoints (`/api/auth/login`, `/api/auth/register`,
`/api/auth/change-password`) are limited to **5 requests / 60 s / IP**.

The shared-cache limiter is a fixed-window counter implemented as
`get` → compare → `set`. This is **not atomic**: concurrent requests can read
the same value, so two requests arriving together can both be allowed. Treat it as a speed
bump, not a hard limit.

| Runtime | Backing store | Notes |
|---------|---------------|-------|
| Node + `REDIS_URL` | Redis | Shared across processes; survives restart |
| Node, no Redis | In-process `Map` | Per-process; resets on restart |

Both degrade to the in-process limiter if the cache errors.

**For a public deployment, put a reverse proxy or WAF rate-limiting rule in
front of `/api/auth/*`.** That is the real brute-force control. The
application-level limiter exists so a single-instance deployment is not
defenceless.

## Timing-attack mitigation (CWE-203)

- **Register**: `bcrypt.hash` always runs *before* the duplicate-username check,
  so response time does not reveal whether a username is taken.
- **Login**: `bcrypt.compare` always runs, comparing against
  `DUMMY_PASSWORD_HASH` when the username does not exist. Both branches pay the
  same bcrypt cost.

> The login path must not be collapsed into a short-circuit such as
> `user && await bcrypt.compare(...)` — that reintroduces the enumeration
> oracle. See the comment in `src/pages/api/auth/login.ts`.

## Input validation

All external input is validated at the API boundary (`src/backend/validation.ts`):

- Section keys must match `/^[a-z0-9-]+$/`
- Preset payloads are validated structurally before any database write
- Export bundles are version-checked (`pioExportVersion: 1`) and every nested
  preset is validated
- Body limits: 1 MB (single preset), 10 MB (import bundle), enforced from
  `Content-Length` before the body is read

## Security headers (per request, `src/middleware.ts`)

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-{n}' [CSP_SCRIPT_ORIGINS]; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' [CSP_CONNECT_ORIGINS]; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

A fresh UUID nonce is generated per request and patched into every `<script>`
tag in HTML responses. Static assets under `/_astro/` additionally receive
`Cache-Control: public, max-age=31536000, immutable`.

### Why `style-src` uses `'unsafe-inline'`

Vue and Tailwind apply styles directly via `element.style` at runtime. A CSP
nonce covers `<style>` *elements* only — never inline style *attributes* set by
JavaScript. Switching to a nonce here does not improve security; it only breaks
the UI. The correct mitigation for markup injection is the output escaping in
the template engine and markdown renderer, which is regression-tested.

## XSS mitigation

- `markdownToSafeHtml()` HTML-escapes `&`, `<`, `>`, `"` and `'` **before** any
  tag is constructed, so the only tags it can emit are its own
  (`p`, `h1`–`h3`, `ul`, `li`, `strong`, `code`).
- The template engine emits `«unknown:key»` / `«empty:key»` placeholders rather
  than raw user data for unresolved tokens.
- The preview pane uses `v-html`, which is safe **only because of the escaping
  above**. `scripts/test-render.mjs` asserts that no attacker-controlled `<` or
  `>` survives, for a set of standard payloads. Keep those tests passing if you
  extend the markdown renderer — adding link support in particular would
  reintroduce XSS without them.

## Authorisation

- Every preset, export and import route is wrapped in `withAuth()`, which
  rejects unauthenticated requests before the handler runs.
- Every database query is scoped by `userId`; there is no cross-user read path.
- `/api/health` is public but returns only `{ status, version }` — the database
  driver is deliberately withheld.

## Local (browser) storage

- Local presets are encrypted with **AES-GCM** via the Web Crypto API
  (`src/storage/secure.ts`)
- Stored shape: `{ v: 2, data: { ciphertext, iv } }`, with a random IV per write
- The key lives in IndexedDB, is device-bound, and is unreadable to other origins

> This protects data at rest from other origins and casual inspection. It does
> **not** protect against script running on this origin.

## Threat model

| Threat | Mitigation |
|--------|-----------|
| Brute-force login / register | 5/min/IP best-effort limiter + bcrypt cost 10; reverse-proxy rule recommended in production |
| Username enumeration | Generic error messages + constant-time bcrypt on both login and register |
| Session fixation | A new JWT is minted on every login and on password change |
| Session hijacking | `HttpOnly` + `Secure` (outside localhost) + `SameSite=Lax`, 4-hour TTL, cache invalidation on logout |
| XSS | Nonce-based `script-src`; escape-first markdown renderer with regression tests |
| SQL injection | Parameterised queries via Drizzle ORM only |
| CSRF | `SameSite=Lax` cookie; no state-changing `GET` routes |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| Information disclosure | Health endpoint withholds the driver; no stack traces in responses |
| Large-payload DoS | 1 MB / 10 MB body limits + 15 s request timeout in middleware |
| Cache memory exhaustion | Memory cache capped at 2,000 entries with LRU eviction |
| Connection-pool exhaustion | Pool initialisation is promise-guarded against concurrent cold starts (CWE-362) |

## Registration control

This project has **no** registration kill-switch and **no** account cap.
`POST /api/auth/register` is reachable by anyone who can reach the server,
subject only to the best-effort rate limiter.

**Do not expose this instance publicly** without putting your own control in
front of `/api/auth/register`.

## Known limitations

- Rate limiting is best-effort, not atomic (see above)
- Password change does not revoke other devices' sessions (see above)
- The in-process limiter resets on restart; set `REDIS_URL` for persistence
- bcrypt cost 10 is appropriate for 2026; raise to 12 for higher-security use
- Rotating `SESSION_SECRET` invalidates all active sessions
