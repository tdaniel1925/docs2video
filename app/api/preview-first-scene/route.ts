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
  const body = await request.json().catch(() => ({})) as { videoId?: string; output?: string; look?: string; voiceId?: string; drawStyle?: string }
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
