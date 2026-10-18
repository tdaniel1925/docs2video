// =============================================================================
// THE LOOK SCREEN — the rules, with no React and no server code, so the
// browser, the API routes and the tests all use the same ones.
//
// A LOOK is the scene kit's look settings (remotion/src/kit/spec.ts `Look`):
// colours (page, second colour, accent, words), headline + body font from the
// free-font list, background style, corners, feel, logo mode, music.
//
//   · start points: "My brand" (brandLook), "A ready style" (READY_STYLES),
//     "Something I like" (a measured palette → lookFromPalette)
//   · nudges: More premium / Warmer / Bolder / Calmer, with Undo
//   · the quality guard's notes ("We darkened the text…" + Why?)
//   · where a look is kept: on the brand (brand_guide_data.video_look, plus
//     up to 8 named looks in video_looks) and, as a COPY, on each video's
//     draft (kitLookCustom) — so editing a look never changes a video that
//     was already set up.
// =============================================================================

import {
  brandLook, contrast, guardLook, isFontId, KIT_FONTS, KIT_LOOKS, mix, normHex, sanitizeLook,
  type BackgroundStyle, type Corners, type Feel, type FontId, type Look, type LogoMode,
} from '../../remotion/src/kit/spec'
import { hexToRgb, rgbToHex, type PaletteColors } from './look-palette'

export { MUSIC_PICKS } from '../../remotion/src/kit/spec'

export type StartMode = 'brand' | 'reference' | 'style'

// ── ready styles ────────────────────────────────────────────────────────────

export const READY_STYLES: { id: string; name: string; look: Look }[] = [
  { id: 'animated-slides', name: 'Navy and gold', look: KIT_LOOKS['animated-slides'] },
  { id: 'editorial', name: 'Calm paper', look: KIT_LOOKS.editorial },
  { id: 'bright', name: 'Bold and bright', look: KIT_LOOKS.bright },
  {
    id: 'forest', name: 'Forest',
    look: {
      ...KIT_LOOKS['animated-slides'], id: 'custom', name: 'Forest',
      colors: { bg: '#0f1f18', glow: '#1d3a2c', accent: '#9fd27a', text: '#f2f5ee' },
      headFont: 'fraunces', bodyFont: 'dm-sans', headWeight: 600, feel: 'calm', background: 'glow',
      series: ['#d9c27a', '#7fb3a0', '#5e8a74'],
    },
  },
]
export const readyStyle = (id: string) => READY_STYLES.find((s) => s.id === id) ?? READY_STYLES[0]

// ── the choices on screen ───────────────────────────────────────────────────

/** Headline font chips. Free fonts only (spec.ts KIT_FONTS). */
export const HEADLINE_CHOICES: { key: string; name: string; head: FontId; body: FontId }[] = [
  { key: 'modern', name: 'Modern', head: 'montserrat', body: 'source-sans' },
  { key: 'classic', name: 'Classic', head: 'playfair', body: 'source-sans' },
  { key: 'bold', name: 'Bold', head: 'oswald', body: 'inter' },
  { key: 'warm', name: 'Warm', head: 'fraunces', body: 'dm-sans' },
]
export const FEEL_CHOICES: { id: Feel; name: string }[] = [
  { id: 'calm', name: 'Calm' }, { id: 'premium', name: 'Premium' }, { id: 'energetic', name: 'Energetic' },
]
export const LOGO_CHOICES: { id: LogoMode; name: string }[] = [
  { id: 'auto', name: 'Auto (best version)' }, { id: 'plate', name: 'On a white card' }, { id: 'text', name: 'Name as text' },
]
export const BACKGROUND_CHOICES: { id: BackgroundStyle; name: string }[] = [
  { id: 'gradient', name: 'Gradient' }, { id: 'glow', name: 'Soft glow' }, { id: 'solid', name: 'Solid' }, { id: 'paper', name: 'Paper' },
]
export const CORNER_CHOICES: { id: Corners; name: string }[] = [{ id: 'square', name: 'Square' }, { id: 'soft', name: 'Soft' }]

