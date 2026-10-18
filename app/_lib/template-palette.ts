// COPIED from One Dollar Decks lib/code-deck/templates/palette.ts by scripts/import-template-previews.mjs — change it there, then import again.
/**
 * A TEMPLATE IN THE BRAND'S COLORS (owner, 2026-10-18: "templates need to be
 * able to change to brand colors").
 *
 * Each template names the colors of its own that may become the brand's —
 * its accent, its second accent, its color-block fills — and, for each, what
 * it sits on or under (the ground behind it when it is words, the ink on it
 * when it is a fill) and how much contrast that needs. The ground, the shades
 * over photographs and the ink on photographs never change. Grunge and
 * Newsweekly keep their character: only their accent changes (Newsweekly's
 * red frame becomes the brand's main color).
 *
 * A brand color is never used as given when it would be hard to read: its
 * lightness is moved, keeping its hue and saturation, to the nearest value
 * that reaches the contrast on everything it meets — 4.5:1 for words of
 * ordinary size, 3:1 for large words and fills under large words. When no
 * lightness reaches it (a color asked to sit on both black and white), that
 * one color stays the template's own and it is said in `kept`.
 *
 * The result is extra CSS that applies only to a page carrying the class
 * `bc` (".t-night.bc …"), so one page can go back to the template's own
 * colors (the engine does, if a page in the brand's colors still fails its
 * final check) while the rest of the video stays in the brand's.
 *
 * NO IMPORTS ON PURPOSE: Docs2Video copies this file whole
 * (scripts/export-template-previews.mjs) so its look-step previews recolor
 * with exactly the same rules the films are drawn with.
 */

export type BrandColorMode = 'template' | 'brand'

type TemplateKey = 'night' | 'luxury' | 'editorial' | 'magazine' | 'lifestyle' | 'swiss' | 'grunge' | 'newsweekly'

/** What one template color must stay readable against: a color ("#rrggbb", or "@#rrggbb" for another swapped color's NEW value) and the contrast it needs. */
type On = [string, number]

type Swap = {
  /** The template's own color, as written in its stylesheet: "#rrggbb", or "rgb:r,g,b" for an rgba(r,g,b,a) whose alpha is kept. */
  from: string
  /** Which brand color it becomes: the main one, or the second (the main one when the brand has one color). */
  role: 'primary' | 'secondary'
  /** Moved toward white (+) or black (−) before fitting — a lighter or deeper version of the brand color, as the template uses. */
  tone?: number
  on: On[]
}

const BG = 4.5, LARGE = 3, MARGIN = 0.3

/** Each template's swappable colors, in order (a later one may sit on an earlier one's new value). */
export const BRAND_SWAPS: Record<TemplateKey, Swap[]> = {
  night: [
    // The cards are glass over the city: their ground is lighter than the page's.
    { from: '#FFB547', role: 'primary', on: [['#04080F', BG], ['#07111F', BG], ['#0A1424', BG], ['#1E2A3C', BG]] },
  ],
  luxury: [
    // Words cross the marble's gold veins: readable on a vein too.
    { from: '#D9B56E', role: 'primary', on: [['#0B0A08', BG], ['#1A1712', BG], ['#3A3226', BG]] },
    { from: '#E6C887', role: 'primary', tone: 0.15, on: [['#0B0A08', BG], ['#4A3C24', LARGE]] },
    { from: '#F1D99A', role: 'primary', tone: 0.35, on: [['#0B0A08', LARGE]] },
    { from: '#B98E43', role: 'primary', tone: -0.1, on: [['#0B0A08', LARGE]] },
    { from: 'rgb:217,181,110', role: 'primary', on: [['#0B0A08', 2]] },
  ],
  editorial: [
    { from: '#5E6B2E', role: 'primary', on: [['#F7F2E8', BG], ['#FFFDF8', BG], ['#EFE7D8', BG]] },
    { from: '#C9CFA2', role: 'primary', tone: 0.55, on: [['#F7F2E8', 1.3]] },
    { from: '#EEF2CF', role: 'primary', tone: 0.85, on: [['@#5E6B2E', BG]] },
    { from: '#F0F3D8', role: 'primary', tone: 0.85, on: [['@#5E6B2E', BG]] },
  ],
  magazine: [
    { from: '#FF4B1F', role: 'primary', on: [['#111111', BG], ['#F5EFE4', 1.5]] },
    { from: '#C2330C', role: 'primary', tone: -0.15, on: [['#E9E1D2', BG]] },
    { from: '#CC330A', role: 'primary', tone: -0.1, on: [['#F5EFE4', LARGE]] },
    { from: '#2A1208', role: 'primary', tone: -0.85, on: [['@#FF4B1F', BG]] },
  ],
  lifestyle: [
    // Over the shaded photographs, whose light parts come through.
    { from: '#FFC98B', role: 'secondary', tone: 0.3, on: [['#1C120A', BG], ['#2B1E14', BG], ['#5C4A3C', BG]] },
    // On the cream cards, which let a little of the photograph through.
    { from: '#A9471F', role: 'primary', on: [['#FFF8EE', BG], ['#FFFFFF', BG], ['#EFE6DA', BG]] },
    { from: '#FFF3E6', role: 'primary', tone: 0.9, on: [['@#A9471F', BG]] },
  ],
  swiss: [
    { from: '#1D4ED8', role: 'primary', on: [['#FFFFFF', BG], ['#F1F4F9', BG]] },
    { from: '#DCE5FF', role: 'primary', tone: 0.85, on: [['@#1D4ED8', BG]] },
    { from: '#3B6EF5', role: 'primary', on: [['#FFFFFF', BG], ['#0B1220', 1.5]] },
    { from: '#8FAEFF', role: 'primary', tone: 0.4, on: [['#0B1220', BG]] },
  ],
  grunge: [
    // On concrete and wet street: readable on the texture's light patches too.
    { from: '#E4F53A', role: 'primary', on: [['#111111', BG], ['#0D0D0C', BG], ['#3A3A36', BG]] },
  ],
  newsweekly: [
    { from: '#E3120B', role: 'primary', on: [['#FAF8F4', BG], ['#FFFFFF', BG], ['#D9D4CC', LARGE]] },
    { from: '#FF5A50', role: 'primary', tone: 0.25, on: [['#111111', BG]] },
  ],
}

