export const SESSION_COOKIE = '__session'
export const SESSION_TTL = 60 * 60 * 24 * 7 // 7 days in seconds

function encodeB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
  let str = ''
  bytes.forEach((b) => { str += String.fromCharCode(b) })
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeB64(str: string): ArrayBuffer {
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  )
}

export async function makeSessionToken(secret: string): Promise<string> {
  const payload = encodeB64(new TextEncoder().encode(JSON.stringify({ exp: Date.now() + SESSION_TTL * 1000 })))
  const key = await hmacKey(secret, 'sign')
  const sig = encodeB64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
  return `${payload}.${sig}`
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  try {
    const dot = token.lastIndexOf('.')
    if (dot < 0) return false
    const payload = token.slice(0, dot)
    const sig = decodeB64(token.slice(dot + 1))
    const key = await hmacKey(secret, 'verify')
    const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload))
    if (!ok) return false
    const { exp } = JSON.parse(new TextDecoder().decode(decodeB64(payload)))
    return Date.now() < exp
  } catch {
    return false
  }
}
