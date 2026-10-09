/**
 * ONE MONEY CALCULATION for the admin — Dashboard, Billing and Revenue all
 * read the numbers from here, so they can never disagree again.
 *
 * Pure (no Stripe, no database): the server part (money-server.ts) turns
 * Stripe subscriptions into `MoneySub`s; this file sorts and adds them up.
 *
 * Rules (owner request, audit 2026-10-09):
 *  - Paying, trialing, past-due and paused are counted SEPARATELY.
 *  - Monthly recurring revenue (MRR) counts PAYING Docs2Video subscriptions
 *    only — a free trial or an unpaid bill is not revenue yet.
 *  - The Stripe account is SHARED with other products (Jordyn, Apex, VidWiz,
 *    PubcoZone). Their subscriptions are shown under "Other products on this
 *    Stripe account", never added to Docs2Video's MRR. (Those were the
 *    "Unknown" $129 / $149 / $150 rows.)
 *  - Conversion = paying customers ÷ real sign-ups; banned, test and admin
 *    accounts are left out of both sides.
 */

export type ProductKind = 'docs2video' | 'addon' | 'other'
export type SubBucket = 'paying' | 'trialing' | 'past_due' | 'paused' | 'incomplete'

export interface PriceInfo {
  /** The name to show, e.g. "Pro", "AI Social add-on", "Jordyn Pro ($129)". */
  name: string
  kind: ProductKind
}

/**
 * Prices on the shared Stripe account that are NOT Docs2Video plans, named so
 * the admin never shows "Unknown". Read from live Stripe (read-only) on
 * 2026-10-09. The server also asks Stripe for product names at run time, so a
 * new price shows its real product name even if it's not listed here.
 */
export const KNOWN_OTHER_PRICES: Record<string, string> = {
  price_1TwT0SFnyKCNDapHIvO3ymPU: 'Jordyn Pro ($129)',
  price_1TtyeKFnyKCNDapHBULC2Fuh: 'Jordyn Pro ($149)',
  price_1TtLgeFnyKCNDapHJ8Z4pdf6: 'Jordyn Pro ($119)',
  price_1Tr0FJFnyKCNDapHvVFcdpnv: 'Apex API calls ($150)',
  price_1Tmgz2FnyKCNDapHXwgCEpef: 'Auto Social ($149)',
  price_1U2EJ6FnyKCNDapHQ8SsLrOF: 'Jordyn Unlimited ($449)',
}

/** Names by monthly amount, for a price we know nothing else about. */
const LEGACY_BY_AMOUNT: Record<number, string> = {
  12900: 'Older $129 plan',
  14900: 'Older $149 plan',
  15000: 'Older $150 plan',
}

