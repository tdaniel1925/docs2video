import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand } from './types'
import { assembleKitPlan, kitLogoAssets, plannerBeats, resolveKitLook } from './kit-engine'
import type { PlannerInput } from './kit-planner'
import { isRegulated, productTokens } from './compliance'
import { resolveClientName } from './personalize'
import { buildPresenter, resolvePhotoPlacement } from './presenter'
import { formatPhoneDisplay } from './phone-utils'
import { formatForTTS } from './tts-format'
import { filmLookForDraft, isFilmLookId } from './film-looks'
import { loadPreviewBrand, renderPreviewStill } from './first-scene-preview-server'
import { applyEdits, type StoryboardEntry } from './storyboard'
import type { CtaScene, KitPlan, KitScene, TitleScene } from '../../remotion/src/kit/spec'

type Draft = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** Everything the storyboard needs about this project, read the same way the video reads it. */
export type StoryboardContext = {
  input: PlannerInput
  brand: Brand | null
  title: string
  recipient: string
  regulated: boolean
}
export async function storyboardContext(admin: SupabaseClient, userId: string, draft: Draft): Promise<StoryboardContext> {
  const brand = await loadPreviewBrand(admin, userId, draft as never)
  const policy = (draft.extractedData ?? {}) as Record<string, unknown>
  const regulated = isRegulated(policy, (policy.classification as Record<string, unknown> | undefined)?.documentType)
  const tokens = regulated ? productTokens(str(policy.title), str(policy.carrier), str(policy.policyType), ...(Array.isArray(policy.bulletPoints) ? (policy.bulletPoints as string[]) : [])) : []
  const recipient = resolveClientName({ recipientName: str(draft.recipientName), policyData: policy })
  const g = (brand?.brand_guide_data ?? {}) as Record<string, unknown>
  const contact = Object.fromEntries(Object.entries({ phone: str(g.phone), email: str(g.email), website: str(g.website), booking: str(g.calendly) }).filter(([, v]) => v)) as PlannerInput['contact']
  // The draft keeps the opening and closing in the same list (_role cover / closing): they are made at "Make it".
  const scenes = ((Array.isArray(draft.scenes) ? draft.scenes : []) as { title?: string; narration?: string; slideData?: never; _role?: string }[]).filter((s) => s._role !== 'cover' && s._role !== 'closing')
  const title = str(draft.title) || str(policy.title) || str(scenes[0]?.title) || 'Your video'
  // The cover and closing here only give the planner its frame: they are made at "Make it".
  const beats = plannerBeats({ title, narration: title }, scenes.map((s) => ({ ...s, narration: formatForTTS(String(s.narration || '')) })), { title: 'Thank you', narration: 'Thank you for watching.' })
  const input: PlannerInput = {
    beats, regulated, productTokens: tokens, recipient: recipient || undefined, brandName: brand?.name || undefined,
    keyMetrics: Array.isArray(policy.keyMetrics) ? (policy.keyMetrics as { label?: string; value?: string }[]) : [],
    hasPresenter: !!buildPresenter(brand)?.photo, contact,
  }
  return { input, brand, title, recipient, regulated }
}

/** One storyboard scene as a one-scene film plan, in this project's look, with its real logo and photo. */
export function framePlan(ctx: StoryboardContext, draft: Draft, entry: StoryboardEntry): KitPlan {
  const look = resolveKitLook({ kitLook: draft.kitLook, kitLookCustom: draft.kitLookCustom, brand: ctx.brand })
  const presenter = buildPresenter(ctx.brand)
  const plan = assembleKitPlan({ title: ctx.title, scenes: [applyEdits(entry.scene, entry.edits)], look, brandName: ctx.brand?.name, presenter, recipient: ctx.recipient, regulated: ctx.regulated })
  return finishFilmPlan(ctx, draft, plan, presenter?.photo)
}

/** The real logo and photo, and the film look this project uses. */
function finishFilmPlan(ctx: StoryboardContext, draft: Draft, plan: KitPlan, photo: string | undefined): KitPlan {
  const logos = kitLogoAssets(ctx.brand)
  if (logos.logo_light || logos.logo_dark || logos.logo_any) plan.brand.logo = { light: logos.logo_light, dark: logos.logo_dark, any: logos.logo_any }
  if (photo && plan.brand.presenter) plan.brand.presenter.photo = photo
  plan.engine = 'film'
  const custom = draft.kitLook === 'custom' || draft.kitLook === 'brand'
  const film = isFilmLookId(draft.filmLook) ? draft.filmLook : custom ? null : filmLookForDraft({ kitLook: draft.kitLook })
  if (film) plan.filmTheme = film
  return plan
}

