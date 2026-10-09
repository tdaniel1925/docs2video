// =============================================================================
// FREE FIRST-SCENE PREVIEW — the parts that touch the outside world: the
// customer's brand, the voice service, storage, and the render service. The
// rules themselves (cap, which scene, which engine, which voice, cache keys)
// are pure and live in first-scene-preview.ts.
//
// Nothing here spends credits. Only the Drawn slides look makes an AI picture
// (one gpt-image draw on fal at low quality, ~0.3c — measured 2026-10-09 —
// plus a ~0.1c spell-check read-back, and one redraw only if words are wrong);
// every other look is drawn by code.
// =============================================================================

import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand } from './types'
import { synthesizeSpeech, speakable } from './tts'
import { buildV3Payload } from './v3-render'
import { buildPresentationHtml, PRESENTATION_TEMPLATES, type PresentationScene } from './presentation'
import { isRegulated, productTokens, scrubComplianceText } from './compliance'
import { resolveClientName } from './personalize'
import { isPersonProfile, resolveDisplayName } from './presenter'
import { isEditedBookend } from './wizard-draft'
import { videoServiceEndpoint } from './video-service'
import {
  editorialPreviewScenes, pickPreviewScenes, stillEngineFor,
  type PreviewScene, type StillEngine,
} from './first-scene-preview'
import { stillCacheKey } from './first-scene-preview-keys'
import { drawnSlidePrompt, drawnSlideText, drawStyleOf } from './drawn-slides'
import { drawSlide } from './slide-engine'
import { drawChecked, expectedFromPrompt } from './slide-spellcheck'

type Draft = Record<string, unknown>
const STORAGE_BUCKET = 'videos'

// ── The brand the finished piece will use ───────────────────────────────────
// Same choice as the Make screen: the draft's brand (null = "no brand" on
// purpose), else the account's default brand. Always scoped to the owner.
export async function loadPreviewBrand(admin: SupabaseClient, userId: string, draft: Draft): Promise<Brand | null> {
  const id = draft.brandId
  if (id === null) return null
  if (typeof id === 'string' && id) {
    const { data } = await admin.from('brands').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
    return (data as Brand | null) ?? null
  }
  const { data } = await admin.from('brands').select('*').eq('user_id', userId)
    .order('is_default', { ascending: false }).order('created_at', { ascending: true }).limit(1)
  return ((data as Brand[] | null) ?? [])[0] ?? null
}

// ── Compliance ──────────────────────────────────────────────────────────────
// A regulated illustration never names the carrier or product, on any surface
// (CLAUDE memory: compliance unification). Same deterministic scrub the real
// engines run; figures stay.
function scrubScene(s: PreviewScene | undefined, tokens: string[]): PreviewScene | undefined {
  if (!s) return s
  const S = (v?: string) => (typeof v === 'string' && v ? scrubComplianceText(v, tokens) : v)
  return {
    ...s,
    title: S(s.title),
    narration: S(s.narration) || s.narration,
    slideData: s.slideData ? {
      ...s.slideData,
      headline: S(s.slideData.headline),
      cta: S(s.slideData.cta),
      bullets: s.slideData.bullets?.map((b) => S(b) || '').filter(Boolean),
      stats: s.slideData.stats?.map((st) => ({ label: S(st.label), value: st.value })).filter((st) => st.value),
    } : undefined,
  }
}

function contactLineFor(brand: Brand | null): string | undefined {
  const g = (brand?.brand_guide_data ?? {}) as Record<string, unknown>
  const parts = [g.phone, g.email, g.website].filter((x): x is string => typeof x === 'string' && !!x.trim())
  return parts.length ? parts.join(' | ') : undefined
}

export type PreviewPlan = {
  engine: StillEngine
  /** What the render service needs (minus userId/videoId/key). */
  request: Record<string, unknown>
  key: string
  /** The words the voice sample reads (scene 1's narration, scrubbed). */
  narration: string
  sceneTitle: string
}

