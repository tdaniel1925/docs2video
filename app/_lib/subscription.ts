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
