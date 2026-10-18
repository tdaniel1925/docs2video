import { TIER_CREDITS } from '../../_lib/credits'
import type { PlanTier } from '../../_lib/pricing'

/** What GET /api/billing/summary answers (read only). */
export type BillingSummary = {
  monthly: number
  topup: number
  total: number
  cycleUsed: number
  cycleGranted: number
  cycleStart: string | null
  renewsAt: string | null
  cancelsAtPeriodEnd: boolean
}

/**
 * The credits card's bar: this period's monthly credits left against what the
 * plan gives each month (TIER_CREDITS — or what was really granted this
 * period, if that's more, e.g. a grandfathered or comped account). Pack
 * credits are said in words beside it, not in the bar.
 */
export function creditBar(summary: BillingSummary | null, tier: PlanTier): { left: number; of: number; pct: number } {
  const of = Math.max(TIER_CREDITS[tier], summary?.cycleGranted ?? 0, 1)
  const left = Math.max(0, summary?.monthly ?? 0)
  const pct = Math.max(0, Math.min(100, Math.round((left / of) * 100)))
  return { left, of, pct }
}
