const DB_NAME = 'simple-post-information-organizer-secure'
const STORE_NAME = 'crypto'
const KEY_ID = 'connection-token-key'

interface StoredCipherText {
  ciphertext: string
  iv: string
}

export async function encryptForStorage(value: string): Promise<StoredCipherText> {
  const cryptoKey = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(value)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext)

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  }
}

export async function decryptFromStorage(payload: StoredCipherText): Promise<string | undefined> {
  try {
    const cryptoKey = await getOrCreateKey()
    const iv = toArrayBuffer(base64ToBytes(payload.iv))
    const ciphertext = toArrayBuffer(base64ToBytes(payload.ciphertext))
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch {
    return undefined
  }
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const db = await openDb()
  const existing = await readKey(db)
  if (existing) return existing

  const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
  await writeKey(db, created)
  return created
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readKey(db: IDBDatabase): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(KEY_ID)
    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? undefined)
    request.onerror = () => reject(request.error)
  })
}

function writeKey(db: IDBDatabase, value: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, KEY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
