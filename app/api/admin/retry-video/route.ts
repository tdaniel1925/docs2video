import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin , isAdminRequest } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'
export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdminRequest(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { videoId } = await request.json() as { videoId: string }
  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    // Load the video's owner + original inputs so we can actually RE-RUN
    // generation, not just flip the status (the old behaviour left it 'pending'
    // forever with nothing picking it up).
    const { data: video, error: loadErr } = await admin
      .from('videos')
      .select('id, user_id, draft_data')
      .eq('id', videoId)
      .single()
    if (loadErr || !video) throw loadErr || new Error('Video not found')

    // Reset to a claimable state.
    const { error: resetErr } = await admin
      .from('videos')
      .update({ status: 'pending', error_message: null, progress_pct: 0, progress_detail: null })
      .eq('id', videoId)
    if (resetErr) throw resetErr

    // Re-trigger generation server-to-server as the video's OWNER, replaying the
    // original inputs from draft_data. generate-video claims status in
    // ('draft','failed','pending'), so the reset above lets it proceed.
    const draft = (video.draft_data as any) || {}
    const internalSecret = (process.env.INTERNAL_API_SECRET || '').trim()
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').trim().replace(/\/+$/, '')
    if (!internalSecret) {
      // Without the internal secret we can't re-trigger; surface clearly.
      return NextResponse.json({ error: 'INTERNAL_API_SECRET not configured — cannot re-trigger generation' }, { status: 500 })
    }

    const genBody = {
      videoId: video.id,
      policyData: draft.policyData ?? draft.extractedData ?? null,
      brandId: draft.brandId ?? null,
      voiceId: draft.voiceId,
      detailLevel: draft.detailLevel,
      narrationStyle: draft.narrationStyle,
      purpose: draft.purpose,
      uploadMode: draft.uploadMode,
      industry: draft.industry,
      preGeneratedScenes: draft.scenes ?? undefined,
    }

    // Fire-and-forget — generate-video runs the pipeline in waitUntil.
    fetch(`${baseUrl}/api/generate-video`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-service': internalSecret,
        'x-internal-user-id': video.user_id,
      },
      body: JSON.stringify(genBody),
    }).catch((e) => console.error('[admin/retry-video] re-trigger failed:', e))

    await logAdminAction(user.id, 'retry_video', video.user_id, { videoId })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/retry-video] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
