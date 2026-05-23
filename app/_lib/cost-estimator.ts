/**
 * Per-video cost estimator.
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
