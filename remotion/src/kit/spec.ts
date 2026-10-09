// =============================================================================
// THE SCENE KIT — the shared rulebook.
//
// One file, no imports, so BOTH sides can read it:
//   · the video (remotion/src/kit/*) draws scenes from it, and
//   · the app (app/_lib/kit-planner.ts) plans scenes against it.
// The render service is plain JavaScript and keeps a small mirror of the
// timing maths (render-service/kit.js); tests/kit-engine.test.ts checks the
// two agree.
//
// What lives here:
//   1. LOOK      — the settings a look is made of (colours, fonts, background,
//                  corners, feel, logo mode), the ready-made looks, the free
//                  font list, and the contrast guard.
//   2. SCENES    — the eight scene types and the shape of each one's words.
//   3. NUMBERS   — reading "$500,000" and writing numbers back the one way
//                  every video writes them ($ and commas).
//   4. TIMING    — how long each scene runs, from its voice length.
// =============================================================================

// ── 1. LOOK ──────────────────────────────────────────────────────────────────

export type Feel = 'calm' | 'premium' | 'energetic'
export type BackgroundStyle = 'gradient' | 'glow' | 'solid' | 'paper'
export type Corners = 'square' | 'soft'
export type LogoMode = 'auto' | 'plate' | 'text'

/**
 * FREE FONTS ONLY. Every one is a Google font shipped through
 * @remotion/google-fonts (already a dependency of the video), so nothing is
 * licensed and nothing is fetched from a customer's website. `module` is the
 * @remotion/google-fonts module name; `weights` are the only weights loaded
 * (each extra weight is another download per render).
 */
export const KIT_FONTS = {
  'plus-jakarta': { family: 'Plus Jakarta Sans', module: 'PlusJakartaSans', kind: 'sans', weights: ['500', '700', '800'] },
  'inter': { family: 'Inter', module: 'Inter', kind: 'sans', weights: ['400', '600', '800'] },
  'montserrat': { family: 'Montserrat', module: 'Montserrat', kind: 'sans', weights: ['500', '700', '800'] },
  'source-sans': { family: 'Source Sans 3', module: 'SourceSans3', kind: 'sans', weights: ['400', '600', '700'] },
  'dm-sans': { family: 'DM Sans', module: 'DMSans', kind: 'sans', weights: ['400', '500', '700'] },
  'manrope': { family: 'Manrope', module: 'Manrope', kind: 'sans', weights: ['500', '700', '800'] },
  'outfit': { family: 'Outfit', module: 'Outfit', kind: 'sans', weights: ['400', '600', '800'] },
  'space-grotesk': { family: 'Space Grotesk', module: 'SpaceGrotesk', kind: 'sans', weights: ['500', '700'] },
  'archivo': { family: 'Archivo', module: 'Archivo', kind: 'sans', weights: ['400', '600', '800'] },
  'work-sans': { family: 'Work Sans', module: 'WorkSans', kind: 'sans', weights: ['400', '600', '800'] },
  'figtree': { family: 'Figtree', module: 'Figtree', kind: 'sans', weights: ['400', '600', '800'] },
  'poppins': { family: 'Poppins', module: 'Poppins', kind: 'sans', weights: ['400', '600', '800'] },
  'fraunces': { family: 'Fraunces', module: 'Fraunces', kind: 'serif', weights: ['400', '600', '800'] },
  'playfair': { family: 'Playfair Display', module: 'PlayfairDisplay', kind: 'serif', weights: ['500', '700', '800'] },
  'lora': { family: 'Lora', module: 'Lora', kind: 'serif', weights: ['400', '600', '700'] },
  'dm-serif': { family: 'DM Serif Display', module: 'DMSerifDisplay', kind: 'serif', weights: ['400'] },
  'instrument-serif': { family: 'Instrument Serif', module: 'InstrumentSerif', kind: 'serif', weights: ['400'] },
  'libre-baskerville': { family: 'Libre Baskerville', module: 'LibreBaskerville', kind: 'serif', weights: ['400', '700'] },
  'merriweather': { family: 'Merriweather', module: 'Merriweather', kind: 'serif', weights: ['400', '700'] },
  'oswald': { family: 'Oswald', module: 'Oswald', kind: 'display', weights: ['500', '700'] },
} as const
export type FontId = keyof typeof KIT_FONTS
export const FONT_IDS = Object.keys(KIT_FONTS) as FontId[]
export const isFontId = (v: unknown): v is FontId => typeof v === 'string' && v in KIT_FONTS

