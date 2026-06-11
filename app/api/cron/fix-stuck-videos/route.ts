import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Cron job: finds videos stuck at "assembling" and checks if the MP4
 * actually exists in Supabase storage. If found, marks as completed.
 *
 * Run every 2 minutes via Vercel Cron or external cron service.
 * GET /api/cron/fix-stuck-videos
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Find videos stuck in assembling/generating for more than 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: stuckVideos } = await admin
    .from('videos')
    .select('id, user_id, title, status, created_at')
    .in('status', ['assembling', 'generating_audio', 'generating_slides', 'starting', 'scripting'])
    .lt('created_at', fiveMinAgo)
    .limit(20)

  if (!stuckVideos || stuckVideos.length === 0) {
    return NextResponse.json({ fixed: 0, failed: 0, checked: 0 })
  }

  let fixed = 0
  let failed = 0

  for (const video of stuckVideos) {
    const videoPath = `${video.user_id}/${video.id}.mp4`
    const { data: urlData } = admin.storage.from('videos').getPublicUrl(videoPath)

    try {
      // Check if the MP4 file exists in storage
      const res = await fetch(urlData.publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })

      if (res.ok) {
        // Video file exists — mark as completed
        const thumbPath = `${video.user_id}/${video.id}_thumb.png`
        const { data: thumbUrl } = admin.storage.from('videos').getPublicUrl(thumbPath)

        // Check for individual slide images
        const slideUrls: string[] = []
        for (let i = 0; i < 30; i++) {
          const slidePath = `${video.user_id}/${video.id}_slide_${i}.png`
          const { data: slideUrl } = admin.storage.from('videos').getPublicUrl(slidePath)
          const slideCheck = await fetch(slideUrl.publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null)
          if (slideCheck?.ok) {
            slideUrls.push(slideUrl.publicUrl)
          } else {
            break // No more slides
          }
        }

        await admin.from('videos').update({
          video_url: urlData.publicUrl,
          thumbnail_url: thumbUrl.publicUrl,
          status: 'completed',
          progress_detail: null,
          progress_pct: 100,
          ...(slideUrls.length > 0 ? { slide_urls: slideUrls } : {}),
        }).eq('id', video.id)

        console.log(`[cron] Fixed stuck video: ${video.title?.slice(0, 40)} (${video.id})`)
        fixed++
      } else {
        // No file — check if it's been stuck for over 30 minutes
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        if (video.created_at < thirtyMinAgo) {
          await admin.from('videos').update({
            status: 'failed',
            error_message: 'Video generation timed out. Please retry.',
            progress_detail: null,
            progress_pct: 0,
          }).eq('id', video.id)
          console.log(`[cron] Marked as failed (timeout): ${video.title?.slice(0, 40)} (${video.id})`)
          failed++
        }
      }
    } catch {
      // Skip this video on error
    }
  }

  return NextResponse.json({ fixed, failed, checked: stuckVideos.length })
}
