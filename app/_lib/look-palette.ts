// =============================================================================
// LOOK PALETTE — turning the colours MEASURED in a picture into one calm look.
//
// Pure (no imports but the kit rulebook), so the browser, the server and the
// tests all share it. The pixels themselves are read on the server
// (look-reference.ts, with sharp); this file only does the colour maths:
//
//   1. clusterPixels  — k-means in Lab (how people see colour), deterministic.
//   2. pickPalette    — ONE strong accent + calm neutrals:
//        · near-greys never become the accent,
//        · near-duplicates are merged,
//        · framework DEFAULT colours (Bootstrap / Tailwind / Material) are
//          set aside when the picture has any other colour — a page built
//          on Bootstrap is not "a brand that loves #0d6efd" (memory:
//          brand colour extraction; the Apex video used Bootstrap's navy/gold),
//        · the page colour is calmed (low chroma) so a busy photo doesn't
//          become a muddy background,
//        · words get a colour that reads (the kit's contrast guard still runs
//          on top).
//   3. alternatives   — "Try other colours from it": the other accents the
//      picture really has, and the same colours on the opposite page.
// =============================================================================

import { contrast, normHex } from '../../remotion/src/kit/spec'

export type Rgb = [number, number, number]
export type Lab = [number, number, number]
export type Cluster = { rgb: Rgb; lab: Lab; weight: number }

/** The colours a look is made of. */
export type PaletteColors = { bg: string; glow: string; accent: string; text: string }

export type MeasuredPalette = PaletteColors & {
  /** Other colour sets from the same picture ("Try other colours from it"). */
  alternatives: PaletteColors[]
  /** The main colours we saw, biggest first (for the screen; up to 6). */
  swatches: string[]
  /** True when the picture is mostly light (the look gets a light page). */
  light: boolean
  /** Accents set aside because they are framework defaults. */
  skippedDefaults: string[]
}

// ── colour conversions ──────────────────────────────────────────────────────

export function hexToRgb(hex: string): Rgb {
  const n = normHex(hex, '#000000').slice(1)
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}
export function rgbToHex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')
}

export function rgbToLab([r, g, b]: Rgb): Lab {
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  const R = lin(r), G = lin(g), B = lin(b)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x), fy = f(y), fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function labToRgb([L, a, b]: Lab): Rgb {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787)
  const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883
  const R = x * 3.2406 + y * -1.5372 + z * -0.4986
  const G = x * -0.9689 + y * 1.8758 + z * 0.0415
  const B = x * 0.0557 + y * -0.204 + z * 1.057
  const gam = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055)
  return [gam(R), gam(G), gam(B)].map((c) => Math.max(0, Math.min(255, c))) as Rgb
}

export const deltaE = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
export const chroma = (l: Lab) => Math.hypot(l[1], l[2])
const hueOf = (l: Lab) => Math.atan2(l[2], l[1])

/** A colour with the same hue, set to lightness L and at most chroma C. */
export function toneOf(lab: Lab, L: number, maxC: number): string {
  const c = Math.min(chroma(lab), maxC), h = hueOf(lab)
  return rgbToHex(labToRgb([L, c * Math.cos(h), c * Math.sin(h)]))
}

// ── framework defaults ──────────────────────────────────────────────────────
// Colours a page gets from a CSS framework without anyone choosing them.
export const FRAMEWORK_DEFAULTS = [
  // Bootstrap 5 + 4
  '#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754', '#20c997', '#0dcaf0',
  '#007bff', '#28a745', '#17a2b8', '#343a40', '#6c757d',
  // Tailwind 500/600s most often left as-is
  '#3b82f6', '#2563eb', '#6366f1', '#4f46e5', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#ec4899',
  // Material
  '#2196f3', '#1976d2', '#3f51b5', '#f44336', '#4caf50', '#ff9800', '#9c27b0', '#e91e63',
]
const DEFAULT_LABS = FRAMEWORK_DEFAULTS.map((h) => rgbToLab(hexToRgb(h)))
export const isFrameworkDefault = (lab: Lab) => DEFAULT_LABS.some((d) => deltaE(d, lab) < 6)

// ── clustering ──────────────────────────────────────────────────────────────

/** A small seeded random number source, so the same picture always gives the same colours. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/**
 * k-means in Lab over RGB pixels (a flat array, 3 bytes each). k-means++
 * start from a fixed seed: the same picture always clusters the same way.
 * Near-duplicate clusters (ΔE < 10) are merged. Weights add up to 1.
 */