/**
 * A website's own font is often paid or private. The look uses the closest
 * free font instead (the look screen labels it "closest match").
 */
const FONT_LOOKALIKES: [RegExp, FontId][] = [
  [/helvetica|arial|neue haas|sf pro|segoe|roboto|open sans|lato/i, 'inter'],
  [/futura|avenir|gotham|proxima|circular|brandon|museo sans/i, 'montserrat'],
  [/garamond|caslon|minion|sabon|times|georgia|baskerville/i, 'libre-baskerville'],
  [/didot|bodoni|canela|ogg|tiempos headline|freight display/i, 'playfair'],
  [/tiempos|freight|chronicle|publico|merriweather/i, 'lora'],
  [/recoleta|cooper|windsor|gt super/i, 'fraunces'],
  [/din|bebas|knockout|tungsten|league gothic|impact/i, 'oswald'],
  [/graphik|aeonik|gt walsheim|sohne|söhne|untitled sans|matter/i, 'dm-sans'],
  [/grotesk|akzidenz|monument|neue montreal/i, 'space-grotesk'],
]
export function closestFreeFont(name: string | null | undefined, fallback: FontId = 'inter'): { id: FontId; exact: boolean } {
  const n = String(name || '').trim()
  if (!n) return { id: fallback, exact: false }
  const slug = n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  for (const id of FONT_IDS) if (id === slug || KIT_FONTS[id].family.toLowerCase() === n.toLowerCase()) return { id, exact: true }
  for (const [re, id] of FONT_LOOKALIKES) if (re.test(n)) return { id, exact: false }
  return { id: fallback, exact: false }
}

/** A look: the small set of settings every kit scene reads. */
export type Look = {
  /** Ready look id ('animated-slides' | 'editorial' | 'bright' | 'brand') or 'custom'. */
  id: string
  name: string
  colors: {
    /** The page. */
    bg: string
    /** The soft second colour behind things (glow blobs, gradient end, cards). */
    glow: string
    /** The one strong colour (numbers, rules, the button). */
    accent: string
    /** Words. Checked against `bg` for 4.5:1 and fixed if it fails. */
    text: string
  }
  headFont: FontId
  bodyFont: FontId
  background: BackgroundStyle
  corners: Corners
  /** Sets motion speed and the music mood. */
  feel: Feel
  logoMode: LogoMode
  /** Extra chart colours after the accent (optional). */
  series?: string[]
  /** Headline weight (serif display faces look best at their regular weight). */
  headWeight?: number
  /** Uppercase short labels ("eyebrows"). Default true. */
  upperLabels?: boolean
}

export const KIT_LOOKS: Record<'animated-slides' | 'editorial' | 'bright', Look> = {
  // The current default feel: deep navy, gold, Montserrat — now filling the frame.
  'animated-slides': {
    id: 'animated-slides', name: 'Animated slides',
    colors: { bg: '#0B1424', glow: '#1D3358', accent: '#D8B25A', text: '#F4F1EC' },
    headFont: 'montserrat', bodyFont: 'source-sans',
    background: 'glow', corners: 'soft', feel: 'premium', logoMode: 'auto',
    series: ['#7FA7E0', '#9FB6C9', '#5E7BA6'], headWeight: 800,
  },
  // Cream paper, a serif headline, calm ink — the magazine page.
  'editorial': {
    id: 'editorial', name: 'Editorial',
    colors: { bg: '#F4EFE6', glow: '#E6DCCB', accent: '#1F5A43', text: '#1C1F26' },
    headFont: 'fraunces', bodyFont: 'dm-sans',
    background: 'paper', corners: 'square', feel: 'calm', logoMode: 'auto',
    series: ['#B08A4A', '#7C8C86', '#C9B79A'], headWeight: 600,
  },
  // The old Explainer colours (cream, navy, coral + teal/gold/purple), as a
  // colour theme of the same kit — friendlier, brighter, rounder.
  'bright': {
    id: 'bright', name: 'Bright',
    colors: { bg: '#F6F3ED', glow: '#D6EEE8', accent: '#E8452A', text: '#15233B' },
    headFont: 'space-grotesk', bodyFont: 'archivo',
    background: 'gradient', corners: 'soft', feel: 'energetic', logoMode: 'auto',
    series: ['#1FA88E', '#F5B72E', '#6B5CE0'], headWeight: 700,
  },
}
export type KitLookId = keyof typeof KIT_LOOKS | 'brand'
export const KIT_LOOK_IDS = ['animated-slides', 'editorial', 'bright', 'brand'] as const
export const isKitLookId = (v: unknown): v is KitLookId => typeof v === 'string' && (KIT_LOOK_IDS as readonly string[]).includes(v)

