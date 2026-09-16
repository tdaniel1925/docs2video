/**
 * RESERVED LOGO SPACE — the corner is told, not hoped for.
 *
 * Ported from Restylez (lib/logo-space.ts), where it has been drawing deck
 * slides with real logos for months. The problem it solves is the one the
 * explainer slides had: `generateSlide()` in app/_lib/gemini.ts accepts a
 * `logoBuffer` and never uses it, so the logo was either absent or invented
 * by the image model — and an invented logo is the one thing this product
 * must never ship.
 *
 * A real logo is NEVER drawn by the image model. Two halves make that work:
 *
 *   1. Going in, the prompt names a SPECIFIC corner area, in percentages of
 *      the canvas, and says it must be left clear of text and important
 *      detail.
 *   2. Coming out, the real file is composited into exactly that area with
 *      sharp — pixel-faithful, the same rectangle every time.
 *
 * Both halves read the numbers from HERE, so the space the model was told to
 * leave and the space the logo lands in are the same rectangle. Because it is
 * expressed in PERCENTAGES, a 1920x1088 slide and a 2752x1536 one get the
 * logo in the same relative spot.
 *
 * WHY THE WORDING MATTERS, measured. An earlier attempt said only "leave the
 * bottom-right corner clear" and the model DREW A WHITE RECTANGLE there — it
 * read "clear" as an object. Naming what must not enter the box ("no text, no
 * numbers, no important detail") and forbidding a drawn logo outright gives a
 * genuinely empty corner: 0.6 pixel variation against 32.9 unconstrained.
 */

/** Bottom-right, as fractions of the canvas. Change here, changes everywhere. */
export const LOGO_SPACE = {
  /** Width of the reserved box, as a fraction of the canvas width. */
  w: 0.22,
  /** Height of the reserved box, as a fraction of the canvas height. */
  h: 0.16,
  /** Clear margin from the right and bottom edges, as a fraction of the width. */
  margin: 0.04,
} as const

/**
 * The sentence the image prompt gets. Say it once, say it the same way.
 *
 * Only added when there IS a logo to place — a slide with no logo should use
 * its whole frame rather than holding a corner open for nothing.
 */
export const logoSpacePrompt = (): string =>
  `RESERVED LOGO SPACE — the customer's REAL logo is placed by us after this image is made. Leave the BOTTOM-RIGHT corner free of text and important detail: a box about ${Math.round(LOGO_SPACE.w * 100)}% of the width and ${Math.round(LOGO_SPACE.h * 100)}% of the height, sitting ${Math.round(LOGO_SPACE.margin * 100)}% in from the right and bottom edges. No text, no numbers, no faces and no important detail may enter that box — plain background only. Do NOT draw a logo, brand mark, monogram, badge, emblem or empty placeholder box there or anywhere else; that space is being held for a real file.`

/** The pixel rectangle for a given canvas — what sharp composites into. */
export function logoRect(width: number, height: number) {
  const margin = Math.round(width * LOGO_SPACE.margin)
  const boxW = Math.round(width * LOGO_SPACE.w)
  const boxH = Math.round(height * LOGO_SPACE.h)
  return { boxW, boxH, margin, right: width - margin, bottom: height - margin }
}

/**
 * PIN THE REAL LOGO — into the corner the prompt was told to keep clear.
 *
 * The uploaded file is composited by code and never redrawn: pixel-faithful,
 * every time. Bottom-right aligned inside the reserved box, so a wide logo
 * and a tall one both sit against the same corner.
 *
 * Returns the slide UNCHANGED if anything goes wrong. A slide without a logo
 * is a small disappointment; a crashed render is a lost job, and this runs at
 * the end of work the customer has already paid for.
 */
export async function pinLogo(slidePng: Buffer, logo: Buffer | null | undefined): Promise<Buffer> {
  if (!logo?.length) return slidePng
  try {
    const sharpMod = await import('sharp')
    const sharp = sharpMod.default ?? sharpMod
    const base = sharp(slidePng)
    const { width = 1920, height = 1088 } = await base.metadata()
    const { boxW, boxH, right, bottom } = logoRect(width, height)
    const fitted = await sharp(logo)
      .resize(boxW, boxH, { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer()
    const lm = await sharp(fitted).metadata()
    return await base
      .composite([{ input: fitted, left: right - (lm.width ?? boxW), top: bottom - (lm.height ?? boxH) }])
      .png()
      .toBuffer()
  } catch (e) {
    console.warn('[logo-space] could not pin the logo:', e instanceof Error ? e.message : e)
    return slidePng
  }
}
