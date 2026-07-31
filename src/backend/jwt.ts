async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  const binString = String.fromCharCode(...bytes)
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binString = atob(base64)
  const bytes = new Uint8Array(binString.length)
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const part1 = base64UrlEncode(JSON.stringify(header))
  const part2 = base64UrlEncode(JSON.stringify(payload))
  const data = new TextEncoder().encode(`${part1}.${part2}`)
  const key = await getCryptoKey(secret)
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data)
  const signatureBytes = new Uint8Array(signatureBuffer)
  let signatureBin = ''
  for (let i = 0; i < signatureBytes.length; i++) {
    signatureBin += String.fromCharCode(signatureBytes[i])
  }
  const part3 = btoa(signatureBin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${part1}.${part2}.${part3}`
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [part1, part2, part3] = parts
  const data = new TextEncoder().encode(`${part1}.${part2}`)
  const key = await getCryptoKey(secret)

  let signatureBin = ''
  try {
    signatureBin = atob(part3.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return null
  }

  const signatureBytes = new Uint8Array(signatureBin.length)
  for (let i = 0; i < signatureBin.length; i++) {
    signatureBytes[i] = signatureBin.charCodeAt(i)
  }

  const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data)
  if (!isValid) return null

  try {
    const payload = JSON.parse(base64UrlDecode(part2))
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
      return null // Expired
    }
    return payload
  } catch {
    return null
  }
}