/**
 * Everything needed to draw the first content scene in the chosen look, built
 * with the SAME builders the real engines use (buildV3Payload,
 * buildPresentationHtml; the render service runs planFromSuppliedScenes for the
 * Slide Deck look). Returns null when there is no content scene yet.
 */
export function buildPreviewPlan(o: {
  output: string; look: string; draft: Draft; brand: Brand | null; rowTitle?: string | null
  /** Drawn slides only: the drawing style on screen (else the draft's, else 3D). */
  drawStyle?: unknown
}): PreviewPlan | null {
  const engine = stillEngineFor(o.output, o.look)
  if (!engine) return null
  const picked = pickPreviewScenes(o.draft.scenes)
  if (!picked) return null
  const ex = (o.draft.extractedData ?? {}) as Record<string, unknown>
  const regulated = !o.draft.complianceExempt && isRegulated(ex, o.draft.scenes)
  const tokens = regulated ? productTokens(typeof ex.title === 'string' ? ex.title : '', typeof ex.subtitle === 'string' ? ex.subtitle : '') : []
  const clean = (s?: PreviewScene) => (regulated ? scrubScene(s, tokens) : s)
  const cover = clean(picked.cover), content = clean(picked.content)!, next = clean(picked.next), closing = clean(picked.closing)
  const brand = o.brand
  const personHidesName = isPersonProfile(brand) && brand?.show_name_on_slides === false
  const brandName = personHidesName ? null : (brand?.name || null)
  const recipient = resolveClientName({ recipientName: o.draft.recipientName as string | undefined, policyData: ex }) || undefined
  // The document title runs along the top of some looks (the editorial
  // header, the presentation cover). On a regulated illustration it is often
  // the product's name, so it is scrubbed too — falling back to a plain title
  // when nothing is left (same rule as generate-presentation).
  const safeTitle = (t: string) => {
    if (!regulated) return t
    const out = scrubComplianceText(t, tokens).trim()
    return out.replace(/[^a-zA-Z]/g, '').length < 6 ? 'Your Personalized Illustration' : out
  }
  const docTitle = safeTitle((typeof ex.title === 'string' && ex.title.trim()) || content.title || 'Presentation')
  const contactLine = o.draft.showContactClosing === false ? undefined : contactLineFor(brand)
  const sceneTitle = content.slideData?.headline || content.title || ''

  let request: Record<string, unknown>
  if (engine === 'drawn') {
    // Drawn slides: the SAME prompt builder generate-video uses, on the first
    // content scene (already compliance-scrubbed above; the scrub runs again
    // inside drawnSlideText so the drawn words can never skip it).
    const style = drawStyleOf(o.drawStyle ?? o.draft.drawStyle)
    const text = drawnSlideText(content, 'content', { scrub: regulated ? (v: string) => scrubComplianceText(v, tokens) : null })
    request = {
      style,
      prompt: drawnSlidePrompt({
        style, text,
        colors: { primary: brand?.primary_color || '#1B365D', secondary: brand?.secondary_color || '#4A90D9' },
      }),
    }
  } else if (engine === 'directed') {
    // The Slide Deck look: the same scene list generate-video hands to the
    // render service (cover, content, closing in the {role, …} shape).
    const toSupplied = (s: PreviewScene | undefined, role: 'cover' | 'content' | 'closing') =>
      s ? { role, title: s.title, narration: s.narration || s.title || ' ', beat: s.beat, slideData: s.slideData } : null
    request = {
      scenes: [toSupplied(cover, 'cover'), toSupplied(content, 'content'), toSupplied(closing, 'closing')].filter(Boolean),
      preparer: brandName || '',
      recipient,
      footer: contactLine,
      logoUrl: brand?.logo_light_url || brand?.logo_url || undefined,
    }
  } else if (engine === 'v3') {
    // Aurora / Cinematic / Infographic: the whole list the finished video gets
    // (a scene's layout depends on where it sits), through buildV3Payload.
    const editedCover = cover && isEditedBookend(cover as Record<string, unknown>) ? cover : null
    const editedClosing = closing && isEditedBookend(closing as Record<string, unknown>) ? closing : null
    const contentScenes = picked.contentScenes.map((s) => clean(s)!)
    const scenes = [
      ...(editedCover ? [{ title: editedCover.slideData?.headline || editedCover.title || docTitle, narration: editedCover.narration || '', slideData: editedCover.slideData, beat: 'hook' }] : []),
      ...contentScenes,
      ...(editedClosing ? [{ title: editedClosing.slideData?.headline || editedClosing.title || 'Thank You', narration: editedClosing.narration || '', slideData: editedClosing.slideData, beat: 'action' }] : []),
    ] as Parameters<typeof buildV3Payload>[0]['scenes']
    const payload = buildV3Payload({
      videoId: 'preview', userId: 'preview', voiceId: 'nova',
      scenes, brand, brandName,
      classification: (ex.classification as { category?: string } | null) ?? null,
      industry: typeof ex.industry === 'string' ? ex.industry : undefined,
      keyMetrics: Array.isArray(ex.keyMetrics) ? (ex.keyMetrics as { label: string; value: string }[]) : [],
      recipient, videoStyle: o.look,
      // Same header/footer scrub the finished video gets (its footer chips come
      // from the raw key metrics, which the scene scrub above doesn't touch).
      extracted: ex, regulated,
    })
    // buildV3Payload keeps the first scene when it trims a long video, so the
    // first content scene sits right after the cover (or first, with none).
    request = {
      payload: { theme: payload.theme, brandName: payload.brandName, brandAccents: payload.brandAccents, logo: payload.logo, frame: payload.frame, recipient: payload.recipient, scenes: payload.scenes },
      sceneIndex: editedCover ? 1 : 0,
    }
  } else if (engine === 'editorial') {
    const masthead = String(brandName || resolveDisplayName(brand) || docTitle || 'REPORT').trim().toUpperCase()
    request = {
      masthead, runningTitle: String(docTitle || brandName || '').trim(),
      brandColor: brand?.primary_color || undefined,
      variant: o.look === 'explainer' ? 'explainer' : 'editorial',
      contactLine, recipient,
      scenes: editorialPreviewScenes({ cover, content, closing, title: docTitle, contactLine }),
    }
  } else {
    // Interactive presentation / slide deck: the real page, from the real
    // builder. The render service opens it on slide 2 and photographs it.
    const templateId = PRESENTATION_TEMPLATES.some((t) => t.id === o.look) ? o.look : PRESENTATION_TEMPLATES[0].id
    const scenes = [cover, content, next, closing].filter(Boolean).map((s) => ({
      title: s!.title, narration: s!.narration || '', _role: s!._role === 'cover' || s!._role === 'closing' ? s!._role : undefined, slideData: s!.slideData,
    })) as PresentationScene[]
    if (!cover) scenes.unshift({ title: docTitle, narration: '', _role: 'cover', slideData: { headline: docTitle } })
    const accent = ((o.draft.accentColor || o.draft.primaryColor) as string | undefined) || brand?.primary_color || brand?.accent_color || undefined
    request = {
      html: buildPresentationHtml({
        title: o.rowTitle ? safeTitle(o.rowTitle) : docTitle,
        scenes, templateId,
        brandName: brand?.name || undefined,
        primaryColor: accent,
        logoUrl: brand?.logo_dark_url || brand?.logo_url || undefined,
        recipientName: o.draft.recipientName as string | undefined,
        disclaimer: regulated ? 'Prepared by your agent for education only. Figures shown are illustrated and not guarantees. Refer to your full illustration for complete terms, values and conditions.' : undefined,
        presenter: { name: isPersonProfile(brand) ? brand?.name || undefined : undefined },
      }),
    }
  }
  return { engine, request, key: stillCacheKey(engine, { look: o.look, request }), narration: content.narration || '', sceneTitle }
}

