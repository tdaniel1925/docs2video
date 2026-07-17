import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from './supabase/admin'

/** Constant-time string compare (audit L2). Returns false on length mismatch
 *  without leaking timing. Use for any secret/token comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Public API (v1) auth + metered credit pool + rate limiting.
 * Keys are issued by admins; only the SHA-256 hash is stored. Generations
 * bill a SEPARATE api_credit_balances pool, never the user's UI credits.
 */

export interface ApiCaller {
  userId: string
  keyId: string
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Generate a new raw key + its hash + display prefix. Raw is shown once. */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const { randomBytes } = require('crypto') as typeof import('crypto')
  const raw = `d2v_live_${randomBytes(24).toString('hex')}`
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 14) }
}

/**
 * Resolve a Bearer API key to its owner. Returns null on any failure
 * (missing, malformed, unknown, revoked). Updates last_used_at.
 */
export async function authenticateApiKey(request: Request): Promise<ApiCaller | null> {
  const header = request.headers.get('authorization') || ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const raw = m[1].trim()
  if (!raw.startsWith('d2v_live_')) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('api_keys')
    .select('id, user_id, is_active')
    .eq('key_hash', hashApiKey(raw))
    .eq('is_active', true)
    .single()
  if (!data) return null

  // best-effort touch; don't block the request on it
  admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
    .then(() => {}, () => {})

  return { userId: data.user_id, keyId: data.id }
}

// ── Credit pool (UNIFIED) ──────────────────────────────────
// API/MCP usage now spends the user's NORMAL subscription credits — the SAME pool
// the in-app UI uses — so a self-serve key "just works" once the user has credits.
// (The old separate `api_credit_balances` pool is bypassed; these three functions
// are the single seam every v1 route already routes through, so pointing them at
// credits.ts flips the whole API to one pool at once.) Dynamic import keeps the
// module graph acyclic.

export async function getApiBalance(userId: string): Promise<number> {
  const { getBalance } = await import('./credits')
  const b = await getBalance(userId)
  return b.total
}

/** Debit the shared subscription pool; only succeeds if it covers `amount`. */
export async function chargeApiCredits(userId: string, amount: number): Promise<boolean> {
  const { deductCredits } = await import('./credits')
  return deductCredits(userId, amount, 'api', undefined, 'API/MCP usage')
}

/** Refund a previously charged amount (e.g. generation failed to start) back to
 *  the shared pool. Unique idempotency key per call so repeat refunds aren't
 *  swallowed (each API charge is independently refundable). */
export async function refundApiCredits(userId: string, amount: number): Promise<void> {
  if (!amount || amount <= 0) return
  const { addTopupCredits } = await import('./credits')
  const { randomUUID } = await import('crypto')
  try {
    await addTopupCredits(userId, amount, 'api-refund', { action: 'api_refund', idempotencyKey: `api-refund:${userId}:${randomUUID()}` })
  } catch (e) {
    console.error(`[api-auth] refundApiCredits error for ${userId}:`, e instanceof Error ? e.message : e)
  }
}

/** Admin top-up — now adds to the shared subscription pool. */
export async function addApiCredits(userId: string, amount: number): Promise<void> {
  if (!amount || amount <= 0) return
  const { addTopupCredits } = await import('./credits')
  const { randomUUID } = await import('crypto')
  await addTopupCredits(userId, amount, 'api-grant', { action: 'admin_grant', idempotencyKey: `api-grant:${userId}:${randomUUID()}` })
}

// ── DB-backed rate limit (in-memory limiter resets per instance) ──
// Default: 60 generation requests per key per hour.
export async function checkApiRateLimit(keyId: string, limit = 60, windowMs = 3600_000): Promise<boolean> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - windowMs).toISOString()
  const { count } = await admin
    .from('api_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', keyId)
    .gte('created_at', since)
  return (count ?? 0) < limit
}

/**
 * Resolve the acting user for a route that may be called either by a logged-in
 * browser session OR server-to-server by the /api/v1 layer with a trusted
 * internal-service header. Returns { userId, isInternal } or null if neither.
 *
 * `getSessionUser` is the route's existing session lookup (so we don't import
 * the server supabase client here and create a cycle).
 */
export async function resolveRequestUser(
  request: Request,
  getSessionUser: () => Promise<{ id: string; email?: string } | null>,
): Promise<{ userId: string; email?: string; isInternal: boolean } | null> {
  const internalSecret = (process.env.INTERNAL_API_SECRET || '').trim()
  const reqSecret = (request.headers.get('x-internal-service') || '').trim()
  const internalUserId = request.headers.get('x-internal-user-id') || ''
  if (internalSecret && safeEqual(reqSecret, internalSecret) && internalUserId) {
    return { userId: internalUserId, isInternal: true }
  }
  const u = await getSessionUser()
  if (!u) return null
  return { userId: u.id, email: u.email, isInternal: false }
}

export async function logApiUsage(entry: {
  apiKeyId: string
  userId: string
  endpoint: string
  videoId?: string | null
  creditsCharged?: number
  status?: string
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from('api_usage_log').insert({
    api_key_id: entry.apiKeyId,
    user_id: entry.userId,
    endpoint: entry.endpoint,
    video_id: entry.videoId ?? null,
    credits_charged: entry.creditsCharged ?? 0,
    status: entry.status ?? 'ok',
  })
}
