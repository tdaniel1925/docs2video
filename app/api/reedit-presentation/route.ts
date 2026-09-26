import { NextResponse } from 'next/server'
import { VIDEO_WORKING } from '../../_lib/video-status'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { CREDIT_COSTS, deductCredits, getBalance } from '../../_lib/credits'
import { PRESENTATION_EDIT_CHARGE_ACTION, refundPresentationEditCharge } from '../../_lib/video-billing'
import type { PresentationScene } from '../../_lib/presentation'

// =============================================================================
// Save edited slides and rebuild the presentation.
//
// The editor (manual or AI) hands back the full scene list; this saves it and
// re-runs the same generator that built the deck the first time — so every
// safeguard the original build had (the unconditional compliance scrub, the
// disclaimer, the theme) applies to the edit identically. An edit path that
// rendered slides its own way would drift from the real one within a month.
//
// PRICING FOLLOWS WHAT ACTUALLY COSTS MONEY. Changing what a slide SHOWS is a
// re-render of HTML — effectively free, so it IS free. Changing what the voice
// SAYS means regenerating narration, so it bills at the existing Fix-a-Scene
// rate (50) per slide whose narration changed, capped well under the price of
// a fresh generation. A user should never be able to pay more for fixing a
// deck than for making a new one.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 300

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')
const INTERNAL_SECRET = (process.env.INTERNAL_API_SECRET || '').trim()
const PER_NARRATION_CHANGE = CREDIT_COSTS['slide-scene-fix'] // 50
const CAP = 300

function isScene(s: unknown): s is PresentationScene {
  if (!s || typeof s !== 'object') return false
  const o = s as Record<string, unknown>
  return typeof o.narration === 'string' && o.narration.length > 0
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    videoId?: string
    scenes?: PresentationScene[]
    /** true = report the price, change nothing */
    quoteOnly?: boolean
  } | null
  const videoId = String(body?.videoId ?? '')
  const scenes = Array.isArray(body?.scenes) ? body!.scenes.filter(isScene) : []
  if (!videoId || scenes.length < 3) {
    return NextResponse.json({ error: 'Need a presentation and at least 3 slides' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('videos')
    .select('id, user_id, output_type, status, draft_data, script')
    .eq('id', videoId)
    .single()
  if (error || !row) return NextResponse.json({ error: 'Presentation not found' }, { status: 404 })
  if (row.user_id !== user.id) return NextResponse.json({ error: 'Not yours' }, { status: 403 })
  if (row.output_type !== 'interactive' && row.output_type !== 'deck') {
    return NextResponse.json({ error: 'Only presentations and slide decks can be edited here' }, { status: 400 })
  }
  if (row.status !== 'completed') {
    return NextResponse.json({ error: 'Wait for the current build to finish first' }, { status: 409 })
  }

  // Price = narration changes only. Compare against what is CURRENTLY stored,
  // by position; added slides count as narration changes (they need a voice).
  const draft = (row.draft_data ?? {}) as Record<string, unknown>
  const before = (Array.isArray(draft.scenes) ? draft.scenes : []) as PresentationScene[]
  const norm = (t: unknown) => String(t ?? '').replace(/\s+/g, ' ').trim()
  let changed = 0
  for (let i = 0; i < scenes.length; i++) {
    if (norm(scenes[i].narration) !== norm(before[i]?.narration)) changed++
  }
  const cost = Math.min(changed * PER_NARRATION_CHANGE, CAP)

  if (body?.quoteOnly) {
    return NextResponse.json({ cost, narrationChanges: changed })
  }

  if (cost > 0) {
    const bal = await getBalance(user.id)
    if ((bal?.total ?? 0) < cost) {
      return NextResponse.json({ error: `Not enough credits (needs ${cost})`, cost }, { status: 402 })
    }
    const ok = await deductCredits(user.id, cost, PRESENTATION_EDIT_CHARGE_ACTION, videoId,
      `Edited narration on ${changed} slide(s)`)
    if (!ok) return NextResponse.json({ error: 'Could not charge credits' }, { status: 402 })
  }

  // Save the new scenes, mark the row as building again, then run the SAME
  // generator via the internal path (so it doesn't charge a second time).
  //
  // THE CLIENT'S LINK STAYS UP MEANWHILE. The published HTML is only replaced
  // when the rebuild succeeds (the generator uploads it as its last step), and
  // the public routes serve that file whatever the status says. If the rebuild
  // FAILS, we put the row back exactly as it was — old scenes, 'completed' —
  // so the share page and deck download keep showing the last good version
  // instead of going dark for good.
  const previous = {
    draft_data: row.draft_data,
    script: (row as { script?: unknown }).script ?? null,
    status: row.status,
  }
  const up = await admin.from('videos').update({
    draft_data: { ...draft, scenes },
    script: scenes,
    status: VIDEO_WORKING, progress_pct: 5, progress_detail: 'Rebuilding with your edits',
    progress_updated_at: new Date().toISOString(),
  }).eq('id', videoId)
  if (up.error) return NextResponse.json({ error: 'Could not start the rebuild. Nothing was changed.' }, { status: 500 })

  const restore = async (reason: string) => {
    const back = await admin.from('videos').update({
      draft_data: previous.draft_data,
      script: previous.script,
      status: previous.status,
      progress_pct: 100,
      progress_detail: 'Your last version is still live',
      error_message: `Edit not applied: ${reason}`.slice(0, 500),
      progress_updated_at: new Date().toISOString(),
    }).eq('id', videoId)
    if (back.error) console.error('[reedit-presentation] could not restore previous version:', back.error.message)
  }

  const templateId = (draft.presentationTemplate as string) || undefined
  let r: Response
  try {
    r = await fetch(`${BASE_URL}/api/generate-presentation`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-service': INTERNAL_SECRET,
        'x-internal-user-id': user.id,
      },
      body: JSON.stringify({ videoId, templateId, outputType: row.output_type }),
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'network error'
    await restore(reason)
    if (cost > 0) await refundPresentationEditCharge(user.id, videoId, cost).catch(() => {})
    return NextResponse.json({ error: 'The rebuild didn’t finish. Your previous version is still live — please try again.' }, { status: 500 })
  }
  if (!r.ok) {
    const msg = await r.json().catch(() => ({} as { error?: string }))
    await restore(msg.error || `rebuild failed (${r.status})`)
    // The generator refunds its own charge on failure — but on the INTERNAL
    // path it charged nothing, so the edit fee taken above would just be kept
    // for a rebuild that never happened. Give it back here — keyed per edit
    // attempt, so it can't collide with any other refund on this row.
    if (cost > 0) await refundPresentationEditCharge(user.id, videoId, cost).catch(() => {})
    return NextResponse.json({ error: `${msg.error || `Rebuild failed (${r.status})`}. Your previous version is still live.` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cost, narrationChanges: changed })
}