// ── colour maths ──
const HEX = /^#?([0-9a-f]{6})$/i
export function normHex(h: unknown, fallback: string): string {
  if (typeof h !== 'string') return fallback
  const s = h.trim()
  const short = /^#?([0-9a-f]{3})$/i.exec(s)
  if (short) return '#' + short[1].split('').map((c) => c + c).join('').toLowerCase()
  const m = HEX.exec(s)
  return m ? '#' + m[1].toLowerCase() : fallback
}
function rgb(h: string): [number, number, number] {
  const n = normHex(h, '#000000').slice(1)
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}
function toHex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')
}
export function luminance(h: string): number {
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  const [r, g, b] = rgb(h)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
/** Mix two colours: t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a), B = rgb(b)
  return toHex(A.map((c, i) => c + (B[i] - c) * t))
}
export function rgba(h: string, a: number): string {
  const [r, g, b] = rgb(h)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`
}
export const isDark = (h: string) => luminance(h) < 0.32

/**
 * Push `fg` toward white (on a dark page) or ink (on a light page) until it
 * reads at `ratio` against `bg`. Keeps the colour's hue as long as it can.
 */
export function readable(fg: string, bg: string, ratio = 4.5): string {
  if (contrast(fg, bg) >= ratio) return normHex(fg, fg)
  const target = isDark(bg) ? '#ffffff' : '#0b0f17'
  for (let t = 0.08; t <= 1.0001; t += 0.04) {
    const c = mix(fg, target, t)
    if (contrast(c, bg) >= ratio) return c
  }
  return target
}

/** Colours every scene uses, worked out once from the look (after the guard). */
export type LookTokens = {
  bg: string; glow: string; accent: string; text: string
  /** Secondary words (labels, context lines) — still ≥ 4.5:1. */
  muted: string
  /** The accent when it is used for WORDS (small labels): ≥ 4.5:1 on the page. */
  accentInk: string
  /** The accent for BIG things (hero numbers, bars): ≥ 3:1 on the page. */
  accentBig: string
  /** Words on top of an accent-filled button. */
  onAccent: string
  /** A card on the page. */
  surface: string
  surfaceLine: string
  /** Chart colours: accent first. */
  series: string[]
  radius: number
  dark: boolean
}

export type GuardResult = { look: Look; tokens: LookTokens; fixes: string[] }

/**
 * THE CONTRAST GUARD. Every look goes through here before a scene sees it.
 * Words must read at 4.5:1 on the page; if they don't, they are darkened or
 * lightened and the change is SAID (the look screen shows `fixes`).
 */
export function guardLook(input: Look): GuardResult {
  const fixes: string[] = []
  const bg = normHex(input.colors.bg, '#0b1424')
  const glow = normHex(input.colors.glow, mix(bg, isDark(bg) ? '#ffffff' : '#000000', 0.12))
  const accent = normHex(input.colors.accent, '#d8b25a')
  let text = normHex(input.colors.text, isDark(bg) ? '#f4f1ec' : '#1c1f26')
  if (contrast(text, bg) < 4.5) {
    const fixed = readable(text, bg, 4.5)
    fixes.push(`We ${isDark(bg) ? 'lightened' : 'darkened'} the text so it stays readable on this background.`)
    text = fixed
  }
  const dark = isDark(bg)
  const muted = readable(mix(text, bg, 0.32), bg, 4.5)
  const accentInk = readable(accent, bg, 4.5)
  const accentBig = readable(accent, bg, 3)
  if (accentBig !== accent) fixes.push(`We adjusted the accent colour a little so big numbers stand out from the background.`)
  const onAccent = contrast('#ffffff', accentBig) >= contrast('#0b0f17', accentBig) ? '#ffffff' : '#0b0f17'
  const surface = dark ? mix(bg, '#ffffff', 0.07) : mix(bg, '#ffffff', 0.55)
  const surfaceLine = dark ? rgba('#ffffff', 0.12) : rgba(text, 0.12)
  const series = [accentBig, ...(input.series || []).map((c) => readable(normHex(c, accentBig), bg, 3))]
  while (series.length < 6) series.push(mix(accentBig, bg, 0.25 + series.length * 0.1))
  const look: Look = {
    ...input,
    colors: { bg, glow, accent, text },
    headFont: isFontId(input.headFont) ? input.headFont : 'montserrat',
    bodyFont: isFontId(input.bodyFont) ? input.bodyFont : 'inter',
    background: (['gradient', 'glow', 'solid', 'paper'] as const).includes(input.background) ? input.background : 'glow',
    corners: input.corners === 'square' ? 'square' : 'soft',
    feel: (['calm', 'premium', 'energetic'] as const).includes(input.feel) ? input.feel : 'premium',
    logoMode: (['auto', 'plate', 'text'] as const).includes(input.logoMode) ? input.logoMode : 'auto',
  }
  // Max corner radius 10px (house rule).
  const radius = look.corners === 'square' ? 2 : 10
  return { look, tokens: { bg, glow, accent, text, muted, accentInk, accentBig, onAccent, surface, surfaceLine, series, radius, dark }, fixes }
}

/**
 * A look from a brand's own colours ("My brand"). One strong accent, calm
 * neutrals: a dark page made from the primary colour, the brand accent (or
 * primary) as the accent. Falls back to Animated slides when the brand has
 * no usable colour.
 */
export function brandLook(brand: { primary_color?: string | null; secondary_color?: string | null; accent_color?: string | null; fonts?: unknown } | null | undefined): Look {
  const base = KIT_LOOKS['animated-slides']
  if (!brand) return { ...base, id: 'brand', name: 'My brand' }
  const sat = (h: string) => { const [r, g, b] = rgb(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx }
  const cands = [brand.accent_color, brand.primary_color, brand.secondary_color].map((c) => normHex(c, '')).filter(Boolean)
  const accent = cands.find((c) => sat(c) > 0.3 && luminance(c) > 0.04) || base.colors.accent
  const primary = normHex(brand.primary_color, '') || accent
  const bg = mix(primary, '#05070c', 0.82)
  const glow = mix(primary, '#05070c', 0.55)
  const fonts = Array.isArray(brand.fonts) ? brand.fonts.filter((f): f is string => typeof f === 'string') : []
  const head = fonts[0] ? closestFreeFont(fonts[0], 'montserrat').id : 'montserrat'
  return { ...base, id: 'brand', name: 'My brand', colors: { bg, glow, accent, text: '#f4f1ec' }, headFont: head }
}

/**
 * Any look the app or the API sends, made safe: unknown fields dropped, bad
 * colours replaced from the preset it names, fonts kept to the free list.
 */
export function sanitizeLook(raw: unknown, fallbackId: keyof typeof KIT_LOOKS = 'animated-slides'): Look {
  const base = KIT_LOOKS[fallbackId]
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, any>
  const preset = typeof r.id === 'string' && r.id in KIT_LOOKS ? KIT_LOOKS[r.id as keyof typeof KIT_LOOKS] : base
  const c = (r.colors && typeof r.colors === 'object') ? r.colors : {}
  return {
    id: typeof r.id === 'string' ? r.id.slice(0, 40) : preset.id,
    name: typeof r.name === 'string' ? r.name.slice(0, 60) : preset.name,
    colors: {
      bg: normHex(c.bg, preset.colors.bg), glow: normHex(c.glow, preset.colors.glow),
      accent: normHex(c.accent, preset.colors.accent), text: normHex(c.text, preset.colors.text),
    },
    headFont: isFontId(r.headFont) ? r.headFont : preset.headFont,
    bodyFont: isFontId(r.bodyFont) ? r.bodyFont : preset.bodyFont,
    background: (['gradient', 'glow', 'solid', 'paper'] as const).includes(r.background) ? r.background : preset.background,
    corners: r.corners === 'square' || r.corners === 'soft' ? r.corners : preset.corners,
    feel: (['calm', 'premium', 'energetic'] as const).includes(r.feel) ? r.feel : preset.feel,
    logoMode: (['auto', 'plate', 'text'] as const).includes(r.logoMode) ? r.logoMode : preset.logoMode,
    series: Array.isArray(r.series) ? r.series.slice(0, 5).map((s: unknown) => normHex(s, preset.colors.accent)) : preset.series,
    headWeight: typeof r.headWeight === 'number' && r.headWeight >= 300 && r.headWeight <= 900 ? r.headWeight : preset.headWeight,
  }
}

/** Feel → motion speed (1 = premium) and the bundled music bed. */
export const FEEL = {
  calm: { speed: 0.8, cut: 20, music: 'music/bed-warm-128.wav', musicMood: 'Gentle, warm, unhurried — soft piano and strings' },
  premium: { speed: 1, cut: 16, music: 'music/bed-corporate-128.wav', musicMood: 'Polished, confident, modern — light pads and soft pulse' },
  energetic: { speed: 1.3, cut: 12, music: 'music/bed-uplifting-128.wav', musicMood: 'Upbeat and bright — light percussion, positive' },
} as const

// ── 2. SCENES ────────────────────────────────────────────────────────────────

export const SCENE_TYPES = ['title', 'bignumber', 'comparison', 'timeline', 'chart', 'checklist', 'quote', 'cta'] as const
export type SceneType = typeof SCENE_TYPES[number]
/** How a scene cuts in: calm = dissolve, build = push, reveal = wipe. */
export type Mood = 'calm' | 'build' | 'reveal'

export type Word = { w: string; start: number; end: number }

type Base = {
  id: number
  narration: string
  mood?: Mood
  /** Voice file for this scene (per-video folder), set by the render service. */
  vo?: string
  /** Voice length in seconds, measured by the render service. */
  voSec?: number
  /** Word timings from the voice service (seconds from the clip start). */
  words?: Word[]
}
/** A number on screen. `value` is the number; prefix/suffix decorate it. */
export type Figure = { value: number; prefix?: string; suffix?: string; decimals?: number }

export type TitleScene = Base & { type: 'title'; headline: string; sub?: string }
export type BigNumberScene = Base & { type: 'bignumber'; label: string; figure: Figure; context?: string; landOn?: string }
export type ComparisonSide = { label: string; figure?: Figure; points?: string[] }
export type ComparisonScene = Base & { type: 'comparison'; heading: string; left: ComparisonSide; right: ComparisonSide; verdict?: string }
export type TimelineScene = Base & { type: 'timeline'; heading: string; steps: { when: string; label: string }[] }
export type ChartScene = Base & {
  type: 'chart'; heading: string; kind: 'bar' | 'donut' | 'line'
  points: { label: string; value: number }[]
  prefix?: string; suffix?: string; decimals?: number
  highlight?: number; takeaway?: string
}
export type ChecklistScene = Base & { type: 'checklist'; heading: string; items: string[] }
export type QuoteScene = Base & { type: 'quote'; quote: string; attribution?: string }
export type CtaScene = Base & {
  type: 'cta'; headline: string; action: string
  contact?: { phone?: string; email?: string; website?: string; booking?: string }
}
export type KitScene = TitleScene | BigNumberScene | ComparisonScene | TimelineScene | ChartScene | ChecklistScene | QuoteScene | CtaScene

/** Word limits per slot — the planner enforces them, the scenes are designed for them. */
export const LIMITS = {
  headline: 10, sub: 18, label: 6, context: 16, heading: 9, sideLabel: 5, point: 9, points: 3,
  verdict: 14, when: 4, stepLabel: 8, steps: [2, 5], chartLabel: 4, chartPoints: [2, 6],
  item: 10, items: [1, 4], quote: 30, attribution: 8, action: 6, takeaway: 14,
} as const

export type KitBrand = {
  name?: string
  /** Real uploaded logo files only. light = for dark pages, dark = for light pages. */
  logo?: { light?: string; dark?: string; any?: string }
  /** The agent's REAL photo; onCover/onClosing default true (the photo-placement choice). */
  presenter?: { name?: string; role?: string; photo?: string; onCover?: boolean; onClosing?: boolean }
}

/** The whole video, as KitVideo reads it. */
export type KitPlan = {
  version: 1
  title: string
  look: Look
  brand: KitBrand
  /** "Prepared for" on the cover and the top-right tag. */
  recipient?: string
  /** Insurance / financial illustration: quiet sound set. */
  regulated?: boolean
  scenes: KitScene[]
  audio?: {
    /** Music file (bundled bed or the per-video file). Omit for the feel's bed. */
    music?: string
    sfx?: 'standard' | 'quiet' | 'off'
  }
}

export const countWords = (s: unknown) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length

/** The platform's own name never appears on a client's video. */
export const isPlatformName = (s: unknown) => /docs\s*2\s*video|docs2video|prismgraphs/i.test(String(s ?? ''))

// ── 3. NUMBERS ───────────────────────────────────────────────────────────────

/**
 * The one way every video writes a number: commas always; money with a $ and
 * whole dollars unless it has cents. 500000 → "$500,000", 46666.5 → "$46,666.50".
 */
export function formatFigure(f: Figure, v: number = f.value): string {
  const prefix = f.prefix || ''
  const money = prefix.includes('$')
  const dec = f.decimals ?? (Number.isInteger(f.value) ? 0 : money ? 2 : Math.min(2, (String(f.value).split('.')[1] || '').length))
  const n = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  return `${v < 0 ? '-' : ''}${prefix}${n}${f.suffix || ''}`
}

const SUFFIX_MULT: Record<string, number> = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, b: 1e9, B: 1e9, thousand: 1e3, million: 1e6, billion: 1e9 }

/**
 * Read a written figure: "$500,000" · "$1.2M" · "6.35%" · "$142/mo" · "Age 65"
 * · "20 years". Returns null when it isn't one number (a range, a word).
 */
export function parseFigure(raw: unknown): Figure | null {
  const s = String(raw ?? '').trim()
  if (!s || s.length > 40) return null
  const m = /^([A-Za-z ]{0,12}?)\s*(~|≈)?\s*(\$|£|€)?\s*(-?\d{1,3}(?:,\d{3})+|-?\d+)(\.\d+)?\s*(thousand|million|billion|[kKmMbB](?![a-z]))?\s*(%|\/\s?(?:mo|month|yr|year|wk|week)|x|\+|[a-zA-Z][a-zA-Z ]{0,14})?$/.exec(s)
  if (!m) return null
  const [, lead, , cur, int, frac, mult, tail] = m
  if (lead && lead.trim() && cur) return null
  let value = parseFloat(int.replace(/,/g, '') + (frac || ''))
  if (!isFinite(value)) return null
  if (mult) value *= SUFFIX_MULT[mult]
  const decimals = mult ? (Number.isInteger(value) ? 0 : 2) : frac ? frac.length - 1 : 0
  let suffix = (tail || '').replace(/\s+/g, ' ')
  if (/^\/\s?(mo|month)$/.test(suffix)) suffix = '/mo'
  else if (/^\/\s?(yr|year)$/.test(suffix)) suffix = '/yr'
  else if (suffix && !/^(%|x|\+)$/.test(suffix)) suffix = ' ' + suffix.trim()
  const prefix = (lead && lead.trim() ? lead.trim() + ' ' : '') + (cur || '')
  return { value, ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}), ...(decimals ? { decimals } : {}) }
}

