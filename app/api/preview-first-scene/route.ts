import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { isAdminRequest } from '../../_lib/admin'
import { logError } from '../../_lib/error-logger'
import { PRESENTATION_TEMPLATES } from '../../_lib/presentation'
import {
  CAP_REACHED_MESSAGE, CAP_WINDOW_SECS, FREE_PREVIEWS_PER_DAY, VIDEO_PREVIEW_LOOKS,
  capDecision, lookNote, narrationSample, previewCapKey, previewsLeft, voiceForPreview,
} from '../../_lib/first-scene-preview'
import { audioCacheKey } from '../../_lib/first-scene-preview-keys'
import { isTemplateColors, isVideoTemplate, videoTemplate, type TemplateColors, type VideoTemplateId } from '../../_lib/video-templates'
import { buildTemplatePreview, previewState, templatePreviewPaths, type PreviewFiles } from '../../_lib/template-preview'
import { startTemplatePreview } from '../../_lib/explainer-engine'
import { SENDER_PROFILE_COLS, type SenderProfile } from '../../_lib/video-sender'
import type { Brand } from '../../_lib/types'
import type { User } from '@supabase/supabase-js'
import {
  alreadyStored, buildPreviewPlan, drawPreviewStill, loadPreviewBrand, previewStoragePath, publicUrlFor,
  renderPreviewStill, storeVoice, synthesizePreviewVoice,
} from '../../_lib/first-scene-preview-server'

// FREE FIRST-SCENE PREVIEW (step 3, "Make it yours").
//
//   GET  ?videoId=…  → { remainingToday, limit }           (for the button label)
//   POST { videoId, output?, look?, voiceId? }
//        → { imageUrl, audioUrl, remainingToday, voiceNote, lookNote }
//
// A still picture of the first content scene in the chosen look, drawn by that
// look's real renderer (Drawn slides: one real AI picture, ~0.3c), plus ~10 s of the voice reading it. 3 per account per
// UTC day (admins unlimited), counted in the existing rate_limits table. It
// NEVER charges credits — nothing here imports the credit code, and a test
// keeps it that way. A preview whose picture and voice are both already
// stored (nothing changed since last time) is free to us and isn't counted.

export const runtime = 'nodejs'
export const maxDuration = 60

type Admin = ReturnType<typeof createAdminClient>

/** Previews used today (0 when there's no row yet). Throws if the table can't be read. */
async function usedToday(admin: Admin, key: string): Promise<number> {
  const { data, error } = await admin.from('rate_limits').select('count').eq('key', key).maybeSingle()
  if (error) throw new Error(`rate_limits read: ${error.message}`)
  return Number((data as { count?: number } | null)?.count ?? 0)
}

/** A preview that failed on our side shouldn't use up one of the day's three. */
async function giveBack(admin: Admin, key: string): Promise<void> {
  try {
    const n = await usedToday(admin, key)
    if (n > 0) await admin.from('rate_limits').update({ count: n - 1 }).eq('key', key).eq('count', n)
  } catch { /* best effort */ }
}

