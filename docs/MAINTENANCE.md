# Maintenance & Revival

This project is expected to sit dormant for long stretches, receiving only
content updates and occasional dependency bumps. This document is the runbook
for picking it back up, and the record of which limitations are **deliberate**
so a future reader does not "fix" them by mistake.

---

## Reviving after a long pause

Run these in order. Stop at the first failure and read the matching section
below.

```sh
npm ci                 # or: bun install
npm run ci             # read-only lint -- must exit 0
npm run check          # TypeScript / Astro diagnostics
npm run test:unit      # render engine, no server or DB needed
npm run test:all       # boots its own server, uses a scratch DB
```

`npm run test:unit` is the fastest signal that the core template engine still
behaves. It needs no server, no database and no network.

### The native-module trap (most likely failure)

`better-sqlite3` is a **native module**. It is compiled against a specific
Node ABI, so a new Node major will break it with errors like
`NODE_MODULE_VERSION mismatch` or `invalid ELF header`.

```sh
rm -rf node_modules package-lock.json   # or bun.lock
npm install
```

If it still fails, `better-sqlite3` has no prebuilt binary for your Node
version yet. Either stay on the previous Node major, or switch to a driver
with no native dependency:

```sh
DATABASE_URL=postgres://user:pass@host:5432/db npm run dev
```

**Do not bump `better-sqlite3` to 13.x.** See [DEPLOYMENT.md](DEPLOYMENT.md)
for why 12.x is pinned (13.x breaks `bun install` on machines without a C++
toolchain).

### Line endings

`biome.json` pins `lineEnding: "lf"` and `.gitattributes` enforces `eol=lf`.
If `npm run ci` fails with formatting errors on files you did not touch, a
tool has rewritten them with CRLF. Fix with:

```sh
npx biome check --write .
```

`build` runs `biome check --write`, so a formatting drift will otherwise be
silently committed by a build.

> Beware of editing sources with a script: on Windows, Python's `write_text`
> translates `\n` to CRLF unless you pass `newline="\n"`. Biome catches it, but
> only for the file types it formats.

### Adapters: deploying with the wrong one fails silently

`output: "server"` makes an adapter mandatory, and each adapter packages the app
in a format only its own host understands:

| Adapter | Emits | Started by |
|---------|-------|-----------|
| `@astrojs/node` | `dist/server/entry.mjs` | you, with `node` |
| `@astrojs/vercel` | `.vercel/output/` | Vercel |

`astro.config.mjs` picks one:

```js
const target = process.env.ASTRO_ADAPTER ?? (process.env.VERCEL ? 'vercel' : 'node')
```

The dangerous property is that a mismatch **still builds successfully**. Deploy
the Node output to Vercel and every route returns 404 — Vercel finds no
`.vercel/output/` function to run, and no `index.html` to serve either, because
the page is `client:only` and nothing is prerendered.

Before any Vercel deploy, confirm the output shape rather than trusting the
build to have exited 0:

```sh
npm run build:vercel
ls .vercel/output          # config.json  functions/  static/
```

If `.vercel/output/` is absent, the Node adapter ran. Check that `VERCEL` or
`ASTRO_ADAPTER` is actually set in that environment.

### SQLite cannot run on serverless

Serverless filesystems are read-only and ephemeral, so `initSqlite()` cannot
create `./data/presets.sqlite`. `DATABASE_URL` (Postgres or MySQL) is mandatory
on Vercel.

`initSqlite()` catches the open failure and rethrows with that explanation, so
a misconfigured deploy reports a config problem rather than a native-module
error that looks like a broken build. Keep that message if you touch the
function.

### Why `path-to-regexp` is pinned in `overrides`

```jsonc
"overrides": { "path-to-regexp": "6.3.0" }
```

`@astrojs/vercel` → `@vercel/routing-utils` pins `path-to-regexp` at exactly
`6.1.0`, which carries a high-severity ReDoS advisory
([GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j)), and
that package **is** traced into the deployed serverless function. `6.3.0` is the
patched release in the same major line.

`npm audit fix` is no help here — it proposes downgrading to
`@astrojs/vercel@8`, which does not support Astro 7.

The override was verified to be behaviourally transparent: the generated
`.vercel/output/config.json` route table is identical before and after. If you
bump the Vercel adapter, re-check that `@vercel/routing-utils` still wants a
`6.x` release; if it moves to a new major, drop or update this override rather
than forcing a mismatch:

```sh
npm ls path-to-regexp --omit=dev   # expect "overridden"
npm audit --omit=dev               # expect 0 vulnerabilities
```

### Biome schema version

