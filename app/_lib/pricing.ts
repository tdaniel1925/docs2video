/**
 * Credit-based pricing: each plan includes monthly video credits.
 * Extra videos beyond the plan are $5 each across all tiers.
 * Slide regenerations cost 1/4 credit each.
 */

export type PlanTier = 'free' | 'personal' | 'starter' | 'pro' | 'business' | 'enterprise'

export interface PlanInfo {
  tier: PlanTier
  label: string
  monthlyPrice: number // cents
  description: string
  features: string[]
  videosPerMonth: number // included credits, -1 = unlimited
  extraVideoPrice: number // cents per additional video
  regenCreditsPerVideo: number // free slide regenerations per video
}

export const PLANS: PlanInfo[] = [
  {
    tier: 'free',
    label: 'Pay Per Video',
    monthlyPrice: 0,
    description: 'No subscription required',
    features: [
      '2 free videos to try',
      '$10 per additional video',
      'Full quality, no watermark',
      'Share pages with AI chat',
      'Download MP4, PDF, PPTX',
    ],
    videosPerMonth: 2,
    extraVideoPrice: 1000, // $10
    regenCreditsPerVideo: 2,
  },
  {
    tier: 'personal',
    label: 'Personal',
    monthlyPrice: 1000, // $10
    description: '3 videos per month',
    features: [
      '3 videos per month included',
      '$5 per additional video',
      'Solo narrator voice',
      'Basic templates',
      'Download MP4 and PDF',
    ],
    videosPerMonth: 3,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 1,
  },
  {
    tier: 'starter',
    label: 'Starter',
    monthlyPrice: 2900, // $29
    description: '5 videos per month',
    features: [
      '5 videos per month included',
      '$5 per additional video',
      'Multi-voice podcast narration',
      '2 brand profiles',
      'All slide templates',
    ],
    videosPerMonth: 5,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 3,
  },
  {
    tier: 'pro',
    label: 'Pro',
    monthlyPrice: 7900, // $79
    description: '20 videos per month',
    features: [
      '20 videos per month included',
      '$5 per additional video',
      'Priority generation',
      'Unlimited brands',
      '5 free slide edits per video',
    ],
    videosPerMonth: 20,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 5,
  },
  {
    tier: 'business',
    label: 'Business',
    monthlyPrice: 19900, // $199
    description: '75 videos per month',
    features: [
      '75 videos per month included',
      '$5 per additional video',
      '10 free slide edits per video',
      'White-label share pages',
      'Priority support',
    ],
    videosPerMonth: 75,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: 10,
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    monthlyPrice: 49900, // $499
    description: '200 videos per month',
    features: [
      '200 videos per month included',
      '$5 per additional video',
      'Unlimited slide edits',
      'White-label share pages',
      'API access',
      'Bulk creation',
      'Dedicated support',
    ],
    videosPerMonth: 200,
    extraVideoPrice: 500, // $5
    regenCreditsPerVideo: -1, // unlimited
  },
]

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
  if (['enterprise', 'enterprise-plus', 'enterprise_plus'].includes(status)) return 'enterprise'
  if (['business', 'unlimited'].includes(status)) return 'business'
  if (['pro', 'professional'].includes(status)) return 'pro'
  if (['starter', 'active'].includes(status)) return 'starter'
  if (['personal'].includes(status)) return 'personal'
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
