/* ============================================================================
 * THE CLIENT PAGE WEARS THE PRESENTER'S BRAND (owner, 2026-10-18: "these look
 * like the old share pages"). The share page is the client's page, so its
 * colours are the brand's — the hero band in the brand's main colour, buttons
 * and labels in its accent — never Docs2Video's blue.
 *
 * Brand colours are whatever a person typed, so every pair is corrected until
 * it reads: words on the hero at least 4.5:1, button words at least 4.5:1,
 * labels and links on the page at least 4.5:1. A colour is only ever darkened
 * or lightened toward what reads, never swapped for another hue.
 * ==========================================================================*/

export type BrandColours = { primary?: string | null; secondary?: string | null; accent?: string | null }

export type ShareTheme = {
  /** The hero band and its deeper edge. */
  hero: string
  heroDeep: string
  /** Words on the hero. */
  heroInk: string
  heroSoft: string
  /** Small labels on the hero, in the accent. */
  heroLabel: string
  /** The main button: its fill and its words. */
  accent: string
  onAccent: string
  /** The accent as words on the page (labels, links, numbers). */
  accentInk: string
  /** A pale tint of the accent for selected things. */
  accentTint: string
  /** The page itself. */
  paper: string
  card: string
  ink: string
  inkSoft: string
  inkFaint: string
  line: string
}

/** Used when the video has no brand, or the brand saved no colours: a calm ink and a bronze, nobody's logo colour. */
export const NEUTRAL_BRAND: Required<BrandColours> = { primary: '#1D2733', secondary: '#1D2733', accent: '#9A6B2F' }

const PAPER = '#F6F4EF'
const CARD = '#FFFFFF'
const INK = '#16181C'
const INK_SOFT = '#4A4F57'
const INK_FAINT = '#6B7079'
const LINE = '#E3DED4'
const WHITE = '#FFFFFF'
const BLACK = '#0B0C0E'

type RGB = [number, number, number]

/** A hex colour (#abc or #aabbcc), else null. */
export function parseHex(v: unknown): RGB | null {
  const s = String(v ?? '').trim()
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
}

const toHex = (c: RGB) => '#' + c.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('').toUpperCase()
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB

function lum(c: RGB): number {
  const [r, g, b] = c.map((n) => {
    const x = n / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast between two hex colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const x = parseHex(a), y = parseHex(b)
  if (!x || !y) return 1
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

/** Move `c` toward `toward` in small steps until it reaches `min` contrast against `ground`. */
function untilReads(c: RGB, ground: string, toward: RGB, min: number): RGB {
  let out = c
  for (let i = 0; i <= 40 && contrast(toHex(out), ground) < min; i++) out = mix(c, toward, i / 40)
  return out
}

export function shareTheme(colours: BrandColours | null | undefined): ShareTheme {
  const primary = parseHex(colours?.primary) ?? parseHex(NEUTRAL_BRAND.primary)!
  // The hero carries white words. The main colour when white reads on it;
  // a light main colour (a yellow, a sky blue) hands the hero to the brand's
  // own darker colour when it has one — darkening a yellow turns it to mud.
  // Only when the brand has no dark colour is the main one taken darker.
  const darkOwn = [colours?.secondary, colours?.accent].map(parseHex).find((c): c is RGB => !!c && contrast(toHex(c), WHITE) >= 4.5)
  const heroBase = contrast(toHex(primary), WHITE) >= 4.5 ? primary : darkOwn ?? primary
  const heroRgb = untilReads(heroBase, WHITE, parseHex(BLACK)!, 4.5)
  // The accent: the brand's accent; else, when the light main colour gave the
  // hero away, that main colour (a yellow button on a green page); else the
  // second colour, else the main one.
  const handedOff = heroBase !== primary
  const accentRaw = parseHex(colours?.accent)
    ?? (handedOff ? primary : null)
    ?? parseHex(colours?.secondary)
    ?? (parseHex(colours?.primary) ? primary : parseHex(NEUTRAL_BRAND.accent)!)
  const hero = toHex(heroRgb)
  const heroDeep = toHex(mix(heroRgb, parseHex(BLACK)!, 0.38))
  // The softer words still read on the deep end of the hero.
  const heroSoft = toHex(untilReads(mix(parseHex(WHITE)!, heroRgb, 0.28), hero, parseHex(WHITE)!, 4.5))
  const heroLabel = toHex(untilReads(accentRaw, hero, parseHex(WHITE)!, 4.5))

  // The button: the accent as given when white or black words read on it; darkened only if neither does.
  const onWhite = contrast(toHex(accentRaw), WHITE), onBlack = contrast(toHex(accentRaw), BLACK)
  let accentRgb = accentRaw
  let onAccent = onWhite >= onBlack ? WHITE : BLACK
  if (Math.max(onWhite, onBlack) < 4.5) { accentRgb = untilReads(accentRaw, WHITE, parseHex(BLACK)!, 4.5); onAccent = WHITE }

  const accentInk = toHex(untilReads(accentRaw, PAPER, parseHex(BLACK)!, 4.5))
  const accentTint = toHex(mix(accentRaw, parseHex(WHITE)!, 0.86))

  return { hero, heroDeep, heroInk: WHITE, heroSoft, heroLabel, accent: toHex(accentRgb), onAccent, accentInk, accentTint, paper: PAPER, card: CARD, ink: INK, inkSoft: INK_SOFT, inkFaint: INK_FAINT, line: LINE }
}

/** The theme as CSS custom properties for the page's root. */
export function shareThemeVars(t: ShareTheme): Record<string, string> {
  return {
    '--wt-hero': t.hero, '--wt-hero-deep': t.heroDeep, '--wt-hero-ink': t.heroInk, '--wt-hero-soft': t.heroSoft, '--wt-hero-label': t.heroLabel,
    '--wt-accent': t.accent, '--wt-on-accent': t.onAccent, '--wt-accent-ink': t.accentInk, '--wt-accent-tint': t.accentTint,
    '--wt-paper': t.paper, '--wt-card': t.card, '--wt-ink': t.ink, '--wt-ink-soft': t.inkSoft, '--wt-ink-faint': t.inkFaint, '--wt-line': t.line,
  }
}

/** The colours saved on a brand row (its three colour columns), for the public share data. */
export function brandColoursOf(brand: { primary_color?: unknown; secondary_color?: unknown; accent_color?: unknown } | null | undefined): BrandColours | null {
  if (!brand) return null
  const pick = (v: unknown) => (parseHex(v) ? String(v).trim() : null)
  const c = { primary: pick(brand.primary_color), secondary: pick(brand.secondary_color), accent: pick(brand.accent_color) }
  return c.primary || c.secondary || c.accent ? c : null
}
