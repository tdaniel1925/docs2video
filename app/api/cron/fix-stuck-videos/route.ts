import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { getRender } from '../../../_lib/creatomate'
import { deductCredits } from '../../../_lib/credits'
import { sendNotification } from '../../../_lib/notify'
import { announceVideoReady, sweepReadyVideos } from '../../../_lib/video-ready'
import {
  IN_PROGRESS_STATUSES, VIDEO_CHARGE_ACTIONS, VIDEO_REFUND_ACTIONS,
  chargeCount, ledgerOutstanding, readVideoLedger, refundVerifiedCharge,
} from '../../../_lib/video-billing'

export const runtime = 'nodejs'
export const maxDuration = 60

// The statuses that mean a video is mid-flight live in app/_lib/video-billing.ts
// (IN_PROGRESS_STATUSES) — ONE list shared with generate-video's one-at-a-time
// limit, so the two can never disagree about what "running" means. 'pending'
// is in it: a video created 'pending' that never moved on used to strand the
// generating page forever because the cron didn't watch it.
const RUNNING = IN_PROGRESS_STATUSES as unknown as string[]

/**
 * Cron: reconcile stuck videos. For V2 (Creatomate) jobs it re-queries the
 * render; for V1 (the render service) it checks storage for the MP4. Force-fails truly stale
 * jobs AND refunds the deducted credits (audit H1), recovers V2 renders whose
 * webhook never landed (audit H4), and uses an activity-staleness window
 * (progress_updated_at) rather than absolute age (audit M1/M2).
 *
 * GET /api/cron/fix-stuck-videos  (run every ~2 min)
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  // Reconcile STUCK SCRIPTS: a draft whose background script-gen was killed
  // mid-flight stays on draft_data.scriptStatus='generating' forever (the
  // function died before its catch could write 'failed'). Fail any that have
  // been generating > 10 min so the wizard stops polling indefinitely.
  let scriptsFailed = 0
  try {
    const tenMinAgoMs = Date.now() - 10 * 60 * 1000
    const tenMinAgo = new Date(tenMinAgoMs).toISOString()
    const { data: stuckDrafts } = await admin
      .from('videos')
      .select('id, draft_data, updated_at, created_at')
      .eq('status', 'draft')
      .lt('created_at', tenMinAgo)
      .limit(50)
    for (const d of stuckDrafts || []) {
      const dd = (d.draft_data || {}) as Record<string, unknown>
      // Measure from when the script job STARTED (scriptStartedAt), not from
      // when the draft was made: a draft created an hour ago whose script began
      // a minute ago is working, not stuck. Older drafts without the stamp fall
      // back to created_at, as before.
      const startedMs = typeof dd.scriptStartedAt === 'string'
        ? new Date(dd.scriptStartedAt).getTime()
        : new Date(d.created_at).getTime()
      if (dd.scriptStatus === 'generating' && startedMs < tenMinAgoMs) {
        await admin.from('videos').update({
          draft_data: { ...dd, scriptStatus: 'failed', scriptError: 'Script generation timed out. Please try again.' },
        }).eq('id', d.id)
        scriptsFailed++
      }
    }
  } catch { /* non-fatal — continue to video reconciliation */ }

  // Render-service failures (review B1): the render service writes status='failed' ITSELF after
  // its early ACK, so those rows never match the in-progress filter below — yet
  // the user was told "your credits were refunded" and nothing ever refunded.
  // A failed row with deducted_cost>0 MAY be charged-but-not-refunded, so sweep
  // those — but refund only what the LEDGER proves was charged for that video
  // and not yet given back (audit C1). deducted_cost sits on a row the user can
  // edit, so it is a hint, never the amount: a hand-made 'failed' row with no
  // real charge behind it refunds nothing and just gets its number cleared.
  // (created_at buffer lets an in-flight failAndRefund finish first; the refund
  // itself is idempotent per-charge, so overlap is harmless.)
  let refundedFailed = 0
  try {
    const { data: failedCharged } = await admin
      .from('videos')
      .select('id, user_id, deducted_cost')
      .eq('status', 'failed')
      .gt('deducted_cost', 0)
      .lt('created_at', fiveMinAgo)
      .limit(25)
    for (const v of failedCharged || []) {
      try {
        if (await refundVerifiedCharge(admin, v) > 0) refundedFailed++
      } catch (e) {
        console.error(`[fix-stuck-videos] refund check failed for ${v.id}:`, e instanceof Error ? e.message : e)
      }
    }
  } catch { /* non-fatal — next run retries */ }

  // Completed-after-refund (review B22): a slow render can finish AFTER the
  // staleness sweep refunded it — the user then has BOTH the delivered video
  // and their money back. Detect recent completed rows whose ledger shows a
  // refund with no recharge, and re-deduct the refunded amount. Idempotent via
  // the 'recharge_video' ledger row; bounded to the last 24h.
  let recharged = 0
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentCompleted } = await admin
      .from('videos')
      .select('id, user_id, video_url, updated_at')
      .eq('status', 'completed')
      .eq('deducted_cost', 0)
      .not('video_url', 'is', null)
      .gt('updated_at', dayAgo)
      .limit(10)
    for (const v of recentCompleted || []) {
      // Read the owner's WHOLE ledger for this video. Re-charge only when the
      // video is, on balance, unpaid (every charge was given back) — never on
      // top of a charge that still stands. That is what stops a video that
      // finished after being failed from charging twice when the user had also
      // pressed Retry (charge #2 is still in force, so nothing more is taken).
      const txs = await readVideoLedger(admin, v.id, v.user_id)
      // Only a VIDEO render can be re-charged here. Presentations used to be
      // refunded with the video refund action too; without this check a
      // presentation that failed once and then built fine was charged again.
      if (chargeCount(txs, VIDEO_CHARGE_ACTIONS) === 0) continue
      if (ledgerOutstanding(txs, VIDEO_CHARGE_ACTIONS, VIDEO_REFUND_ACTIONS) > 0) continue
      const lastRefund = [...txs].reverse().find(t => t.action === 'refund_video' || t.action === 'refund_video_retry')
      if (!lastRefund) continue
      const amount = Math.abs(lastRefund.amount || 0)
      if (amount <= 0) continue
      const ok = await deductCredits(v.user_id, amount, 'recharge_video', v.id,
        `Recharge: video completed after refund (+video kept, ${amount} credits re-charged)`)
      if (ok) {
        await admin.from('videos').update({ deducted_cost: amount }).eq('id', v.id)
        recharged++
        await sendNotification(admin, v.user_id, {
          type: 'video_ready',
          title: 'Your video completed',
          message: 'A video that was refunded finished rendering after all — the credits were re-applied since the video was delivered.',
          link: `/videos/${v.id}`,
        }).catch(() => {})
      }
      // Insufficient balance → deduct returns false; retried next runs until
      // they have credits (harmless no-op attempts, gated by the ledger check).
    }
  } catch { /* non-fatal */ }

  // "Your video is ready": the render service marks videos done itself, so
  // this is where the app learns about it. One bell notice + one email per
  // project (app/_lib/video-ready.ts keeps it to once).
  let readyEmails = 0
  try { readyEmails = await sweepReadyVideos(admin) } catch { /* non-fatal — next run retries */ }

  const { data: stuckVideos } = await admin
    .from('videos')
    .select('id, user_id, title, status, output_type, created_at, progress_updated_at, deducted_cost, creatomate_render_id, slide_urls, thumbnail_url')
    .in('status', RUNNING)
    .lt('created_at', fiveMinAgo)
    .limit(25)

  if (!stuckVideos || stuckVideos.length === 0) {
    return NextResponse.json({ fixed: 0, failed: 0, recovered: 0, checked: 0, scriptsFailed, refundedFailed, recharged, readyEmails })
  }

  let fixed = 0, failed = 0, recovered = 0

  // Force-fail + refund a job and notify the user. The refund is checked
  // against the ledger (audit C1) and is idempotent per charge.
  const forceFail = async (video: any, message: string): Promise<boolean> => {
    // Only fail a row that is STILL running: if the renderer finished (or failed
    // it itself) between our read and now, leave its result alone.
    const { data: flipped } = await admin.from('videos').update({
      status: 'failed', error_message: message, progress_detail: null, progress_pct: 0,
    }).eq('id', video.id).in('status', RUNNING).select('id')
    if (!flipped || flipped.length === 0) return false
    let refunded = 0
    try { refunded = await refundVerifiedCharge(admin, video) } catch (e) {
      console.error(`[fix-stuck-videos] refund failed for ${video.id}:`, e instanceof Error ? e.message : e)
    }
    await sendNotification(admin, video.user_id, {
      type: 'video_failed',
      title: 'Video generation failed',
      message: `${video.title?.slice(0, 40) || 'Your video'} could not be completed.${refunded > 0 ? ' Your credits were refunded.' : ''}`,
      link: `/videos/${video.id}`,
    }).catch(() => {})
    return true
  }

  // Staleness: no progress write in 10 min (fall back to created_at if the
  // column was never set). A long-but-live render keeps bumping progress.
  const tenMinAgo = Date.now() - 10 * 60 * 1000
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000
  const isStale = (v: any) => {
    const last = v.progress_updated_at ? new Date(v.progress_updated_at).getTime() : new Date(v.created_at).getTime()
    return last < tenMinAgo
  }

  for (const video of stuckVideos) {
    try {
      // --- V2 path: a Creatomate render id means we can ask Creatomate directly ---
      if (video.creatomate_render_id) {
        let render: { status: string; url?: string } | null = null
        try { render = await getRender(video.creatomate_render_id) } catch { render = null }

        if (render?.status === 'succeeded' && render.url) {
          // Webhook never finalized — recover the MP4 ourselves.
          try {
            const mp4Res = await fetch(render.url, { signal: AbortSignal.timeout(90000) })
            if (mp4Res.ok) {
              const mp4 = Buffer.from(await mp4Res.arrayBuffer())
              const path = `${video.user_id}/${video.id}.mp4`
              await admin.storage.from('videos').upload(path, mp4, { contentType: 'video/mp4', upsert: true })
              const { data: pub } = admin.storage.from('videos').getPublicUrl(path)
              await admin.from('videos').update({
                status: 'completed', video_url: pub.publicUrl, progress_detail: null, progress_pct: 100,
                ...(video.thumbnail_url ? {} : (video.slide_urls?.[0] ? { thumbnail_url: video.slide_urls[0] } : {})),
              }).eq('id', video.id)
              await announceVideoReady(admin, { ...video, status: 'completed' }).catch(() => 'skipped')
              recovered++
              continue
            }
          } catch { /* fall through to staleness check */ }
        } else if (render?.status === 'failed') {
          if (await forceFail(video, 'Video rendering failed.')) failed++
          continue
        }
        // render still planned/rendering, or recovery failed → only fail if stale.
        if (isStale(video) && await forceFail(video, 'Video generation timed out.')) failed++
        continue
      }

      // --- V1 path: no render id → check storage for the finished MP4 ---
      const videoPath = `${video.user_id}/${video.id}.mp4`
      const { data: urlData } = admin.storage.from('videos').getPublicUrl(videoPath)
      const res = await fetch(urlData.publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })

      if (res.ok) {
        const thumbPath = `${video.user_id}/${video.id}_thumb.png`
        const { data: thumbUrl } = admin.storage.from('videos').getPublicUrl(thumbPath)
        const slideUrls: string[] = []
        for (let i = 0; i < 30; i++) {
          const slidePath = `${video.user_id}/${video.id}_slide_${i}.png`
          const { data: slideUrl } = admin.storage.from('videos').getPublicUrl(slidePath)
          const slideCheck = await fetch(slideUrl.publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null)
          if (slideCheck?.ok) slideUrls.push(slideUrl.publicUrl); else break
        }
        await admin.from('videos').update({
          video_url: urlData.publicUrl, thumbnail_url: thumbUrl.publicUrl, status: 'completed',
          progress_detail: null, progress_pct: 100,
          ...(slideUrls.length > 0 ? { slide_urls: slideUrls } : {}),
        }).eq('id', video.id)
        await announceVideoReady(admin, { ...video, status: 'completed' }).catch(() => 'skipped')
        fixed++
      } else {
        // No MP4 yet — force-fail only if stale (no progress in 10 min) AND
        // older than 30 min absolute, so a slow-but-live render service render survives.
        // A job WAITING IN LINE on the render service is alive too: the render
        // service now stamps progress_updated_at every couple of minutes while it
        // waits for its render slot (audit H3), so isStale() stays false for it
        // and it is no longer failed + refunded and then charged again on finish.
        const old = new Date(video.created_at).getTime() < thirtyMinAgo
        if (isStale(video) && old && await forceFail(video, 'Video generation timed out.')) failed++
      }
    } catch {
      // Skip this video on error; next run retries.
    }
  }

  return NextResponse.json({ fixed, failed, recovered, checked: stuckVideos.length, scriptsFailed, refundedFailed, recharged, readyEmails })
}
