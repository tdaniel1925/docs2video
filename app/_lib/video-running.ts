/**
 * Every status that means "this job is still running". ONE list, used by the
 * one-at-a-time limit in generate-video, the stuck-video cron, and the
 * generating page — so a job the cron watches always counts against the limit,
 * and the page never spins forever on a status it doesn't recognise.
 *
 * Pure (no imports) so browser pages can use it too.
 */
export const IN_PROGRESS_STATUSES = [
  'pending', 'starting', 'scripting', 'generating_slides', 'generating_audio',
  'assembling', 'queued', 'processing', 'rendering',
] as const

/**
 * RESTART RULE (audit 2026-10-09: "restart = free video").
 *
 * Restart refunds the running job's charge and starts a fresh one. If it is
 * allowed while the first job is still working, the first job can finish
 * AFTER its charge was given back — a free video. So Restart is only for a
 * job that has really gone quiet (no progress written for 15 minutes) or has
 * already failed. A job that is still writing progress is left alone.
 */
export const RESTART_QUIET_MS = 15 * 60 * 1000

export type RestartDecision =
  | { ok: true; kind: 'stalled' | 'failed' }
  | { ok: false; reason: 'still_working' | 'not_running' }

export function restartDecision(
  row: { status?: string | null; progress_updated_at?: string | null; created_at?: string | null },
  nowMs: number,
): RestartDecision {
  const status = String(row.status || '')
  if (status === 'failed') return { ok: true, kind: 'failed' }
  if (!(IN_PROGRESS_STATUSES as readonly string[]).includes(status)) return { ok: false, reason: 'not_running' }
  const lastRaw = row.progress_updated_at || row.created_at
  const last = lastRaw ? new Date(lastRaw).getTime() : NaN
  // No usable time at all → we can't prove it went quiet; leave it running.
  if (!Number.isFinite(last)) return { ok: false, reason: 'still_working' }
  return nowMs - last >= RESTART_QUIET_MS ? { ok: true, kind: 'stalled' } : { ok: false, reason: 'still_working' }
}