const TIER_NAMES: Record<string, string> = { starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise', personal: 'Personal' }

export function describePrice(
  priceId: string | null | undefined,
  monthlyCents: number,
  ctx: {
    /** Docs2Video plan price ids from env: { starter: 'price_…', … } */
    tierPrices: Record<string, string | undefined>
    addonPriceId?: string | null
    /** Stripe product name per price id, when the server could read it. */
    productNames?: Map<string, string> | Record<string, string>
  },
): PriceInfo {
  const id = priceId || ''
  for (const [tier, pid] of Object.entries(ctx.tierPrices)) {
    if (pid && pid === id) return { name: TIER_NAMES[tier] ?? tier, kind: 'docs2video' }
  }
  if (id && ctx.addonPriceId && id === ctx.addonPriceId) return { name: 'AI Social add-on', kind: 'addon' }
  if (KNOWN_OTHER_PRICES[id]) return { name: KNOWN_OTHER_PRICES[id], kind: 'other' }
  const names = ctx.productNames
  const product = names instanceof Map ? names.get(id) : names?.[id]
  if (product) {
    // A Docs2Video-named product we don't have in env (an older price).
    if (/docs2video/i.test(product)) return { name: `${product.replace(/^docs2video\s*/i, '') || 'Docs2Video'} (older price)`, kind: 'docs2video' }
    if (/ai social/i.test(product)) return { name: 'AI Social add-on (older price)', kind: 'addon' }
    return { name: `${product} ($${Math.round(monthlyCents / 100)})`, kind: 'other' }
  }
  if (LEGACY_BY_AMOUNT[monthlyCents]) return { name: LEGACY_BY_AMOUNT[monthlyCents], kind: 'other' }
  return { name: `Unlisted price ($${Math.round(monthlyCents / 100)})`, kind: 'other' }
}

/** A Stripe subscription, cut down to what the money numbers need. */
export interface MoneySub {
  id: string
  customerId: string
  status: string
  /** pause_collection is set (billing paused). */
  paused: boolean
  cancelAtPeriodEnd: boolean
  priceId: string | null
  /** Per month, in cents (yearly prices divided by 12), × quantity. */
  monthlyCents: number
  planName: string
  kind: ProductKind
}

/** Which money bucket a subscription is in, or null when it's finished. */
export function bucketOf(sub: Pick<MoneySub, 'status' | 'paused'>): SubBucket | null {
  if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return null
  if (sub.paused || sub.status === 'paused') return 'paused'
  if (sub.status === 'active') return 'paying'
  if (sub.status === 'trialing') return 'trialing'
  if (sub.status === 'past_due' || sub.status === 'unpaid') return 'past_due'
  if (sub.status === 'incomplete') return 'incomplete'
  return null
}

export function monthlyCents(unitAmount: number | null | undefined, interval: string | null | undefined, quantity = 1, intervalCount = 1): number {
  const amount = (unitAmount ?? 0) * (quantity || 1)
  if (interval === 'year') return Math.round(amount / (12 * (intervalCount || 1)))
  if (interval === 'week') return Math.round((amount * 52) / 12 / (intervalCount || 1))
  if (interval === 'day') return Math.round((amount * 365) / 12 / (intervalCount || 1))
  return Math.round(amount / (intervalCount || 1))
}

export interface BucketCounts {
  paying: number
  trialing: number
  pastDue: number
  paused: number
  incomplete: number
  /** Paying but set to cancel at the end of the period. */
  cancelling: number
}

export interface MoneySummary {
  /** Docs2Video plans + the AI Social add-on. */
  docs2video: BucketCounts & {
    /** MRR from PAYING subscriptions only, cents. */
    mrrCents: number
    /** Would-be MRR if every trial converted, cents (shown as a hint only). */
    trialingCents: number
    /** Monthly amount stuck on past-due bills, cents. */
    pastDueCents: number
    byPlan: { name: string; paying: number; trialing: number; pastDue: number; mrrCents: number }[]
  }
  /** Other products on the same Stripe account (not Docs2Video money). */
  other: { count: number; payingMrrCents: number; byName: { name: string; count: number; payingMrrCents: number }[] }
}

export function summarizeMoney(subs: MoneySub[]): MoneySummary {
  const d: MoneySummary['docs2video'] = {
    paying: 0, trialing: 0, pastDue: 0, paused: 0, incomplete: 0, cancelling: 0,
    mrrCents: 0, trialingCents: 0, pastDueCents: 0, byPlan: [],
  }
  const plans = new Map<string, MoneySummary['docs2video']['byPlan'][number]>()
  const others = new Map<string, { name: string; count: number; payingMrrCents: number }>()
  let otherCount = 0
  let otherMrr = 0

  for (const s of subs) {
    const b = bucketOf(s)
    if (!b) continue
    if (s.kind === 'other') {
      otherCount++
      const o = others.get(s.planName) ?? { name: s.planName, count: 0, payingMrrCents: 0 }
      o.count++
      if (b === 'paying') { o.payingMrrCents += s.monthlyCents; otherMrr += s.monthlyCents }
      others.set(s.planName, o)
      continue
    }
    const p = plans.get(s.planName) ?? { name: s.planName, paying: 0, trialing: 0, pastDue: 0, mrrCents: 0 }
    if (b === 'paying') {
      d.paying++; d.mrrCents += s.monthlyCents; p.paying++; p.mrrCents += s.monthlyCents
      if (s.cancelAtPeriodEnd) d.cancelling++
    } else if (b === 'trialing') {
      d.trialing++; d.trialingCents += s.monthlyCents; p.trialing++
    } else if (b === 'past_due') {
      d.pastDue++; d.pastDueCents += s.monthlyCents; p.pastDue++
    } else if (b === 'paused') d.paused++
    else if (b === 'incomplete') d.incomplete++
    plans.set(s.planName, p)
  }
  d.byPlan = [...plans.values()].sort((a, b) => b.mrrCents - a.mrrCents || b.paying - a.paying)
  return {
    docs2video: d,
    other: { count: otherCount, payingMrrCents: otherMrr, byName: [...others.values()].sort((a, b) => b.count - a.count) },
  }
}

// ── Who counts as a real customer ───────────────────────────────────────────

/**
 * Test / internal accounts, hidden from conversion and (by default) from the
 * audit log. `extra` = addresses the server knows are test logins (TEST_EMAIL).
 */
export function isTestAccount(email: string | null | undefined, extra: string[] = []): boolean {
  const e = (email || '').toLowerCase().trim()
  if (!e) return false
  if (extra.map((x) => x.toLowerCase().trim()).filter(Boolean).includes(e)) return true
  return (
    /\.test$/.test(e) ||
    /@(example|test)\.(com|org|net)$/.test(e) ||
    /(^|[+._-])(e2e|paytest|qa|test|testing)([+._-]|\d|@)/.test(e)
  )
}

export interface ConversionInput {
  email: string | null
  subscription_status: string | null
  is_admin?: boolean | null
  stripe_customer_id?: string | null
}

/**
 * Conversion = sign-ups who are paying ÷ all real sign-ups. Banned, test and
 * admin accounts are left out of BOTH numbers. "Paying" = their Stripe
 * customer has a paying Docs2Video subscription.
 */
export function conversion(profiles: ConversionInput[], payingCustomerIds: Set<string>, testEmails: string[] = []) {
  let eligible = 0
  let paying = 0
  for (const p of profiles) {
    if ((p.subscription_status || '').toLowerCase() === 'banned') continue
    if (p.is_admin) continue
    if (isTestAccount(p.email, testEmails)) continue
    eligible++
    if (p.stripe_customer_id && payingCustomerIds.has(p.stripe_customer_id)) paying++
  }
  return { eligible, paying, ratePct: eligible ? Math.round((paying / eligible) * 1000) / 10 : 0 }
}

export const centsToDollars = (c: number) =>
  `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
