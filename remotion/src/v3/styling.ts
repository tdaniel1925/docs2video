import {
  type Theme, PREMIUM, EXECUTIVE_LIGHT, WARM_TRUST, MODERN_FINTECH, BOLD_EDITORIAL, MINIMAL_MONO,
} from '../tokens'
import { luminance } from '../contrast'

/**
 * Styling resolution: content picks a default theme (mood), the brand supplies
 * the accent colors + logo. Theme = structure/mood; brand = accents. This keeps
 * every video on-brand AND always legible.
 */

/** Map a document category (from the classifier) to a default theme. */
export function themeForCategory(category: string | undefined): Theme {
  switch ((category || '').toLowerCase()) {
    case 'insurance': return EXECUTIVE_LIGHT       // trustworthy corporate
    case 'finance': return MODERN_FINTECH          // sleek fintech
    case 'healthcare': return WARM_TRUST           // human, gentle
    case 'legal': return MINIMAL_MONO              // serious, understated
    case 'business':
    case 'consulting': return EXECUTIVE_LIGHT
    case 'events':
    case 'entertainment': return PREMIUM           // bold, cinematic
    case 'marketing': return BOLD_EDITORIAL
    default: return PREMIUM                          // Docs2Video house default
  }
}

/** Nudge an accent color to stay legible against the theme's ground.
 *  On a dark ground, very dark accents get lightened; on light, very light get darkened. */
function guardAccent(hex: string, mode: 'dark' | 'light'): string {
  const L = luminance(hex)
  if (mode === 'dark' && L < 0.22) return lighten(hex, 0.4)   // too dark on dark
  if (mode === 'light' && L > 0.8) return darken(hex, 0.4)    // too light on light
  return hex
}

/**
 * Apply a brand to a chosen theme: keep the theme's mood/ground, replace the
 * ACCENTS with the brand's colors (contrast-guarded), tint the glass edge, and
 * carry the logo through. Falls back to the theme's own accents if no brand.
 */
export function applyBrand(
  theme: Theme,
  brand?: { colors?: string[]; logo?: string } | null
): Theme & { logo?: string } {
  if (!brand?.colors?.length) return { ...theme }
  const guarded = brand.colors.map((c) => guardAccent(c, theme.mode))
  // Always provide 3 accents (pad with the theme's own if brand has fewer).
  const accents: [string, string, string] = [
    guarded[0] ?? theme.accents[0],
    guarded[1] ?? theme.accents[1],
    guarded[2] ?? theme.accents[2],
  ]
  return {
    ...theme,
    name: `${theme.name} · branded`,
    accents,
    glassEdge: hexA(accents[0], 0.28),
    logo: brand.logo,
  }
}

/** Resolve final theme from content + brand + optional user override. */
export function resolveTheme(opts: {
  category?: string
  override?: Theme
  brand?: { colors?: string[]; logo?: string } | null
}): Theme & { logo?: string } {
  const base = opts.override ?? themeForCategory(opts.category)
  return applyBrand(base, opts.brand)
}

// --- small color utils ---
function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))) }
function parse(hex: string) { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
function toHex(r: number, g: number, b: number) { return '#' + [r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('') }
function lighten(hex: string, amt: number) { const [r, g, b] = parse(hex); return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt) }
function darken(hex: string, amt: number) { const [r, g, b] = parse(hex); return toHex(r * (1 - amt), g * (1 - amt), b * (1 - amt)) }
function hexA(hex: string, a: number) { const [r, g, b] = parse(hex); return `rgba(${r},${g},${b},${a})` }
