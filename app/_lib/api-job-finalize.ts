import type { SupabaseClient } from '@supabase/supabase-js'
import { refundApiCredits } from './api-auth'
import { fireApiWebhook } from './api-webhook'

// =============================================================================
// FINISHING A PUBLIC-API JOB (audit 2026-10-09).
//
// An API job (POST /api/v1/videos, /commercials, /presentations) is charged
// up front from the account's credits. When it later FAILED on the render
// service, or the stuck-video cron failed it, nothing refunded those credits
// and the caller's webhook never fired — they paid and were never told. A job
// that finished on the render service never fired its webhook either.
//
// finalizeApiJob does it once per job, whoever gets there first (the failure
// path in generate-video or the cron sweep):
//   1. claim the job (draft_data.apiFinalizedAt, only if not already set);
//   2. failed → refund its API charge with the job's own refund key (so it is
//      refunded once even if another path also refunds);
//   3. fire the caller's webhook.
// =============================================================================

export interface ApiJobRow {
  id: string
  user_id: string
  status: string
  draft_data: Record<string, unknown> | null
}

export type FinalizeResult = 'not_api' | 'not_finished' | 'already_done' | 'refunded' | 'notified'

export async function finalizeApiJob(admin: SupabaseClient, row: ApiJobRow): Promise<FinalizeResult> {
  const dd = (row.draft_data || {}) as Record<string, unknown>
  if (dd.source !== 'api') return 'not_api'
  if (row.status !== 'failed' && row.status !== 'completed') return 'not_finished'
  if (dd.apiFinalizedAt) return 'already_done'

  // 1. Claim — only one path finishes a job.
  const { data: claimed, error } = await admin
    .from('videos')
    .update({ draft_data: { ...dd, apiFinalizedAt: new Date().toISOString() } })
    .eq('id', row.id)
    .is('draft_data->>apiFinalizedAt', null)
    .select('id')
  if (error || !claimed || claimed.length === 0) return 'already_done'

  // 2. A failed job gives its API credits back (once — keyed by the job).
  //    Skipped when a route already refunded it before refunds carried the
  //    job's key: such a route logged the job as 'failed' in api_usage_log.
  let result: FinalizeResult = 'notified'
  const cost = Number(dd.apiCost) || 0
  if (row.status === 'failed' && cost > 0 && !(await alreadyRefunded(admin, row.id))) {
    if (await refundApiCredits(row.user_id, cost, row.id)) result = 'refunded'
  }

  // 3. Tell the caller.
  await fireApiWebhook(row.id)
  return result
}

/** True if this job's charge was already given back (a 'failed' usage log line
 *  from the v1 route, or an api_refund ledger line carrying the job id). An
 *  unreadable answer counts as "already refunded" — never refund twice; the
 *  owner is told by the refund path if anything is owed. */
async function alreadyRefunded(admin: SupabaseClient, jobId: string): Promise<boolean> {
  const [usage, ledger] = await Promise.all([
    admin.from('api_usage_log').select('id').eq('video_id', jobId).eq('status', 'failed').limit(1),
    admin.from('credit_transactions').select('id').eq('video_id', jobId).eq('action', 'api_refund').limit(1),
  ])
  if (usage.error || ledger.error) {
    const { alertOps } = await import('./ops-alert')
    await alertOps({ source: 'api', stage: 'job-refund-check', message: `Could not check whether failed API job ${jobId} was refunded, so it was NOT refunded automatically. Check it by hand.`, videoId: jobId })
    return true
  }
  return (usage.data?.length ?? 0) > 0 || (ledger.data?.length ?? 0) > 0
}

/** Jobs made before this went live were finished the old way; leave them be. */
export const API_FINALIZE_SINCE = '2026-10-10T00:00:00Z'

/** The cron sweep: recent finished API jobs that haven't been finished off yet. */
export async function sweepApiJobs(admin: SupabaseClient, limit = 25): Promise<number> {
  const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weekAgo = new Date(Math.max(weekAgoMs, Date.parse(API_FINALIZE_SINCE))).toISOString()
  const { data, error } = await admin
    .from('videos')
    .select('id, user_id, status, draft_data')
    .eq('draft_data->>source', 'api')
    .in('status', ['failed', 'completed'])
    .is('draft_data->>apiFinalizedAt', null)
    .gt('created_at', weekAgo)
    .limit(limit)
  if (error) throw new Error(`api job sweep read failed: ${error.message}`)
  let done = 0
  for (const row of (data || []) as ApiJobRow[]) {
    const r = await finalizeApiJob(admin, row)
    if (r === 'refunded' || r === 'notified') done++
  }
  return done
}
