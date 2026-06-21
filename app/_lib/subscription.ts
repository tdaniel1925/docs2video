/**
 * Single source of truth for which subscription_status values count as paid.
 * Several routes used to keep their own copies of this list and drifted —
 * 'agency' was missing from generate-video's copy, locking agency users out.
 */
export const PAID_STATUSES = [
  'active',
  'starter',
  'pro',
  'professional',
  'business',
  'agency',
  'enterprise',
  'enterprise-plus',
  'enterprise_plus',
]

export function isPaidTier(status?: string | null): boolean {
  return PAID_STATUSES.includes((status ?? '').toLowerCase())
}

/**
 * Per-plan concurrent-generation cap (audit L1/M1). Single source of truth so
 * every entry path (legacy /api/videos AND the live generate-video path) agrees,
 * and so agency / enterprise-plus aren't silently capped at the free limit.
 */
export function maxConcurrentForTier(status?: string | null, opts?: { isAdmin?: boolean; isBeta?: boolean }): number {
  if (opts?.isAdmin || opts?.isBeta) return 99
  const s = (status ?? '').toLowerCase()
  if (['enterprise', 'enterprise-plus', 'enterprise_plus'].includes(s)) return 5
  if (s === 'agency') return 4
  if (s === 'business') return 3
  if (['pro', 'professional', 'starter', 'active'].includes(s)) return 2
  return 1 // free / unknown
}
