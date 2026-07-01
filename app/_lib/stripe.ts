import Stripe from 'stripe'
import type { PlanTier } from './pricing'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver)
  },
})

/* ── Subscription price IDs from env ── */
export const SUBSCRIPTION_PRICES: Record<Exclude<PlanTier, 'free'>, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
  business: process.env.STRIPE_PRICE_BUSINESS!,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE!,
}

/* ── Per-video price IDs from env ── */
export const VIDEO_PRICE_IDS = {
  free: process.env.STRIPE_PRICE_VIDEO_FREE!,
  member: process.env.STRIPE_PRICE_VIDEO_MEMBER!,
}

/**
 * Drain a Stripe list endpoint past the 100-item page cap (review P3): the
 * admin billing/revenue/stats reports called `.list({ limit: 100 })` once, so
 * MRR and revenue silently under-reported as soon as there were >100
 * subscriptions/charges. Bounded at maxPages as a runaway guard.
 */
export async function listAllStripe<T extends { id: string }>(
  list: (params: Record<string, unknown>) => Promise<{ data: T[]; has_more: boolean }>,
  params: Record<string, unknown> = {},
  maxPages = 20,
): Promise<T[]> {
  const out: T[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const res = await list({ ...params, limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) })
    out.push(...res.data)
    if (!res.has_more || res.data.length === 0) return out
    startingAfter = res.data[res.data.length - 1].id
  }
  console.warn(`[stripe] listAllStripe hit the ${maxPages}-page cap (${out.length} items) — results may be truncated`)
  return out
}

/**
 * Given a Stripe price ID, return the matching subscription tier.
 * Returns null for an UNKNOWN price id (audit M1) rather than silently
 * downgrading a paying customer to 'free' — callers must handle null (log +
 * keep the existing tier) so a misconfigured STRIPE_PRICE_* env can't wipe a
 * subscriber's plan.
 */
export function tierFromPriceId(priceId: string): PlanTier | null {
  for (const [tier, id] of Object.entries(SUBSCRIPTION_PRICES)) {
    if (id && id === priceId) return tier as PlanTier
  }
  console.error(`[stripe] tierFromPriceId: unknown price id ${priceId} — STRIPE_PRICE_* env may be misconfigured`)
  return null
}
