import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { IN_PROGRESS_STATUSES, refundVerifiedCharge } from '../../../../_lib/video-billing'
import { RESTART_QUIET_MS, restartDecision } from '../../../../_lib/video-running'
import { alertOps } from '../../../../_lib/ops-alert'
export const maxDuration = 30

/**
 * POST /api/videos/{id}/restart — the "Restart Generation" button on a video
 * that seems stuck.
 *
 * THE FIRST BUG THIS FIXES. The button used to set the running row straight
 * back to 'pending' from the browser. The next run then charged again, and the
 * first charge was never given back. Restarting cost the customer twice.
 *
 * THE SECOND BUG (audit 2026-10-09, "restart = free video"). Restart refunded a
 * job that was still WORKING. The first job then finished anyway and the
 * customer had the video with their money back. Now Restart only works on a
 * job that has gone quiet — no progress written for 15 minutes — or one that
 * already failed. (The render service also refuses to mark a row finished once
 * it has been failed, and the stuck-video cron re-charges a video that
 * finishes after a refund.)
 *
 * On the server:
 *   1. a quiet running row is marked 'failed' (only if it is STILL running and
 *      STILL quiet, so a progress write or a second click can't race it);
 *   2. the charge the ledger says is still owed for it is refunded — the same
 *      ledger-checked refund the cron uses, so nothing is refunded twice;
 *   3. the old run's file is removed and the row goes back to 'pending'; the
 *      page starts a fresh run, which charges once, as normal.
 * If step 2 or 3 fails, the row is left 'failed' with its charge noted, which
 * is exactly what the stuck-video cron picks up and refunds — never lost.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const running = IN_PROGRESS_STATUSES as unknown as string[]

  // Read the row first (owner-scoped) to decide whether a restart is allowed.
  const { data: current, error: readErr } = await admin
    .from('videos')
    .select('id, user_id, status, progress_updated_at, created_at, deducted_cost')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (readErr) {
    console.error('[videos/restart] could not read the video:', readErr.message)
    return NextResponse.json({ error: 'Could not restart this video. Please try again.' }, { status: 500 })
  }
  if (!current) return NextResponse.json({ error: 'We couldn’t find that video.' }, { status: 404 })

  const decision = restartDecision(current, Date.now())
  if (!decision.ok) {
    return decision.reason === 'still_working'
      ? NextResponse.json({
          error: 'This video is still being made — it wrote progress in the last 15 minutes. Please give it a little longer. If nothing changes for 15 minutes, you can restart it.',
          code: 'still_working',
        }, { status: 409 })
      : NextResponse.json({ error: 'This video is no longer running — refresh the page to see where it ended up.' }, { status: 409 })
  }

  let row: { id: string; user_id: string; deducted_cost: number | null } | undefined
  if (decision.kind === 'stalled') {
    // Step 1 — owner-scoped, only while still running AND still quiet.
    const cutoff = new Date(Date.now() - RESTART_QUIET_MS).toISOString()
    const { data: claimed, error: claimErr } = await admin
      .from('videos')
      .update({
        status: 'failed',
        error_message: 'Restarted by you',
        progress_detail: 'Restarting...',
        progress_updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .in('status', running)
      .or(`progress_updated_at.lt.${cutoff},and(progress_updated_at.is.null,created_at.lt.${cutoff})`)
      .select('id, user_id, deducted_cost')
    if (claimErr) {
      console.error('[videos/restart] could not stop the old run:', claimErr.message)
      return NextResponse.json({ error: 'Could not restart this video. Please try again.' }, { status: 500 })
    }
    row = claimed?.[0] as typeof row
    if (!row) {
      // It wrote progress (or finished) between our read and now.
      return NextResponse.json({ error: 'This video just moved on — refresh the page to see where it is.' }, { status: 409 })
    }
  } else {
    row = { id: current.id, user_id: current.user_id, deducted_cost: current.deducted_cost }
  }

  // Step 2 — give back what the first run was charged (ledger-checked).
  let refunded = 0
  try {
    refunded = await refundVerifiedCharge(admin, row)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[videos/restart] refund failed for ${id} — the stuck-video cron will retry it:`, msg)
    await alertOps({ source: 'videos/restart', stage: 'refund', message: `Restart refund failed (the cron will retry): ${msg}`, videoId: id, userId: user.id })
    return NextResponse.json({ error: 'We stopped the old run but could not restart it yet. Press "Try again" in a moment — you won’t be charged twice.' }, { status: 500 })
  }

  // Step 3 — remove the old run's file (so a late upload from it can't be
  // picked up as this video), then ready for a fresh run.
  await admin.storage.from('videos').remove([`${user.id}/${id}.mp4`]).catch(() => {})
  const { error: pendErr } = await admin
    .from('videos')
    .update({ status: 'pending', error_message: null, progress_pct: 0, progress_detail: 'Restarting...', progress_updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'failed')
  if (pendErr) {
    console.error('[videos/restart] could not set the row back to pending:', pendErr.message)
    return NextResponse.json({ error: 'We stopped the old run but could not restart it. Press "Try again".' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, refunded })
}
