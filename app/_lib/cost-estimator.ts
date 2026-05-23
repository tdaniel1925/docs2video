/**
 * Per-video cost estimator and daily spend ceiling enforcement.
 * Ceiling enforcement gated by COST_CEILINGS_ENABLED env var.
 */

export interface CostEstimate {
  estimated_cost_cents: number
  cost_breakdown: {
    slide_image: number    // per slide
    tts_hd_per_1k_chars: number
    music: number
  }
}

/**
 * Estimate the cost of generating a video based on scene count, narration length, and music.
 */
export function estimateVideoCost(
  sceneCount: number,
  totalNarrationChars: number,
  includeMusic: boolean
): CostEstimate {
  const slideImageCost = sceneCount * 8  // ~$0.08 per slide (OpenAI gpt-image-2)
  const ttsCost = Math.ceil(totalNarrationChars / 1000) * 3  // ~$0.03 per 1K chars
  const musicCost = includeMusic ? 5 : 0  // ~$0.05 for AI music

  return {
    estimated_cost_cents: slideImageCost + ttsCost + musicCost,
    cost_breakdown: {
      slide_image: slideImageCost,
      tts_hd_per_1k_chars: ttsCost,
      music: musicCost,
    },
  }
}

/**
 * Tier-based daily spend ceilings (in cents).
 */
export const TIER_CEILINGS_CENTS: Record<string, number> = {
  free: 50,           // $0.50/day
  starter: 500,       // $5/day
  pro: 2000,          // $20/day
  business: 5000,     // $50/day
  enterprise: 99999,  // effectively unlimited
}

/**
 * Check if a new video would exceed the user's daily spend ceiling.
 * Returns false (allow) if COST_CEILINGS_ENABLED is not 'true'.
 */
export async function exceedsCeiling(
  userId: string,
  estimatedCents: number,
  tier: string,
  supabase: any
): Promise<boolean> {
  if (process.env.COST_CEILINGS_ENABLED !== 'true') return false

  const ceiling = TIER_CEILINGS_CENTS[tier] ?? TIER_CEILINGS_CENTS['free']
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('daily_user_spend')
    .select('total_cents')
    .eq('user_id', userId)
    .eq('spend_date', today)
    .single()

  const currentSpend = data?.total_cents ?? 0
  return (currentSpend + estimatedCents) > ceiling
}
