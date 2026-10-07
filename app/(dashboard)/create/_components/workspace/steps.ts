/**
 * THE FOUR STEPS — one list, used by the step rail (desktop), the one-line
 * "Step 2 of 4 · The story" bar (phone) and the guard test.
 *
 *   1 What it's about   /create                         client, goal, content
 *   2 Check the story   /create/script (/brief forwards) points and scenes
 *   3 Make it yours     /create/theme (+ /brand, /voice) look, voice, price, make
 *   4 Send it           /create/generating → the result page
 *
 * The waiting screen IS step 4, so it keeps the rail too: people waiting on
 * a video should still see where they are and what they chose.
 *
 * Pure on purpose (no React) so a test can check every path.
 */
export const STEPS = [
  { label: 'What it’s about', short: 'What it’s about', hint: 'Client, goal, your document', paths: ['/create'] },
  { label: 'Check the story', short: 'The story', hint: 'Points and scenes — free', paths: ['/create/brief', '/create/script'] },
  { label: 'Make it yours', short: 'Make it yours', hint: 'Look, voice, what to send', paths: ['/create/theme', '/create/brand', '/create/voice'] },
  { label: 'Send it', short: 'Send it', hint: 'Making it, then one link', paths: ['/create/generating'] },
] as const

/** Which step (0-based) a path belongs to, or -1 for pages outside the flow
 *  (the commercial maker has its own screen). */
export function stepIndexFor(pathname: string): number {
  return STEPS.findIndex((s) => (s.paths as readonly string[]).includes(pathname))
}

/** The phone's one line: "Step 2 of 4 · The story". */
export function phoneStepLine(index: number): string {
  const s = STEPS[index]
  return s ? `Step ${index + 1} of ${STEPS.length} · ${s.short}` : ''
}
