let dotEnvLoaded = false

async function ensureDotEnv(): Promise<void> {
  if (dotEnvLoaded) return
  dotEnvLoaded = true
  try {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {}
}

export async function getEnvValue(_context: unknown, key: string): Promise<string | undefined> {
  if (!process.env[key]) await ensureDotEnv()
  return process.env[key]
}