/** A frame's signature: the same scene, words and look draw the same picture, so it is drawn once. */
export const frameSig = (plan: KitPlan) => createHash('sha256').update(JSON.stringify({ s: plan.scenes, l: plan.look, f: plan.filmTheme, b: plan.brand, r: plan.recipient })).digest('hex').slice(0, 24)

/** Draw one storyboard frame on the render service (the free preview's path: KitVideo, one still). */
export async function drawFrame(o: { userId: string; videoId: string; plan: KitPlan; sig: string }): Promise<string> {
  return renderPreviewStill({ userId: o.userId, videoId: o.videoId, plan: { engine: 'kit', request: { plan: o.plan }, key: o.sig, narration: '', sceneTitle: '' } })
}

/*
 * THE OPENING AND CLOSING (step 7, 2026-11-15): each as a one-scene film plan, built from the same things the video
 * uses at Make it (generate-video: the title, who it is for, the brand, the photo placement, the contact on the
 * closing), plus a plain list of what is on each. The step draws them in the browser and redraws as choices change.
 */
export type BookendChoices = { photoPlacement?: string; showContactClosing?: boolean }
export type Bookend = { plan: KitPlan; elements: string[] }
export function bookendPlans(ctx: StoryboardContext, draft: Draft, choices: BookendChoices): { cover: Bookend; closing: Bookend } {
  const look = resolveKitLook({ kitLook: draft.kitLook, kitLookCustom: draft.kitLookCustom, brand: ctx.brand })
  const presenter = buildPresenter(ctx.brand)
  const placementPref = choices.photoPlacement ?? (str(draft.photoPlacement) || ctx.brand?.photo_placement || undefined)
  const photo = resolvePhotoPlacement(str(draft.videoStyle) || 'slides', placementPref as never)
  const scenesOf = (Array.isArray(draft.scenes) ? draft.scenes : []) as { _role?: string; slideData?: { headline?: string; cta?: string } }[]
  const editedCover = scenesOf.find((x) => x._role === 'cover')?.slideData
  const editedClosing = scenesOf.find((x) => x._role === 'closing')?.slideData
  const g = (ctx.brand?.brand_guide_data ?? {}) as Record<string, unknown>
  const showContact = choices.showContactClosing ?? (draft.showContactClosing !== false)
  const contact = showContact ? Object.fromEntries(Object.entries({
    phone: str(g.phone) ? formatPhoneDisplay(String(g.phone)) : undefined, email: str(g.email), website: str(g.website), booking: str(g.calendly),
  }).filter(([, v]) => v)) as CtaScene['contact'] : undefined
  const has = contact && Object.values(contact).some(Boolean)
  const cover: TitleScene = { id: 1, type: 'title', narration: '', headline: str(editedCover?.headline) || ctx.title }
  const closing: CtaScene = {
    id: 1, type: 'cta', narration: '', headline: str(editedClosing?.headline) || 'Questions? Let’s talk',
    action: str(editedClosing?.cta) || (contact?.booking ? 'Book a quick call' : contact?.phone ? 'Give us a call' : contact?.email ? 'Send us a note' : 'Get in touch'),
    ...(has ? { contact } : {}),
  }
  const one = (scene: KitScene) => finishFilmPlan(ctx, draft, assembleKitPlan({ title: ctx.title, scenes: [scene], look, brandName: ctx.brand?.name, presenter, photo, recipient: ctx.recipient, regulated: ctx.regulated }), presenter?.photo)
  const logo = !!(ctx.brand?.logo_url)
  const coverEls = [
    'Title: ' + cover.headline,
    ...(ctx.recipient ? ['Prepared for ' + ctx.recipient] : []),
    ...(presenter && photo.cover ? ['Your photo, name' + (presenter.role ? ' and role' : '')] : presenter ? ['Your name (no photo on the opening)'] : []),
    ...(logo ? ['Your logo'] : ctx.brand?.name ? [ctx.brand.name] : []),
    // No brand: say why there is no name or photo (owner's live test, 2026-11-15).
    ...(!ctx.brand ? ['No name or photo: this project has no brand. Add a brand to show them.'] : []),
  ]
  const closingEls = [
    'Headline: ' + closing.headline,
    'Button: ' + closing.action,
    ...(has ? ['Your contact: ' + [contact?.phone, contact?.email, contact?.website].filter(Boolean).join(' · ')]
      : !ctx.brand ? ['No photo or contact details: this project has no brand. Add a brand to show them.']
      : !showContact ? ['No contact details (turned off)'] : ['No contact details: add them on your brand']),
    ...(presenter && photo.closing ? ['Your photo'] : []),
    ...(logo ? ['Your logo'] : []),
  ]
  return { cover: { plan: one(cover), elements: coverEls }, closing: { plan: one(closing), elements: closingEls } }
}
