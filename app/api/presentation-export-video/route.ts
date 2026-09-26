import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, CREDIT_COSTS } from '../../_lib/credits'
import { EXPORT_CHARGE_ACTION, EXPORT_REFUND_ACTION, ledgerOutstanding, readVideoLedger, refundExportCharge } from '../../_lib/video-billing'

export const runtime = 'nodejs'
export const maxDuration = 60

const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL
const VIDEO_ASSEMBLY_SECRET = process.env.VIDEO_ASSEMBLY_SECRET

/** POST { videoId } → queue the MP4 export of an interactive presentation on
 *  the render service (real-time page capture + narration mux). Charges videoExport
 *  credits; the render service sets videos.export_video_url when done (run migration
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
    .select('id, user_id, status, output_type, video_url, updated_at')
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
    return NextResponse.json({ error: `Not enough credits — you need ${check.shortfall} more.`, code: 'insufficient_credits', needed: cost, balance: check.remaining }, { status: 402 })
  }

  // ONE EXPORT AT A TIME (H4). A double-click used to charge twice. Two guards:
  //  1. An export already paid for and still running (charged in the last 20
  //     minutes, not refunded, no MP4 yet) → report it as queued, charge nothing.
  //  2. A compare-and-set on updated_at, so of two clicks that arrive together
  //     only one gets past this point (the other sees the row changed → 409).
  try {
    const rows = await readVideoLedger(admin, videoId, user.id)
    const recent = rows.filter((r) => r.created_at && Date.now() - new Date(r.created_at).getTime() < 20 * 60 * 1000)
    if (ledgerOutstanding(recent, [EXPORT_CHARGE_ACTION], [EXPORT_REFUND_ACTION]) > 0) {
      return NextResponse.json({ ok: true, queued: true, existing: true })
    }
  } catch { /* ledger unreadable — the lock below still prevents a double charge */ }
  const lockedAt = new Date().toISOString()
  let lockQuery = admin.from('videos')
    .update({ updated_at: lockedAt })
    .eq('id', videoId).eq('user_id', user.id)
  lockQuery = video.updated_at ? lockQuery.eq('updated_at', video.updated_at) : lockQuery.is('updated_at', null)
  const { data: locked } = await lockQuery.select('id')
  if (!locked || locked.length === 0) {
    return NextResponse.json({ error: 'An export for this presentation is already starting.' }, { status: 409 })
  }

  const ok = await deductCredits(user.id, cost, EXPORT_CHARGE_ACTION, videoId)
  if (!ok) {
    return NextResponse.json({ error: 'We couldn’t take the credits for this export — please try again.', code: 'insufficient_credits', needed: cost }, { status: 402 })
  }

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
    // Its own refund key per export attempt — it used to share the video/
    // presentation refund marker, so it could be silently dropped.
    await refundExportCharge(user.id, videoId, cost).catch(() => {})
    console.error(`[presentation-export-video ${videoId}]`, err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'The video export couldn’t start right now. Your credits were refunded — please try again in a few minutes.' },
      { status: 502 }
    )
  }
}