/* ─────────────────────────────── color math ─────────────────────────────── */

export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s.trim())
const rgbOf = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const hexOf = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
export const luminanceOf = (hex: string) => { const [r, g, b] = rgbOf(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) }
export const contrast = (a: string, b: string) => { const x = luminanceOf(a), y = luminanceOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}
function fromHsl(h: number, s: number, l: number): string {
  if (s === 0) return hexOf(l * 255, l * 255, l * 255)
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p }
  return hexOf(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255)
}

/** Toward white (t > 0) or black (t < 0) by |t|. */
export const tone = (hex: string, t: number) => { const [r, g, b] = rgbOf(hex); const to = t > 0 ? 255 : 0, k = Math.abs(t); return hexOf(r + (to - r) * k, g + (to - g) * k, b + (to - b) * k) }

/**
 * The color nearest `hex` in lightness (hue and saturation kept) that reaches
 * every contrast asked. Null when no lightness does.
 */
export function fitColor(hex: string, on: [string, number][]): string | null {
  const ok = (c: string) => on.every(([bg, min]) => contrast(c, bg) >= min)
  if (ok(hex)) return hex.toUpperCase()
  const [h, s, l] = toHsl(hex)
  for (let d = 0.005; d <= 1; d += 0.005) {
    for (const ll of [l - d, l + d]) {
      if (ll < 0 || ll > 1) continue
      const c = fromHsl(h, s, ll)
      if (ok(c)) return c
    }
  }
  return null
}

/* ─────────────────────────────── the skin ─────────────────────────────── */

export type BrandSkin = {
  /** Extra CSS for pages with class "bc"; empty when nothing changed. */
  css: string
  /** Template color → the brand-derived color it became. */
  map: Record<string, string>
  /** Template colors left as they were, and why (a brand color that could not be made readable there). */
  kept: string[]
}

/** The brand's colors, cleaned: valid hex only, near-duplicates dropped, at most three. */
export function cleanPalette(palette: readonly unknown[] | null | undefined): string[] {
  const out: string[] = []
  for (const p of palette ?? []) {
    if (!isHex(p)) continue
    const c = p.trim().toUpperCase()
    if (!out.some((o) => contrast(o, c) < 1.05 && Math.abs(toHsl(o)[0] - toHsl(c)[0]) < 0.02)) out.push(c)
    if (out.length === 3) break
  }
  return out
}

/** Swap one template's colors for the brand's, contrast-corrected. */
export function brandSkin(id: TemplateKey, skinCss: string, palette: readonly unknown[]): BrandSkin {
  const pal = cleanPalette(palette)
  if (!pal.length) return { css: '', map: {}, kept: [] }
  const roleColor = { primary: pal[0], secondary: pal[1] ?? pal[0] }
  const map: Record<string, string> = {}
  const kept: string[] = []
  for (const sw of BRAND_SWAPS[id]) {
    const base = sw.tone ? tone(roleColor[sw.role], sw.tone) : roleColor[sw.role]
    const on: [string, number][] = []
    let usable = true
    for (const [bg, min] of sw.on) {
      if (!bg.startsWith('@')) { on.push([bg, min]); continue }
      const other = map[bg.slice(1).toUpperCase()] ?? bg.slice(1)
      on.push([other, min])
      if (!isHex(other)) usable = false
    }
    // A little to spare: a drawn page measures a hair under the arithmetic (edges, glass over photographs).
    const fitted = usable ? fitColor(base, on.map(([bg, min]): [string, number] => [bg, min >= LARGE ? min + MARGIN : min])) : null
    const key = sw.from.toUpperCase()
    if (fitted) map[key] = fitted
    else kept.push(`${sw.from} (${sw.role}) kept: no shade of ${roleColor[sw.role]} is readable on ${sw.on.map((o) => o[0]).join(', ')}`)
  }
  if (!Object.keys(map).length) return { css: '', map, kept }

  // Each rule of the template's skin that names a swapped color, again, in
  // the brand's colors, for pages with the class "bc" (one class more
  // specific, so it wins).
  const out: string[] = []
  for (const rule of skinCss.split('\n')) {
    const brace = rule.indexOf('{')
    if (brace < 0 || !rule.trim().endsWith('}')) continue
    let body = rule.slice(brace)
    const before = body
    for (const [from, to] of Object.entries(map)) {
      if (from.startsWith('RGB:')) {
        const [r, g, b] = rgbOf(to)
        body = body.split(`rgba(${from.slice(4)},`).join(`rgba(${r},${g},${b},`)
      } else {
        body = body.replace(new RegExp(`${from}(?![0-9a-f])`, 'gi'), to)
      }
    }
    if (body === before) continue
    const selector = rule.slice(0, brace).split(`.t-${id}`).join(`.t-${id}.bc`)
    out.push(selector + body)
  }
  return { css: out.join('\n'), map, kept }
}
