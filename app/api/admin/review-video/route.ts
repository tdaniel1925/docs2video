import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
import { refundVideoCredits } from '../../../_lib/credits'
import { retryQuote, rerunVideo } from '../../../_lib/admin/retry'

export const maxDuration = 30

/**
 * POST /api/admin/review-video  { videoId, action: 'approve' | 'reject' }
 * For videos held as `review_required` (unusual insurance numbers).
 *  - approve: release it to be made — the same re-run the Retry button uses,
 *    which charges the owner again (they were refunded when it was held).
 *  - reject: mark it failed with a plain reason; if any charge is somehow
 *    still outstanding it is given back (normally it already was).
 * Only acts on a row that is still waiting — a second click does nothing.
 */
export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { videoId, action } = (await request.json().catch(() => ({}))) as { videoId?: string; action?: string }
  if (!videoId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'videoId and action (approve|reject) are required' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: video } = await db.from('videos').select('id, user_id, status, deducted_cost').eq('id', videoId).maybeSingle()
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  if (video.status !== 'review_required') {
    return NextResponse.json({ error: 'This video is no longer waiting for review.' }, { status: 409 })
  }

  if (action === 'approve') {
    const quote = await retryQuote(videoId)
    const r = await rerunVideo(videoId)
    if (r.error) return NextResponse.json({ error: r.error }, { status: 500 })
    await logAdminAction(user.id, 'review_approve', video.user_id, { videoId, credits: quote?.credits ?? null })
    return NextResponse.json({ success: true })
  }

  // reject — only flips a row that is still waiting (no double action).
  const { data: flipped, error } = await db.from('videos')
    .update({ status: 'failed', error_message: 'Not approved after review. No credits were charged.', progress_pct: 0 })
    .eq('id', videoId).eq('status', 'review_required').select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!flipped?.length) return NextResponse.json({ error: 'This video is no longer waiting for review.' }, { status: 409 })
  if (video.deducted_cost && video.deducted_cost > 0) {
    await refundVideoCredits(video.user_id, video.deducted_cost, videoId)
  }
  await logAdminAction(user.id, 'review_reject', video.user_id, { videoId, refunded: video.deducted_cost ?? 0 })
  return NextResponse.json({ success: true })
}