/** Every number in a piece of text, as plain values ("$1.2M" → 1200000, "6.35%" → 6.35). */
export function numbersIn(text: unknown): number[] {
  const out: number[] = []
  const re = /(\$\s?)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(thousand|million|billion|[kKmMbB](?![a-z]))?/g
  for (const m of String(text ?? '').matchAll(re)) {
    let v = parseFloat(m[2].replace(/,/g, '') + (m[3] || ''))
    if (m[4]) v *= SUFFIX_MULT[m[4]]
    if (isFinite(v)) out.push(v)
  }
  return out
}

/** Spelled-out numbers the voice reads ("five hundred thousand") → digits, for grounding checks. */
const SMALL: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
export function spelledNumbersIn(text: unknown): number[] {
  const out: number[] = []
  const words = String(text ?? '').toLowerCase().replace(/-/g, ' ').split(/[^a-z]+/)
  let cur = 0, total = 0, any = false
  const flush = () => { if (any) out.push(total + cur); cur = 0; total = 0; any = false }
  for (const w of words) {
    if (w in SMALL) { cur += SMALL[w]; any = true }
    else if (w === 'hundred' && any) cur *= 100
    else if ((w === 'thousand' || w === 'million' || w === 'billion') && any) { total += cur * (w === 'thousand' ? 1e3 : w === 'million' ? 1e6 : 1e9); cur = 0 }
    else if (w === 'and' && any) continue
    else flush()
  }
  flush()
  return out
}

