import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { IN_PROGRESS_STATUSES, refundVerifiedCharge } from '../../../../_lib/video-billing'
export const maxDuration = 30

/**
 * POST /api/videos/{id}/restart — the "Restart Generation" button on a video
 * that seems stuck.
 *
 * THE BUG THIS FIXES. The button used to set the running row straight back to
 * 'pending' from the browser. The next run then charged again, and the first
 * charge was never given back — the stuck-video cron only refunds rows marked
 * 'failed', and this row never was. Restarting cost the customer twice.
 *
 * Now, on the server:
 *   1. the running row is marked 'failed' (only if it is still running, so two
 *      clicks can't both restart it);
 *   2. the charge the ledger says is still owed for it is refunded — the same
 *      ledger-checked refund the cron uses, so nothing is refunded twice;
 *   3. the row goes back to 'pending', and the page starts a fresh run, which
 *      charges once, as normal.
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

  // Step 1 — owner-scoped, and only while the job is still running.
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
    .select('id, user_id, deducted_cost')
  if (claimErr) {
    console.error('[videos/restart] could not stop the old run:', claimErr.message)
    return NextResponse.json({ error: 'Could not restart this video. Please try again.' }, { status: 500 })
  }
  const row = claimed?.[0] as { id: string; user_id: string; deducted_cost: number | null } | undefined
  if (!row) {
    // Finished (or failed) in the meantime, or not this user's video.
    return NextResponse.json({ error: 'This video is no longer running — refresh the page to see where it ended up.' }, { status: 409 })
  }

  // Step 2 — give back what the first run was charged (ledger-checked).
  let refunded = 0
  try {
    refunded = await refundVerifiedCharge(admin, row)
  } catch (err) {
    console.error(`[videos/restart] refund failed for ${id} — the stuck-video cron will retry it:`, err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'We stopped the old run but could not restart it yet. Use "Retry Generation" in a moment — you won’t be charged twice.' }, { status: 500 })
  }

  // Step 3 — ready for a fresh run.
  const { error: pendErr } = await admin
    .from('videos')
    .update({ status: 'pending', error_message: null, progress_pct: 0, progress_detail: 'Restarting...' })
    .eq('id', id)
    .eq('status', 'failed')
  if (pendErr) {
    console.error('[videos/restart] could not set the row back to pending:', pendErr.message)
    return NextResponse.json({ error: 'We stopped the old run but could not restart it. Use "Retry Generation".' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, refunded })
}
