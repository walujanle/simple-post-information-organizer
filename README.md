# simple-post-information-organizer

Astro 7 (SSR) + Vue 3 + Tailwind 4 app that organizes post information into
presets (sections + body blocks), with encrypted local storage and an optional
DB-backed cloud store + auth.

## Project status: complete and archived

This project is finished and **no longer actively developed**. It is archived in
a working, fully tested state rather than abandoned mid-flight:

- Lint, type-check, 42 unit tests and the API + cache suites all pass, verified
  against SQLite, PostgreSQL and MySQL.
- No known vulnerabilities in the dependency tree at the time of archiving.
- [MAINTENANCE.md](docs/MAINTENANCE.md) is a revival runbook — how to get it
  building again after a long pause, which versions are pinned and why, and
  which limitations are deliberate so they are not "fixed" by mistake.

**No security updates will be issued.** If you intend to run this, review the
dependencies yourself first (`npm audit`) and read
[SECURITY.md](docs/SECURITY.md) — in particular, there is no registration guard,
so do not expose an instance publicly without putting your own control in front
of it.

MIT licensed: forking and continuing the work is welcome.

## Documentation

| Document | Contents |
|----------|---------|
| [architecture.md](docs/architecture.md) | System layout, data flow, domain model, design decisions |
| [API.md](docs/API.md) | Full API reference with request/response shapes |
| [SECURITY.md](docs/SECURITY.md) | Auth, CSP, XSS mitigation, threat model |
| [MAINTENANCE.md](docs/MAINTENANCE.md) | Revival runbook, dependency policy, deliberate limitations |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Setup, env vars, deployment guides |

## Requirements

| Tool | Version | Role |
| ---- | ------- | ---- |
| Node.js | >= 24.18.0 | Server runtime (required in all cases) |
| npm | >= 11 (ships with Node) | Package manager / task runner |
| Bun | >= 1.3.14 | Optional alternative package manager / task runner |

Either npm or Bun can drive the project — no script depends on a specific
package manager. Astro itself always runs under Node, even when launched with
`bun run`.

## Quick Start

```sh
npm install
cp .env.example .env
# Edit .env: set SESSION_SECRET (min 32 chars)
npm run dev
```

Or with Bun:

```sh
bun install
cp .env.example .env
bun run dev
```

Open http://localhost:4321

## Scripts

Run with `npm run <script>` or `bun run <script>`.

| Script | Action |
| ------ | ------ |
| `dev` | Start dev server (Node + SQLite) |
| `verify` | Biome check (writes fixes) + TypeScript check + unit tests |
| `build` | Verify + production build (Node, or Vercel when `VERCEL=1`) |
| `build:vercel` | Verify + force a Vercel build locally |
| `preview` | Preview production build |
| `check` | TypeScript check |
| `lint` | Biome lint |
| `format` | Biome format (writes) |
| `ci` | Biome CI check (read-only) |
| `test:unit` | Render-engine unit tests (42 assertions, no server needed) |
| `test:api` | Run 30-assertion API test suite against a running server |
| `test:cache` | Run cache test suite against a running server |
| `test:all` | Run unit tests, then boot a server on a free port and run the cache + API suites |

## Runtime

Two deployment targets. The adapter is chosen automatically:

| Target | Selected by | Output |
| ------ | ----------- | ------ |
| Node standalone (default) | default | `dist/server/entry.mjs` |
| Vercel | `VERCEL=1` (set by Vercel) or `ASTRO_ADAPTER=vercel` | `.vercel/output/` |

On Vercel the filesystem is read-only, so `DATABASE_URL` (Postgres or MySQL) is
**required** — SQLite cannot be used there. See
[DEPLOYMENT.md](docs/DEPLOYMENT.md).

DB driver auto-detected from environment:

| Driver | Trigger |
| ------ | ------- |
| SQLite (default) | no extra config |
| Postgres | `DATABASE_URL=postgres://...` |
| MySQL | `DATABASE_URL=mysql://...` |

## License

MIT. See [LICENSE](LICENSE).
