import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectDir = dirname(scriptDir)

// The suites register accounts and write presets, so they run against a scratch
// SQLite file and a raised account cap rather than whatever the developer has
// configured. Set DATABASE_URL to point the same suites at Postgres or MySQL.
const SCRATCH_DB = './data/test-run.sqlite'
const testEnv = {
  ...process.env,
  REGISTRATION_ENABLED: 'true',
  MAX_ACCOUNTS: process.env.MAX_ACCOUNTS ?? '1000',
  PIO_SQLITE_PATH: process.env.PIO_SQLITE_PATH ?? SCRATCH_DB,
}

function resetScratchDb() {
  if (process.env.DATABASE_URL) return
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(join(projectDir, `${SCRATCH_DB}${suffix}`), { force: true })
  }
}

// Resolve the locally installed Astro CLI instead of shelling out to a package
// manager, so this runner behaves identically under Node and Bun.
const astroBin = join(dirname(require.resolve('astro/package.json')), 'bin', 'astro.mjs')

// Whichever runtime is executing this file (node or bun) also runs the children.
const runtime = process.execPath

function run(args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(runtime, args, {
      cwd: projectDir,
      stdio: 'inherit',
      env: testEnv,
      ...opts,
    })
    child.on('close', (code) => resolve(code ?? 1))
  })
}

async function main() {
  console.log('[test-runner] Running unit tests...')
  const unitCode = await run(['--test', join(scriptDir, 'test-render.mjs')])
  if (unitCode !== 0) {
    console.error('[test-runner] Unit tests failed; skipping integration suites.')
    process.exit(unitCode)
  }

  // Astro keeps a persistent dev server per project and will silently reuse a
  // stale one -- which would run the suites against the previous environment
  // and report false passes. Always stop it first.
  console.log('[test-runner] Stopping any stale dev server...')
  await run([astroBin, 'dev', 'stop'], { stdio: 'ignore' })

  resetScratchDb()

  // A fixed port is unsafe: any other dev server already holding it would
  // silently receive the suites, reporting results for the wrong application.
  // Claim a free port and hand its URL to every suite.
  const port = await findFreePort()
  // Astro binds the IPv6 loopback, so address it by name rather than 127.0.0.1.
  const base = `http://localhost:${port}`

  console.log(`[test-runner] Starting Astro dev server on ${base} ...`)
  const server = spawn(runtime, [astroBin, 'dev', '--port', String(port)], {
    cwd: projectDir,
    stdio: 'pipe',
    env: testEnv,
  })

  let serverLog = ''
  server.stdout.on('data', (d) => {
    const text = d.toString()
    serverLog += text
    console.log('[astro]', text.trim())
  })
  server.stderr.on('data', (d) => {
    serverLog += d.toString()
    console.error('[astro-err]', d.toString().trim())
  })

  const shutdown = () => server.kill()
  process.on('SIGINT', () => {
    shutdown()
    process.exit(1)
  })
  process.on('exit', shutdown)

  if (!(await waitForReady(base))) {
    console.error('[test-runner] Server never became ready.')
    if (serverLog.includes('already running')) {
      console.error('[test-runner] A stale dev server for this project is still up.')
    }
    shutdown()
    process.exit(1)
  }

  console.log('[test-runner] Server is ready! Running cache tests...')
  const cacheCode = await run([join(scriptDir, 'test-cache.mjs'), base])
  console.log(`[test-runner] Cache tests completed with exit code: ${cacheCode}`)

  console.log('[test-runner] Running standard API tests...')
  const apiCode = await run([join(scriptDir, 'test-api.mjs'), base])
  console.log(`[test-runner] API tests completed with exit code: ${apiCode}`)

  console.log('[test-runner] Shutting down Astro dev server...')
  shutdown()
  process.exit(cacheCode || apiCode)
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function waitForReady(base) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

main()