/** Tell the owner: error log (admin Logs) + the ops email, like the health cron. */
function alertOwner(message: string, detail: Record<string, unknown>) {
  logError('preview-first-scene', new Error(message), detail)
  if (process.env.NODE_ENV !== 'production') return
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com'
  fetch(`${base}/api/internal/error-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-secret': process.env.VIDEO_ASSEMBLY_SECRET || '' },
    body: JSON.stringify({ source: 'app', stage: 'preview-first-scene', message, detail: JSON.stringify(detail).slice(0, 2000), videoId: detail.videoId, userId: detail.userId }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {})
}

async function signedInUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await signedInUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const admin = createAdminClient()
  const isAdmin = await isAdminRequest(user)
  let used = 0
  try { used = isAdmin ? 0 : await usedToday(admin, previewCapKey(user.id, new Date())) } catch { /* show the full count */ }
  return NextResponse.json({ remainingToday: previewsLeft(used, isAdmin), limit: FREE_PREVIEWS_PER_DAY })
}

export async function POST(request: Request) {
  const user = await signedInUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { videoId?: string; output?: string; look?: string; voiceId?: string; drawStyle?: string; templateId?: unknown; templateColors?: unknown }
  const videoId = typeof body.videoId === 'string' ? body.videoId : ''
  if (!videoId) return NextResponse.json({ error: 'Missing project.' }, { status: 400 })

  const admin = createAdminClient()
  // OWNER ONLY: someone else's project id finds nothing.
  const { data: row } = await admin.from('videos').select('id, user_id, title, output_type, draft_data')
    .eq('id', videoId).eq('user_id', user.id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'We couldn’t find that project.' }, { status: 404 })
  const draft = (row.draft_data ?? {}) as Record<string, unknown>

  // The choices on screen win (the Make screen saves them only when Make is
  // pressed); the draft fills in anything not sent. Each is checked.
  const outputRaw = body.output ?? draft.outputType ?? row.output_type ?? 'video'
  const output = outputRaw === 'interactive' || outputRaw === 'deck' || outputRaw === 'video' ? outputRaw : String(outputRaw)
  const isPres = output === 'interactive' || output === 'deck'
  // A draft saved for the scene kit stores videoStyle 'kit' + kitLook; its preview look is "kit:<look>".
  const savedVideoLook = draft.videoStyle === 'kit' ? `kit:${typeof draft.kitLook === 'string' ? draft.kitLook : 'animated-slides'}` : draft.videoStyle
  const lookRaw = body.look ?? (isPres ? draft.presentationTemplate : savedVideoLook)
  const look = isPres
    ? (PRESENTATION_TEMPLATES.some((t) => t.id === lookRaw) ? String(lookRaw) : PRESENTATION_TEMPLATES[0].id)
    : ((VIDEO_PREVIEW_LOOKS as readonly string[]).includes(String(lookRaw)) ? String(lookRaw) : 'slides')
  const voiceId = typeof body.voiceId === 'string' ? body.voiceId : (typeof draft.voiceId === 'string' ? draft.voiceId : 'nova')

  if (output !== 'video' && !isPres) {
    return NextResponse.json({ error: 'Free previews are for videos and presentations.' }, { status: 400 })
  }

  const brand = await loadPreviewBrand(admin, user.id, draft)

  // A TEMPLATE (template-preview.ts): their own cover and first scene, laid out
  // in it by the render worker — a job, asked after until its pictures are in.
  if (output === 'video' && isVideoTemplate(body.templateId)) {
    const colors: TemplateColors = isTemplateColors(body.templateColors) ? body.templateColors : 'template'
    return templatePreview({ admin, user, videoId, rowTitle: row.title as string | null, draft, brand, templateId: body.templateId, colors, voiceId })
  }
  const plan = buildPreviewPlan({ output, look, draft, brand, rowTitle: row.title as string | null, drawStyle: body.drawStyle })
  if (!plan) return NextResponse.json({ error: 'Write your story first — the preview shows its first scene.' }, { status: 400 })

  const voicePick = voiceForPreview(output, look, voiceId)
  const sample = voicePick ? narrationSample(plan.narration) : ''
  const stillPath = previewStoragePath(user.id, 'still', plan.key)
  const stillUrl = publicUrlFor(admin, stillPath)
  const voiceKey = voicePick && sample ? audioCacheKey(sample, voicePick.engine, voicePick.voice) : null
  const voicePath = voiceKey ? previewStoragePath(user.id, 'voice', voiceKey) : null
  const voiceUrl = voicePath ? publicUrlFor(admin, voicePath) : null

  const [haveStill, haveVoice] = await Promise.all([alreadyStored(stillUrl), voiceUrl ? alreadyStored(voiceUrl) : Promise.resolve(true)])

  // ── The daily cap ──
  const isAdmin = await isAdminRequest(user)
  const capKey = previewCapKey(user.id, new Date())
  let used: number
  try { used = isAdmin ? 0 : await usedToday(admin, capKey) } catch (e) {
    alertOwner('Preview cap table unreadable', { videoId, userId: user.id, error: (e as Error).message })
    return NextResponse.json({ error: 'Previews are resting for a moment. Please try again shortly.' }, { status: 503 })
  }
  const free = haveStill && haveVoice // nothing to make — costs us nothing, not counted
  let counted = false
  if (!free) {
    if (!capDecision({ usedToday: used, isAdmin }).allowed) {
      return NextResponse.json({ error: CAP_REACHED_MESSAGE, code: 'preview_cap', remainingToday: 0 }, { status: 429 })
    }
    if (!isAdmin) {
      // Atomic count (two tabs pressing at once can't both get the third).
      const { data: ok, error } = await admin.rpc('rate_limit_hit', { p_key: capKey, p_max: FREE_PREVIEWS_PER_DAY, p_window_secs: CAP_WINDOW_SECS })
      if (error) {
        // Fail CLOSED: this spends real money, so no counter = no preview.
        alertOwner('Preview cap counter failed', { videoId, userId: user.id, error: error.message })
        return NextResponse.json({ error: 'Previews are resting for a moment. Please try again shortly.' }, { status: 503 })
      }
      if (ok !== true) return NextResponse.json({ error: CAP_REACHED_MESSAGE, code: 'preview_cap', remainingToday: 0 }, { status: 429 })
      counted = true
      used += 1
    }
  }

  try {
    const [imageUrl, audioUrl] = await Promise.all([
      haveStill ? Promise.resolve(stillUrl)
        // Drawn slides: one AI picture, drawn here (~0.3c); every other look by the render service.
        : plan.engine === 'drawn' ? drawPreviewStill(admin, stillPath, plan)
        : renderPreviewStill({ userId: user.id, videoId, plan }),
      (async () => {
        if (!voicePick || !voicePath || !voiceUrl) return null
        if (haveVoice) return voiceUrl
        await storeVoice(admin, voicePath, await synthesizePreviewVoice(sample, voicePick))
        return voiceUrl
      })(),
    ])
    return NextResponse.json({
      imageUrl, audioUrl,
      remainingToday: previewsLeft(used, isAdmin),
      voiceNote: voicePick?.note ?? null,
      lookNote: lookNote(output, look),
      sceneTitle: plan.sceneTitle,
      sampleText: sample || null,
      choice: { output, look, voiceId, ...(plan.engine === 'drawn' ? { drawStyle: plan.request.style } : {}) },
    })
  } catch (e) {
    if (counted) await giveBack(admin, capKey)
    alertOwner(`Free preview failed: ${(e as Error).message}`, { videoId, userId: user.id, output, look, engine: plan.engine })
    return NextResponse.json({
      error: 'We couldn’t make the preview just now. It didn’t use up one of your free previews — please try again.',
      remainingToday: previewsLeft(counted ? used - 1 : used, isAdmin),
    }, { status: 502 })
  }
}

// ── A TEMPLATE'S PREVIEW (template-preview.ts) ──────────────────────────────
// Same cap and the same never-charges rule as every free preview. Its
// pictures are drawn on the render worker, which takes about a minute: the
// first press starts the job and answers 202 (pending); the page asks again
// every few seconds and gets the pictures once both are in storage — or, if
// the worker could not make them, an error and the free preview back.

type PendingNote = { at: string; counted: boolean; capKey: string | null }

/** One listing of the customer's previews folder says which of this preview's files are there. */
async function previewFiles(admin: Admin, paths: ReturnType<typeof templatePreviewPaths>): Promise<{ files: PreviewFiles; note: PendingNote | null }> {
  const { data, error } = await admin.storage.from('videos').list(paths.folder, { search: paths.prefix, limit: 20 })
  if (error) throw new Error(`previews list: ${error.message}`)
  const names = new Set((data ?? []).map((f) => f.name))
  const name = (p: string) => p.slice(paths.folder.length + 1)
  let note: PendingNote | null = null
  if (names.has(name(paths.pending))) {
    const dl = await admin.storage.from('videos').download(paths.pending)
    if (dl.data) { try { note = JSON.parse(await dl.data.text()) as PendingNote } catch { note = null } }
  }
  const at = note?.at ? Date.parse(note.at) : NaN
  return {
    files: { cover: names.has(name(paths.cover)), scene: names.has(name(paths.scene)), failed: names.has(name(paths.failed)), pendingAt: Number.isFinite(at) ? at : null },
    note,
  }
}

async function templatePreview(o: {
  admin: Admin; user: User; videoId: string; rowTitle: string | null; draft: Record<string, unknown>; brand: Brand | null
  templateId: VideoTemplateId; colors: TemplateColors; voiceId: string
}): Promise<NextResponse> {
  const { admin, user, videoId } = o
  const { data: profile } = await admin.from('profiles').select(SENDER_PROFILE_COLS).eq('id', user.id).maybeSingle()
  const plan = buildTemplatePreview({ draft: o.draft, brand: o.brand, profile: (profile as SenderProfile | null) ?? null, templateId: o.templateId, colors: o.colors, rowTitle: o.rowTitle })
  if (!plan) return NextResponse.json({ error: 'Write your story first — the preview shows its first scene.' }, { status: 400 })
  const paths = templatePreviewPaths(user.id, plan.key)
  const isAdmin = await isAdminRequest(user)
  const capKey = previewCapKey(user.id, new Date())
  const choice = { output: 'video', look: 'template', voiceId: o.voiceId, templateId: o.templateId, templateColors: o.colors }
  const lookName = videoTemplate(o.templateId)?.name ?? 'this template'

  // The voice reading the first scene, as every free preview has.
  const voicePick = voiceForPreview('video', 'slides', o.voiceId)
  const sample = voicePick ? narrationSample(plan.narration) : ''
  const voiceKey = voicePick && sample ? audioCacheKey(sample, voicePick.engine, voicePick.voice) : null
  const voicePath = voiceKey ? previewStoragePath(user.id, 'voice', voiceKey) : null
  const voiceUrl = voicePath ? publicUrlFor(admin, voicePath) : null
  const voiceReady = async (): Promise<string | null> => {
    if (!voicePick || !voicePath || !voiceUrl) return null
    if (await alreadyStored(voiceUrl)) return voiceUrl
    await storeVoice(admin, voicePath, await synthesizePreviewVoice(sample, voicePick))
    return voiceUrl
  }
  const usedNow = async () => { try { return isAdmin ? 0 : await usedToday(admin, capKey) } catch { return 0 } }
  const clear = (...p: string[]) => admin.storage.from('videos').remove(p).then(() => {}, () => {})

  let state: ReturnType<typeof previewState>, note: PendingNote | null
  try {
    const got = await previewFiles(admin, paths)
    state = previewState(got.files, Date.now()); note = got.note
  } catch (e) {
    alertOwner('Template preview storage unreadable', { videoId, userId: user.id, error: (e as Error).message })
    return NextResponse.json({ error: 'Previews are resting for a moment. Please try again shortly.' }, { status: 503 })
  }

  if (state === 'ready') {
    let audioUrl: string | null = null
    try { audioUrl = await voiceReady() } catch { audioUrl = null }
    if (note) void clear(paths.pending)
    return NextResponse.json({
      imageUrl: publicUrlFor(admin, paths.cover), sceneUrl: publicUrlFor(admin, paths.scene), audioUrl,
      remainingToday: previewsLeft(await usedNow(), isAdmin),
      voiceNote: voicePick?.note ?? null,
      lookNote: `Your own cover and first scene in ${lookName}${plan.colors === 'brand' ? ', in your brand’s colors' : ''} — every scene of the video is laid out the same way.`,
      sceneTitle: plan.sceneTitle, sampleText: sample || null, choice,
    })
  }

  if (state === 'failed' || state === 'stale') {
    // Not made: the free preview it used is given back, and the next press starts afresh.
    if (note?.counted && note.capKey) await giveBack(admin, note.capKey)
    void clear(paths.pending, paths.failed)
    alertOwner(`Template preview ${state === 'stale' ? 'timed out' : 'failed'}`, { videoId, userId: user.id, template: o.templateId, key: plan.key })
    return NextResponse.json({
      error: 'We couldn’t make the preview just now. It didn’t use up one of your free previews — please try again.',
      remainingToday: previewsLeft(await usedNow(), isAdmin),
    }, { status: 502 })
  }

  if (state === 'pending') {
    return NextResponse.json({ pending: true, remainingToday: previewsLeft(await usedNow(), isAdmin), choice }, { status: 202 })
  }

  // ── Start it: one of the day's free previews, counted as every preview is. ──
  let used: number
  try { used = isAdmin ? 0 : await usedToday(admin, capKey) } catch (e) {
    alertOwner('Preview cap table unreadable', { videoId, userId: user.id, error: (e as Error).message })
    return NextResponse.json({ error: 'Previews are resting for a moment. Please try again shortly.' }, { status: 503 })
  }
  if (!capDecision({ usedToday: used, isAdmin }).allowed) {
    return NextResponse.json({ error: CAP_REACHED_MESSAGE, code: 'preview_cap', remainingToday: 0 }, { status: 429 })
  }
  let counted = false
  if (!isAdmin) {
    const { data: ok, error } = await admin.rpc('rate_limit_hit', { p_key: capKey, p_max: FREE_PREVIEWS_PER_DAY, p_window_secs: CAP_WINDOW_SECS })
    if (error) {
      alertOwner('Preview cap counter failed', { videoId, userId: user.id, error: error.message })
      return NextResponse.json({ error: 'Previews are resting for a moment. Please try again shortly.' }, { status: 503 })
    }
    if (ok !== true) return NextResponse.json({ error: CAP_REACHED_MESSAGE, code: 'preview_cap', remainingToday: 0 }, { status: 429 })
    counted = true
    used += 1
  }
  const pending: PendingNote = { at: new Date().toISOString(), counted, capKey: counted ? capKey : null }
  try {
    const up = await admin.storage.from('videos').upload(paths.pending, Buffer.from(JSON.stringify(pending)), { contentType: 'application/json', upsert: true })
    if (up.error) throw new Error(`pending note: ${up.error.message}`)
    const [started] = await Promise.all([
      startTemplatePreview({
        userId: user.id, key: plan.key, templateId: plan.templateId, title: plan.title, scenes: plan.scenes,
        identity: plan.identity, forbidden: plan.forbidden, colors: plan.colors, palette: plan.palette, pageCount: plan.pageCount,
        logoUrl: plan.logoUrl, photoUrl: plan.photoUrl, presenter: plan.presenter,
      }),
      voiceReady().catch(() => null), // ready by the time the pictures are
    ])
    console.log(`[preview-first-scene ${videoId}] template ${plan.templateId} preview job ${started.jobId}`)
    return NextResponse.json({ pending: true, remainingToday: previewsLeft(used, isAdmin), choice }, { status: 202 })
  } catch (e) {
    if (counted) await giveBack(admin, capKey)
    void clear(paths.pending)
    alertOwner(`Template preview could not start: ${(e as Error).message}`, { videoId, userId: user.id, template: o.templateId })
    return NextResponse.json({
      error: 'We couldn’t make the preview just now. It didn’t use up one of your free previews — please try again.',
      remainingToday: previewsLeft(counted ? used - 1 : used, isAdmin),
    }, { status: 502 })
  }
}
