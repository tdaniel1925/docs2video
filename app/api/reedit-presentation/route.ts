import { NextResponse } from 'next/server'
import { VIDEO_WORKING } from '../../_lib/video-status'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { CREDIT_COSTS, deductCredits, getBalance, refundVideoCredits } from '../../_lib/credits'
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
    .select('id, user_id, output_type, status, draft_data')
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
    const ok = await deductCredits(user.id, cost, 'presentation-edit', videoId,
      `Edited narration on ${changed} slide(s)`)
    if (!ok) return NextResponse.json({ error: 'Could not charge credits' }, { status: 402 })
  }

  // Save the new scenes, mark the row as building again, then run the SAME
  // generator via the internal path (so it doesn't charge a second time).
  const up = await admin.from('videos').update({
    draft_data: { ...draft, scenes },
    script: scenes,
    status: VIDEO_WORKING, progress_pct: 5, progress_detail: 'Rebuilding with your edits',
    progress_updated_at: new Date().toISOString(),
  }).eq('id', videoId)
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 })

  const templateId = (draft.presentationTemplate as string) || undefined
  const r = await fetch(`${BASE_URL}/api/generate-presentation`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-service': INTERNAL_SECRET,
      'x-internal-user-id': user.id,
    },
    body: JSON.stringify({ videoId, templateId, outputType: row.output_type }),
  })
  if (!r.ok) {
    const msg = await r.json().catch(() => ({} as { error?: string }))
    // The generator refunds its own charge on failure — but on the INTERNAL
    // path it charged nothing, so the edit fee taken above would just be kept
    // for a rebuild that never happened. Give it back here.
    if (cost > 0) await refundVideoCredits(user.id, cost, videoId).catch(() => {})
    return NextResponse.json({ error: msg.error || `Rebuild failed (${r.status})` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cost, narrationChanges: changed })
}
