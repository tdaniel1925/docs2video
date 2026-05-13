/**
 * Pay-per-project pricing with optional Pro membership discount.
 * No credits system — users pay per project.
 */

export const PRO_MONTHLY_PRICE = 2500 // $25.00 in cents
export const PRO_DISCOUNT = 0.40 // 40% off for Pro members

export interface ProjectPrice {
  type: string
  label: string
  description: string
  basePrice: number // cents
  proPrice: number // cents
  costEstimate: number // our estimated API cost in cents
}

export const PROJECT_PRICES: ProjectPrice[] = [
  { type: 'video', label: 'Video Explainer', description: 'Narrated video + branded slides + share page + AI chatbot', basePrice: 2500, proPrice: 1500, costEstimate: 200 },
  { type: 'video-detailed', label: 'Video (Detailed)', description: '5-7 minute deep dive explainer', basePrice: 3500, proPrice: 2100, costEstimate: 300 },
  { type: 'deck', label: 'Slide Deck', description: 'Editable PPTX with AI backgrounds (no audio)', basePrice: 1500, proPrice: 900, costEstimate: 250 },
  { type: 'course', label: 'Video Course (10 episodes)', description: 'Complete multi-episode training series', basePrice: 19900, proPrice: 11900, costEstimate: 2000 },
  { type: 'logo', label: 'Logo Design (4 concepts)', description: 'AI designer creates 4 logo options', basePrice: 1500, proPrice: 900, costEstimate: 75 },
  { type: 'social-kit', label: 'Social Media Kit', description: '20+ images for all platforms', basePrice: 1500, proPrice: 900, costEstimate: 100 },
  { type: 'infographic', label: 'Infographic', description: 'Professional data visualization', basePrice: 500, proPrice: 300, costEstimate: 30 },
  { type: 'business-card', label: 'Business Card', description: 'Front + back at 300 DPI', basePrice: 500, proPrice: 300, costEstimate: 40 },
  { type: 'flyer', label: 'Flyer', description: 'Professional flyer design', basePrice: 500, proPrice: 300, costEstimate: 30 },
  { type: 'image-remix', label: 'Image Remix', description: 'AI redesign of any image', basePrice: 300, proPrice: 200, costEstimate: 20 },
]

export function getProjectPrice(type: string): ProjectPrice | undefined {
  return PROJECT_PRICES.find(p => p.type === type)
}

export function getUserPrice(type: string, isPro: boolean): number {
  const price = getProjectPrice(type)
  if (!price) return 0
  return isPro ? price.proPrice : price.basePrice
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function isProMember(subscriptionStatus: string | null): boolean {
  const proStatuses = ['pro', 'professional', 'active', 'agency']
  return proStatuses.includes((subscriptionStatus ?? '').toLowerCase())
}
