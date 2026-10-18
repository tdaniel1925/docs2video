// =============================================================================
// The scenes the LIVE look preview plays (the look screen's Remotion Player).
//
// Draft mode: the person's OWN story from step 2 — cover, up to three content
// scenes, closing — laid out by the kit's plain code mapping (fallbackPlan,
// the same one the free preview uses: no AI, $0). Regulated documents get the
// same compliance scrub as every other surface.
// Brand mode (Brands → Video look): a short sample story.
//
// The look itself is NOT in here: the browser swaps in the look on screen.
// =============================================================================

import type { Brand } from './types'
import { pickPreviewScenes, type PreviewScene } from './first-scene-preview'
import { isRegulated, productTokens, scrubComplianceText } from './compliance'
import { resolveClientName } from './personalize'
import { buildPresenter, isPersonProfile } from './presenter'
import { assembleKitPlan, kitLogoAssets, plannerBeats } from './kit-engine'
import { fallbackPlan } from './kit-planner'
import { KIT_LOOKS, type KitPlan, type KitScene } from '../../remotion/src/kit/spec'

type Draft = Record<string, unknown>
const MAX_CONTENT = 3

function brandBits(brand: Brand | null) {
  const personHidesName = isPersonProfile(brand) && brand?.show_name_on_slides === false
  const brandName = personHidesName ? null : (brand?.name || null)
  const g = (brand?.brand_guide_data ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const contact = Object.fromEntries(Object.entries({ phone: str(g.phone), email: str(g.email), website: str(g.website), booking: str(g.calendly) }).filter(([, v]) => v)) as Record<string, string>
  return { brandName, contact }
}

function withAssets(plan: KitPlan, brand: Brand | null): KitPlan {
  const logos = kitLogoAssets(brand)
  if (logos.logo_light || logos.logo_dark || logos.logo_any) plan.brand.logo = { light: logos.logo_light, dark: logos.logo_dark, any: logos.logo_any }
  const presenter = buildPresenter(brand)
  if (presenter?.photo && plan.brand.presenter) plan.brand.presenter.photo = presenter.photo
  return plan
}

/** The person's own scenes, ready for the in-browser kit. null = no story yet. */
export function draftPreviewPlan(o: { draft: Draft; brand: Brand | null; rowTitle?: string | null }): KitPlan | null {
  const picked = pickPreviewScenes(o.draft.scenes)
  if (!picked) return null
  const ex = (o.draft.extractedData ?? {}) as Record<string, unknown>
  const regulated = !o.draft.complianceExempt && isRegulated(ex, o.draft.scenes)
  const tokens = regulated ? productTokens(typeof ex.title === 'string' ? ex.title : '', typeof ex.subtitle === 'string' ? ex.subtitle : '') : []
  const S = (v?: string) => (regulated && typeof v === 'string' && v ? scrubComplianceText(v, tokens) : v)
  const clean = (s?: PreviewScene): PreviewScene | undefined => s && ({
    ...s, title: S(s.title), narration: S(s.narration) || s.narration,
    slideData: s.slideData ? {
      ...s.slideData, headline: S(s.slideData.headline), cta: S(s.slideData.cta),
      bullets: s.slideData.bullets?.map((b) => S(b) || '').filter(Boolean),
      stats: s.slideData.stats?.map((st) => ({ label: S(st.label), value: st.value })).filter((st) => st.value),
    } : undefined,
  })
  const content = picked.contentScenes.slice(0, MAX_CONTENT).map((s) => clean(s)!)
  const cover = clean(picked.cover), closing = clean(picked.closing)
  const rawTitle = (typeof ex.title === 'string' && ex.title.trim()) || content[0]?.title || o.rowTitle || 'Your video'
  const docTitle = regulated ? (scrubComplianceText(rawTitle, tokens).replace(/[^a-zA-Z]/g, '').length < 6 ? 'Your Personalized Illustration' : scrubComplianceText(rawTitle, tokens)) : rawTitle
  const { brandName, contact } = brandBits(o.brand)
  const recipient = resolveClientName({ recipientName: o.draft.recipientName as string | undefined, policyData: ex }) || undefined
  const asBeat = (s: PreviewScene | undefined, fallbackTitle: string) => ({ title: s?.title || fallbackTitle, narration: s?.narration || s?.title || fallbackTitle, slideData: s?.slideData })
  const beats = plannerBeats(asBeat(cover, docTitle), content.map((c) => asBeat(c, docTitle)), asBeat(closing, 'Questions? Let’s talk'))
  const scenes = fallbackPlan({
    beats, regulated, productTokens: tokens, recipient, brandName: brandName || undefined,
    contact: o.draft.showContactClosing === false ? undefined : contact,
    keyMetrics: Array.isArray(ex.keyMetrics) ? (ex.keyMetrics as { label?: string; value?: string }[]) : [],
  })
  const plan = assembleKitPlan({ title: docTitle, scenes, look: KIT_LOOKS['animated-slides'], brandName, presenter: buildPresenter(o.brand), recipient, regulated })
  return withAssets(plan, o.brand)
}

/** Brands → Video look: a short sample story (no document needed). */
export function samplePreviewPlan(brand: Brand | null): KitPlan {
  const { brandName, contact } = brandBits(brand)
  const scenes: KitScene[] = [
    { id: 1, type: 'title', narration: 'Here is your plan, made simple.', headline: 'Your plan, made simple.', sub: 'What it does for your family, in two minutes.' },
    { id: 2, type: 'bignumber', narration: 'Your family is protected with five hundred thousand dollars.', label: 'Protected for your family', figure: { value: 500000, prefix: '$' }, context: 'Paid tax-free, when it’s needed most' },
    { id: 3, type: 'comparison', narration: 'Without it, six hundred ten thousand left to pay. With it, one hundred ten thousand.', heading: 'If something happens', left: { label: 'Without it', figure: { value: 610000, prefix: '$' }, points: ['Left to pay'] }, right: { label: 'With it', figure: { value: 110000, prefix: '$' }, points: ['Left to pay'] } },
    { id: 4, type: 'cta', narration: 'Questions? Let’s talk.', headline: 'Questions? Let’s talk.', action: 'Book a 15-minute call', contact: Object.keys(contact).length ? contact : { phone: '(555) 010-0199' } },
  ]
  const plan = assembleKitPlan({ title: 'Your plan', scenes, look: KIT_LOOKS['animated-slides'], brandName, presenter: buildPresenter(brand), recipient: 'The Rivera Family', regulated: false })
  return withAssets(plan, brand)
}
