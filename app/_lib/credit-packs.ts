// =============================================================================
// TOP-UP CREDIT PACKS — what each is called, how many credits, what it costs.
//
// These were typed by hand in four places (the top-up window, Settings, the
// pricing page, the help articles), and the $10 pack was called "Starter" —
// the same name as the retired $29 Starter plan, so "I bought Starter" could
// mean either. Every screen now reads this list.
//
// `key` is what app/api/credits/buy/route.ts and Stripe know each pack by and
// must not change: the $10 pack keeps the key 'starter' even though customers
// now read "Small". A test checks the credits here match that route's list.
//
// WITH THE MINUTES PRICING ON (plan-pricing.ts) EVERY PACK IS $5 A VIDEO MINUTE: 1,250 credits
// is one minute, so $10 = 2 minutes, $25 = 5, $50 = 10. The old bigger packs
// (7,500 for $25, 18,000 for $50) sold a minute for as little as $3.47, under
// what a minute-heavy explainer can cost to keep half. The Stripe prices
// ($10 / $25 / $50) do not change — only the credits each one grants.
//
// Imports only plan-pricing (pure), so client and server components can both use it.
// =============================================================================

import { minutesPricingOn } from './plan-pricing'

export type CreditPackKey = 'starter' | 'power' | 'studio'

export type CreditPack = {
  key: CreditPackKey
  /** What the customer reads. */
  name: string
  credits: number
  priceCents: number
  /** The one pack the top-up window points people to. */
  bestValue: boolean
}

/* The credits each pack grants: before the switch as they always were, after it $5 a minute. Prices never change. */
export const PACK_CREDITS: Record<CreditPackKey, number> = minutesPricingOn()
  ? { starter: 2500, power: 6250, studio: 12500 }
  : { starter: 2500, power: 7500, studio: 18000 }

export const CREDIT_PACKS: readonly CreditPack[] = [
  { key: 'starter', name: 'Small', credits: PACK_CREDITS.starter, priceCents: 1000, bestValue: false },
  { key: 'power', name: 'Power', credits: PACK_CREDITS.power, priceCents: 2500, bestValue: true },
  { key: 'studio', name: 'Studio', credits: PACK_CREDITS.studio, priceCents: 5000, bestValue: false },
]

/** "$10" — whole dollars, the way every pack is priced. */
export function packPrice(pack: CreditPack): string {
  return `$${Math.round(pack.priceCents / 100)}`
}

/** The cheapest pack, for "top up from $10" lines. */
export const SMALLEST_PACK: CreditPack = CREDIT_PACKS.reduce((a, b) => (b.priceCents < a.priceCents ? b : a))

/** "2,500 credits for $10, 6,250 for $25, or 12,500 for $50" */
export function packsSentence(): string {
  const parts = CREDIT_PACKS.map((p, i) =>
    `${p.credits.toLocaleString('en-US')}${i === 0 ? ' credits' : ''} for ${packPrice(p)}`)
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')}, or ${parts[parts.length - 1]}`
    : parts.join('')
}
