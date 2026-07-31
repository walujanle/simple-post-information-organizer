const BASE = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '')
// Label only. /api/health deliberately withholds dbDriver (docs/SECURITY.md).
const DRIVER_LABEL = process.argv[3] || null

const results = []
let cookie = ''
let pass = 0
let fail = 0

function check(name, cond, detail = '') {
  if (cond) {
    pass++
    results.push(`  PASS  ${name}`)
  } else {
    fail++
    results.push(`  FAIL  ${name}${detail ? ` :: ${detail}` : ''}`)
  }
}

async function req(path, opts = {}) {
  const headers = { 'content-type': 'application/json', ...(opts.headers || {}) }
  if (cookie) headers.cookie = cookie
  const res = await fetch(BASE + path, { ...opts, headers })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  let body = null
  const text = await res.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: res.status, body }
}

const stamp = Date.now().toString(36)
const username = `tester_${stamp}`
const password = 'passw0rd!'
const presetId = `preset_${stamp}`

async function main() {
  results.push(`Target: ${BASE}${DRIVER_LABEL ? ` (driver=${DRIVER_LABEL})` : ''}`)

  let r = await req('/api/health')
  check('GET /api/health -> 200', r.status === 200, `got ${r.status}`)
  check('health status ok', r.body?.status === 'ok', JSON.stringify(r.body))

  r = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  check(
    'POST /api/auth/register -> ok',
    r.status === 200 && r.body?.status === 'ok',
    `${r.status} ${JSON.stringify(r.body)}`,
  )

  r = await req('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  check('duplicate register -> 400', r.status === 400, `got ${r.status}`)

  r = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password: 'wrongpass' }),
  })
  check('login wrong password -> 401', r.status === 401, `got ${r.status}`)

  r = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  check(
    'login success -> 200',
    r.status === 200 && r.body?.status === 'ok',
    `${r.status} ${JSON.stringify(r.body)}`,
  )
  check('login sets session cookie', !!cookie, 'no cookie')

  r = await req('/api/auth/session')
  check(
    'GET /api/auth/session authenticated',
    r.status === 200 && r.body?.isAuthenticated === true,
    JSON.stringify(r.body),
  )

  const savedCookie = cookie
  cookie = ''
  r = await req('/api/presets')
  check('GET /api/presets no-auth -> 401', r.status === 401, `got ${r.status}`)
  cookie = savedCookie

  r = await req('/api/presets', { method: 'POST', body: JSON.stringify({ sections: 'not-array' }) })
  check('create invalid preset -> 400', r.status === 400, `got ${r.status}`)

  const preset = {
    id: presetId,
    name: 'Test Preset',
    sections: [{ key: 'title', value: 'Hello', sort: 0 }],
    bodyBlocks: [{ label: 'Body', contentMd: '# Hi', sort: 0 }],
  }
  r = await req('/api/presets', { method: 'POST', body: JSON.stringify(preset) })
  check('POST /api/presets -> 201', r.status === 201, `${r.status} ${JSON.stringify(r.body)}`)
  check('created preset has id', r.body?.id === presetId, JSON.stringify(r.body))

  r = await req('/api/presets')
  check('GET /api/presets -> 200', r.status === 200, `got ${r.status}`)
  check(
    'list contains created preset',
    Array.isArray(r.body) && r.body.some((p) => p.id === presetId),
    JSON.stringify(r.body),
  )

  r = await req(`/api/presets/${presetId}`)
  check('GET /api/presets/:id -> 200', r.status === 200, `got ${r.status}`)
  check('preset name matches', r.body?.name === 'Test Preset', JSON.stringify(r.body))

  r = await req('/api/presets/does-not-exist')
  check('GET missing preset -> 404', r.status === 404, `got ${r.status}`)

  r = await req(`/api/presets/${presetId}`, {
    method: 'PUT',
    body: JSON.stringify({ ...preset, name: 'Updated Preset' }),
  })
  check('PUT /api/presets/:id -> 200', r.status === 200, `${r.status} ${JSON.stringify(r.body)}`)
  check('update reflected', r.body?.name === 'Updated Preset', JSON.stringify(r.body))

  r = await req('/api/export')
  check('GET /api/export -> 200', r.status === 200, `got ${r.status}`)
  check(
    'export bundle has presets',
    Array.isArray(r.body?.presets) && r.body.presets.length > 0,
    JSON.stringify(r.body),
  )

  const importBundle = {
    pioExportVersion: 1,
    source: 'cloud',
    exportedAt: new Date().toISOString(),
    presets: [
      {
        id: `imp_${stamp}`,
        name: 'Imported',
        sections: [],
        bodyBlocks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  }
  r = await req('/api/import?mode=merge', { method: 'POST', body: JSON.stringify(importBundle) })
  check(
    'POST /api/import merge -> 200',
    r.status === 200 && typeof r.body?.created === 'number',
    `${r.status} ${JSON.stringify(r.body)}`,
  )
  check('import merge created=1', r.body?.created === 1, JSON.stringify(r.body))

  r = await req('/api/import?mode=replace', { method: 'POST', body: JSON.stringify(importBundle) })
  check(
    'POST /api/import replace -> 200',
    r.status === 200,
    `${r.status} ${JSON.stringify(r.body)}`,
  )

  r = await req('/api/presets')
  check(
    'replace removed old preset',
    Array.isArray(r.body) && !r.body.some((p) => p.id === presetId),
    JSON.stringify(r.body),
  )
  check(
    'replace kept imported preset',
    Array.isArray(r.body) && r.body.some((p) => p.id === `imp_${stamp}`),
    JSON.stringify(r.body),
  )

  r = await req('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: password, newPassword: 'newpass123' }),
  })
  check(
    'change-password -> ok',
    r.status === 200 && r.body?.status === 'ok',
    `${r.status} ${JSON.stringify(r.body)}`,
  )

  r = await req('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'newpass123' }),
  })
  check('change-password wrong current -> 400', r.status === 400, `got ${r.status}`)

  r = await req('/api/auth/logout', { method: 'POST' })
  check('POST /api/auth/logout -> 200', r.status === 200, `got ${r.status}`)
  cookie = ''

  r = await req('/api/auth/session')
  check(
    'session after logout not authenticated',
    r.body?.isAuthenticated === false,
    JSON.stringify(r.body),
  )

  console.log(results.join('\n'))
  console.log(`\n${DRIVER_LABEL ? `[${DRIVER_LABEL}] ` : ''}Pass: ${pass}  Fail: ${fail}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(2)
})
