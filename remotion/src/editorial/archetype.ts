/**
 * Editorial slide ARCHETYPES — the curated set of premium layouts the EPOCH
 * (Time-magazine-style) theme can render. The AI's job is to classify each
 * content scene into one of these, NOT to design freely. This is what makes the
 * output reliably high-end: every scene lands in a hand-designed layout.
 *
 * Selection is two-layer:
 *  1. The script generator (Claude) TAGS each scene with an archetype — it
 *     understands intent ("this is a quote", "this is a list of 4 principles").
 *  2. pickArchetype() validates that tag against the content SHAPE and fills it
 *     in deterministically when the tag is missing/implausible. AI decides,
 *     code guarantees it never breaks.
 */

export type EditorialArchetype =
  | 'cover'      // opening / title page (masthead + headline + dek)
  | 'lede'       // narrative intro paragraph (drop-cap body)
  | 'grid'       // 4-6 parallel items (use-cases, features)
  | 'pullquote'  // one powerful isolated statement
  | 'stat'       // the numbers that matter (1-3 big figures)
  | 'list'       // ordered points / principles / steps
  | 'decision'   // closing call-to-action / "what to do now"

export const ALL_ARCHETYPES: EditorialArchetype[] = ['cover', 'lede', 'grid', 'pullquote', 'stat', 'list', 'decision']

/** The content a scene carries (superset; fields used per archetype). */
export type EditorialScene = {
  archetype?: EditorialArchetype   // LLM-tagged (may be absent/wrong)
  kicker?: string                  // section label, e.g. "THE BRIEFING"
  title: string
  dek?: string                     // sub-headline / supporting line
  body?: string                    // paragraph (lede)
  quote?: string                   // pull-quote text
  attribution?: string
  items?: { title: string; detail?: string }[]   // grid / list
  metrics?: { label: string; value: string }[]    // stat
  image?: string                   // optional framed photo
  audio?: string
  durationInFrames: number
}

function hasNum(v: string): boolean { return /-?\d/.test(v || '') }

/**
 * Resolve the archetype for a scene. Honors a plausible LLM tag; otherwise
 * infers from the content shape. Always returns something renderable.
 */
export function pickArchetype(s: EditorialScene, index: number, total: number): EditorialArchetype {
  const items = s.items ?? []
  const metrics = (s.metrics ?? []).filter((m) => m.label && m.value && hasNum(m.value))

  // Trust a valid LLM tag — but sanity-check it has the data it needs.
  if (s.archetype && ALL_ARCHETYPES.includes(s.archetype)) {
    const a = s.archetype
    if (a === 'cover' && index !== 0) { /* only scene 0 is a cover */ }
    else if (a === 'grid' && items.length < 3) { /* not enough items for a grid */ }
    else if (a === 'stat' && metrics.length === 0) { /* no numbers */ }
    else if (a === 'pullquote' && !s.quote && !s.title) { /* nothing to quote */ }
    else if (a === 'list' && items.length === 0) { /* no items */ }
    else return a // tag is valid AND has the data — use it
  }

  // --- deterministic inference (safety net) ---
  if (index === 0) return 'cover'
  if (index === total - 1) return 'decision'
  if (s.quote) return 'pullquote'
  if (metrics.length >= 1 && items.length === 0) return 'stat'
  if (items.length >= 4) return 'grid'
  if (items.length >= 1) return 'list'
  if (metrics.length >= 1) return 'stat'
  if (s.body && s.body.length > 120) return 'lede'
  return 'lede'
}