// ── Voice ───────────────────────────────────────────────────────────────────

/** The sample, spoken the way the finished piece will speak it. */
export async function synthesizePreviewVoice(text: string, pick: { engine: 'elevenlabs' | 'openai'; voice: string }): Promise<Buffer> {
  if (pick.engine === 'elevenlabs') return synthesizeSpeech(text, pick.voice)
  // A voice other than Sarah, in any look: that OpenAI voice, same model and
  // speed as render-service/slides.js openaiTimed (the V3/editorial renders use
  // the same voice at 0.98 speed — close enough for a 10-second sample).
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const res = await openai.audio.speech.create(
    { model: (process.env.OPENAI_TTS_MODEL || 'tts-1-hd') as 'tts-1-hd', voice: pick.voice as 'nova', input: speakable(text), response_format: 'mp3', speed: 0.95 },
    { signal: AbortSignal.timeout(30000) },
  )
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 100) throw new Error(`OpenAI voice returned ${buf.length} bytes`)
  return buf
}

// ── Storage ─────────────────────────────────────────────────────────────────

export function previewStoragePath(userId: string, kind: 'still' | 'voice', key: string): string {
  return `${userId}/previews/${kind}-${key}.${kind === 'still' ? 'png' : 'mp3'}`
}

export function publicUrlFor(admin: SupabaseClient, path: string): string {
  return admin.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Is this file already in storage (made by an earlier preview)? */
export async function alreadyStored(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000), cache: 'no-store' })
    return r.ok
  } catch { return false }
}

