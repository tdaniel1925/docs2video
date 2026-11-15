import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { filmEngineFor } from '../../_lib/film-engine'
import { planKitVideoCached } from '../../_lib/kit-engine'
import { applyEdits, checkEdited, numberChecks, screenFields, storyKey, type SceneEdits, type Storyboard, type StoryboardEntry } from '../../_lib/storyboard'
import { storyboardContext, type StoryboardContext } from '../../_lib/storyboard-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/*
 * THE STORYBOARD (step 5, film engine on) — storyboard.ts.
 *   GET   ?videoId=          the saved storyboard (no planning, $0)
 *   POST  { videoId }        plan it (or re-plan after the story changed): the kit planner, cached — an unchanged
 *                            story reuses its plan for $0; edits on unchanged scenes are kept
 *   PATCH { videoId, key, edits }   change the words on screen of one scene; checked like the planner's own
 *                            scenes (numbers must be in the source) — refused with the reasons when they fail
 * Only for accounts the film engine is on for, and only the owner's project.
 */
type Admin = ReturnType<typeof createAdminClient>
type Row = { id: string; draft_data: Record<string, unknown> | null; status: string }

async function load(videoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) }
  if (!(await filmEngineFor(user.id))) return { error: NextResponse.json({ error: 'The storyboard is not switched on for this account.' }, { status: 403 }) }
  const admin = createAdminClient()
  const { data: row } = await admin.from('videos').select('id, draft_data, status').eq('id', videoId).eq('user_id', user.id).maybeSingle()
  if (!row) return { error: NextResponse.json({ error: 'We couldn’t find that project.' }, { status: 404 }) }
  return { user, admin, row: row as Row }
}

/** What the page shows for each scene. */
function view(board: Storyboard | undefined, draft: Record<string, unknown>, ctx: StoryboardContext | null) {
  const scenes = (Array.isArray(draft.scenes) ? draft.scenes : []) as { title?: string; narration?: string }[]
  return (board?.entries ?? []).map((e) => {
    const shown = applyEdits(e.scene, e.edits)
    const story = scenes.find((s) => storyKey(s.narration) === e.key)
    return {
      key: e.key, type: shown.type, title: story?.title ?? '', narration: story?.narration ?? shown.narration,
      fields: screenFields(shown), edited: !!e.edits && Object.keys(e.edits).length > 0,
      checks: ctx ? numberChecks(shown, ctx.input) : [], frame: e.frame?.url ?? null,
    }
  })
}

async function save(admin: Admin, row: Row, board: Storyboard) {
  const fresh = await admin.from('videos').select('draft_data').eq('id', row.id).maybeSingle()
  const draft = { ...((fresh.data?.draft_data as Record<string, unknown> | null) ?? row.draft_data ?? {}), storyboard: board }
  await admin.from('videos').update({ draft_data: draft }).eq('id', row.id)
  return draft
}

export async function GET(request: Request) {
  const videoId = new URL(request.url).searchParams.get('videoId') || ''
  const r = await load(videoId)
  if ('error' in r) return r.error
  const draft = r.row.draft_data ?? {}
  const board = draft.storyboard as Storyboard | undefined
  const ctx = board ? await storyboardContext(r.admin, r.user.id, draft) : null
  return NextResponse.json({ scenes: view(board, draft, ctx), planned: !!board })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { videoId?: string }
  const r = await load(String(body.videoId || ''))
  if ('error' in r) return r.error
  const draft = r.row.draft_data ?? {}
  const ctx = await storyboardContext(r.admin, r.user.id, draft)
  if (ctx.input.beats.filter((b) => b.role === 'content').length === 0) return NextResponse.json({ error: 'Write the story first: there are no scenes yet.' }, { status: 400 })
  const prev = (draft.storyboard as Storyboard | undefined) ?? { entries: [], at: '' }
  const planned = await planKitVideoCached(ctx.input, prev.cache)
  const entries: StoryboardEntry[] = []
  planned.result.scenes.forEach((s, i) => {
    const beat = ctx.input.beats[i]
    if (!beat || beat.role !== 'content') return
    const key = storyKey(beat.narration)
    const old = prev.entries.find((e) => e.key === key)
    entries.push({ key, scene: s, ...(old?.edits ? { edits: old.edits } : {}), ...(old?.frame ? { frame: old.frame } : {}) })
  })
  const board: Storyboard = { entries, at: new Date().toISOString(), cache: planned.cache, ...(prev.frames ? { frames: prev.frames } : {}) }
  const saved = await save(r.admin, r.row, board)
  console.log(`[storyboard ${r.row.id}] ${entries.length} scenes (${planned.result.source}, $${planned.result.costUsd.toFixed(4)}${planned.reused ? ', reused' : ''})`)
  return NextResponse.json({ scenes: view(board, saved, ctx), planned: true })
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as { videoId?: string; key?: string; edits?: SceneEdits }
  const r = await load(String(body.videoId || ''))
  if ('error' in r) return r.error
  const draft = r.row.draft_data ?? {}
  const board = draft.storyboard as Storyboard | undefined
  const entry = board?.entries.find((e) => e.key === body.key)
  if (!board || !entry) return NextResponse.json({ error: 'That scene changed. Reopen the storyboard.' }, { status: 409 })
  const edits: SceneEdits = Object.fromEntries(Object.entries(body.edits && typeof body.edits === 'object' ? body.edits : {}).map(([k, v]) => [String(k).slice(0, 40), String(v ?? '').slice(0, 160)]))
  const ctx = await storyboardContext(r.admin, r.user.id, draft)
  const shown = applyEdits(entry.scene, { ...entry.edits, ...edits })
  const index = Math.max(1, ctx.input.beats.findIndex((b) => storyKey(b.narration) === entry.key))
  const issues = checkEdited(shown, index, ctx.input)
  if (issues.length) return NextResponse.json({ error: 'Those words can’t go on screen as they are.', issues, checks: numberChecks(shown, ctx.input) }, { status: 422 })
  entry.edits = { ...entry.edits, ...edits }
  const saved = await save(r.admin, r.row, board)
  return NextResponse.json({ scenes: view(board, saved, ctx) })
}
