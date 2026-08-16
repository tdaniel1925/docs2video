/**
 * THE FIVE STEPS, IN ORDER — the one place that defines the flow.
 *
 * The sidebar, the progress state, and each page's Back/Next all read from here,
 * so the order lives in a single list. Changing the flow means editing this file
 * and nothing else. The wait screen (/design/making) and results
 * (/design/results) are deliberately NOT in this list — they are outside the
 * numbered steps.
 */
export type Step = { path: string; label: string; blurb: string }

export const STEPS: Step[] = [
  { path: '/design', label: 'What', blurb: 'What you’re making' },
  { path: '/design/style', label: 'Style', blurb: 'A look + your images' },
  { path: '/design/content', label: 'Content', blurb: 'What it says' },
  { path: '/design/sizes', label: 'Sizes', blurb: 'Where it’s used' },
  { path: '/design/summary', label: 'Review', blurb: 'Check and start' },
]

/** Longest-prefix match, so /design/style beats /design. */
export function activeStepIndex(pathname: string | null): number {
  if (!pathname) return 0
  return STEPS.reduce((best, s, i) => {
    const hit = pathname === s.path || pathname.startsWith(s.path + '/') || pathname.startsWith(s.path + '?')
    return hit && s.path.length > STEPS[best].path.length ? i : best
  }, 0)
}