export function clusterPixels(rgb: ArrayLike<number>, k = 8, iterations = 12): Cluster[] {
  const n = Math.floor(rgb.length / 3)
  if (n === 0) return []
  const labs: Lab[] = new Array(n)
  for (let i = 0; i < n; i++) labs[i] = rgbToLab([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]])
  const rnd = seeded(42)
  const centers: Lab[] = [labs[Math.floor(rnd() * n)]]
  const d2 = new Float64Array(n)
  while (centers.length < Math.min(k, n)) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      let best = Infinity
      for (const c of centers) best = Math.min(best, (labs[i][0] - c[0]) ** 2 + (labs[i][1] - c[1]) ** 2 + (labs[i][2] - c[2]) ** 2)
      d2[i] = best; sum += best
    }
    if (sum === 0) break
    let r = rnd() * sum, pick = n - 1
    for (let i = 0; i < n; i++) { r -= d2[i]; if (r <= 0) { pick = i; break } }
    centers.push(labs[pick])
  }
  const assign = new Int32Array(n)
  for (let it = 0; it < iterations; it++) {
    const acc = centers.map(() => [0, 0, 0, 0])
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity
      for (let c = 0; c < centers.length; c++) {
        const d = (labs[i][0] - centers[c][0]) ** 2 + (labs[i][1] - centers[c][1]) ** 2 + (labs[i][2] - centers[c][2]) ** 2
        if (d < bd) { bd = d; best = c }
      }
      assign[i] = best
      const a = acc[best]; a[0] += labs[i][0]; a[1] += labs[i][1]; a[2] += labs[i][2]; a[3]++
    }
    for (let c = 0; c < centers.length; c++) if (acc[c][3]) centers[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]]
  }
  const counts = centers.map(() => 0)
  for (let i = 0; i < n; i++) counts[assign[i]]++
  let clusters: Cluster[] = centers.map((lab, c) => ({ lab, rgb: labToRgb(lab), weight: counts[c] / n })).filter((c) => c.weight > 0)
  // merge near-duplicates
  clusters.sort((a, b) => b.weight - a.weight)
  const merged: Cluster[] = []
  for (const c of clusters) {
    const twin = merged.find((m) => deltaE(m.lab, c.lab) < 10)
    if (twin) {
      const w = twin.weight + c.weight
      twin.lab = [0, 1, 2].map((j) => (twin.lab[j] * twin.weight + c.lab[j] * c.weight) / w) as Lab
      twin.rgb = labToRgb(twin.lab); twin.weight = w
    } else merged.push({ ...c })
  }
  clusters = merged.sort((a, b) => b.weight - a.weight)
  return clusters
}

// ── picking the look's colours ──────────────────────────────────────────────

/** Near-grey: never an accent. */
const NEUTRAL_CHROMA = 14

function textFor(bgLab: Lab, light: boolean): string {
  return light ? toneOf(bgLab, 13, 8) : toneOf(bgLab, 95, 4)
}

function setFor(base: { bgLab: Lab; light: boolean; ink?: string | null }, accent: string): PaletteColors {
  const { bgLab, light } = base
  const bg = light ? toneOf(bgLab, Math.max(91, Math.min(97, bgLab[0])), 8) : toneOf(bgLab, Math.max(6, Math.min(16, bgLab[0])), 12)
  const glow = light ? toneOf(bgLab, Math.max(84, Math.min(90, bgLab[0] - 7)), 14) : toneOf(bgLab, Math.max(18, Math.min(26, bgLab[0] + 12)), 20)
  // Words: the picture's own dark ink (a navy, a deep green…) when it reads well, else a calm near-black/white.
  let text = base.ink && contrast(base.ink, bg) >= 7 ? base.ink : textFor(bgLab, light)
  if (contrast(text, bg) < 7) text = light ? '#14161c' : '#f6f3ee'
  return { bg, glow, accent, text }
}

/**
 * The look's colours from the clusters a picture was measured into.
 * `seen` = all clusters (biggest first).
 */
export function pickPalette(seen: Cluster[]): MeasuredPalette {
  const clusters = seen.filter((c) => c.weight > 0).sort((a, b) => b.weight - a.weight)
  if (!clusters.length) throw new Error('no colours')
  const avgL = clusters.reduce((s, c) => s + c.lab[0] * c.weight, 0) / clusters.reduce((s, c) => s + c.weight, 0)
  const light = avgL >= 58

  // The page: the biggest cluster on the right side of light/dark, calmed.
  const sided = clusters.filter((c) => (light ? c.lab[0] >= 60 : c.lab[0] < 55) && c.weight >= 0.03)
  const pageSrc = (sided[0] ?? clusters[0]).lab
  const bgLab: Lab = [pageSrc[0], pageSrc[1], pageSrc[2]]

  // Accent candidates: real colour, not tiny, and not the page itself.
  const colourful = clusters.filter((c) => chroma(c.lab) >= NEUTRAL_CHROMA + 8 && c.weight >= 0.012 && c.lab[0] > 18 && c.lab[0] < 92)
  const nonDefault = colourful.filter((c) => !isFrameworkDefault(c.lab))
  const skipped = colourful.filter((c) => isFrameworkDefault(c.lab)).map((c) => rgbToHex(c.rgb))
  const pool = nonDefault.length ? nonDefault : colourful
  const score = (c: Cluster) => Math.sqrt(c.weight) * (chroma(c.lab) / 100) * (1 - Math.abs(c.lab[0] - 55) / 90)
  const ranked = [...pool].sort((a, b) => score(b) - score(a))
  // Dedupe accents by hue (two blues are one choice).
  const accents: Cluster[] = []
  for (const c of ranked) if (!accents.some((a) => deltaE(a.lab, c.lab) < 22)) accents.push(c)

  const fallbackAccent = light ? toneOf(bgLab, 38, 40) : toneOf(bgLab, 72, 40)
  const accentHexes = accents.length ? accents.map((a) => rgbToHex(a.rgb)) : [fallbackAccent]
  // The picture's ink: a real, sizeable colour on the far side of light/dark (navy text on a cream page).
  const inkSrc = clusters.find((c) => c.weight >= 0.03 && chroma(c.lab) >= 8 && (light ? c.lab[0] <= 30 : c.lab[0] >= 88))
  const base = { bgLab, light, ink: inkSrc ? rgbToHex(inkSrc.rgb) : null }
  const main = setFor(base, accentHexes[0])

  // "Try other colours from it": the other real accents, then the same colours on the opposite page.
  const alternatives: PaletteColors[] = accentHexes.slice(1, 4).map((a) => setFor(base, a))
  const flipped = setFor({ bgLab: [light ? 12 : 95, bgLab[1], bgLab[2]], light: !light }, accentHexes[0])
  alternatives.push(flipped)

  return {
    ...main,
    alternatives,
    swatches: clusters.slice(0, 6).map((c) => rgbToHex(c.rgb)),
    light,
    skippedDefaults: nonDefault.length ? skipped : [],
  }
}
