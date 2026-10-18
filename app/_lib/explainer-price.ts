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
// THE PRICE IS SET SO THE CHEAPEST CREDIT STILL MAKES MONEY. A credit sells
// for as little as $0.0025 (the Enterprise plan: $499 for 200,000); at that
// rate these numbers keep about 60% of the price, ~68% on Pro, 75%+ on packs
// and Starter. A grandfathered customer pays half (credits.ts) and still
// leaves a margin. 150 words of narration is about a minute.
//
//   price = 1,400 + 320 × scenes + 3 × narration words (+150 per extra file)
//
// A typical standard video (7 scenes, ~350 words) is about 4,700 credits.
//
// Browser-safe on purpose (pricing screens import the quote): no server imports.
// =============================================================================

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
  const s = Math.max(1, Math.round(scenes || 0))
  const w = Math.max(0, Math.round(words || 0))
  return EXPLAINER_BASE_CREDITS + EXPLAINER_SCENE_CREDITS * s + EXPLAINER_WORD_CREDITS * w
}
