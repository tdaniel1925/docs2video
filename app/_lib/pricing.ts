/**
 * Credit-based pricing: each plan includes a monthly credit allowance
 * (TIER_CREDITS in credits.ts). A standard video costs 1,000 credits.
 *
 * Extra usage is NOT billed per video. Anyone (free or paid) tops up with
 * one-time credit packs (credit-packs.ts; see
 * app/api/credits/buy/route.ts + BuyCreditsModal). The `extraVideoPrice`,
 * `overageRatePer1000` and `regenCreditsPerVideo` fields below are legacy
 * numbers (only the unused pay-per-project route reads extraVideoPrice);
 * nothing customer-facing may quote them.
 *
 * `features` / `description` ARE shown to customers (pricing page, settings).
 * Keep them to things the code actually does — no per-tier promises that
 * aren't enforced (e.g. "priority generation", "free slide edits").
 *
 * Starter ($29) is retired. From when NEXT_PUBLIC_D2V_MINUTES_PRICING=on (owner,
 * once the new Stripe prices exist), the plans are sold in VIDEO
 * MINUTES (plan-pricing.ts — the one place their prices, minutes and features
 * live): Free (first video, up to 2 minutes), Pro $129 for 20 minutes, and
 * Business $299 for 60 minutes once NEXT_PUBLIC_D2V_BUSINESS_PLAN=on.
 * Enterprise ($499 / 200,000 credits) is no longer sold: at a minute-heavy
 * worst case its credits would keep too little. Existing subscribers of a
 * plan that is no longer sold keep it (getUserTier still resolves them).
 */

import { PLAN_FREE, PLAN_PRO, PLAN_BUSINESS, planFeatures, businessPlanOn, minutesPricingOn, CREDITS_PER_MINUTE, MIN_BILLED_MINUTES, EXTRA_MINUTE_CENTS, dollars, formatMinutes } from './plan-pricing'

export type PlanTier = 'free' | 'starter' | 'pro' | 'business' | 'enterprise'

export interface PlanInfo {
  tier: PlanTier
  label: string
  monthlyPrice: number // cents
  description: string
  features: string[]
  videosPerMonth: number // included credits, -1 = unlimited
  extraVideoPrice: number // cents per additional video
  regenCreditsPerVideo: number // free slide regenerations per video
  monthlyCredits: number // inflated credit amount
  approxStandardVideos: number // approximate standard videos included
  approxQuickVideos: number // approximate quick videos included
  overageRatePer1000: number // cents per 1,000 overage credits
}

/** The plans as sold until the minutes pricing is switched on — exactly as before 2026-10-18. */
const CREDIT_PLANS: PlanInfo[] = [
  {
    tier: 'free',
    label: 'Pay As You Go',
    monthlyPrice: 0,
    description: 'No subscription required',
    features: [
      '2,000 free credits to start (about 2 standard videos)',
      'Top up anytime with credit packs from $10',
      'Full quality, no watermark',
      'Branded client share pages',
      'Download MP4, PDF, PPTX',
    ],
    videosPerMonth: 2,
    extraVideoPrice: 1000, // $10
    regenCreditsPerVideo: 2,
    monthlyCredits: 2000, // matches TIER_CREDITS.free (a standard video = 1000)
    approxStandardVideos: 2,
    approxQuickVideos: 4,
    overageRatePer1000: 0, // legacy/unused — free users top up with the same credit packs
  },
  {
    tier: 'starter',
    label: 'Starter',
    monthlyPrice: 2900, // $29
    // Retired — no longer sold; kept so existing Starter subscribers resolve.
    description: '5,000 credits per month',
    features: [
      '5,000 credits every month (about 5 standard videos)',
      'Top up anytime with credit packs from $10',
      'Branded client share pages',
      'Download MP4, PDF, PPTX',
    ],
    videosPerMonth: 5,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 3,
    monthlyCredits: 5000,
    approxStandardVideos: 5,  // 5000 / 1000 per standard video
    approxQuickVideos: 10,    // 5000 / 500 per quick video
    overageRatePer1000: 500,
  },
  {
    tier: 'pro',
    label: 'Pro',
    monthlyPrice: 7900, // $79
    description: '25,000 credits per month',
    features: [
      '25,000 credits every month (about 25 standard videos)',
      'Top up anytime with credit packs from $10',
      'Unlimited brands',
      'Branded client share pages',
      'API and AI-assistant access',
    ],
    videosPerMonth: 25, // 25,000 credits / 1,000 per standard video
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 5,
    monthlyCredits: 25000,
    approxStandardVideos: 25,  // 25000 / 1000
    approxQuickVideos: 50,     // 25000 / 500
    overageRatePer1000: 500,
  },
  {
    tier: 'business',
    label: 'Business',
    monthlyPrice: 19900, // $199
    description: '75,000 credits per month',
    features: [
      '75,000 credits every month (about 75 standard videos)',
      'Top up anytime with credit packs from $10',
      'White-label share pages (no Docs2Video branding)',
      'Unlimited brands',
      'Priority support',
    ],
    videosPerMonth: 75,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 10,
    monthlyCredits: 75000,
    approxStandardVideos: 75,   // 75000 / 1000
    approxQuickVideos: 150,     // 75000 / 500
    overageRatePer1000: 400,
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    monthlyPrice: 49900, // $499
    description: '200,000 credits per month',
    features: [
      '200,000 credits every month (about 200 standard videos)',
      'Top up anytime with credit packs from $10',
      'White-label share pages (no Docs2Video branding)',
      'API and AI-assistant access',
      'Dedicated support',
    ],
    videosPerMonth: 200,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: -1, // unlimited
    monthlyCredits: 200000,
    approxStandardVideos: 200,  // 200000 / 1000
    approxQuickVideos: 400,     // 200000 / 500
    overageRatePer1000: 300,
  },
]

