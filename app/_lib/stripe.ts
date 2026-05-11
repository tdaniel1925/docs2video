import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia',
    })
  }
  return _stripe
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver)
  },
})

export const PLANS = {
  free: { name: 'Demo', priceId: null, credits: 3, price: 0, brands: 1, features: ['basic'] },
  starter: { name: 'Starter', priceId: process.env.STRIPE_STARTER_PRICE_ID!, credits: 30, price: 4900, brands: 2, features: ['basic', 'custom_templates'] },
  professional: { name: 'Professional', priceId: process.env.STRIPE_PRO_PRICE_ID!, credits: 75, price: 9900, brands: -1, features: ['basic', 'custom_templates', 'proposals', 'quotes', 'payments', 'followups', 'calendar'] },
  agency: { name: 'Agency', priceId: process.env.STRIPE_AGENCY_PRICE_ID!, credits: 200, price: 24900, brands: -1, features: ['basic', 'custom_templates', 'proposals', 'quotes', 'payments', 'followups', 'calendar', 'whitelabel', 'api', 'team'] },
} as const

export type PlanId = keyof typeof PLANS

export const PACKS = [
  { id: 'single', name: '1 Credit', count: 1, price: 500 },     // $5 in cents
  { id: 'pack5', name: '5-Pack', count: 5, price: 1900 },       // $19
  { id: 'pack10', name: '10-Pack', count: 10, price: 3500 },     // $35
  { id: 'pack25', name: '25-Pack', count: 25, price: 7900 },     // $79
] as const

export function getPlanFeatures(subscriptionStatus: string): readonly string[] {
  const plan = Object.values(PLANS).find(p => p.name.toLowerCase() === subscriptionStatus.toLowerCase())
  return plan?.features ?? PLANS.free.features
}

export function hasFeature(subscriptionStatus: string, feature: string): boolean {
  return getPlanFeatures(subscriptionStatus).includes(feature)
}
