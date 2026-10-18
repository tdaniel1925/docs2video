// =============================================================================
// THE PLANS, IN VIDEO MINUTES — ONE PLACE (owner decision 2026-10-18).
//
// "We really only have one customer so an increase now is best … maybe we go
// based on actual video minutes instead of videos?" → Pro is $129 a month for
// 20 video minutes. Customers read MINUTES everywhere; credits stay inside the
// app (balances, charges and refunds still move credits), with one fixed rate:
//
//   1 video minute = CREDITS_PER_MINUTE credits (1,250)
//
// So 20 minutes is 25,000 credits — the same monthly grant Pro already had —
// and a $5 extra minute is 1,250 credits for $5 ($0.004 a credit, the rate of
// the $10 / 2,500-credit pack).
//
// HOW MANY MINUTES A VIDEO COUNTS (an explainer, EXPLAINER_ENGINE=on):
//   the larger of
//     * its narration at 150 words a minute, rounded UP to a whole minute,
//     * its scenes at 4 a minute, rounded up (a scene costs real money to
//       design and draw even with no words on it), and
//     * 2 minutes — every video counts at least 2.
//
// WHY IT NEVER LOSES MONEY. The explainer engine costs (measured on AWS
// 2026-10-17, explainer-price.ts): $1.40 a video + $0.32 a scene + $0.40 a
// minute of narration. For a video counted as m minutes it has at most 4m
// scenes and 150m words, so it costs at most $1.40 + $1.68 × m. The worst
// case is the 2-minute minimum: $4.76.
//   * Sold as extras ($5 a minute): $10 → 52% kept, worst case.
//   * On Pro ($129 ÷ 20 = $6.45 a minute): $12.90 → 63% kept, worst case.
//   * On Business ($299 ÷ 60 = $4.98 a minute): $9.97 → 52% kept, worst case.
// A typical 7-scene, 75-second video counts 2 minutes and costs about $3.80.
// tests/plan-pricing.test.ts checks every story size against these numbers.
//
// ONE SWITCH, NEXT_PUBLIC_D2V_MINUTES_PRICING=on, turns all of this on at
// once: the plans, the video price in minutes, the free start and the top-up
// packs. Off (the default) everything stays exactly as it was before, so
// nothing changes until the owner has made the new Stripe prices and set
// STRIPE_PRICE_PRO_129 (stripe.ts). A subscriber on the old $79 Pro keeps it.
//
// Pure (no imports) so the plans page, the homepage, the price quote and the
// server all read the same numbers.
// =============================================================================

/** The minutes pricing is live (owner switch; off until the new Stripe prices exist). Read literally so Next inlines it in the browser. */
export function minutesPricingOn(): boolean {
  return String(process.env.NEXT_PUBLIC_D2V_MINUTES_PRICING || '').toLowerCase() === 'on'
}

/** One video minute, in the credits the app moves internally. */
export const CREDITS_PER_MINUTE = 1250
/** Every video counts at least this many minutes. */
export const MIN_BILLED_MINUTES = 2
/** Narration pace the minutes are counted at (about how fast the voice speaks). */
export const WORDS_PER_MINUTE = 150
/** Scenes one counted minute covers; more scenes than this count more minutes. */
export const SCENES_PER_MINUTE = 4

/** $5 for each minute past the plan's monthly minutes. */
export const EXTRA_MINUTE_CENTS = 500
/** $1 for each slide-deck page past the plan's monthly decks. */
export const EXTRA_DECK_PAGE_CENTS = 100

/**
 * Standalone slide decks are part of Pro's offer, but Docs2Video does not make
 * standalone decks today (videos-only.ts retired the deck builder). Until it
 * does, no page may promise them: the allowance below waits here, and pages
 * show the deck line only when this is true.
 */
export const DECKS_LIVE = false

export interface MinutesPlan {
  tier: 'free' | 'pro' | 'business'
  label: string
  /** Monthly price in cents (0 for the free start). */
  priceCents: number
  /** Video minutes included (monthly on a paid plan; once on the free start). */
  minutes: number
  /** The same minutes in internal credits. */
  credits: number
  /** Every video's own slides download as PowerPoint and PDF. */
  videoSlidesIncluded: boolean
  /** Standalone slide decks a month (shown only when DECKS_LIVE). */
  decks: { perMonth: number; maxPages: number } | null
  /** Env var holding this plan's Stripe price id (null for the free start). */
  stripePriceEnv: string | null
}

/** Free: the first video, up to 2 minutes. A card is needed first (credits.ts spendBlockReason). */
export const PLAN_FREE: MinutesPlan = {
  tier: 'free',
  label: 'Free',
  priceCents: 0,
  minutes: 2,
  credits: 2 * CREDITS_PER_MINUTE,
  videoSlidesIncluded: true,
  decks: null,
  stripePriceEnv: null,
}

export const PLAN_PRO: MinutesPlan = {
  tier: 'pro',
  label: 'Pro',
  priceCents: 12900,
  minutes: 20,
  credits: 20 * CREDITS_PER_MINUTE,
  videoSlidesIncluded: true,
  decks: { perMonth: 5, maxPages: 12 },
  stripePriceEnv: 'STRIPE_PRICE_PRO_129',
}

