/**
 * THE THREE STEPS — one list, used by the focus header (the step numbers at
 * the top of every create screen) and the guard test.
 *
 *   1 Your content   /create                           the document, website, text or idea
 *   2 The story      /create/script (/brief forwards)  the one point, the numbers, the scenes
 *   3 The look       /create/theme (+ /brand, /voice)   look, voice, price, Make it
 *
 * The making screen (/create/generating) and the result page come after the
 * three steps: they are not a step. On the making screen the header shows all
 * three ticked (makingDone).
 *
 * Pure on purpose (no React) so a test can check every path.
 */
export const STEPS = [
  { label: 'Your content', paths: ['/create'] },
  { label: 'The story', paths: ['/create/brief', '/create/script'] },
  { label: 'The look', paths: ['/create/theme', '/create/brand', '/create/voice'] },
] as const

/** Pages that come after the three steps (all three show as done). */
export const AFTER_STEPS = ['/create/generating'] as const

/** Which step (0-based) a path belongs to; STEPS.length for the making
 *  screen (every step done); -1 for pages outside the flow (the commercial
 *  maker has its own screen). */
export function stepIndexFor(pathname: string): number {
  if ((AFTER_STEPS as readonly string[]).includes(pathname)) return STEPS.length
  return STEPS.findIndex((s) => (s.paths as readonly string[]).includes(pathname))
}

/** Where a step that is already done opens again, for the same draft. Null
 *  when there is no draft yet (nothing to go back to). */
export function stepHref(index: number, draftId: string | null): string | null {
  if (!draftId) return null
  const id = encodeURIComponent(draftId)
  if (index === 0) return `/create?id=${id}`
  if (index === 1) return `/create/script?id=${id}`
  if (index === 2) return `/create/theme?id=${id}`
  return null
}
