// The looks on offer. A video and a presentation are drawn by different
// engines, so each has its own set: picking "Aurora" can't style a
// presentation, and "Heritage" can't style a video. The Make screen shows the
// set that fits the chosen output.

export type VideoLookId = 'slides' | 'aurora' | 'cinematic' | 'editorial' | 'explainer' | 'infographic' | 'drawn' | 'custom'

/** The step-3 card that opens the look screen (/create/look) — not a look itself. */
export const CREATE_LOOK_CARD = 'create-look'

import { NAMES } from '../../../../_lib/names'

/** Video looks. `short` is the one line under the card's name (a few words);
 *  `tagline` is the longer description under the cards for the picked one. A sample picture of each lives in /public/style-samples/<id>-{cover,data,closing}.png. */
export const VIDEO_LOOKS: { id: VideoLookId; name: string; short: string; tagline: string; tag?: string }[] = [
  { id: 'slides', name: NAMES.animatedSlidesLook, short: 'Points and charts appear as the voice speaks', tagline: 'Animated slides — headings, bullets, charts and icons that appear as the voice speaks. Reads the whole document.' },
  { id: 'aurora', name: 'Aurora', short: 'Motion graphics on one flowing background', tagline: 'Modern motion graphics on one flowing branded background. Clean and cohesive.' },
  { id: 'cinematic', name: 'Cinematic', short: 'Film-style pictures for a story', tagline: 'Film-style pictures and moving text. Best for story-led videos.' },
  { id: 'editorial', name: 'Editorial', short: 'Calm magazine pages in your colour', tagline: 'Clean, warm magazine layout with serif type on your brand color.' },
  { id: 'explainer', name: 'Explainer', short: 'Friendly cards for how it works', tagline: 'Friendly cards and charts. Great for how-it-works.' },
  { id: 'infographic', name: 'Infographic', short: 'Big numbers, timelines and charts', tagline: 'Big numbers, cards, timelines and charts. Best for number-heavy reports.' },
  // The original Docs2Video look: AI draws every slide as one finished picture
  // (app/_lib/drawn-slides.ts — its drawing styles are DRAW_STYLES there).
  { id: 'drawn', name: 'Drawn slides', short: 'Each slide drawn as one picture', tagline: 'AI draws every slide as one finished picture — headline, points and numbers included.', tag: 'NEW' },
]
export const VIDEO_SAMPLE_KINDS = ['cover', 'data', 'closing'] as const

export function isVideoLook(v: unknown): v is VideoLookId {
  return v === 'custom' || VIDEO_LOOKS.some((l) => l.id === v)
}

/** Presentation / slide-deck looks — color sets in the presentation builder
 *  (ids must match PRESENTATION_TEMPLATES in app/_lib/presentation). */
export const PRES_LOOKS: { id: string; name: string; short: string; tagline: string; swatch: [string, string, string] }[] = [
  { id: 'heritage', name: 'Heritage', short: 'Cream, navy and gold', tagline: 'Cream, navy and gold. Weight for financial documents.', swatch: ['#f7f5ee', '#1c2a44', '#a8842c'] },
  { id: 'warm', name: 'Warm Editorial', short: 'Cream and terracotta', tagline: 'Cream and terracotta. Friendly and human.', swatch: ['#faf9f5', '#3d3929', '#c96442'] },
  { id: 'bold', name: 'Corporate Bold', short: 'Navy and red', tagline: 'Navy and red. Sharp business energy.', swatch: ['#f4f6fa', '#1e3a70', '#c0272d'] },
  { id: 'midnight', name: 'Midnight', short: 'Dark navy and gold', tagline: 'Dark navy and gold. Evening polish.', swatch: ['#0f1729', '#eef2fb', '#d9b64c'] },
  { id: 'mint', name: 'Fresh Mint', short: 'Cream and mint green', tagline: 'Cream and mint green. Light and hopeful.', swatch: ['#f4f1ec', '#2b3427', '#6da33f'] },
  { id: 'certificate', name: 'Certificate', short: 'Parchment and formal navy', tagline: 'Parchment, fine patterns and formal navy type.', swatch: ['#f5f0e0', '#1a1a3a', '#8a6d2f'] },
]

export function isPresLook(v: unknown): v is string {
  return PRES_LOOKS.some((l) => l.id === v)
}

// ── The look cards on step 3 ────────────────────────────────────────────────
//
// Step 3 draws its look cards from this one list, so a new look is ONE more
// entry in VIDEO_LOOKS (plus its /style-samples/<id>-cover.png picture) — or,
// for a look that isn't ready to show its samples yet, one entry here with
// its own `thumb`. `recommended` puts the BEST tag on a card (and it is the
// one picked when nothing was saved); `tag` adds a small word next to the
// name ("NEW").

