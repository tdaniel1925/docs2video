/**
 * Single source of truth for the % shown while a video is building.
 *
 * The server emits only a few coarse progress milestones (script ~18, asset gen
 * ~30, render 72-90, finalize 90+). Showing the raw `progress_pct` makes the bar
 * sit frozen for long stretches AND made two screens disagree: the builder
 * screen smoothed/crept the number ahead while the dashboard showed the raw DB
 * value, so a user watching both saw e.g. 70% here and 30% there.
 *
 * `displayProgress(rawPct)` maps the raw milestone to the value a user should
 * SEE — a stable representative percent per phase. Both the builder (which eases
 * toward it) and the dashboard (which shows it directly) call this, so they
 * always read the same number.
 */
export function displayProgress(rawPct: number | null | undefined): number {
  const p = typeof rawPct === 'number' && Number.isFinite(rawPct) ? rawPct : 0
  if (p <= 0) return 5            // just started — show a little movement, never 0
  if (p >= 100) return 100
  if (p >= 90) return 95          // finalizing (encode/upload)
  if (p >= 72) return Math.min(94, Math.round(p))  // render: real frame %, capped just under finalize
  if (p >= 30) return 65          // asset generation (slides + audio)
  if (p >= 18) return 25          // scripting / setup
  return Math.max(10, Math.round(p))
}
