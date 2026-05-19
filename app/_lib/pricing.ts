/**
 * Credit-based pricing: each plan includes monthly video credits.
 * Extra videos beyond the plan are charged per-video via card on file.
 * Slide regenerations cost 1/4 credit each.
 */

export type PlanTier = 'free' | 'pro' | 'business' | 'agency' | 'enterprise' | 'enterprise-plus'

export interface PlanInfo {
  tier: PlanTier
  label: string
  monthlyPrice: number // cents
  description: string
  features: string[]
  videosPerMonth: number // included credits, -1 = unlimited
  extraVideoPrice: number // cents per additional video
  coursesPerMonth: number // 0 = pay per course, -1 = unlimited
  regenCreditsPerVideo: number // free slide regenerations per video
}

export const PLANS: PlanInfo[] = [
  {
    tier: 'free',
    label: 'Pay Per Video',
    monthlyPrice: 0,
    description: 'No subscription required',
    features: [
      '1 free video to try',
      '$10 per additional video',
      'Full quality, no watermark',
      'Share pages with AI chat',
      'Download MP4, PDF, PPTX',
    ],
    videosPerMonth: 1,
    extraVideoPrice: 1000, // $10
    coursesPerMonth: 0,
    regenCreditsPerVideo: 2,
  },
  {
    tier: 'pro',
    label: 'Pro',
    monthlyPrice: 2500, // $25
    description: '5 videos/mo + discounted extras',
    features: [
      '5 videos per month included',
      '$6 per additional video',
      'Priority generation',
      'Unlimited brands',
      '$149 per video course',
    ],
    videosPerMonth: 5,
    extraVideoPrice: 600, // $6
    coursesPerMonth: 0,
    regenCreditsPerVideo: 3,
  },
  {
    tier: 'business',
    label: 'Business',
    monthlyPrice: 9900, // $99
    description: '30 videos per month',
    features: [
      '30 videos per month included',
      '$4 per additional video',
      '5 free slide edits per video',
      'Courses at $99 each',
      'Priority support',
    ],
    videosPerMonth: 30,
    extraVideoPrice: 400, // $4
    coursesPerMonth: 0,
    regenCreditsPerVideo: 5,
  },
  {
    tier: 'agency',
    label: 'Agency',
    monthlyPrice: 24900, // $249
    description: '80 videos + 5 courses',
    features: [
      '80 videos per month included',
      '$3 per additional video',
      '10 free slide edits per video',
      '5 video courses per month',
      'Team sharing (coming soon)',
      'White-label options (coming soon)',
    ],
    videosPerMonth: 80,
    extraVideoPrice: 300, // $3
    coursesPerMonth: 5,
    regenCreditsPerVideo: 10,
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    monthlyPrice: 49900, // $499
    description: '200 videos + 20 courses',
    features: [
      '200 videos per month included',
      '$2 per additional video',
      'Unlimited slide edits',
      '20 video courses per month',
      'Bulk creation (50 at a time)',
      'White-label share pages',
      'Client CRM dashboard',
      '5 team seats',
      'Priority email support',
    ],
    videosPerMonth: 200,
    extraVideoPrice: 200, // $2
    coursesPerMonth: 20,
    regenCreditsPerVideo: -1, // unlimited
  },
  {
    tier: 'enterprise-plus',
    label: 'Enterprise Plus',
    monthlyPrice: 79900, // $799
    description: '500 videos + unlimited courses',
    features: [
      '500 videos per month included',
      '$1.50 per additional video',
      'Unlimited slide edits',
      'Unlimited courses',
      'Bulk creation (200 at a time)',
      'Custom domain share pages',
      'API access',
      '20 team seats',
      'Dedicated phone + Slack support',
      '1-on-1 onboarding call',
      '99.9% SLA guarantee',
    ],
    videosPerMonth: 500,
    extraVideoPrice: 150, // $1.50
    coursesPerMonth: -1,
    regenCreditsPerVideo: -1, // unlimited
  },
]

export interface ProjectPrice {
  type: string
  label: string
  description: string
  basePrice: number // cents — pay-per-project price
  proPrice: number // cents — Pro member price
}

export const PROJECT_PRICES: ProjectPrice[] = [
  { type: 'video', label: 'Video Explainer', description: 'Narrated video + share page', basePrice: 1000, proPrice: 600 },
  { type: 'deck', label: 'Slide Deck', description: 'Editable PPTX, no audio', basePrice: 1000, proPrice: 600 },
  { type: 'infographic', label: 'Infographic', description: 'Data visualization', basePrice: 1000, proPrice: 600 },
  { type: 'course', label: 'Video Course', description: 'Multi-episode series', basePrice: 24900, proPrice: 14900 },
]

export function getProjectPrice(type: string): ProjectPrice | undefined {
  return PROJECT_PRICES.find(p => p.type === type)
}

export function getPlan(tier: PlanTier): PlanInfo {
  return PLANS.find(p => p.tier === tier) ?? PLANS[0]
}

export function getUserTier(subscriptionStatus: string | null): PlanTier {
  const status = (subscriptionStatus ?? '').toLowerCase()
  if (['enterprise-plus', 'enterprise_plus'].includes(status)) return 'enterprise-plus'
  if (['enterprise'].includes(status)) return 'enterprise'
  if (['agency'].includes(status)) return 'agency'
  if (['business', 'unlimited'].includes(status)) return 'business'
  if (['pro', 'professional', 'active', 'starter'].includes(status)) return 'pro'
  return 'free'
}

export function getUserPrice(type: string, subscriptionStatus: string | null): number {
  const tier = getUserTier(subscriptionStatus)
  const plan = getPlan(tier)

  // If plan includes videos and this is a video/deck/infographic, it's covered by credits
  // The actual credit check happens in the API — this returns the overage price
  if (type === 'course') {
    if (plan.coursesPerMonth === -1) return 0 // unlimited
    if (tier === 'business') return 9900
    if (tier === 'pro') return 14900
    return 24900 // free tier
  }

  // For videos: return 0 if they have credits, otherwise return the extra video price
  // Actual enforcement happens server-side
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
  return tier === 'enterprise' || tier === 'enterprise-plus'
}

export function isEnterprise(subscriptionStatus: string | null): boolean {
  const tier = getUserTier(subscriptionStatus)
  return tier === 'enterprise' || tier === 'enterprise-plus'
}
