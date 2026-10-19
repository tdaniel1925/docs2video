// =============================================================================
// A TEMPLATE'S FREE PREVIEW (owner, 2026-10-19: "the free preview shows sample
// scenes rather than a short video" — fix it). The customer's OWN cover and
// first content scene, laid out in the template they picked, with their brand,
// their words and the template's or the brand's colors — drawn by the real
// template engine on the render worker (One Dollar Decks render-worker
// worker.ts templatePreview), the same TemplateInput the whole video gets.
//
// Why two stills and not a short clip: every other look's free preview is one
// still and ten seconds of the voice (first-scene-preview.ts). A clip would
// need the film pipeline (voice, motion direction, slice machines): minutes
// and many times the cost, for a preview. Two real stills — the cover and the
// first scene — plus the same voice sample show what the video will look like.
//
// The worker takes about a minute to start, longer than a request may wait, so
// the preview is a job: started once (pending marker), then the page asks
// again until the pictures are in storage (or the worker's failed note is).
// =============================================================================

import { createHash } from 'crypto'
import type { Brand } from './types'
import { pickPreviewScenes, type PreviewScene } from './first-scene-preview'
import { scrubScene } from './first-scene-preview-server'
import { isRegulated, productTokens } from './compliance'
import { resolveClientName } from './personalize'
import { buildPresenter, isPersonProfile, resolvePhotoPlacement } from './presenter'
import { formatPhoneDisplay } from './phone-utils'
import { kitLogoAssets } from './kit-engine'
import { sceneFor, type ExplainerScene } from './explainer-engine'
import { videoSender, foreignIdentity, type SenderBrand, type SenderProfile } from './video-sender'
import { templateIdentity, type TemplateIdentity } from './template-identity'
import { brandTemplatePalette, type TemplateColors, type VideoTemplateId } from './video-templates'

type Draft = Record<string, unknown>

/** Bumped when what a preview shows changes, so old pictures are never reused for it. */
export const TEMPLATE_PREVIEW_VERSION = 'tpl-v1'
/** A started preview not finished by then is given up (its free preview given back). */
export const TEMPLATE_PREVIEW_TIMEOUT_MS = 6 * 60 * 1000

export type TemplatePreviewPlan = {
  key: string
  templateId: VideoTemplateId
  colors: TemplateColors
  palette: string[]
  title: string
  /** The cover and the first content scene, as the whole video sends them. */
  scenes: [ExplainerScene, ExplainerScene]
  identity: TemplateIdentity
  forbidden: string[]
  pageCount: number
  logoUrl: string | null
  /** A person's photo, when it goes on the cover. */
  photoUrl: string | null
  presenter: { name: string; role?: string; cover: boolean; closing: boolean } | null
  /** What the voice sample reads: the first scene's words. */
  narration: string
  sceneTitle: string
}

/** Where a preview's pictures, its failure note and its pending marker live (the worker's d2v.ts previewPaths names the first three). */
export function templatePreviewPaths(userId: string, key: string) {
  const base = `${userId}/previews/tpl-${key}`
  return { folder: `${userId}/previews`, prefix: `tpl-${key}`, cover: `${base}-cover.png`, scene: `${base}-scene.png`, failed: `${base}-failed.json`, pending: `${base}-pending.json` }
}

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x))

/**
 * Everything the worker needs to draw the preview, built the way
 * generate-video builds the whole video's template job. Null when there is no
 * content scene yet.
 */
export function buildTemplatePreview(o: {
  draft: Draft; brand: Brand | null; profile: SenderProfile | null
  templateId: VideoTemplateId; colors: TemplateColors; rowTitle?: string | null
}): TemplatePreviewPlan | null {
  const picked = pickPreviewScenes(o.draft.scenes)
  if (!picked) return null
  const ex = (o.draft.extractedData ?? {}) as Record<string, unknown>
  const regulated = !o.draft.complianceExempt && isRegulated(ex, o.draft.scenes)
  const tokens = regulated ? productTokens(typeof ex.title === 'string' ? ex.title : '', typeof ex.subtitle === 'string' ? ex.subtitle : '') : []
  const clean = (s?: PreviewScene) => (regulated ? scrubScene(s, tokens) : s)
  const content = clean(picked.content)!
  const cover = clean(picked.cover)

  const brand = o.brand
  const sender = videoSender(brand as SenderBrand | null, o.profile)
  const recipient = resolveClientName({ recipientName: o.draft.recipientName as string | undefined, policyData: ex }) || null
  const personHidesName = isPersonProfile(brand) && brand?.show_name_on_slides === false
  const person = isPersonProfile(brand) ? buildPresenter(brand) : null
  const placement = resolvePhotoPlacement(o.draft.videoStyle as string | undefined, (o.draft.photoPlacement as never) || (brand?.photo_placement as never) || undefined)
  const presenter = person?.name ? { name: person.name, ...(person.role ? { role: person.role } : {}), cover: placement.cover, closing: placement.closing } : null
  // The preview shows the cover: the photo goes only when it goes on the cover.
  const photoUrl = presenter && presenter.cover && person?.photo ? person.photo : null
  const showContact = o.draft.showContactClosing !== false
  const identity = templateIdentity(sender, {
    profile: o.profile, client: recipient, showContact,
    photoOn: photoUrl && presenter ? { cover: presenter.cover, closing: presenter.closing } : null,
    hideName: personHidesName,
    phoneShown: sender.source === 'brand' && sender.phone ? formatPhoneDisplay(sender.phone) : null,
  })
  const forbidden = foreignIdentity(sender, o.profile)
  const palette = o.colors === 'brand' ? brandTemplatePalette(brand) : []
  const colors: TemplateColors = palette.length ? o.colors : 'template'

  // The cover's title, as generate-video gives the whole video: the cover's own, else the first scene's.
  const title = (cover?.slideData?.headline || cover?.title || content.title || o.rowTitle || 'Your video').trim()
  const coverExtra = [recipient ? `Prepared for ${recipient}` : '', personHidesName ? '' : (brand?.name || '')].filter(Boolean)
  const scenes: [ExplainerScene, ExplainerScene] = [
    sceneFor('cover', { title, narration: cover?.narration || title, slideData: cover?.slideData as never }, coverExtra),
    sceneFor('content', content as never),
  ]
  const logos = kitLogoAssets(brand)
  const logoUrl = logos.logo_any || logos.logo_light || logos.logo_dark || null
  const pageCount = picked.contentScenes.length + 2
  const key = createHash('sha256').update(stable({
    v: TEMPLATE_PREVIEW_VERSION, templateId: o.templateId, colors, palette, scenes: scenes.map((s) => ({ r: s.role, t: s.title, b: s.bullets })),
    identity, forbidden, pageCount, logoUrl, photoUrl, presenter,
  })).digest('hex').slice(0, 32)
  return {
    key, templateId: o.templateId, colors, palette, title, scenes, identity, forbidden, pageCount, logoUrl, photoUrl, presenter,
    narration: String(content.narration || ''), sceneTitle: String(content.slideData?.headline || content.title || ''),
  }
}

/** What storage holds for a preview, from one listing of its folder. */
export type PreviewFiles = { cover: boolean; scene: boolean; failed: boolean; pendingAt: number | null }

export function previewState(f: PreviewFiles, now: number): 'ready' | 'failed' | 'pending' | 'stale' | 'none' {
  if (f.cover && f.scene) return 'ready'
  if (f.failed) return 'failed'
  if (f.pendingAt !== null) return now - f.pendingAt > TEMPLATE_PREVIEW_TIMEOUT_MS ? 'stale' : 'pending'
  return 'none'
}