export type LookCard = {
  id: string
  name: string
  /** One short line under the name on the card. */
  short: string
  tagline: string
  /** A picture (video looks) or a mini slide drawn from three colours (presentations). */
  thumb: { kind: 'img'; src: string } | { kind: 'swatch'; swatch: [string, string, string]; title?: string }
  recommended?: boolean
  tag?: string
  /** Sample pictures shown under the cards when this look is picked. */
  samples?: string[]
}

/** Which video look carries the BEST tag (and is picked by default). */
export const RECOMMENDED_VIDEO_LOOK: VideoLookId = 'slides'

/**
 * With the new scene engine on (KIT_ENGINE=on): Aurora, Cinematic and
 * Infographic leave the list (old videos still render), Explainer becomes the
 * Bright colour theme, and the pictures come from the scene kit itself
 * (/style-samples/kit-<look>-{cover,data,closing}.png).
 */
const KIT_CARD: Partial<Record<VideoLookId, { kitLook: string; name?: string; short: string; tagline: string }>> = {
  slides: { kitLook: 'animated-slides', short: 'Big numbers and charts as the voice speaks', tagline: 'Deep navy and gold. One big idea per scene — numbers that count up as they are said, charts, timelines and checklists.' },
  editorial: { kitLook: 'editorial', short: 'Calm cream pages, serif headlines', tagline: 'Cream paper, a serif headline and calm green ink — a magazine page that moves.' },
  explainer: { kitLook: 'bright', name: 'Bright', short: 'Bright, friendly colours', tagline: 'Warm cream with coral, teal and gold — friendly and energetic, great for how-it-works.' },
}

/** The look made on the look screen, as step 3 shows it (colours only — pure data). */
export type YourLook = { name?: string; colors: { bg: string; glow: string; accent: string; text: string } }

export function lookCards(output: string, opts: { kit?: boolean; yourLook?: YourLook | null } = {}): LookCard[] {
  if (output === 'interactive' || output === 'deck') {
    return PRES_LOOKS.map((l, i) => ({ id: l.id, name: l.name, short: l.short, tagline: l.tagline, thumb: { kind: 'swatch', swatch: l.swatch }, recommended: i === 0 }))
  }
  if (opts.kit) {
    // THE LOOK SCREEN (look wizard): "Your look" comes FIRST when the brand or
    // this project has one; "Create your own look" sits next to the ready looks.
    const yours: LookCard[] = opts.yourLook ? [{
      id: 'custom', name: 'Your look',
      short: opts.yourLook.name && !/^(your look|custom)$/i.test(opts.yourLook.name) ? opts.yourLook.name : 'Your colours, fonts and feel',
      tagline: 'Your own look, made on the look screen. Change it any time — videos already made keep theirs.',
      thumb: { kind: 'swatch', swatch: [opts.yourLook.colors.bg, opts.yourLook.colors.text, opts.yourLook.colors.accent], title: 'Your look' },
    }] : []
    const create: LookCard = {
      id: CREATE_LOOK_CARD, name: opts.yourLook ? 'Change your look' : 'Create your own look',
      short: 'Match your brand, a picture or a website',
      tagline: 'Opens the look screen: start from your brand, something you like, or a ready style.',
      thumb: { kind: 'swatch', swatch: ['#f4f1ec', '#0b2545', '#2f6b3a'], title: '+ Your own' },
    }
    const ready = VIDEO_LOOKS.filter((l) => l.id === 'drawn' || KIT_CARD[l.id]).map((l): LookCard => {
      const k = KIT_CARD[l.id]
      const pic = k ? `kit-${k.kitLook}` : l.id
      return {
        id: l.id, name: k?.name ?? l.name, short: k?.short ?? l.short, tagline: k?.tagline ?? l.tagline,
        thumb: { kind: 'img' as const, src: `/style-samples/${pic}-cover.png` },
        recommended: l.id === RECOMMENDED_VIDEO_LOOK,
        ...(l.tag ? { tag: l.tag } : {}),
        samples: VIDEO_SAMPLE_KINDS.map((s) => `/style-samples/${pic}-${s}.png`),
      }
    })
    const drawnAt = ready.findIndex((c) => c.id === 'drawn')
    const withCreate = drawnAt >= 0 ? [...ready.slice(0, drawnAt), create, ...ready.slice(drawnAt)] : [...ready, create]
    return [...yours, ...withCreate]
  }
  return VIDEO_LOOKS.map((l) => ({
    id: l.id,
    name: l.name,
    short: l.short,
    tagline: l.tagline,
    thumb: { kind: 'img', src: `/style-samples/${l.id}-cover.png` },
    recommended: l.id === RECOMMENDED_VIDEO_LOOK,
    ...(l.tag ? { tag: l.tag } : {}),
    samples: VIDEO_SAMPLE_KINDS.map((k) => `/style-samples/${l.id}-${k}.png`),
  }))
}
