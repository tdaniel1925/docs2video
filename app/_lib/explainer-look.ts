import type { SupabaseClient } from '@supabase/supabase-js'
import { alreadyStored, buildPreviewPlan, loadPreviewBrand, previewStoragePath, publicUrlFor, renderPreviewStill } from './first-scene-preview-server'
import { KIT_LOOK_FOR_CARD } from './kit-looks'

/*
 * THE LOOK THE EXPLAINER ENGINE DESIGNS FROM (fix, 2026-10-18).
 *
 * The explainer engine (explainer-engine.ts) designs every scene to match ONE
 * reference picture — the same ground, type, colours, shapes and spacing —
 * with the brand colours worn as its accents (One Dollar Decks
 * lib/code-deck/style.ts). It used to be sent no picture at all for the look
 * the customer picked, so every video came out in the default soft-startup
 * look while the free preview showed the picked one.
 *
 * Now the picture is, in order:
 *   1. the customer's own picture (styleReferenceUrl), as before;
 *   2. THEIR FREE PREVIEW of this look — the still the Look step showed them,
 *      found by the same plan key the preview stored it under. The video is
 *      designed from exactly what they saw;
 *   3. for a ready look (Animated slides, Editorial, Bright) its own sample
 *      inside page (public/style-samples/kit-<look>-data.png);
 *   4. for "Your look" with no preview yet, that preview still made now (the
 *      same render the Free preview button runs);
 *   5. only then the default starting look.
 *
 * Drawn slides never come here: the explainer engine draws code-built scenes,
 * not one finished AI picture per slide, so Drawn slides keep their own
 * pipeline (generate-video).
 */

/** The ready looks' own inside-page samples (served from public/). */
export const READY_LOOK_SAMPLE: Record<string, string> = {
  'animated-slides': '/style-samples/kit-animated-slides-data.png',
  editorial: '/style-samples/kit-editorial-data.png',
  bright: '/style-samples/kit-bright-data.png',
}

type Draft = Record<string, unknown>

/** The scene-kit look a draft picked: a ready look id, 'custom', 'brand' — or null (no kit look; the default). */
export function pickedKitLook(draft: Draft): string | null {
  if (draft.videoStyle === 'kit') return typeof draft.kitLook === 'string' && draft.kitLook ? draft.kitLook : 'animated-slides'
  const card = typeof draft.videoStyle === 'string' ? draft.videoStyle : ''
  return KIT_LOOK_FOR_CARD[card] ?? null
}

export type ExplainerLook = {
  /** The picture to send (absolute URL), or null for the engine's default look. */
  referenceUrl: string | null
  source: 'own' | 'preview' | 'look-sample' | 'rendered' | 'default'
  look: string | null
}

export async function explainerLookFor(o: {
  admin: SupabaseClient; userId: string; videoId: string; draft: Draft
  ownReferenceUrl?: string | null
  siteUrl: string
  /** Make the preview still when "Your look" has none yet (default true). */
  renderIfMissing?: boolean
}): Promise<ExplainerLook> {
  if (o.ownReferenceUrl) return { referenceUrl: o.ownReferenceUrl, source: 'own', look: null }
  const look = pickedKitLook(o.draft)
  if (!look || look === 'brand') return { referenceUrl: null, source: 'default', look }
  const site = o.siteUrl.replace(/\/+$/, '')

  let plan: ReturnType<typeof buildPreviewPlan> = null
  try {
    const brand = await loadPreviewBrand(o.admin, o.userId, o.draft)
    plan = buildPreviewPlan({ output: 'video', look: `kit:${look}`, draft: o.draft, brand })
  } catch { plan = null }
  if (plan) {
    const url = publicUrlFor(o.admin, previewStoragePath(o.userId, 'still', plan.key))
    if (await alreadyStored(url)) return { referenceUrl: url, source: 'preview', look }
  }
  if (READY_LOOK_SAMPLE[look]) return { referenceUrl: `${site}${READY_LOOK_SAMPLE[look]}`, source: 'look-sample', look }
  if (look === 'custom' && plan && o.renderIfMissing !== false) {
    try {
      const url = await renderPreviewStill({ userId: o.userId, videoId: o.videoId, plan })
      return { referenceUrl: url, source: 'rendered', look }
    } catch (e) {
      console.warn(`[explainer-look] your-look still could not be made (${e instanceof Error ? e.message : e}) — default look`)
    }
  }
  return { referenceUrl: null, source: 'default', look }
}
