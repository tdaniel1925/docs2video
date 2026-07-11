import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { logError } from '../../_lib/error-logger'
import { videoServiceUrl } from '../../_lib/video-service'
import { checkCredits, deductCredits, getCreditCost, refundVideoCredits } from '../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 60

const VIDEO_ASSEMBLY_URL = videoServiceUrl()
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

/**
 * Fix-a-Scene — re-record/edit ONE scene of a slide-deck video without redoing
 * the whole thing. The VPS reuses the persisted plan + other scenes' VO; only
 * the edited scene gets a fresh voiceover, then it re-renders + re-fits timing.
 *
 * Billing (the user's rule: never charge to fix OUR mistakes):
 *   - action 'rerecord'          → FREE  (fixes a TTS glitch)
 *   - action 'fix-pronunciation' → FREE  (fixes a mispronunciation)
 *   - action 'edit-text'         → charged (the user changed their content)
 *   - previewOnly (hear the new VO before committing) → always FREE
 *
 * Body: { videoId, sceneId, action, newText?, pronounce?:{word,say}, previewOnly? }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { videoId, sceneId, action, newText, pronounce, previewOnly } = body || {}
  if (!videoId || sceneId == null || !action) {
    return NextResponse.json({ error: 'Missing videoId, sceneId, or action' }, { status: 400 })
  }
  const validActions = ['rerecord', 'edit-text', 'fix-pronunciation']
  if (!validActions.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const admin = createAdminClient()
  // ownership check
  const { data: video } = await admin.from('videos').select('id, user_id, status').eq('id', videoId).eq('user_id', user.id).single()
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

  // BILLING: only content edits (edit-text) that are NOT previews are charged.
  const isBillable = action === 'edit-text' && !previewOnly
  let charged = 0
  if (isBillable) {
    const cost = getCreditCost('slide-scene-fix')
    const check = await checkCredits(user.id, cost)
    if (!check.allowed) {
      return NextResponse.json({ error: `Not enough credits. This edit costs ${cost} credits.`, needed: cost, remaining: check.remaining }, { status: 402 })
    }
    const ok = await deductCredits(user.id, cost, 'slide-scene-fix', videoId, `Fix-a-Scene: edited scene ${sceneId}`)
    if (!ok) return NextResponse.json({ error: 'Could not reserve credits. Please try again.' }, { status: 402 })
    charged = cost
  }

  // pre-check the VPS is up
  try {
    const health = await fetch(`${VIDEO_ASSEMBLY_URL}/health`, { signal: AbortSignal.timeout(6000) })
    if (!health.ok) throw new Error(`health ${health.status}`)
  } catch {
    // refund if we charged and can't proceed
    if (charged) await refundVideoCredits(user.id, charged, videoId)
    return NextResponse.json({ error: 'Video service is temporarily unavailable. Please try again shortly.' }, { status: 503 })
  }

  if (!previewOnly) {
    await admin.from('videos').update({ status: 'processing', progress_pct: 8, progress_detail: action === 'edit-text' ? 'Applying your edit…' : 'Re-recording the scene…' }).eq('id', videoId)
  }

  try {
    const res = await fetch(`${VIDEO_ASSEMBLY_URL}/re-render-scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({ videoId, userId: user.id, sceneId, action, newText, pronounce, previewOnly: !!previewOnly }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`VPS ${res.status}: ${(await res.text()).slice(0, 160)}`)
    return NextResponse.json({ success: true, videoId, charged, previewOnly: !!previewOnly })
  } catch (e: any) {
    const isAbort = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    if (isAbort) return NextResponse.json({ success: true, videoId, charged, previewOnly: !!previewOnly }) // VPS accepted, working async
    if (charged) await refundVideoCredits(user.id, charged, videoId)
    logError('fix-scene', e, { userId: user.id, videoId, action })
    return NextResponse.json({ error: 'Could not start the scene fix.', videoId }, { status: 502 })
  }
}
