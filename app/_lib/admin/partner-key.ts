/**
 * The Jordyn platform's partner API key ("Jordyn platform (partner billing)").
 * Revoking it stops Jordyn making videos for its customers, so the admin
 * shows an extra warning before it is revoked.
 */
export function isPartnerKey(k: { name?: string | null }): boolean {
  return /jordyn|partner/i.test(k.name || '')
}
