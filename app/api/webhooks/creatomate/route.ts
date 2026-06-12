import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { getRender } from '../../../_lib/creatomate'
import { addTopupCredits } from '../../../_lib/credits'
import { sendNotification } from '../../../_lib/notify'
import { fireApiWebhook } from '../../../_lib/api-webhook'
import { refundApiCredits } from '../../../_lib/api-auth'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/webhooks/creatomate — render completion for pipeline v2.
 * Creatomate webhooks are unsigned, so we only take the render id from the
 * payload and re-fetch the render from their API (authenticated) before
 * trusting status, URL, or metadata.
 */
export async function POST(request: Request) {
  let renderId: string | undefined
  try {
    const body = await request.json()
    renderId = typeof body?.id === 'string' ? body.id : undefined
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  if (!renderId) return NextResponse.json({ error: 'Missing render id' }, { status: 400 })

  let render
  try {
    render = await getRender(renderId)
  } catch (err) {
    console.error(`[creatomate-webhook] Could not verify render ${renderId}:`, err)
    // 500 so Creatomate retries the webhook
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }

  let meta: { videoId?: string; userId?: string; deductedCost?: number } = {}
  try {
    meta = JSON.parse(render.metadata || '{}')
  } catch { /* ignore */ }
  const { videoId, userId, deductedCost } = meta
  if (!videoId || !userId) {
    console.error(`[creatomate-webhook] Render ${renderId} has no video metadata — ignoring`)
    return NextResponse.json({ received: true })
  }

  const admin = createAdminClient()

  if (render.status === 'succeeded' && render.url) {
    try {
      // Copy the MP4 into our own storage (Creatomate URLs are temporary)
      const mp4Res = await fetch(render.url, { signal: AbortSignal.timeout(90000) })
      if (!mp4Res.ok) throw new Error(`MP4 download failed (HTTP ${mp4Res.status})`)
      const mp4 = Buffer.from(await mp4Res.arrayBuffer())

      const videoPath = `${userId}/${videoId}.mp4`
      const { error: upErr } = await admin.storage.from('videos').upload(videoPath, mp4, {
        contentType: 'video/mp4',
        upsert: true,
      })
      if (upErr) throw new Error(`MP4 upload failed: ${upErr.message}`)

      const { data: urlData } = admin.storage.from('videos').getPublicUrl(videoPath)
      await admin.from('videos').update({
        status: 'completed',
        video_url: urlData.publicUrl,
        progress_detail: null,
        progress_pct: 100,
      }).eq('id', videoId)

      await sendNotification(admin, userId, {
        type: 'video_ready',
        title: 'Your video is ready',
        message: 'Your video has finished rendering.',
        link: `/videos/${videoId}`,
      })
      await fireApiWebhook(videoId)
      console.log(`[creatomate-webhook] Video ${videoId} completed (render ${renderId})`)
      return NextResponse.json({ received: true })
    } catch (err) {
      console.error(`[creatomate-webhook] Finalize failed for video ${videoId}:`, err)
      // 500 so Creatomate retries — the render URL is still valid
      return NextResponse.json({ error: 'Finalize failed' }, { status: 500 })
    }
  }

  if (render.status === 'failed') {
    const message = render.error_message || 'Video rendering failed'
    console.error(`[creatomate-webhook] Render failed for video ${videoId}: ${message}`)

    // API jobs are metered against the API credit pool, not UI credits.
    const { data: vrow } = await admin
      .from('videos')
      .select('draft_data')
      .eq('id', videoId)
      .single()
    const isApiJob = (vrow?.draft_data as any)?.source === 'api'

    if (deductedCost && deductedCost > 0) {
      try {
        if (isApiJob) {
          await refundApiCredits(userId, deductedCost)
        } else {
          await addTopupCredits(userId, deductedCost, `refund: failed video ${videoId}`)
        }
      } catch (refundErr) {
        console.error(`[creatomate-webhook] Refund failed for video ${videoId}:`, refundErr)
      }
    }
    await admin.from('videos').update({
      status: 'failed',
      error_message: message,
    }).eq('id', videoId)
    await sendNotification(admin, userId, {
      type: 'video_failed',
      title: 'Video generation failed',
      message,
      link: `/videos/${videoId}`,
    })
    await fireApiWebhook(videoId)
    return NextResponse.json({ received: true })
  }

  // Intermediate statuses (planned/rendering) — acknowledge and ignore
  return NextResponse.json({ received: true })
}