`biome.json` carries a `$schema` URL with a version in it. If it does not match
the installed `@biomejs/biome`, every Biome run prints a `deserialize` warning.
It is only noise, but it clutters CI logs. When bumping Biome, update the URL to
the same version.

---

## Dependency policy

| Change | Rule |
|--------|------|
| Patch / minor | Safe. Bump freely, then run `npm run test:all`. |
| Major: `astro`, `vue`, `tailwindcss`, `drizzle-orm` | One at a time, with a full `test:all` after each. Never batch. |
| `better-sqlite3` | Frozen at 12.x. See above. |
| `@astrojs/vercel` | Must stay on the major that peers the installed Astro (`astro: ^7`). Verify with `build:vercel` after any bump. |
| `typescript` | Frozen at 6.x while dormant. TS 7 is a large migration with no benefit here. |
| Anything new | Prefer not to. The small dependency surface is the main reason this project survives neglect. |

Check exposure before touching anything:

```sh
npm audit --omit=dev
npm outdated
```

---

## Deliberate limitations

These are **decisions, not bugs**. Each one was considered and kept.

### No pagination
`GET /api/presets` returns every preset, and `exportAll` loads them all into
memory. This is a personal, single-user tool, so paging would add real
complexity for no benefit. If it ever becomes multi-tenant, paging is the first
thing to add.

### Preset stored as an opaque JSON blob
The `payload TEXT` column holds the whole preset. This is why the schema has
never needed a migration and why all drivers share one table definition. The
cost is that `list()` parses every payload just to read `name` and
`sectionKeys`; results are cached for `CACHE_TTL_SECONDS` to soften it.
Promoting `name` to a real column would reintroduce migration debt -- do not.

### No server-side rendering, and no SEO
`index.astro` mounts the app with `client:only="vue"` because it depends on
`localStorage`, IndexedDB, the clipboard and blob downloads. Crawlers therefore
see an empty body. This is correct: the app is private, so `public/robots.txt`
disallows indexing outright. Do not add SSR "for SEO".

### `style-src 'unsafe-inline'`
Vue and Tailwind set styles through `element.style` at runtime. A CSP nonce
covers `<style>` elements, not inline style attributes, so a nonce here would
break the UI without improving safety. The real defence against style/markup
injection is the escaping in `markdownToSafeHtml()`, which is regression-tested
in `scripts/test-render.mjs`.

### Rate limiting is best-effort
The `CacheProvider` interface offers no atomic increment, so concurrent
requests can read the same counter. Treat the 5/min/IP limit as a speed bump.
Real brute-force protection comes from bcrypt cost 10 and keeping the instance
private. See [SECURITY.md](SECURITY.md).

### Password change does not revoke other sessions
Changing the password rotates *the caller's* session and updates the hash, but
JWTs already issued to other devices stay valid until they expire (4 hours).
Revoking them would require either a per-request database lookup (defeating the
cache-first session path) or a schema migration. For a single-user app with a
4-hour token this is an accepted trade-off, not an oversight.

### Two deployment targets, and only two
Node standalone and Vercel. Each additional adapter is another dependency to
keep in version-lockstep and another way for a deploy to fail silently. Do not
add a third without a concrete need.

### No account cap or registration kill-switch
There is no built-in registration guard: anyone who can reach the server can
create an account. **Do not expose this publicly** without putting your own
control in front of `/api/auth/register` -- a reverse-proxy rule, network
restriction, or a fork that adds a cap.

### `d1` appears in the driver union
`DbDriver` includes `d1`, reserved for a Cloudflare D1 backend. It is not
reachable in this build because there is no Cloudflare adapter, and the branch
is kept so the storage layer can be pointed at D1 without reshaping the
interface.

---

## Testing notes

- `test:unit` -- pure functions, no I/O. Runs on Node's built-in test runner
  with native TypeScript type stripping, so it needs no test framework.
- `test:all` -- claims a **free port** (never a fixed one) and hands the URL to
  each suite. A fixed port is unsafe: any other dev server already holding it
  would silently receive the suites, reporting results for the wrong
  application.
- `test:all` writes to a **scratch** SQLite file (`data/test-run.sqlite`), so it
  never touches real data. Point it at another engine with `DATABASE_URL`:

```sh
DATABASE_URL=postgres://postgres@127.0.0.1:5432/scratch npm run test:all
DATABASE_URL=mysql://root@127.0.0.1:3306/scratch      npm run test:all
```

- Astro keeps a **persistent dev server per project**. Starting a second one
  silently reuses the first, along with its environment. `test:all` runs
  `astro dev stop` first for this reason. If you see impossible results, run
  `npx astro dev stop` and try again.