/** The weight a headline font looks best at (serif display faces: regular/semibold). */
export function headWeightFor(id: FontId): number {
  const f = KIT_FONTS[id]
  const ws = f.weights.map(Number)
  const max = Math.max(...ws)
  if (f.kind === 'serif') return ws.includes(600) ? 600 : ws.includes(700) ? 700 : max
  return max
}

/** "Fraunces" or "Fraunces · closest match" (a reference's own font is never used). */
export function fontLabel(id: FontId, exact: boolean): string {
  return exact ? KIT_FONTS[id].family : `${KIT_FONTS[id].family} · closest match`
}

/** Which headline chip is on for a look (null = a font from a reference). */
export function headlineKey(look: Look): string | null {
  return HEADLINE_CHOICES.find((h) => h.head === look.headFont)?.key ?? null
}

export function withHeadline(look: Look, head: FontId, body?: FontId): Look {
  return { ...look, headFont: head, bodyFont: body ?? look.bodyFont, headWeight: headWeightFor(head) }
}

// ── colour helpers (HSL) for the nudges ─────────────────────────────────────

type Hsl = [number, number, number]
function toHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function fromHsl([h, s, l]: Hsl): string {
  const hh = ((h % 360) + 360) % 360, ss = Math.max(0, Math.min(1, s)), ll = Math.max(0, Math.min(1, l))
  const c = (1 - Math.abs(2 * ll - 1)) * ss, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = ll - c / 2
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x]
  return rgbToHex([(r + m) * 255, (g + m) * 255, (b + m) * 255])
}
const adjust = (hex: string, f: (h: Hsl) => Hsl) => fromHsl(f(toHsl(normHex(hex, '#000000'))))
/** Turn a hue toward a target hue by up to `deg` degrees. */
function hueToward(h: number, target: number, deg: number): number {
  const d = ((target - h + 540) % 360) - 180
  return h + Math.sign(d) * Math.min(Math.abs(d), deg)
}

export type NudgeKind = 'premium' | 'warmer' | 'bolder' | 'calmer'
export const NUDGES: { id: NudgeKind; name: string }[] = [
  { id: 'premium', name: 'More premium' }, { id: 'warmer', name: 'Warmer' }, { id: 'bolder', name: 'Bolder' }, { id: 'calmer', name: 'Calmer' },
]

/** One small, visible step. The contrast guard still runs on the result. */
export function nudge(look: Look, kind: NudgeKind): Look {
  const c = look.colors
  const dark = toHsl(c.bg)[2] < 0.5
  let colors = { ...c }
  let feel = look.feel
  if (kind === 'premium') {
    colors = {
      ...colors,
      bg: adjust(c.bg, ([h, s, l]) => [h, s * 0.8, dark ? l * 0.78 : Math.min(0.97, l + 0.02)]),
      glow: adjust(c.glow, ([h, s, l]) => [h, s * 0.75, dark ? l * 0.85 : l]),
      accent: mix(c.accent, dark ? '#d9b665' : '#7a5c22', 0.3),
    }
    feel = 'premium'
  } else if (kind === 'warmer') {
    colors = {
      ...colors,
      bg: adjust(c.bg, ([h, s, l]) => [hueToward(h, 30, 25), Math.min(1, s + 0.06), l]),
      glow: adjust(c.glow, ([h, s, l]) => [hueToward(h, 28, 30), Math.min(1, s + 0.08), l]),
      accent: adjust(c.accent, ([h, s, l]) => [hueToward(h, 28, 22), s, l]),
      text: adjust(c.text, ([h, s, l]) => [hueToward(h, 35, 40), Math.min(0.3, s + 0.05), l]),
    }
  } else if (kind === 'bolder') {
    colors = {
      ...colors,
      accent: adjust(c.accent, ([h, s, l]) => [h, Math.min(1, s * 1.25 + 0.08), dark ? Math.max(0.5, Math.min(0.62, l)) : Math.max(0.38, Math.min(0.5, l))]),
      glow: adjust(c.glow, ([h, s, l]) => [h, Math.min(1, s * 1.3 + 0.05), l]),
    }
    feel = 'energetic'
  } else {
    colors = {
      ...colors,
      accent: adjust(c.accent, ([h, s, l]) => [h, s * 0.7, l]),
      glow: mix(c.glow, c.bg, 0.3),
    }
    feel = 'calm'
  }
  return { ...look, id: 'custom', colors, feel }
}

