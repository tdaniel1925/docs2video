/**
 * Logo processing for video rendering. Takes an uploaded logo and produces two
 * transparent variants: LIGHT (near-white, reads on dark themes) and DARK (navy,
 * reads on light themes). Real logos only — this never generates a logo.
 *
 * Strategy:
 *  1. If the upload already has an alpha channel (transparent PNG/SVG) → trust it;
 *     recolor opaque pixels to make the light/dark variants.
 *  2. Else knock out a near-white OR near-black flat background by threshold.
 *  3. Assess quality: how much of the image survived as opaque content. If the
 *     result is poor (busy/photo/gradient bg) → flag needsEnhance so the caller
 *     can route to rembg, and/or fall back to rendering on a frosted chip.
 *
 * Recoloring uses the alpha mask as a monochrome stencil — correct for typical
 * single-color marks/wordmarks. Multi-color logos are detected (high color
 * variance) and returned as-is with chip=true rather than being flattened.
 */
import sharp from 'sharp'

export type LogoVariants = {
  /** Transparent PNG, content recolored near-white. */
  light: Buffer
  /** Transparent PNG, content recolored navy/dark. */
  dark: Buffer
  /** Original, trimmed + normalized to PNG (used when chip=true). */
  original: Buffer
  /** True when the logo is multi-color → render on a frosted chip, don't recolor. */
  chip: boolean
  /** True when knockout was poor → caller should try rembg before accepting. */
  needsEnhance: boolean
  /** 0–1: fraction of pixels that are opaque content after processing. */
  contentRatio: number
}

const LIGHT = { r: 245, g: 248, b: 255 }
const DARK = { r: 14, g: 26, b: 43 }     // #0E1A2B (matches EXECUTIVE_LIGHT ink)

/** Knock out a flat near-white or near-black background to transparent. */
async function knockout(input: sharp.Sharp): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  // Sample the four corners to guess the background color.
  const corners = [0, (width - 1) * channels, (height - 1) * width * channels, ((height - 1) * width + (width - 1)) * channels]
  let br = 0, bg = 0, bb = 0
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2] }
  br /= 4; bg /= 4; bb /= 4
  const TOL = 38
  for (let i = 0; i < data.length; i += channels) {
    const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb
    if (Math.sqrt(dr * dr + dg * dg + db * db) < TOL) data[i + 3] = 0  // background → transparent
  }
  return { data: Buffer.from(data), info }
}

/** Recolor all opaque pixels to a flat color, preserving the alpha stencil. */
async function recolor(raw: Buffer, info: sharp.OutputInfo, color: { r: number; g: number; b: number }): Promise<Buffer> {
  const { width, height, channels } = info
  const out = Buffer.from(raw)
  for (let i = 0; i < out.length; i += channels) {
    if (out[i + 3] > 8) { out[i] = color.r; out[i + 1] = color.g; out[i + 2] = color.b }
  }
  return sharp(out, { raw: { width, height, channels } }).png().toBuffer()
}

/** Heuristic: does the (opaque) content span many distinct hues? → multi-color. */
function isMultiColor(raw: Buffer, info: sharp.OutputInfo): boolean {
  const { channels } = info
  const buckets = new Set<number>()
  let opaque = 0
  for (let i = 0; i < raw.length; i += channels) {
    if (raw[i + 3] < 32) continue
    opaque++
    // quantize to 3 bits/channel
    buckets.add(((raw[i] >> 5) << 6) | ((raw[i + 1] >> 5) << 3) | (raw[i + 2] >> 5))
  }
  if (opaque === 0) return false
  return buckets.size > 12   // many color buckets among opaque pixels
}

function contentRatioOf(raw: Buffer, info: sharp.OutputInfo): number {
  const { channels } = info
  let opaque = 0, total = 0
  for (let i = 0; i < raw.length; i += channels) { total++; if (raw[i + 3] > 32) opaque++ }
  return total ? opaque / total : 0
}

export async function processLogo(buffer: Buffer): Promise<LogoVariants> {
  const base = sharp(buffer).trim({ threshold: 10 }).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
  const meta = await sharp(buffer).metadata()
  const hadAlpha = !!meta.hasAlpha

  // Get RGBA raw. If the source had no alpha, knock out a flat background first.
  let raw: Buffer, info: sharp.OutputInfo
  if (hadAlpha) {
    const r = await base.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    raw = r.data; info = r.info
  } else {
    const r = await knockout(base)
    raw = r.data; info = r.info
  }

  const contentRatio = contentRatioOf(raw, info)
  const multi = isMultiColor(raw, info)

  // Poor knockout: source had no alpha AND almost everything survived (didn't cut
  // a background) or almost nothing survived → needs rembg.
  const needsEnhance = !hadAlpha && (contentRatio > 0.92 || contentRatio < 0.02)

  const originalPng = await sharp(raw, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer()

  if (multi) {
    // Keep true colors; both "variants" are the original — it'll render on a chip.
    return { light: originalPng, dark: originalPng, original: originalPng, chip: true, needsEnhance, contentRatio }
  }

  const [light, dark] = await Promise.all([
    recolor(raw, info, LIGHT),
    recolor(raw, info, DARK),
  ])
  return { light, dark, original: originalPng, chip: false, needsEnhance, contentRatio }
}