/** Business is ready but not sold until NEXT_PUBLIC_D2V_BUSINESS_PLAN=on. */
export const PLAN_BUSINESS: MinutesPlan = {
  tier: 'business',
  label: 'Business',
  priceCents: 29900,
  minutes: 60,
  credits: 60 * CREDITS_PER_MINUTE,
  videoSlidesIncluded: true,
  decks: { perMonth: 15, maxPages: 12 },
  stripePriceEnv: 'STRIPE_PRICE_BUSINESS_299',
}

/** Business is offered only when the owner turns it on (off by default). */
export function businessPlanOn(): boolean {
  return String(process.env.NEXT_PUBLIC_D2V_BUSINESS_PLAN || '').toLowerCase() === 'on'
}

/** The plans a page shows, in order: Free, Pro, and Business when it is on. */
export function minutesPlans(): MinutesPlan[] {
  return businessPlanOn() ? [PLAN_FREE, PLAN_PRO, PLAN_BUSINESS] : [PLAN_FREE, PLAN_PRO]
}

/** Minutes a video of this size counts (see the top of this file). */
export function billedMinutes(scenes: number, words: number): number {
  const s = Math.max(1, Math.round(scenes || 0))
  const w = Math.max(0, Math.round(words || 0))
  return Math.max(MIN_BILLED_MINUTES, Math.ceil(w / WORDS_PER_MINUTE), Math.ceil(s / SCENES_PER_MINUTE))
}

export function minutesToCredits(minutes: number): number {
  return Math.round(minutes * CREDITS_PER_MINUTE)
}

/** Credits as minutes, to one decimal and never rounded up ("12.4"). */
export function creditsToMinutes(credits: number): number {
  return Math.floor((Math.max(0, credits || 0) / CREDITS_PER_MINUTE) * 10) / 10
}

/** "2 minutes", "1 minute", "12.4 minutes". */
export function formatMinutes(minutes: number): string {
  const n = Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1)
  return `${n} minute${minutes === 1 ? '' : 's'}`
}

/** "$129" — whole dollars. */
export function dollars(cents: number): string {
  return `$${Math.round(cents / 100)}`
}

/** What a plan card lists — only things the app does today. */
export function planFeatures(plan: MinutesPlan): string[] {
  const out: string[] = []
  if (plan.tier === 'free') {
    out.push(`Your first video free, up to ${formatMinutes(plan.minutes)}`)
    out.push('A card is needed to start; nothing is charged')
  } else {
    out.push(`${plan.minutes} video minutes every month`)
    out.push('Every video counts at least 2 minutes')
  }
  if (plan.videoSlidesIncluded) out.push("Every video's slides as PowerPoint and PDF")
  if (DECKS_LIVE && plan.decks) out.push(`${plan.decks.perMonth} slide decks a month, up to ${plan.decks.maxPages} pages each`)
  if (plan.tier !== 'free') out.push(`Extra minutes ${dollars(EXTRA_MINUTE_CENTS)} each`)
  return out
}

// ── The cost model the prices are checked against (explainer-price.ts) ──────

export const EXPLAINER_COST_CENTS = { perVideo: 140, perScene: 32, perNarrationMinute: 40 } as const

/** What one explainer of this size costs us, in cents. */
export function explainerCostCents(scenes: number, words: number): number {
  return EXPLAINER_COST_CENTS.perVideo + EXPLAINER_COST_CENTS.perScene * scenes + EXPLAINER_COST_CENTS.perNarrationMinute * (words / WORDS_PER_MINUTE)
}

/** The most a video counted as `minutes` can cost us, in cents. */
export function worstCaseCostCents(minutes: number): number {
  return explainerCostCents(SCENES_PER_MINUTE * minutes, WORDS_PER_MINUTE * minutes)
}

// ── How an amount reads to the customer ─────────────────────────────────────

/** "12.4 minutes" with the minutes pricing on; "15,600 credits" before. Every balance and price on screen goes through here. */
export function amountLabel(credits: number): string {
  if (minutesPricingOn()) return formatMinutes(creditsToMinutes(credits))
  return `${Math.round(credits).toLocaleString('en-US')} credit${credits === 1 ? '' : 's'}`
}

/** Just the number ("12.4" / "15,600") and the word ("minutes" / "credits"), for chips that style them apart. */
export function amountParts(credits: number): { value: string; unit: string } {
  if (minutesPricingOn()) {
    const m = creditsToMinutes(credits)
    return { value: Number.isInteger(m) ? String(m) : m.toFixed(1), unit: m === 1 ? 'minute' : 'minutes' }
  }
  return { value: Math.round(credits).toLocaleString('en-US'), unit: credits === 1 ? 'credit' : 'credits' }
}

/** "minutes" / "credits" — the word for what the customer buys. */
export function amountNoun(): string {
  return minutesPricingOn() ? 'minutes' : 'credits'
}
