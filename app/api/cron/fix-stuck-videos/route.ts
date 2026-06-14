import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { getRender } from '../../../_lib/creatomate'
import { refundVideoCredits } from '../../../_lib/credits'
import { sendNotification } from '../../../_lib/notify'

export const runtime = 'nodejs'
export const maxDuration = 60

// Statuses that mean a video is mid-flight. Keep in sync with generate-video /
// render-video. (audit M1: a single shared list — kept here as the canonical one.)
const IN_PROGRESS_STATUSES = ['assembling', 'generating_audio', 'generating_slides', 'starting', 'scripting', 'queued']

/**
 * Cron: reconcile stuck videos. For V2 (Creatomate) jobs it re-queries the
 * render; for V1 (VPS) it checks storage for the MP4. Force-fails truly stale
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

  const { data: stuckVideos } = await admin
    .from('videos')
    .select('id, user_id, title, status, created_at, progress_updated_at, deducted_cost, creatomate_render_id, slide_urls, thumbnail_url')
    .in('status', IN_PROGRESS_STATUSES)
    .lt('created_at', fiveMinAgo)
    .limit(25)

  if (!stuckVideos || stuckVideos.length === 0) {
    return NextResponse.json({ fixed: 0, failed: 0, recovered: 0, checked: 0 })
  }

  let fixed = 0, failed = 0, recovered = 0

  // Force-fail + refund a job and notify the user. Idempotent refund.
  const forceFail = async (video: any, message: string) => {
    await admin.from('videos').update({
      status: 'failed', error_message: message, progress_detail: null, progress_pct: 0,
    }).eq('id', video.id)
    if (video.deducted_cost && video.deducted_cost > 0) {
      await refundVideoCredits(video.user_id, video.deducted_cost, video.id)
    }
    await sendNotification(admin, video.user_id, {
      type: 'video_failed',
      title: 'Video generation failed',
      message: `${video.title?.slice(0, 40) || 'Your video'} could not be completed. Your credits were refunded.`,
      link: `/videos/${video.id}`,
    }).catch(() => {})
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
              await sendNotification(admin, video.user_id, {
                type: 'video_ready', title: 'Your video is ready', message: 'Your video has finished rendering.', link: `/videos/${video.id}`,
              }).catch(() => {})
              recovered++
              continue
            }
          } catch { /* fall through to staleness check */ }
        } else if (render?.status === 'failed') {
          await forceFail(video, 'Video rendering failed. Your credits were refunded.')
          failed++
          continue
        }
        // render still planned/rendering, or recovery failed → only fail if stale.
        if (isStale(video)) { await forceFail(video, 'Video generation timed out. Your credits were refunded.'); failed++ }
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
        fixed++
      } else {
        // No MP4 yet — force-fail only if stale (no progress in 10 min) AND
        // older than 30 min absolute, so a slow-but-live VPS render survives.
        const old = new Date(video.created_at).getTime() < thirtyMinAgo
        if (isStale(video) && old) { await forceFail(video, 'Video generation timed out. Your credits were refunded.'); failed++ }
      }
    } catch {
      // Skip this video on error; next run retries.
    }
  }

  return NextResponse.json({ fixed, failed, recovered, checked: stuckVideos.length })
}