/** The plans in video minutes (plan-pricing.ts), live once NEXT_PUBLIC_D2V_MINUTES_PRICING=on. */
const MINUTES_PLANS: PlanInfo[] = [
  {
    tier: 'free',
    label: PLAN_FREE.label,
    monthlyPrice: PLAN_FREE.priceCents,
    description: `Your first video free, up to ${PLAN_FREE.minutes} minutes`,
    features: [
      ...planFeatures(PLAN_FREE),
      'Full quality, no watermark',
      'Branded client share pages',
    ],
    videosPerMonth: 1,
    extraVideoPrice: 1000, // $10
    regenCreditsPerVideo: 2,
    monthlyCredits: PLAN_FREE.credits, // matches TIER_CREDITS.free
    approxStandardVideos: 1,
    approxQuickVideos: 1,
    overageRatePer1000: 0, // legacy/unused — free users top up with the same credit packs
  },
  {
    tier: 'starter',
    label: 'Starter',
    monthlyPrice: 2900, // $29
    // Retired — no longer sold; kept so existing Starter subscribers resolve.
    description: '5,000 credits per month',
    features: [
      '5,000 credits every month (about 5 standard videos)',
      'Top up anytime with credit packs from $10',
      'Branded client share pages',
      'Download MP4, PDF, PPTX',
    ],
    videosPerMonth: 5,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 3,
    monthlyCredits: 5000,
    approxStandardVideos: 5,  // 5000 / 1000 per standard video
    approxQuickVideos: 10,    // 5000 / 500 per quick video
    overageRatePer1000: 500,
  },
  {
    tier: 'pro',
    label: PLAN_PRO.label,
    monthlyPrice: PLAN_PRO.priceCents, // $129
    description: `${PLAN_PRO.minutes} video minutes per month`,
    features: [
      ...planFeatures(PLAN_PRO),
      'Unlimited brands',
      'Branded client share pages',
      'API and AI-assistant access',
    ],
    videosPerMonth: PLAN_PRO.minutes / 2, // every video counts at least 2 minutes
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 5,
    monthlyCredits: PLAN_PRO.credits,
    approxStandardVideos: PLAN_PRO.minutes / 2,
    approxQuickVideos: PLAN_PRO.minutes / 2,
    overageRatePer1000: 500,
  },
  {
    tier: 'business',
    label: PLAN_BUSINESS.label,
    monthlyPrice: PLAN_BUSINESS.priceCents, // $299
    description: `${PLAN_BUSINESS.minutes} video minutes per month`,
    features: [
      ...planFeatures(PLAN_BUSINESS),
      'White-label share pages (no Docs2Video branding)',
      'Unlimited brands',
    ],
    videosPerMonth: PLAN_BUSINESS.minutes / 2,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 10,
    monthlyCredits: PLAN_BUSINESS.credits,
    approxStandardVideos: PLAN_BUSINESS.minutes / 2,
    approxQuickVideos: PLAN_BUSINESS.minutes / 2,
    overageRatePer1000: 400,
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    monthlyPrice: 49900, // $499
    description: '200,000 credits per month',
    features: [
      '200,000 credits every month (about 200 standard videos)',
      'Top up anytime with credit packs from $10',
      'White-label share pages (no Docs2Video branding)',
      'API and AI-assistant access',
      'Dedicated support',
    ],
    videosPerMonth: 200,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: -1, // unlimited
    monthlyCredits: 200000,
    approxStandardVideos: 200,  // 200000 / 1000
    approxQuickVideos: 400,     // 200000 / 500
    overageRatePer1000: 300,
  },
]

/** The plans every page and route reads: today's, until the switch is on. */
export const PLANS: PlanInfo[] = minutesPricingOn() ? MINUTES_PLANS : CREDIT_PLANS

/**
 * The plans a NEW subscriber can buy today. Starter ($29) is retired: existing
 * Starter subscribers are grandfathered, but no page may offer it and no
 * checkout may create it. Every "Subscribe" button and every server route that
 * starts a subscription reads this list, so they can't disagree (audit: the
 * onboarding page offered Starter/"Agency", which checkout rejected with
 * "Invalid plan.", and /setup-payment still sold Starter).
 */
