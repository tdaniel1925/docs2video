/**
 * 4-tier pricing: Pay Per Project, Pro ($25/mo), Business ($99/mo), Agency ($249/mo)
 *
 * Pay Per Project: $10 per video, deck, or infographic. Courses $249 each.
 * Pro ($25/mo): 40% off per-project ($6 each). Courses $149 each.
 * Business ($99/mo): Unlimited videos, decks, infographics. No courses.
 * Agency ($249/mo): Everything unlimited + 5 courses/month.
 */

export type PlanTier = 'free' | 'pro' | 'business' | 'agency'

export interface PlanInfo {
  tier: PlanTier
  label: string
  monthlyPrice: number // cents
  description: string
  features: string[]
  coursesPerMonth: number // 0 = pay per project, -1 = not available
  unlimitedProjects: boolean
}

export const PLANS: PlanInfo[] = [
  {
    tier: 'free',
    label: 'Pay Per Project',
    monthlyPrice: 0,
    description: 'No subscription required',
    features: [
      '$10 per video, deck, or infographic',
      'Full quality, no watermark',
      'Share pages with AI chat',
      'Download MP4, PDF, PPTX',
    ],
    coursesPerMonth: 0, // pay per course
    unlimitedProjects: false,
  },
  {
    tier: 'pro',
    label: 'Pro',
    monthlyPrice: 2500, // $25
    description: '40% off every project',
    features: [
      '$6 per video, deck, or infographic',
      '$149 per video course',
      'Priority generation',
      'Unlimited brands',
    ],
    coursesPerMonth: 0, // pay per course at discount
    unlimitedProjects: false,
  },
  {
    tier: 'business',
    label: 'Business',
    monthlyPrice: 9900, // $99
    description: 'Unlimited creation',
    features: [
      'Unlimited videos, decks, infographics',
      'Everything in Pro',
      'No per-project fees',
      'Priority support',
    ],
    coursesPerMonth: -1, // courses not included
    unlimitedProjects: true,
  },
  {
    tier: 'agency',
    label: 'Agency',
    monthlyPrice: 24900, // $249
    description: 'Everything unlimited',
    features: [
      'Everything in Business',
      '5 video courses per month',
      'Team sharing (coming soon)',
      'White-label options (coming soon)',
    ],
    coursesPerMonth: 5,
    unlimitedProjects: true,
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
  if (['agency'].includes(status)) return 'agency'
  if (['business', 'unlimited'].includes(status)) return 'business'
  if (['pro', 'professional', 'active'].includes(status)) return 'pro'
  return 'free'
}

export function getUserPrice(type: string, subscriptionStatus: string | null): number {
  const tier = getUserTier(subscriptionStatus)
  const price = getProjectPrice(type)
  if (!price) return 0

  // Business and Agency get unlimited videos/decks/infographics (not courses)
  if ((tier === 'business' || tier === 'agency') && type !== 'course') return 0

  // Agency gets courses included (up to 5/mo — enforcement elsewhere)
  if (tier === 'agency' && type === 'course') return 0

  // Pro gets discounted price
  if (tier === 'pro') return price.proPrice

  return price.basePrice
}

export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function isProMember(subscriptionStatus: string | null): boolean {
  const tier = getUserTier(subscriptionStatus)
  return tier !== 'free'
}

export function isUnlimited(subscriptionStatus: string | null): boolean {
  const tier = getUserTier(subscriptionStatus)
  return tier === 'business' || tier === 'agency'
}
