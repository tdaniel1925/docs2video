// =============================================================================
// When does "someone watched your video" deserve an email + text?
//
// Before: every single view — including the agent's own previews, a client
// refreshing the page, and a question being asked (which was counted as a new
// view). Agents got buried and had no way to turn it down.
//
// Now the agent picks (Activity page → View alerts):
//   'all'   — (default, same idea as before) one alert per viewer, then quiet
//             for COOLDOWN_HOURS for that same viewer on that same video
//   'first' — only the very first time each viewer opens a video
//   'off'   — no email or text (views still show in the dashboard)
// The owner's own views never alert (the route checks that before this).
// =============================================================================

export type ViewAlertPref = 'all' | 'first' | 'off'
export const VIEW_ALERT_PREFS: ViewAlertPref[] = ['all', 'first', 'off']
export const COOLDOWN_HOURS = 12

export function normalizePref(v: unknown): ViewAlertPref {
  return VIEW_ALERT_PREFS.includes(v as ViewAlertPref) ? (v as ViewAlertPref) : 'all'
}

/**
 * Counts INCLUDE the view being handled right now (it's recorded first), so
 * "1" means "this is the only one".
 */
export function shouldSendViewAlert(o: {
  pref: ViewAlertPref
  viewsFromViewerInCooldown: number
  viewsFromViewerEver: number
}): boolean {
  if (o.pref === 'off') return false
  if (o.pref === 'first') return o.viewsFromViewerEver <= 1
  return o.viewsFromViewerInCooldown <= 1
}
