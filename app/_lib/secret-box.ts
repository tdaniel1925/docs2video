import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

/**
 * Encrypt secrets we have to keep (SMTP passwords, Gmail/Outlook tokens)
 * before they go into the database. AES-256-GCM with a key from the
 * DATA_ENCRYPTION_KEY env var.
 *
 * Stored format:  enc:v1:<iv b64url>:<tag b64url>:<ciphertext b64url>
 *
 * Backward compatible both ways:
 *  - decryptSecret() passes an old plaintext value straight through, so rows
 *    saved before this change keep working.
 *  - With no DATA_ENCRYPTION_KEY set, encryptSecret() stores plaintext (the old
 *    behavior) and logs a warning once, so nothing breaks before the owner sets
 *    the key. Once set, NEVER change or remove it — rows encrypted with it can
 *    only be read with it.
 *
 * DATA_ENCRYPTION_KEY: any long random string (e.g. `openssl rand -base64 32`).
 * It is hashed to a 32-byte key, so its exact length does not matter.
 */

const PREFIX = 'enc:v1:'
let warned = false

function getKey(): Buffer | null {
  const raw = (process.env.DATA_ENCRYPTION_KEY || '').trim()
  if (!raw) return null
  return createHash('sha256').update(raw, 'utf8').digest()
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null
  if (isEncrypted(value)) return value
  const key = getKey()
  if (!key) {
    if (!warned) {
      warned = true
      console.warn('[secret-box] DATA_ENCRYPTION_KEY is not set — email passwords and tokens are being stored unencrypted.')
    }
    return value
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ct.toString('base64url')}`
}

/**
 * Returns the plaintext. Old unencrypted values come back unchanged. Throws if
 * a value is encrypted but the key is missing or wrong — a send should fail
 * loudly rather than log in with garbage.
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (!isEncrypted(value)) return value
  const key = getKey()
  if (!key) throw new Error('This saved email login is encrypted, but DATA_ENCRYPTION_KEY is not set on the server.')
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(':')
  if (!ivB64 || !tagB64 || ctB64 === undefined) throw new Error('Saved email login is damaged.')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8')
}