// ── undo ────────────────────────────────────────────────────────────────────

export type LookHistory = { past: Look[]; present: Look }
const HISTORY_MAX = 30
export const startHistory = (look: Look): LookHistory => ({ past: [], present: look })
/** Record a change (a no-op change isn't recorded). */
export function commit(h: LookHistory, next: Look): LookHistory {
  if (JSON.stringify(next) === JSON.stringify(h.present)) return h
  return { past: [...h.past, h.present].slice(-HISTORY_MAX), present: next }
}
export function undo(h: LookHistory): LookHistory {
  if (!h.past.length) return h
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1] }
}
export const canUndo = (h: LookHistory) => h.past.length > 0

// ── start points ────────────────────────────────────────────────────────────

type BrandLike = { name?: string | null; primary_color?: string | null; secondary_color?: string | null; accent_color?: string | null; fonts?: unknown; logo_chip?: boolean | null }

/** "My brand": the brand's own colours (one accent, calm dark page) and its closest free font. */
export function lookFromBrand(brand: BrandLike | null | undefined): Look {
  const l = brandLook(brand ?? null)
  return { ...l, id: 'custom', name: brand?.name ? `${brand.name}` : 'My brand', headWeight: headWeightFor(l.headFont), logoMode: brand?.logo_chip ? 'plate' : l.logoMode }
}

/** What the vision step names (look-reference.ts), already checked. */
export type ReferenceRead = { mood: Feel; density: 'airy' | 'balanced' | 'dense'; energy: 'low' | 'medium' | 'high'; font: FontId; fontExact: boolean }

/** "Something I like": measured colours + the named mood/font → a look. */
export function lookFromPalette(colors: PaletteColors, read?: Partial<ReferenceRead> | null, opts: { light?: boolean } = {}): Look {
  const base = KIT_LOOKS[opts.light ? 'editorial' : 'animated-slides']
  const head: FontId = read?.font && isFontId(read.font) ? read.font : base.headFont
  const feel: Feel = read?.energy === 'high' ? 'energetic' : read?.mood ?? base.feel
  const background: BackgroundStyle = read?.density === 'airy' ? (opts.light ? 'paper' : 'solid') : read?.density === 'dense' ? 'gradient' : (opts.light ? 'paper' : 'glow')
  return {
    ...base, id: 'custom', name: 'From your picture',
    colors: { bg: colors.bg, glow: colors.glow, accent: colors.accent, text: colors.text },
    headFont: head, bodyFont: KIT_FONTS[head].kind === 'serif' ? 'dm-sans' : (head === 'inter' ? 'source-sans' : 'inter'),
    headWeight: headWeightFor(head), feel, background, series: undefined,
  }
}

/** Swap in another colour set from the same picture, keeping everything else. */
export function withColors(look: Look, colors: PaletteColors): Look {
  return { ...look, id: 'custom', colors: { ...colors } }
}

// ── the quality guard, said in words ────────────────────────────────────────

export const GUARD_WHY = 'Words too close in colour to what’s behind them are hard to read, especially on phones and TVs. Every word must be at least 4.5 times brighter or darker than its background (the accessibility standard) — when we fix one, we go further so it reads comfortably. Big numbers need at least 3 times.'