export type SellablePlanTier = 'pro' | 'business' | 'enterprise'
/* Minutes pricing: Pro, and Business once it is on. Until then: what was sold before. */
export const SELLABLE_PLAN_TIERS: readonly SellablePlanTier[] = minutesPricingOn()
  ? (businessPlanOn() ? ['pro', 'business'] : ['pro'])
  : ['pro', 'business', 'enterprise']

export function isSellablePlan(tier: string | null | undefined): tier is SellablePlanTier {
  return !!tier && (SELLABLE_PLAN_TIERS as readonly string[]).includes(tier)
}

/** A plan's monthly credits as video minutes (plan-pricing.ts). */
export function planMinutes(plan: PlanInfo): number {
  return Math.floor(plan.monthlyCredits / CREDITS_PER_MINUTE)
}

/** The AI Social add-on — a separate monthly subscription (STRIPE_PRICE_ADDON_SOCIAL). */
export const SOCIAL_ADDON_MONTHLY_CENTS = 5000

export interface ProjectPrice {
  type: string
  label: string
  description: string
  basePrice: number // cents — pay-per-project price
  proPrice: number // cents — paid member price
}

export const PROJECT_PRICES: ProjectPrice[] = [
  { type: 'video', label: 'Video Explainer', description: 'Narrated video + share page', basePrice: 1000, proPrice: 500 },
  { type: 'deck', label: 'Slide Deck', description: 'Editable PPTX, no audio', basePrice: 1000, proPrice: 500 },
  { type: 'infographic', label: 'Infographic', description: 'Data visualization', basePrice: 1000, proPrice: 500 },
]

export function getProjectPrice(type: string): ProjectPrice | undefined {
  return PROJECT_PRICES.find(p => p.type === type)
}

export function getPlan(tier: PlanTier): PlanInfo {
  return PLANS.find(p => p.tier === tier) ?? PLANS[0]
}

export function getUserTier(subscriptionStatus: string | null): PlanTier {
  const status = (subscriptionStatus ?? '').toLowerCase()
  // 'agency' is a real paid tier (maps to the top allotment so agency users
  // aren't silently dropped to free — see credits audit #5).
  if (['enterprise', 'enterprise-plus', 'enterprise_plus', 'agency'].includes(status)) return 'enterprise'
  if (['business', 'unlimited'].includes(status)) return 'business'
  if (['pro', 'professional'].includes(status)) return 'pro'
  if (['starter', 'active'].includes(status)) return 'starter'
  return 'free'
}

export function getUserPrice(type: string, subscriptionStatus: string | null): number {
  const tier = getUserTier(subscriptionStatus)
  const plan = getPlan(tier)
  return plan.extraVideoPrice
}

export function formatPrice(cents: number): string {
  if (cents === 0) return 'Included'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function isProMember(subscriptionStatus: string | null): boolean {
  const tier = getUserTier(subscriptionStatus)
  return tier !== 'free'
}

export function isUnlimited(subscriptionStatus: string | null): boolean {
  const tier = getUserTier(subscriptionStatus)
  return tier === 'enterprise'
}

export function isEnterprise(subscriptionStatus: string | null): boolean {
  const tier = getUserTier(subscriptionStatus)
  return tier === 'enterprise'
}

/*
 * WHAT A PLAN CARD SAYS UNDER ITS PRICE, and the lines above and below the
 * cards — in minutes with the minutes pricing on, in credits before. Every
 * pricing surface (public /pricing, in-app /pricing, the homepage) reads these,
 * so they can't say different things.
 */
export function planCardLines(plan: PlanInfo): { headline: string; sub: string } {
  if (minutesPricingOn()) {
    return plan.tier === 'free'
      ? { headline: 'First video free', sub: `Up to ${formatMinutes(planMinutes(plan))} · card needed, no charge` }
      : { headline: `${formatMinutes(planMinutes(plan))} / mo`, sub: `Extra minutes ${dollars(EXTRA_MINUTE_CENTS)} each` }
  }
  return plan.tier === 'free'
    ? { headline: `${plan.monthlyCredits.toLocaleString('en-US')} free credits`, sub: `~${plan.approxStandardVideos} videos to try · then top up` }
    : { headline: `${plan.monthlyCredits.toLocaleString('en-US')} credits / mo`, sub: `~${plan.approxStandardVideos} standard videos` }
}

export function pricingIntro(): string {
  return minutesPricingOn()
    ? `Your plan is video minutes. A video uses the minutes it runs, rounded up, and every video counts at least ${MIN_BILLED_MINUTES}. Cancel anytime; minutes reset each month. Extra minutes are ${dollars(EXTRA_MINUTE_CENTS)} each.`
    : 'One pool of credits for videos, presentations and commercials. A standard video is 1,000 credits. Cancel anytime; credits reset each cycle. Top up whenever you need more.'
}

export function pricingFootnote(): string {
  return minutesPricingOn()
    ? `All plans cancel anytime · billed monthly · minutes reset each month · extra minutes ${dollars(EXTRA_MINUTE_CENTS)} each.`
    : 'All plans cancel anytime · billed monthly · credits reset each cycle · extra credits available on paid plans.'
}
