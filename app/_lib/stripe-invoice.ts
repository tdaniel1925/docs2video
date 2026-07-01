/**
 * Cross-API-version accessors for Stripe invoice/subscription shapes, plus the
 * social-add-on guard. Kept in _lib (not the route file) so they're unit-testable
 * — these tiny predicates gate real money decisions in the Stripe webhook:
 * the $50 AI-Social add-on is a SEPARATE Stripe subscription whose events must
 * NEVER touch the user's main plan (review B3: the add-on's price id isn't in
 * SUBSCRIPTION_PRICES, so the webhook's `?? 'pro'` tier fallback silently
 * upgraded a free user to Pro with a full credit grant, and a failed $50 add-on
 * invoice flipped the whole account past_due).
 */

/** The invoice's subscription id — `invoice.subscription` on older API
 *  versions, `invoice.parent.subscription_details.subscription` on newer. */
export function subscriptionIdFromInvoice(invoice: unknown): string | null {
  const inv = invoice as any
  const raw = inv?.subscription ?? inv?.parent?.subscription_details?.subscription ?? null
  if (typeof raw === 'string') return raw
  return raw?.id ?? null
}

/** The first line item's price id — `line.price.id` on older API versions,
 *  `line.pricing.price_details.price` on newer. */
export function priceIdFromInvoice(invoice: unknown): string | null {
  const inv = invoice as any
  for (const line of inv?.lines?.data ?? []) {
    const id = line?.price?.id ?? line?.pricing?.price_details?.price ?? null
    if (typeof id === 'string' && id) return id
  }
  return null
}

/** True when a subscription object is the AI-Social add-on (metadata.type set
 *  at checkout in app/api/social-addon/checkout). */
export function isSocialAddonSubscription(
  sub: { metadata?: Record<string, string> | null } | null | undefined,
): boolean {
  return sub?.metadata?.type === 'social_addon'
}
