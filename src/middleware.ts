import type { APIContext } from 'astro'
import { getEnvValue } from '@/backend/runtime'
import { REQUEST_TIMEOUT_MS } from '@/config/constants'

const HSTS = 'max-age=31536000; includeSubDomains'
const STATIC_ASSET_PATTERN = /^\/_astro\//

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[\s,]+/)
    .map((o) => o.trim().replace(/[\r\n;]/g, ''))
    .filter(Boolean)
}

export async function onRequest(
  context: APIContext,
  next: () => Promise<Response>,
): Promise<Response> {
  const nonce = crypto.randomUUID()

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(new Error('Request timed out')),
    REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await Promise.race([
      next(),
      new Promise<Response>((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => {
            reject(new Error('Request timed out'))
          },
          { once: true },
        )
      }),
    ])

    const extraScriptOrigins = parseOrigins(await getEnvValue(context, 'CSP_SCRIPT_ORIGINS'))
    const extraConnectOrigins = parseOrigins(await getEnvValue(context, 'CSP_CONNECT_ORIGINS'))

    const csp = [
      "default-src 'self'",
      `script-src ${[`'self'`, `'nonce-${nonce}'`, ...extraScriptOrigins].join(' ')}`,
      // style-src uses 'unsafe-inline' because Vue and UI libraries apply styles
      // directly via element.style at runtime. Nonces only cover <style> blocks,
      // not inline style attributes, so 'unsafe-inline' is required here.
      // Do not replace with a nonce — it will not prevent the CSP violation.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      `connect-src ${[`'self'`, ...extraConnectOrigins].join(' ')}`,
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')

    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('Strict-Transport-Security', HSTS)
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

    if (STATIC_ASSET_PATTERN.test(context.url.pathname)) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    }

    const contentType = response.headers.get('content-type') ?? ''
    const contentEncoding = response.headers.get('content-encoding')
    if (contentType.includes('text/html') && !contentEncoding) {
      const html = await response.text()
      const modified = html.replace(/<script\b/gi, `<script nonce="${nonce}"`)
      const headers = new Headers(response.headers)
      headers.delete('content-length')
      return new Response(modified, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }

    return response
  } finally {
    clearTimeout(timeoutId)
  }
}
