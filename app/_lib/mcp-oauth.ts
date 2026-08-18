import { createHash, randomBytes } from 'crypto'

// Shared helpers for the MCP OAuth provider. Tokens are stored HASHED (never in
// the clear); the raw value only ever leaves in the token response.

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/** PKCE S256 verify: does this verifier hash to the stored challenge? */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  const computed = createHash('sha256').update(verifier).digest('base64url')
  return computed === challenge
}

export function newToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`
}

export function newCode(): string {
  return randomBytes(24).toString('base64url')
}

export function newClientId(): string {
  return `mcpc_${randomBytes(12).toString('hex')}`
}

export const ACCESS_TTL_SEC = 60 * 60          // 1h access token
export const CODE_TTL_SEC = 5 * 60             // 5min auth code
