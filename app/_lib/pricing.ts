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
  { type: 'video', label: 'Video Explainer', description: 'Narrated video + branded slides + share page + AI chatbot', basePrice: 2900, proPrice: 1700, costEstimate: 200 },
  { type: 'video-detailed', label: 'Video (Detailed)', description: '5-7 minute deep dive explainer', basePrice: 3900, proPrice: 2300, costEstimate: 300 },
  { type: 'deck', label: 'Slide Deck', description: 'Editable PPTX with AI backgrounds (no audio)', basePrice: 1900, proPrice: 1100, costEstimate: 250 },
  { type: 'course', label: 'Video Course (10 episodes)', description: 'Complete multi-episode training series', basePrice: 24900, proPrice: 14900, costEstimate: 2000 },
  { type: 'brand-kit', label: 'Brand Kit', description: 'Logo + business cards + social kit + landing page + brand guide', basePrice: 14900, proPrice: 8900, costEstimate: 500 },
  { type: 'logo', label: 'Logo Design (4 concepts)', description: 'AI designer creates 4 logo options + SVG vector files', basePrice: 4900, proPrice: 2900, costEstimate: 100 },
  { type: 'social-kit', label: 'Social Media Kit', description: '20+ images for all platforms', basePrice: 3900, proPrice: 2300, costEstimate: 100 },
  { type: 'infographic', label: 'Infographic', description: 'Professional data visualization', basePrice: 1900, proPrice: 1100, costEstimate: 30 },
  { type: 'business-card', label: 'Business Card', description: 'Front + back at 300 DPI, print-ready', basePrice: 1900, proPrice: 1100, costEstimate: 40 },
  { type: 'flyer', label: 'Flyer', description: 'Professional flyer design', basePrice: 1500, proPrice: 900, costEstimate: 30 },
  { type: 'email-signature', label: 'Email Signature', description: 'Professional HTML email signature', basePrice: 900, proPrice: 500, costEstimate: 10 },
  { type: 'image-remix', label: 'Image Remix', description: 'AI redesign of any image', basePrice: 500, proPrice: 300, costEstimate: 20 },
  { type: 'style-upgrade', label: 'Style Upgrade', description: 'Choose from premium style gallery', basePrice: 500, proPrice: 0, costEstimate: 0 },
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
