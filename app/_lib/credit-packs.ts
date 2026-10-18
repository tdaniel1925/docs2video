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
// Imports nothing, so client and server components can both use it.
// =============================================================================

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

export const CREDIT_PACKS: readonly CreditPack[] = [
  { key: 'starter', name: 'Small', credits: 2500, priceCents: 1000, bestValue: false },
  { key: 'power', name: 'Power', credits: 7500, priceCents: 2500, bestValue: true },
  { key: 'studio', name: 'Studio', credits: 18000, priceCents: 5000, bestValue: false },
]

/** "$10" — whole dollars, the way every pack is priced. */
export function packPrice(pack: CreditPack): string {
  return `$${Math.round(pack.priceCents / 100)}`
}

/** The cheapest pack, for "top up from $10" lines. */
export const SMALLEST_PACK: CreditPack = CREDIT_PACKS.reduce((a, b) => (b.priceCents < a.priceCents ? b : a))

/** "2,500 credits for $10, 7,500 for $25, or 18,000 for $50" */
export function packsSentence(): string {
  const parts = CREDIT_PACKS.map((p, i) =>
    `${p.credits.toLocaleString('en-US')}${i === 0 ? ' credits' : ''} for ${packPrice(p)}`)
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')}, or ${parts[parts.length - 1]}`
    : parts.join('')
}
