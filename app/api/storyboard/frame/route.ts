import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { filmEngineFor } from '../../../_lib/film-engine'
import type { Storyboard } from '../../../_lib/storyboard'
import { drawFrame, framePlan, frameSig, storyboardContext } from '../../../_lib/storyboard-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Frames drawn per project per day (a frame is drawn again only when its scene, words or look changed). */
const FRAMES_PER_DAY = 60

/*
 * POST /api/storyboard/frame { videoId, key } — the still frame of one storyboard scene, drawn by the render
 * service exactly as the video will draw it (KitVideo, the film engine, this project's look, logo and photo).
 * Kept with the scene: the same scene, words and look are never drawn twice. A still, never a clip (owner rule).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { videoId?: string; key?: string }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (!(await filmEngineFor(user.id))) return NextResponse.json({ error: 'The storyboard is not switched on for this account.' }, { status: 403 })
  const admin = createAdminClient()
  const { data: row } = await admin.from('videos').select('id, draft_data').eq('id', String(body.videoId || '')).eq('user_id', user.id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'We couldn’t find that project.' }, { status: 404 })
  const draft = (row.draft_data ?? {}) as Record<string, unknown>
  const board = draft.storyboard as Storyboard | undefined
  const entry = board?.entries.find((e) => e.key === body.key)
  if (!board || !entry) return NextResponse.json({ error: 'That scene changed. Reopen the storyboard.' }, { status: 409 })

  const ctx = await storyboardContext(admin, user.id, draft)
  const plan = framePlan(ctx, draft, entry)
  const sig = frameSig(plan)
  if (entry.frame?.sig === sig) return NextResponse.json({ url: entry.frame.url })

  const day = new Date().toISOString().slice(0, 10)
  const used = board.frames?.day === day ? board.frames.n : 0
  if (used >= FRAMES_PER_DAY) return NextResponse.json({ error: 'That’s all the pictures for today. Your words are saved; the pictures come back tomorrow.' }, { status: 429 })
  try {
    const url = await drawFrame({ userId: user.id, videoId: row.id, plan, sig })
    // Save on the freshest draft (another frame or an edit may have saved meanwhile).
    const fresh = await admin.from('videos').select('draft_data').eq('id', row.id).maybeSingle()
    const d = (fresh.data?.draft_data ?? draft) as Record<string, unknown>
    const b = (d.storyboard ?? board) as Storyboard
    const e = b.entries.find((x) => x.key === entry.key)
    if (e) e.frame = { url, sig }
    b.frames = { day, n: (b.frames?.day === day ? b.frames.n : 0) + 1 }
    await admin.from('videos').update({ draft_data: { ...d, storyboard: b } }).eq('id', row.id)
    return NextResponse.json({ url })
  } catch (err) {
    console.error(`[storyboard frame ${row.id}] ${(err as Error).message}`)
    return NextResponse.json({ error: 'We couldn’t draw this picture just now. Your words are saved.' }, { status: 502 })
  }
}
