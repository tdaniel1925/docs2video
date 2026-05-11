import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * Fire-and-forget pipeline trigger.
 * Called after the video record is created with _pipeline_input.
 * Reads the input from the DB and calls generate-video internally.
 * Returns immediately — the pipeline runs in the background.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { videoId } = await request.json() as { videoId: string }
  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })

  const admin = createAdminClient()

  // Read the pipeline input from the video record
  const { data: video } = await admin
    .from('videos')
    .select('id, status, script, user_id')
    .eq('id', videoId)
    .single()

  if (!video || video.user_id !== user.id) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (video.status !== 'pending') {
    return NextResponse.json({ error: 'Video already started' }, { status: 400 })
  }

  const input = (video.script as any)?._pipeline_input
  if (!input) {
    return NextResponse.json({ error: 'No pipeline input found' }, { status: 400 })
  }

  // Mark as starting so it doesn't get triggered again by the fallback on video detail page
  await admin.from('videos').update({ status: 'starting' }).eq('id', videoId)

  // Fire-and-forget: call generate-video internally
  const xHost = request.headers.get('x-forwarded-host')
  const reqOrigin = request.headers.get('origin')
  const origin = reqOrigin
    ? reqOrigin
    : xHost
    ? `https://${xHost}`
    : 'https://docs2video.com'

  // Get auth cookies to forward
  const cookieHeader = request.headers.get('cookie') ?? ''

  fetch(`${origin}/api/generate-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    },
    body: JSON.stringify({
      videoId: video.id,
      policyData: input.policyData,
      brandId: input.brandId,
      voiceId: input.voiceId,
      styleId: input.styleId,
      approvedSlides: input.approvedSlides,
      preGeneratedScenes: input.scenes,
      preGeneratedAudioId: input.preGeneratedAudioId,
      detailed: input.detailed,
      musicUrl: input.musicUrl,
    }),
  }).catch(err => {
    console.error(`[start-pipeline] Failed to trigger for ${videoId}:`, err)
    // Reset status so it can be retried
    admin.from('videos').update({ status: 'pending' }).eq('id', videoId)
  })

  // Return immediately — pipeline is running in background
  return NextResponse.json({ started: true })
}
