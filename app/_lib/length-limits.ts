// =============================================================================
// HOW BIG A STORY MAY BE FOR THE LENGTH THAT WAS PAID FOR.
//
// THE HOLE (audit 2026-10-09). generate-video takes the scenes the browser
// sends. The price is set by the saved length (Short / Standard / Detailed),
// but nothing stopped a Short-priced request carrying 60 scenes and 9,000
// words of narration — a long video for the price of a short one, and real
// AI/voice/render cost on our side.
//
// The limits come from the length rules the story writer is given
// (script-generator.ts): Short = 3–4 scenes, under 150 words; Standard =
// 6–8 scenes, under 450 words; Detailed = 5–15 minutes. Each limit adds room
// for the cover + closing scenes and for the person's own edits, so a story
// the writer produced (and the person tweaked) always fits; only a story far
// past what was paid for is refused.
//
// Pure (no imports) so the browser could show the same rule later.
// =============================================================================

export type StoryLengthId = 'quick' | 'standard' | 'detailed'

export const LENGTH_LIMITS: Record<StoryLengthId, { name: string; maxScenes: number; maxWords: number }> = {
  // 4 content + cover + closing, +2 spare. ~150 spoken words + bookends, ×2 for edits.
  quick: { name: 'Short', maxScenes: 8, maxWords: 400 },
  // 8 content + cover + closing, +4 spare. ~450 words + bookends, ×2 for edits.
  standard: { name: 'Standard', maxScenes: 14, maxWords: 1000 },
  // 15 minutes at ~165 words a minute ≈ 2,500 words; the writer is told
  // "as many scenes as the content needs" (a 50-page document ≈ 12).
  detailed: { name: 'Detailed', maxScenes: 30, maxWords: 3500 },
}

/** Words of narration in one scene (two-voice dialogue counted too). */
function sceneWords(s: unknown): number {
  if (!s || typeof s !== 'object') return 0
  const o = s as { narration?: unknown; dialogue?: unknown }
  let text = typeof o.narration === 'string' ? o.narration : ''
  if (Array.isArray(o.dialogue)) {
    for (const d of o.dialogue) if (d && typeof (d as { text?: unknown }).text === 'string') text += ' ' + (d as { text: string }).text
  }
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

export function storySize(scenes: unknown): { scenes: number; words: number } {
  const list = Array.isArray(scenes) ? scenes : []
  return { scenes: list.length, words: list.reduce((n: number, s) => n + sceneWords(s), 0) }
}

/**
 * Null when the story fits the paid length; otherwise a plain sentence saying
 * what is too big and what to do.
 */
export function storyTooBigMessage(scenes: unknown, length: StoryLengthId): string | null {
  const lim = LENGTH_LIMITS[length] ?? LENGTH_LIMITS.standard
  const size = storySize(scenes)
  if (size.scenes > lim.maxScenes) {
    return `This story has ${size.scenes} scenes, which is more than a ${lim.name} video can have (up to ${lim.maxScenes}). Remove some scenes, or choose a longer length on the Story step.`
  }
  if (size.words > lim.maxWords) {
    return `This story has about ${size.words.toLocaleString('en-US')} words of narration, which is more than a ${lim.name} video can have (up to ${lim.maxWords.toLocaleString('en-US')}). Shorten it, or choose a longer length on the Story step.`
  }
  return null
}
