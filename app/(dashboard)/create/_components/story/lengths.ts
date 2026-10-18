// =============================================================================
// HOW LONG THE STORY IS — chosen on step 2, shown (read-only) on step 3.
//
// The length is saved on the draft as `detailLevel` ('quick' | 'standard' |
// 'detailed'). The story writer uses it to decide how many scenes to write,
// and the price on step 3 reads the same saved value — so a Short video is
// written short AND charged as short. One list here, so both screens use the
// same names.
//
// Pure on purpose (no React, no network) so each rule has a test.
// =============================================================================

export type StoryLength = 'quick' | 'standard' | 'detailed'

export const LENGTHS: { id: StoryLength; name: string; minutes: string; scenes: string }[] = [
  { id: 'quick', name: 'Short', minutes: 'under 1 minute', scenes: '3–4 scenes' },
  { id: 'standard', name: 'Standard', minutes: '2–5 minutes', scenes: '6–8 scenes' },
  { id: 'detailed', name: 'Detailed', minutes: '5–15 minutes', scenes: 'every detail' },
]

export const DEFAULT_LENGTH: StoryLength = 'standard'

/** A saved length, or Standard when nothing (or something odd) was saved. */
export function lengthOf(v: unknown): StoryLength {
  return v === 'quick' || v === 'standard' || v === 'detailed' ? v : DEFAULT_LENGTH
}

export function lengthName(v: unknown): string {
  const id = lengthOf(v)
  return LENGTHS.find((l) => l.id === id)!.name
}

/**
 * What picking a length should do right now.
 *   'none'    — it's the length already chosen, or the story is being written
 *   'save'    — no story yet: just remember it, the story will be written at it
 *   'offer'   — a story exists at another length: offer a free rewrite (never
 *               change the saved length without rewriting, or the price and
 *               the story would disagree)
 */
export type LengthChange = 'none' | 'save' | 'offer'

export function lengthChange(opts: { current: StoryLength; picked: StoryLength; hasStory: boolean; writing: boolean }): LengthChange {
  if (opts.writing) return 'none'
  if (!opts.hasStory) return opts.picked === opts.current ? 'none' : 'save'
  return opts.picked === opts.current ? 'none' : 'offer'
}

/** The anchor step 3's "Change the length" link lands on. */
export const LENGTH_ANCHOR = 'length'
