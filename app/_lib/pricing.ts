/**
 * 4-tier pricing: Pay Per Project, Pro ($25/mo), Business ($99/mo), Agency ($249/mo)
 *
 * Pay Per Project: $10 per video, deck, or infographic. Courses $249 each.
 * Pro ($25/mo): 40% off per-project ($6 each). Courses $149 each.
 * Business ($99/mo): Unlimited videos, decks, infographics. No courses.
 * Agency ($249/mo): Everything unlimited + 5 courses/month.
 */

export type PlanTier = 'free' | 'pro' | 'business' | 'agency' | 'enterprise' | 'enterprise-plus'

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
    description: '$25/mo + discounted projects',
    features: [
      '$25/mo membership fee',
      'Then $6 per video, deck, or infographic',
      '$149 per video course',
      'Priority generation + unlimited brands',
    ],
    coursesPerMonth: 0, // pay per course at discount
    unlimitedProjects: false,
  },
  {
    tier: 'business',
    label: 'Business',
    monthlyPrice: 9900, // $99
    description: '50 projects per month',
    features: [
      'Up to 50 videos, decks, or infographics/mo',
      'No per-project fees',
      'Courses at $99 each',
      'Priority support',
    ],
    coursesPerMonth: 0, // pay per course at $99
    unlimitedProjects: false,
  },
  {
    tier: 'agency',
    label: 'Agency',
    monthlyPrice: 24900, // $249
    description: '150 projects + 5 courses',
    features: [
      'Up to 150 videos, decks, or infographics/mo',
      '5 video courses per month included',
      'Team sharing (coming soon)',
      'White-label options (coming soon)',
    ],
    coursesPerMonth: 5,
    unlimitedProjects: true,
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    monthlyPrice: 49900, // $499
    description: 'For mid-size agencies',
    features: [
      'Unlimited videos, decks, infographics',
      '20 video courses per month',
      'Bulk creation (50 at a time)',
      'White-label share pages',
      'Client CRM dashboard',
      '5 team seats',
      'Priority email support',
    ],
    coursesPerMonth: 20,
    unlimitedProjects: true,
  },
  {
    tier: 'enterprise-plus',
    label: 'Enterprise Plus',
    monthlyPrice: 79900, // $799
    description: 'For large agencies & enterprises',
    features: [
      'Everything in Enterprise',
      'Unlimited courses',
      'Bulk creation (200 at a time)',
      'Custom domain share pages',
      'API access',
      '20 team seats',
      'Dedicated phone + Slack support',
      '1-on-1 onboarding call',
      '99.9% SLA guarantee',
    ],
    coursesPerMonth: -1, // unlimited
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
  if (['enterprise-plus', 'enterprise_plus'].includes(status)) return 'enterprise-plus'
  if (['enterprise'].includes(status)) return 'enterprise'
  if (['agency'].includes(status)) return 'agency'
  if (['business', 'unlimited'].includes(status)) return 'business'
  if (['pro', 'professional', 'active'].includes(status)) return 'pro'
  return 'free'
}

export function getUserPrice(type: string, subscriptionStatus: string | null): number {
  const tier = getUserTier(subscriptionStatus)
  const price = getProjectPrice(type)
  if (!price) return 0

  // Enterprise Plus: everything unlimited
  if (tier === 'enterprise-plus') return 0

  // Enterprise: projects included, courses included (up to 20/mo)
  if (tier === 'enterprise') return 0

  // Business and Agency: included projects (not courses for Business)
  if ((tier === 'business' || tier === 'agency') && type !== 'course') return 0

  // Agency: courses included (up to 5/mo — enforcement elsewhere)
  if (tier === 'agency' && type === 'course') return 0

  // Business: courses at $99 each
  if (tier === 'business' && type === 'course') return 9900

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
  return ['business', 'agency', 'enterprise', 'enterprise-plus'].includes(tier)
}

export function isEnterprise(subscriptionStatus: string | null): boolean {
  const tier = getUserTier(subscriptionStatus)
  return tier === 'enterprise' || tier === 'enterprise-plus'
}
