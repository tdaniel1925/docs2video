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
  personal: process.env.STRIPE_PRICE_PERSONAL!,
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
  business: process.env.STRIPE_PRICE_BUSINESS!,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE!,
}

/* ── Per-project price IDs from env ── */
export const PROJECT_PRICE_IDS = {
  project: process.env.STRIPE_PRICE_PROJECT!,
  project_pro: process.env.STRIPE_PRICE_PROJECT_PRO!,
  course: process.env.STRIPE_PRICE_COURSE!,
  course_pro: process.env.STRIPE_PRICE_COURSE_PRO!,
  course_biz: process.env.STRIPE_PRICE_COURSE_BIZ!,
}

/**
 * Given a Stripe price ID, return the matching subscription tier.
 */
export function tierFromPriceId(priceId: string): PlanTier {
  for (const [tier, id] of Object.entries(SUBSCRIPTION_PRICES)) {
    if (id === priceId) return tier as PlanTier
  }
  return 'free'
}
