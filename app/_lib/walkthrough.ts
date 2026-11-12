/**
 * WALK-THROUGH (videoStyle 'walkthrough') — what the app sends the render
 * service. The client's own PDF is the picture; the render service
 * (render-service/walkthrough.js, POST /generate-walkthrough) reads the pages,
 * blurs insurer / product / client names and margin logos, plans one page +
 * gold box + card per scene, voices it and films it (WalkthroughVideo).
 *
 * Pure: only the kit's look rules (import-free), so a test can check the body
 * without the route.
 */
import { guardLook, type FontId, type Look } from '../../remotion/src/kit/spec'

export const WALKTHROUGH_STYLE = 'walkthrough'

/** The video's colours and type (WalkthroughVideo's WalkTheme). */
export type WalkTheme = { bg: string; glow: string; text: string; muted: string; accentInk: string; accentBig: string; onAccent: string; surface: string; surfaceLine: string; headFont: FontId; bodyFont: FontId }

/**
 * The colours a Walk-through wears: the user's own look (the look screen — this
 * video's copy, else the brand's saved one) or one made from their brand
 * colours and font (resolveKitLook with 'custom' gives exactly that order).
 * Through the kit's contrast guard, so every word reads on the page.
 */
export function walkthroughTheme(look: Look): WalkTheme {
  const { tokens, look: safe } = guardLook(look)
  return {
    bg: tokens.bg, glow: tokens.glow, text: tokens.text, muted: tokens.muted,
    accentInk: tokens.accentInk, accentBig: tokens.accentBig, onAccent: tokens.onAccent,
    surface: tokens.surface, surfaceLine: tokens.surfaceLine,
    headFont: safe.headFont, bodyFont: safe.bodyFont,
  }
}

type Scene = { title?: unknown; narration?: unknown; slideData?: unknown }

export type WalkthroughBody = {
  videoId: string
  userId: string
  voiceId?: string
  sourcePdfPath: string
  scenes: { title: string; narration: string; slideData?: unknown }[]
  cover: { narration: string; eyebrow: string; title: string; prepared?: string; from?: string }
  closing: { narration: string; eyebrow: string; title: string; line?: string; contact: string[] }
  hideTerms: string[]
  clientName: string
  theme?: WalkTheme
}

export function walkthroughBody(o: {
  videoId: string; userId: string; voiceId?: string; sourcePdfPath: string
  scenes: Scene[]; coverNarration: string; closingNarration: string
  title: string; recipient?: string | null; from?: string | null
  regulated: boolean; sourceDownload: boolean; contact: (string | undefined | null)[]
  hideTerms: string[]; theme?: WalkTheme | null
}): WalkthroughBody {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const scenes = o.scenes
    .map((s) => ({ title: str(s.title), narration: str(s.narration), ...(s.slideData ? { slideData: s.slideData } : {}) }))
    .filter((s) => s.narration)
  return {
    videoId: o.videoId, userId: o.userId, ...(o.voiceId ? { voiceId: o.voiceId } : {}), sourcePdfPath: o.sourcePdfPath,
    scenes,
    cover: {
      narration: o.coverNarration,
      eyebrow: o.regulated ? 'Your policy, explained' : 'Your document, explained',
      title: o.title,
      ...(str(o.recipient) ? { prepared: str(o.recipient) } : {}),
      ...(str(o.from) ? { from: str(o.from) } : {}),
    },
    closing: {
      narration: o.closingNarration,
      eyebrow: 'Every number came from your document',
      title: 'Thank you',
      // Only promise the document is "below" when the share page really offers it.
      ...(o.sourceDownload ? { line: 'Your full document is below this video.' } : {}),
      contact: o.contact.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 3),
    },
    hideTerms: [...new Set(o.hideTerms.filter((t) => typeof t === 'string' && t.trim().length >= 3))],
    clientName: str(o.recipient),
    ...(o.theme ? { theme: o.theme } : {}),
  }
}
