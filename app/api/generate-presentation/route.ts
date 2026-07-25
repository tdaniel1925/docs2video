import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, refundVideoCredits, CREDIT_COSTS } from '../../_lib/credits'
import { synthesizeSpeech } from '../../_lib/tts'
import { buildPresentationHtml, PRESENTATION_TEMPLATES, type PresentationScene } from '../../_lib/presentation'

export const runtime = 'nodejs'
// Interactive: per-scene TTS + assembly. Well under video times, but give room.
export const maxDuration = 300

/** POST { videoId, templateId, outputType: 'interactive' | 'deck' }
 *  The HTML-first generator: scenes (already written + edited in the wizard)
 *  → one self-contained presentation HTML in storage. No VPS, no ffmpeg.
 *  'interactive' narrates every scene; 'deck' is silent (PDF/PPTX exports
 *  come later from the same artifact). */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const videoId: string | undefined = body.videoId
  const outputType: 'interactive' | 'deck' = body.outputType === 'deck' ? 'deck' : 'interactive'
  const templateId: string = PRESENTATION_TEMPLATES.some((t) => t.id === body.templateId)
    ? body.templateId
    : PRESENTATION_TEMPLATES[0].id
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('videos')
    .select('id, user_id, title, draft_data, status')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const draft = (row.draft_data ?? {}) as Record<string, unknown>
  const scenes = (draft.scenes ?? []) as PresentationScene[]
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return NextResponse.json({ error: 'No scenes yet — finish the script step first.' }, { status: 400 })
  }

  // ── Credits: interactive 700 · deck reuses the existing deck price ──
  const costKey = outputType === 'interactive' ? 'interactive' : 'deck'
  const cost = (CREDIT_COSTS as Record<string, number>)[costKey] ?? 700
  const check = await checkCredits(user.id, cost)
  if (!check.allowed) {
    return NextResponse.json({ error: 'Not enough credits — you need ' + check.shortfall + ' more.', code: 'insufficient_credits' }, { status: 402 })
  }
  await deductCredits(user.id, cost, `presentation_${outputType}`, videoId)

  const setStatus = (status: string, pct: number, detail: string) =>
    admin.from('videos').update({
      status, progress_pct: pct, progress_detail: detail,
      progress_updated_at: new Date().toISOString(),
    }).eq('id', videoId)

  try {
    // ── Narration (interactive only) — parallel with bounded concurrency.
    // Sequential TTS blew the 300s function ceiling on long decks (the killed
    // function stranded the row at "assembling" with no refund). ──
    let voClips: string[] | undefined
    if (outputType === 'interactive') {
      await setStatus('generating_audio', 20, `Recording narration (0/${scenes.length})`)
      const voiceId = (draft.voiceId as string) || 'nova'
      const clips: string[] = new Array(scenes.length)
      let next = 0, done = 0
      const worker = async () => {
        while (true) {
          const idx = next++
          if (idx >= scenes.length) return
          const buf = await synthesizeSpeech(scenes[idx].narration ?? '', voiceId)
          clips[idx] = buf.toString('base64')
          done++
          if (done % 3 === 0 || done === scenes.length) {
            await setStatus('generating_audio', 20 + Math.round((done / scenes.length) * 45), `Recording narration (${done}/${scenes.length})`)
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(5, scenes.length) }, worker))
      voClips = clips
    }

    // ── Assemble the presentation ──
    await setStatus('assembling', 70, 'Assembling presentation')

    // Resolve brand + presenter identity from their real sources: the selected
    // brands row (company or person profile) and the user's own profile.
    const brandId = (draft.brandId || draft.selectedBrand || draft.autoBrandId) as string | undefined
    let brandRow: { name?: string; profile_type?: string; person_role?: string | null; photo_url?: string | null } | null = null
    if (brandId) {
      const { data } = await admin.from('brands')
        .select('name, profile_type, person_role, photo_url')
        .eq('id', brandId).eq('user_id', user.id).single()
      brandRow = data
    }
    const { data: profile } = await admin.from('profiles')
      .select('full_name, company_name, phone, email, photo_url')
      .eq('id', user.id).single()

    const inlineBrand = (draft.inlineBrand ?? {}) as { name?: string }
    const brandName = brandRow?.name || inlineBrand.name || profile?.company_name || undefined
    const presenterName = (brandRow?.profile_type === 'person' ? brandRow.name : undefined)
      || profile?.full_name || brandName
    const presenterPhoto = (brandRow?.profile_type === 'person' ? brandRow.photo_url : undefined)
      || profile?.photo_url || undefined
    const contactLine = [
      (draft.contactPhone as string) || profile?.phone,
      (draft.contactEmail as string) || profile?.email,
      (draft.contactWebsite as string) || undefined,
    ].filter(Boolean).join('  ·  ') || undefined

    const html = buildPresentationHtml({
      title: (row.title as string) || 'Presentation',
      scenes,
      templateId,
      brandName,
      recipientName: draft.recipientName as string | undefined,
      presenter: {
        name: presenterName,
        photoUrl: presenterPhoto ?? undefined,
        contactLine,
      },
      voClips,
      shareActions: outputType === 'interactive',
    })

    // ── Store + finish. video_url carries the HTML for these output types
    // (typed by output_type — no migration needed). ──
    const path = `presentations/${videoId}.html`
    const up = await admin.storage.from('videos').upload(path, Buffer.from(html), {
      contentType: 'text/html; charset=utf-8', upsert: true,
    })
    if (up.error) throw new Error(up.error.message)
    const { data: pub } = admin.storage.from('videos').getPublicUrl(path)

    // templateId lives in draft_data.presentationTemplate (saved by the theme
    // page) — videos.video_style does NOT exist in prod (migration drift), and
    // an unchecked failed update here strands the row at "assembling" forever.
    const fin = await admin.from('videos').update({
      status: 'completed', progress_pct: 100, progress_detail: 'Done',
      output_type: outputType,
      video_url: pub.publicUrl,
      progress_updated_at: new Date().toISOString(),
    }).eq('id', videoId)
    if (fin.error) throw new Error(`Failed to finalize: ${fin.error.message}`)

    return NextResponse.json({ ok: true, url: pub.publicUrl, outputType, templateId })
  } catch (err) {
    await refundVideoCredits(user.id, cost, videoId).catch(() => {})
    const message = err instanceof Error ? err.message : 'Generation failed'
    await admin.from('videos').update({ status: 'failed', error_message: message }).eq('id', videoId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
