import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Brand } from './types'
import { assembleKitPlan, kitLogoAssets, plannerBeats, resolveKitLook } from './kit-engine'
import type { PlannerInput } from './kit-planner'
import { isRegulated, productTokens } from './compliance'
import { resolveClientName } from './personalize'
import { buildPresenter } from './presenter'
import { formatForTTS } from './tts-format'
import { filmLookForDraft, isFilmLookId } from './film-looks'
import { loadPreviewBrand, renderPreviewStill } from './first-scene-preview-server'
import { applyEdits, type StoryboardEntry } from './storyboard'
import type { KitPlan } from '../../remotion/src/kit/spec'

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
  const scenes = (Array.isArray(draft.scenes) ? draft.scenes : []) as { title?: string; narration?: string; slideData?: never }[]
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
  const logos = kitLogoAssets(ctx.brand)
  if (logos.logo_light || logos.logo_dark || logos.logo_any) plan.brand.logo = { light: logos.logo_light, dark: logos.logo_dark, any: logos.logo_any }
  if (presenter?.photo && plan.brand.presenter) plan.brand.presenter.photo = presenter.photo
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
  return renderPreviewStill({ userId: o.userId, videoId: o.videoId, plan: { engine: 'kit', request: { plan: o.plan }, key: `sb-${o.sig}`, narration: '', sceneTitle: '' } })
}
