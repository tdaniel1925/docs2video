// =============================================================================
// WHAT AN EXPLAINER VIDEO COSTS — priced by its real size, never flat.
//
// Founder (2026-10-17): "you decide the best pricing — just make sure we make
// money and don't lose." The explainer engine (app/_lib/explainer-engine.ts)
// costs real money per video, unlike the old engines (cents), and the cost
// grows with the story: every scene is designed and directed by Claude and
// may get a drawn picture; every minute is voiced and rendered.
//
// MEASURED on AWS (2026-10-17): 7 scenes, 73 s → Claude $1.59. With the
// pictures, voice, the score and the render machines a video costs about
//   $1.40 once (reading the look, planning the pictures, a 90-second score
//          looped under the film, the cut)
// + $0.32 a scene (designing and drawing it, directing its motion, its picture)
// + $0.40 a minute of narration (the voice, rendering the frames)
//
// TODAY: 1,400 + 320 a scene + 3 a narration word (the cheapest credit still
// keeps ~60%). WITH THE MINUTES PRICING ON (owner decision 2026-10-18, plan-pricing.ts):
// a video counts the larger of its narration minutes (150 words a minute,
// rounded up), its scenes at 4 a minute, and 2 minutes; each minute is
// CREDITS_PER_MINUTE credits. plan-pricing.ts shows why no story size loses
// money. A grandfathered customer pays half (price-quote.ts).
//
// Browser-safe on purpose (pricing screens import the quote): no server imports.
// =============================================================================

import { billedMinutes, minutesToCredits, minutesPricingOn } from './plan-pricing'

export const EXPLAINER_BASE_CREDITS = 1400
export const EXPLAINER_SCENE_CREDITS = 320
export const EXPLAINER_WORD_CREDITS = 3

/** The explainer engine is what EVERY customer's video is made with (EXPLAINER_ENGINE=on) — then its price applies. */
export function explainerPricingOn(): boolean {
  const on = String(process.env.EXPLAINER_ENGINE || '').toLowerCase() === 'on'
  return on && Boolean(process.env.RENDER_BUCKET && process.env.RENDER_SUBNETS && process.env.RENDER_SECURITY_GROUP && process.env.RENDER_AWS_ACCESS_KEY_ID && process.env.RENDER_AWS_SECRET_ACCESS_KEY)
}

/** Credits for an explainer of this size, before any extra-file charge. */
export function explainerCredits(scenes: number, words: number): number {
  if (minutesPricingOn()) return minutesToCredits(billedMinutes(scenes, words))
  const s = Math.max(1, Math.round(scenes || 0))
  const w = Math.max(0, Math.round(words || 0))
  return EXPLAINER_BASE_CREDITS + EXPLAINER_SCENE_CREDITS * s + EXPLAINER_WORD_CREDITS * w
}
