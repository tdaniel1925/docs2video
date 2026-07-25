import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, refundVideoCredits, CREDIT_COSTS } from '../../_lib/credits'
import { synthesizeSpeech } from '../../_lib/tts'
import { buildPresentationHtml, PRESENTATION_TEMPLATES, type PresentationScene } from '../../_lib/presentation'
import { isRegulated, productTokens, scrubComplianceText } from '../../_lib/compliance'
import { safeEqual } from '../../_lib/api-auth'

export const runtime = 'nodejs'
// Interactive: per-scene TTS + assembly. Well under video times, but give room.
export const maxDuration = 300

/** POST { videoId, templateId, outputType: 'interactive' | 'deck' }
 *  The HTML-first generator: scenes (already written + edited in the wizard)
 *  → one self-contained presentation HTML in storage. No VPS, no ffmpeg.
 *  'interactive' narrates every scene; 'deck' is silent (PDF/PPTX exports
 *  come later from the same artifact). */
export async function POST(request: NextRequest) {
  // Internal service auth (public API v1 / partner layer): the v1 route has
  // already authenticated the API key and METERED the charge — act as the
  // resolved owner and skip the UI-credit deduction below.
  const internalSecret = (process.env.INTERNAL_API_SECRET || '').trim()
  const reqInternalSecret = (request.headers.get('x-internal-service') || '').trim()
  const internalUserId = request.headers.get('x-internal-user-id') || ''
  const isInternalCall = !!internalSecret && safeEqual(reqInternalSecret, internalSecret) && !!internalUserId

  let user: { id: string } | null = null
  if (isInternalCall) {
    user = { id: internalUserId }
  } else {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    user = auth.user
  }
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
  let scenes = (draft.scenes ?? []) as PresentationScene[]
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return NextResponse.json({ error: 'No scenes yet — finish the script step first.' }, { status: 400 })
  }

  // ── COMPLIANCE: same hard rule as every other engine — a regulated
  // illustration NEVER names the carrier or branded product, on ANY surface
  // (slide text, narration, title). Figures stay. The scrubbed scenes are
  // persisted below so PDF/PPTX/deck exports read clean content too. ──
  const exData = (draft.extractedData ?? {}) as Record<string, unknown>
  // complianceExempt: marketing/pitch sources (set by the v1 partner layer) —
  // the scrub is for regulated ILLUSTRATION explainers, not product pitches.
  const regulated = !draft.complianceExempt && isRegulated(exData, scenes)
  // Harvest branded-product tokens ONLY from the document title/subtitle —
  // scene headings are Title Case English and would poison the detector.
  const complianceToks = regulated ? productTokens(
    typeof exData.title === 'string' ? exData.title : '',
    typeof exData.subtitle === 'string' ? exData.subtitle : '',
  ) : []
  if (regulated) {
    const S = (v?: string) => (typeof v === 'string' && v ? scrubComplianceText(v, complianceToks) : v)
    scenes = scenes.map((s) => ({
      ...s,
      title: S(s.title),
      narration: S(s.narration) || s.narration,
      slideData: s.slideData ? {
        ...s.slideData,
        headline: S(s.slideData.headline),
        cta: S(s.slideData.cta),
        bullets: s.slideData.bullets?.map((b) => S(b) || '').filter(Boolean),
        stats: s.slideData.stats?.map((st) => ({ label: S(st.label), value: S(st.value) })).filter((st) => st.value),
      } : undefined,
    }))
  }

  // ── Credits: interactive 700 · deck reuses the existing deck price.
  // Internal (v1/partner) calls are already metered upstream — skip. ──
  const costKey = outputType === 'interactive' ? 'interactive' : 'deck'
  const cost = (CREDIT_COSTS as Record<string, number>)[costKey] ?? 700
  if (!isInternalCall) {
    const check = await checkCredits(user.id, cost)
    if (!check.allowed) {
      return NextResponse.json({ error: 'Not enough credits — you need ' + check.shortfall + ' more.', code: 'insufficient_credits' }, { status: 402 })
    }
    await deductCredits(user.id, cost, `presentation_${outputType}`, videoId)
  }

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
    const fmtPhone = (p?: string | null) => {
      const d = String(p ?? '').replace(/\D/g, '')
      if (d.length === 11 && d.startsWith('1')) return `1-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`
      if (d.length === 10) return `1-${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
      return p || undefined
    }
    const contactLine = [
      fmtPhone((draft.contactPhone as string) || profile?.phone),
      (draft.contactEmail as string) || profile?.email,
      (draft.contactWebsite as string) || undefined,
    ].filter(Boolean).join('  ·  ') || undefined

    // Title comes from the source document (or the user's override) — never
    // the placeholder "Presentation" if we can help it. Regulated titles are
    // scrubbed; if that guts them (the title WAS the product name), fall back
    // to a generic benefit framing.
    let title = (row.title as string)
      || (typeof exData.title === 'string' && exData.title.trim() ? exData.title.trim() : '')
      || scenes[0]?.slideData?.headline || scenes[0]?.title || 'Presentation'
    let subtitle = typeof exData.subtitle === 'string' ? exData.subtitle : undefined
    if (regulated) {
      title = scrubComplianceText(title, complianceToks)
      if (title.replace(/[^a-zA-Z]/g, '').length < 6) title = 'Your Personalized Illustration'
      subtitle = subtitle ? scrubComplianceText(subtitle, complianceToks) : undefined
      if (subtitle && subtitle.replace(/[^a-zA-Z]/g, '').length < 6) subtitle = undefined
    }

    const html = buildPresentationHtml({
      title,
      scenes,
      templateId,
      subtitle,
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
      ...(row.title && !regulated ? {} : { title }),
      // Persist the scrubbed scenes so every downstream reader (PPTX/PDF
      // exports, client deck download, re-renders) gets clean content.
      ...(regulated ? { draft_data: { ...draft, scenes } } : {}),
      progress_updated_at: new Date().toISOString(),
    }).eq('id', videoId)
    if (fin.error) throw new Error(`Failed to finalize: ${fin.error.message}`)

    return NextResponse.json({ ok: true, url: pub.publicUrl, outputType, templateId })
  } catch (err) {
    if (!isInternalCall) await refundVideoCredits(user.id, cost, videoId).catch(() => {})
    const message = err instanceof Error ? err.message : 'Generation failed'
    await admin.from('videos').update({ status: 'failed', error_message: message }).eq('id', videoId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