// ── 4. TIMING ────────────────────────────────────────────────────────────────

export const KIT_FPS = 30
export const KIT_W = 1920
export const KIT_H = 1080
/** Frames from a scene's first frame to its voice starting (the cut settles first). */
export const VO_LEAD = 12
/** Quiet frames after a scene's voice before the next cut begins. */
export const VO_TAIL = 22
/** The last scene holds this long after its voice (the sign-off breathes). */
export const END_HOLD = 75
/** Shortest scene of each type, in frames (the cover must be readable). */
export const MIN_FRAMES: Record<SceneType, number> = {
  title: 120, bignumber: 105, comparison: 120, timeline: 120, chart: 120, checklist: 105, quote: 105, cta: 150,
}
/** A scene with no voice yet (the free preview) gets this long. */
export const PREVIEW_FRAMES = 240

export type KitTimeline = {
  /** First frame of each scene (scenes overlap by the cut length). */
  starts: number[]
  /** Length of each scene in frames, including its cut in and out. */
  durations: number[]
  /** Voice length of each scene in frames (0 = none). */
  voFrames: number[]
  /** Cut length in frames. */
  cut: number
  total: number
}

/** The whole timeline from voice lengths. Mirrored in render-service/kit.js (kitTimeline). */
export function kitTimeline(scenes: { type: SceneType; voSec?: number }[], feel: Feel, opts: { preview?: boolean } = {}): KitTimeline {
  const cut = FEEL[feel]?.cut ?? 16
  const voFrames = scenes.map((s) => (opts.preview ? 0 : Math.max(0, Math.round((s.voSec || 0) * KIT_FPS))))
  const durations = scenes.map((s, i) => {
    if (opts.preview) return PREVIEW_FRAMES
    const last = i === scenes.length - 1
    const need = VO_LEAD + voFrames[i] + (last ? END_HOLD : VO_TAIL + cut)
    return Math.max(MIN_FRAMES[s.type] ?? 105, need)
  })
  const starts: number[] = []
  let t = 0
  durations.forEach((d, i) => { starts.push(t); t += d - (i < durations.length - 1 ? cut : 0) })
  return { starts, durations, voFrames, cut, total: Math.max(1, t) }
}

/** The frame (from the scene's voice start) where a spoken phrase begins, or null. */
export function cueFrame(words: Word[] | undefined, phrase: string | undefined, fps = KIT_FPS): number | null {
  if (!words?.length || !phrase) return null
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const target = phrase.split(/\s+/).map(norm).filter(Boolean)
  if (!target.length) return null
  const wn = words.map((w) => norm(w.w))
  for (let i = 0; i < wn.length; i++) {
    let ok = true
    for (let k = 0; k < target.length; k++) {
      const a = wn[i + k]
      if (a == null || !(a === target[k] || (target[k].length > 3 && (a.startsWith(target[k]) || target[k].startsWith(a))))) { ok = false; break }
    }
    if (ok) return Math.round(words[i].start * fps)
  }
  return null
}

/** The mood a scene cuts in with when the planner didn't say. */
export function defaultMood(type: SceneType): Mood {
  if (type === 'title' || type === 'quote' || type === 'cta') return 'calm'
  if (type === 'bignumber' || type === 'comparison') return 'reveal'
  return 'build'
}