export async function storeVoice(admin: SupabaseClient, path: string, mp3: Buffer): Promise<void> {
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, mp3, { contentType: 'audio/mpeg', upsert: true })
  if (error) throw new Error(`voice upload: ${error.message}`)
}

// ── Drawn slides: one real picture, drawn here (no render service needed) ──

/** The free preview route may run 60 s: only redraw a misspelt slide when the first draw + check left time for it. */
const PREVIEW_REDRAW_BEFORE_MS = 25_000

/**
 * Draws the preview slide (fal gpt-image at low quality, Gemini if fal fails),
 * spell-checks it (slide-spellcheck.ts, ~0.1c: a dropped / wrong / squeezed
 * word → one redraw if there's time, the better one kept; a check that
 * can't run accepts the slide) and stores it.
 */
export async function drawPreviewStill(admin: SupabaseClient, path: string, plan: PreviewPlan): Promise<string> {
  const prompt = String(plan.request.prompt || '')
  if (!prompt) throw new Error('drawn preview: no prompt')
  const sharp = (await import('sharp')).default
  const started = Date.now()
  const drawOne = async () => sharp(await drawSlide(prompt, null, { quality: 'low' })).resize(1920, 1080, { fit: 'cover', position: 'centre' }).png().toBuffer()
  const { buf } = await drawChecked({
    expected: expectedFromPrompt(prompt),
    draw: drawOne,
    canRedraw: () => Date.now() - started < PREVIEW_REDRAW_BEFORE_MS,
    label: 'drawn preview',
  })
  if (!buf) throw new Error('drawn preview: no picture')
  const png = buf
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, png, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`still upload: ${error.message}`)
  return publicUrlFor(admin, path)
}

// ── The render service ──────────────────────────────────────────────────────

export async function renderPreviewStill(o: { userId: string; videoId: string; plan: PreviewPlan }): Promise<string> {
  const res = await fetch(videoServiceEndpoint('/preview-still'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-secret': process.env.VIDEO_ASSEMBLY_SECRET || '' },
    body: JSON.stringify({ ...o.plan.request, engine: o.plan.engine, key: o.plan.key, userId: o.userId, videoId: o.videoId }),
    signal: AbortSignal.timeout(55000),
  })
  const text = await res.text()
  let data: { success?: boolean; imageUrl?: string; error?: string } | null = null
  try { data = JSON.parse(text) } catch { /* not JSON */ }
  if (!res.ok || !data?.success || !data.imageUrl) throw new Error(data?.error || `preview-still HTTP ${res.status}: ${text.slice(0, 200)}`)
  return data.imageUrl
}
