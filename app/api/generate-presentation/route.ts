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
    // ── Narration (interactive only) ──
    let voClips: string[] | undefined
    if (outputType === 'interactive') {
      await setStatus('generating_audio', 20, 'Recording narration')
      const voiceId = (draft.voiceId as string) || 'nova'
      voClips = []
      for (const s of scenes) {
        const buf = await synthesizeSpeech(s.narration ?? '', voiceId)
        voClips.push(buf.toString('base64'))
      }
    }

    // ── Assemble the presentation ──
    await setStatus('assembling', 70, 'Assembling presentation')
    const brand = (draft.brand ?? {}) as Record<string, string | undefined>
    const html = buildPresentationHtml({
      title: (row.title as string) || 'Presentation',
      scenes,
      templateId,
      brandName: brand.name,
      recipientName: draft.recipientName as string | undefined,
      presenter: {
        name: brand.person_name as string | undefined ?? brand.name,
        photoUrl: brand.photo_url as string | undefined,
        contactLine: brand.contact_line as string | undefined,
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

    await admin.from('videos').update({
      status: 'completed', progress_pct: 100, progress_detail: 'Done',
      output_type: outputType, video_style: templateId,
      video_url: pub.publicUrl,
      progress_updated_at: new Date().toISOString(),
    }).eq('id', videoId)

    return NextResponse.json({ ok: true, url: pub.publicUrl, outputType, templateId })
  } catch (err) {
    await refundVideoCredits(user.id, cost, videoId).catch(() => {})
    const message = err instanceof Error ? err.message : 'Generation failed'
    await admin.from('videos').update({ status: 'failed', error_message: message }).eq('id', videoId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
