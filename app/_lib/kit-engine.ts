// =============================================================================
// THE SCENE KIT — how the app hands a video to it.
//
//   KIT_ENGINE=on   Step 3's "Animated slides", "Editorial" and "Bright" cards
//                   save videoStyle 'kit' + a kit look; generate-video plans
//                   the video with Claude (kit-planner.ts) and sends it to the
//                   render service's /generate-kit.
//   (off)           Nothing changes: the old engines make every video.
//
// Old videos keep their engine either way: a draft saved as 'slides',
// 'editorial', 'explainer', 'aurora', … renders exactly as before (retries
// included). Only a draft saved as 'kit' uses the kit.
// =============================================================================

import { createHash } from 'crypto'
import type { Brand } from './types'
import { shouldShowLogo } from './presenter'
import { planKitScenes, type PlanResult, type PlannerBeat, type PlannerInput, type PlannerCall } from './kit-planner'
import {
  brandLook, isKitLookId, isPlatformName, KIT_LOOKS, sanitizeLook,
  type KitBrand, type KitPlan, type KitScene, type Look,
} from '../../remotion/src/kit/spec'

export function kitEngineOn(): boolean {
  return String(process.env.KIT_ENGINE || '').toLowerCase() === 'on'
}

// Which step-3 card becomes which kit look lives in kit-looks.ts (pure, browser-safe).
export { KIT_LOOK_FOR_CARD, CARD_FOR_KIT_LOOK } from './kit-looks'

/** The look a kit video is made in: a saved custom look, the brand's own, or a ready look. */
export function resolveKitLook(o: { kitLook?: unknown; kitLookCustom?: unknown; brand?: Brand | null }): Look {
  let look: Look
  const asLook = (raw: unknown): Look => {
    const id = (raw as { id?: unknown }).id
    return sanitizeLook(raw, typeof id === 'string' && id in KIT_LOOKS ? id as keyof typeof KIT_LOOKS : 'animated-slides')
  }
  const custom = o.kitLookCustom && typeof o.kitLookCustom === 'object' ? o.kitLookCustom : null
  // "Your look" (the look screen): the copy saved on THIS video's draft wins —
  // so editing the brand's look later never changes a video already set up —
  // else the look saved on the brand, else one made from the brand's colours.
  // A ready look picked on step 3 (kitLook = its id) is never overridden by an
  // older custom copy still sitting on the draft.
  const brandSaved = savedBrandLook(o.brand)
  if (o.kitLook === 'custom' || (o.kitLook === undefined && custom)) {
    look = custom ? asLook(custom) : brandSaved ? asLook(brandSaved) : brandLook(o.brand ?? null)
  } else if (o.kitLook === 'brand') {
    look = brandLook(o.brand ?? null)
  } else if (isKitLookId(o.kitLook) && o.kitLook !== 'brand') {
    look = KIT_LOOKS[o.kitLook]
  } else {
    look = KIT_LOOKS['animated-slides']
  }
  // A logo the brand says needs a card (unknown colours) always gets one.
  if (o.brand?.logo_chip && look.logoMode === 'auto') look = { ...look, logoMode: 'plate' }
  return look
}

/** The video look saved on a brand by the look screen (brand_guide_data.video_look), or null. */
export function savedBrandLook(brand: Brand | null | undefined): Record<string, unknown> | null {
  const g = (brand?.brand_guide_data ?? null) as Record<string, unknown> | null
  const v = g && typeof g === 'object' ? g.video_look : null
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

/** The agent's real logo files, for the render service to download. */
export function kitLogoAssets(brand: Brand | null | undefined): { logo_light?: string; logo_dark?: string; logo_any?: string } {
  if (!brand || !shouldShowLogo(brand)) return {}
  const light = brand.logo_light_url || undefined
  const dark = brand.logo_dark_url || undefined
  const any = brand.logo_url || (brand as { logo_file_url?: string | null }).logo_file_url || undefined
  if (light || dark) return { ...(light ? { logo_light: light } : {}), ...(dark ? { logo_dark: dark } : {}) }
  return any ? { logo_any: any } : {}
}

type SceneLike = { title?: string; narration?: string; slideData?: PlannerBeat['slideData'] }

/** The beats the planner sees: the cover, the user's content scenes, the closing. */
export function plannerBeats(cover: SceneLike, content: SceneLike[], closing: SceneLike): PlannerBeat[] {
  const beat = (s: SceneLike, role: PlannerBeat['role']): PlannerBeat => ({ role, title: s.title, narration: String(s.narration || '').trim(), slideData: s.slideData })
  return [beat(cover, 'cover'), ...content.map((s) => beat(s, 'content')), beat(closing, 'closing')].filter((b) => b.narration)
}

/** A stable key for "the same story": a retry of an unchanged story reuses its plan for $0. */
export function plannerInputHash(input: PlannerInput): string {
  const { videoId: _v, ...rest } = input
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 32)
}

export type KitPlanCache = { hash: string; scenes: KitScene[]; source: PlanResult['source']; costUsd: number; at: string }

/**
 * Plan (or reuse the plan for) a video. A cached plan for the exact same
 * story + numbers + settings is reused, so retries and restarts never pay twice.
 */
export async function planKitVideoCached(input: PlannerInput, cache: unknown, opts: { call?: PlannerCall | null } = {}): Promise<{ result: PlanResult; cache: KitPlanCache; reused: boolean }> {
  const hash = plannerInputHash(input)
  const c = cache as KitPlanCache | null | undefined
  if (c && c.hash === hash && Array.isArray(c.scenes) && c.scenes.length === input.beats.length) {
    return { result: { scenes: c.scenes, source: c.source, costUsd: 0, calls: 0, issues: [], note: 'reused the saved plan' }, cache: c, reused: true }
  }
  const result = await planKitScenes(input, opts.call !== undefined ? { call: opts.call } : {})
  return { result, cache: { hash, scenes: result.scenes, source: result.source, costUsd: result.costUsd, at: new Date().toISOString() }, reused: false }
}

/** The plan KitVideo renders (minus the per-scene voice the render service adds). */
export function assembleKitPlan(o: {
  title: string; scenes: KitScene[]; look: Look; brandName?: string | null
  presenter?: { name?: string; role?: string; photo?: string } | null
  /** Where the photo goes (presenter.ts resolvePhotoPlacement). */
  photo?: { cover: boolean; closing: boolean } | null; recipient?: string | null; regulated: boolean
}): KitPlan {
  const ph = o.photo ?? { cover: true, closing: true }
  const brand: KitBrand = {
    name: o.brandName && !isPlatformName(o.brandName) ? o.brandName : undefined,
    // The photo itself is downloaded by the render service; here only who and where.
    presenter: o.presenter && (ph.cover || ph.closing) ? { name: o.presenter.name, role: o.presenter.role, onCover: ph.cover, onClosing: ph.closing } : undefined,
  }
  return {
    version: 1,
    title: o.title,
    look: o.look,
    brand,
    recipient: o.recipient && !isPlatformName(o.recipient) ? o.recipient : undefined,
    regulated: o.regulated,
    scenes: o.scenes,
    audio: { sfx: o.regulated ? 'quiet' : 'standard' },
  }
}
