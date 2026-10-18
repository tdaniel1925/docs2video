/**
 * THE EIGHT STEPS — one list, used by the focus header (the step bars at the
 * top of every create screen), each step's Back / Next, and the guard tests.
 * The approved redesign (2026-10-18): one job per screen.
 *
 *   1 Content           /create             the document, website, text or idea
 *   2 Story             /create/story       what we took from it: the one point, the numbers, quick questions
 *   3 Brand             /create/brand       a saved brand, a new one (logo, colors, name), or none — no website needed
 *   4 Look              /create/style       the look cards, your own look (/create/look: a picture you like), the free preview
 *   5 Scenes            /create/scenes      every scene: its words, what is on screen, the order, the length
 *   6 Voice             /create/voice       the narrator, music, video or presentation
 *   7 Opener & close    /create/opening     how you're introduced, your photo, contact and booking link on the closing
 *   8 Review            /create/review      everything at a glance, the free preview, the price, Make it
 *
 * Steps 2 + 5 share one screen's code (StoryScenes), 3 + 7 another
 * (BrandCovers) and 4, 6 + 8 a third (LookVoiceReview): the same loading,
 * saving and making, shown one job at a time. Old addresses (/create/script,
 * /create/theme, /create/brief) forward to the right step.
 *
 * The making screen (/create/generating) comes after the eight steps: there
 * the header shows them all done (AFTER_STEPS).
 *
 * Pure on purpose (no React) so a test can check every path.
 */
export const STEPS = [
  { key: 'content', label: 'Content', paths: ['/create'] },
  { key: 'story', label: 'Story', paths: ['/create/story', '/create/brief', '/create/script'] },
  { key: 'brand', label: 'Brand', paths: ['/create/brand'] },
  { key: 'look', label: 'Look', paths: ['/create/style', '/create/look'] },
  { key: 'scenes', label: 'Scenes', paths: ['/create/scenes'] },
  { key: 'voice', label: 'Voice', paths: ['/create/voice'] },
  { key: 'opening', label: 'Opener & close', paths: ['/create/opening'] },
  { key: 'review', label: 'Review', paths: ['/create/review', '/create/theme'] },
] as const

export type StepKey = (typeof STEPS)[number]['key']

/** Pages that come after the steps (all of them show as done). */
export const AFTER_STEPS = ['/create/generating'] as const

/** Which step (0-based) a path belongs to; STEPS.length for the making
 *  screen (every step done); -1 for pages outside the flow (the commercial
 *  maker has its own screen). */
export function stepIndexFor(pathname: string): number {
  if ((AFTER_STEPS as readonly string[]).includes(pathname)) return STEPS.length
  return STEPS.findIndex((s) => (s.paths as readonly string[]).includes(pathname))
}

/** A step's own screen for a draft: its first path, with ?id=. */
export function stepPath(key: StepKey, draftId: string): string {
  const step = STEPS.find((s) => s.key === key)!
  return `${step.paths[0]}?id=${encodeURIComponent(draftId)}`
}

/** Where a step that is already done opens again, for the same draft. Null
 *  when there is no draft yet (nothing to go back to). */
export function stepHref(index: number, draftId: string | null): string | null {
  if (!draftId || index < 0 || index >= STEPS.length) return null
  return stepPath(STEPS[index].key, draftId)
}

/** The step before and after one, for its Back and Next. */
export function neighbours(key: StepKey): { prev: (typeof STEPS)[number] | null; next: (typeof STEPS)[number] | null } {
  const i = STEPS.findIndex((s) => s.key === key)
  return { prev: i > 0 ? STEPS[i - 1] : null, next: i < STEPS.length - 1 ? STEPS[i + 1] : null }
}
