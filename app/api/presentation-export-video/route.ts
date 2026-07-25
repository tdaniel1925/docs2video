import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, refundVideoCredits, CREDIT_COSTS } from '../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 60

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL
const VIDEO_ASSEMBLY_SECRET = process.env.VIDEO_ASSEMBLY_SECRET

/** POST { videoId } → queue the MP4 export of an interactive presentation on
 *  the VPS (real-time page capture + narration mux). Charges videoExport
 *  credits; the VPS sets videos.export_video_url when done (run migration
 *  20260724_export_video_url first). Already-exported rows return the URL
 *  free — re-export by design only happens after a regeneration. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!VIDEO_ASSEMBLY_URL || !VIDEO_ASSEMBLY_SECRET) {
    return NextResponse.json({ error: 'Export service not configured.' }, { status: 503 })
  }

  const { videoId } = await request.json().catch(() => ({}))
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: video } = await admin
    .from('videos')
    .select('id, user_id, status, output_type, video_url')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (video.output_type !== 'interactive' || video.status !== 'completed' || !video.video_url) {
    return NextResponse.json({ error: 'Only completed interactive presentations export to video.' }, { status: 400 })
  }

  // Existing export → free re-download (column read defensively: if the
  // migration hasn't run yet this query fails without breaking anything).
  try {
    const { data: ex } = await admin.from('videos').select('export_video_url').eq('id', videoId).single()
    if (ex?.export_video_url) return NextResponse.json({ ok: true, url: ex.export_video_url, existing: true })
  } catch { /* column not migrated yet — proceed */ }

  const cost = (CREDIT_COSTS as Record<string, number>).videoExport ?? 400
  const check = await checkCredits(user.id, cost)
  if (!check.allowed) {
    return NextResponse.json({ error: `Not enough credits — you need ${check.shortfall} more.` }, { status: 402 })
  }
  await deductCredits(user.id, cost, 'presentation_video_export', videoId)

  try {
    const res = await fetch(`${VIDEO_ASSEMBLY_URL}/export-presentation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      // Proxy URL, not the raw storage URL — Supabase serves stored HTML as
      // text/plain (anti-XSS), which would break Playwright's page scripts.
      body: JSON.stringify({
        videoId,
        htmlUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')}/api/public/presentation/${videoId}`,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Export service error (HTTP ${res.status})`)
    return NextResponse.json({ ok: true, queued: true })
  } catch (err) {
    await refundVideoCredits(user.id, cost, videoId).catch(() => {})
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed to start' },
      { status: 502 }
    )
  }
}