/** What the guard changed, in plain words (empty = nothing needed fixing). */
export function guardNotes(look: Look): { fixes: string[]; guarded: Look } {
  const g = guardLook(look)
  return { fixes: g.fixes, guarded: g.look }
}

/** True when every word in the look reads (after the guard). */
export function readsWell(look: Look): boolean {
  const { tokens: t } = guardLook(look)
  return contrast(t.text, t.bg) >= 4.5 && contrast(t.text, t.glow) >= 4.5 && contrast(t.muted, t.bg) >= 4.5 && contrast(t.accentInk, t.bg) >= 4.5 && contrast(t.accentBig, t.bg) >= 3
}

// ── keeping looks ───────────────────────────────────────────────────────────

export type SavedLook = Look & { savedAt?: string }
export const MAX_SAVED_LOOKS = 8

/**
 * A look made safe and COPIED (never shared by reference): what goes onto a
 * video's draft and onto the brand. Editing one later can't reach the other.
 */
export function snapshotLook(raw: unknown, name?: string): Look {
  const copy = JSON.parse(JSON.stringify(raw ?? null)) as unknown
  const id = copy && typeof copy === 'object' ? (copy as { id?: unknown }).id : undefined
  const look = sanitizeLook(copy, typeof id === 'string' && id in KIT_LOOKS ? id as keyof typeof KIT_LOOKS : 'animated-slides')
  const clean: Look = { ...look, id: typeof id === 'string' && id in KIT_LOOKS ? look.id : 'custom' }
  if (name && name.trim()) clean.name = name.trim().slice(0, 60)
  return clean
}

/** The brand's saved looks (brand_guide_data.video_look + video_looks). */
export function readBrandLooks(guide: unknown): { current: SavedLook | null; saved: SavedLook[] } {
  const g = guide && typeof guide === 'object' ? guide as Record<string, unknown> : {}
  const one = (v: unknown): SavedLook | null => (v && typeof v === 'object' && !Array.isArray(v) ? { ...snapshotLook(v), ...(typeof (v as SavedLook).savedAt === 'string' ? { savedAt: (v as SavedLook).savedAt } : {}) } : null)
  const current = one(g.video_look)
  const saved = Array.isArray(g.video_looks) ? (g.video_looks.map(one).filter(Boolean) as SavedLook[]).slice(0, MAX_SAVED_LOOKS) : []
  return { current, saved }
}

/** The brand's guide data with `look` saved as its look (and in its named list). Other guide fields untouched. */
export function withSavedLook(guide: unknown, look: Look, now = new Date()): Record<string, unknown> {
  const g = guide && typeof guide === 'object' && !Array.isArray(guide) ? { ...(guide as Record<string, unknown>) } : {}
  const entry: SavedLook = { ...snapshotLook(look), savedAt: now.toISOString() }
  const { saved } = readBrandLooks(g)
  const others = saved.filter((s) => s.name.toLowerCase() !== entry.name.toLowerCase())
  return { ...g, video_look: entry, video_looks: [entry, ...others].slice(0, MAX_SAVED_LOOKS) }
}

/**
 * The brand form saves the whole guide-data box from what it loaded. The
 * look lives in the same box, so the SERVER keeps the look already stored —
 * an older brand form can never wipe a look saved since it was opened.
 */
export function keepVideoLook(formGuide: unknown, storedGuide: unknown): Record<string, unknown> | null {
  const form = formGuide && typeof formGuide === 'object' && !Array.isArray(formGuide) ? { ...(formGuide as Record<string, unknown>) } : null
  const stored = storedGuide && typeof storedGuide === 'object' ? storedGuide as Record<string, unknown> : {}
  const out: Record<string, unknown> = form ?? {}
  delete out.video_look
  delete out.video_looks
  if (stored.video_look !== undefined) out.video_look = stored.video_look
  if (stored.video_looks !== undefined) out.video_looks = stored.video_looks
  return form || stored.video_look !== undefined || stored.video_looks !== undefined ? out : null
}
