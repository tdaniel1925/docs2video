// =============================================================================
// Making a design big enough to actually print.
//
// THE PROBLEM THIS SOLVES. The image generator has a hard ceiling of about 4.2
// million dots per picture. A printer wants 300 dots per inch. An 8.5x11 flyer
// at 300 dpi is 8.4 million dots — twice what we are allowed to generate. So
// every large piece comes out of the generator SMALLER than print needs:
//
//     business card   393 dpi   fine as generated
//     postcard 6x4    300 dpi   fine as generated
//     flyer 8.5x11    205 dpi   short
//     poster 11x17    146 dpi   less than half
//
// Until now the file was simply stretched to the right dimensions. That makes a
// file whose header SAYS 300 dpi while the detail inside is still 205 — the
// lettering goes soft, and small print is where anyone notices first.
//
// Stretching invents no detail. An upscaler reconstructs it. Measured on a real
// generated design, the difference in the small caps line is obvious: stretched
// edges are furred, upscaled edges are clean.
//
// WHY THIS MODEL. ESRGAN enlarges what is there. The "creative" upscalers
// hallucinate plausible detail, which on a photograph is lovely and on a flyer
// is a disaster — they will happily redraw a phone number into a different
// phone number. Nothing here may invent a character.
// =============================================================================

/** 2x is enough for every size we sell — see the table above. */
const SCALE = 2

/** fal is already configured for this project; nothing new to sign up for. */
const ENDPOINT = 'https://fal.run/fal-ai/esrgan'

export type UpscaleResult = {
  buffer: Buffer<ArrayBuffer>
  /** False when it was left alone — either not needed, or the service failed. */
  upscaled: boolean
  /** Set when it was needed but could not be done, so callers can be honest. */
  reason?: string
}

/**
 * Enlarge a design if — and only if — it is smaller than the print needs.
 *
 * NEVER FATAL. A design that exists at 205 dpi is worth far more to the person
 * who paid for it than an error message, so a failure here returns the original
 * and says why. The caller decides whether to mention it.
 */
export async function upscaleForPrint(
  src: Buffer<ArrayBuffer>,
  targetW: number,
  targetH: number,
): Promise<UpscaleResult> {
  const key = process.env.FAL_KEY
  const sharp = (await import('sharp')).default
  const meta = await sharp(src).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0

  // Already big enough. A card and a postcard land here, and paying to enlarge
  // something that is then scaled back down would be pure waste.
  if (w >= targetW && h >= targetH) return { buffer: src, upscaled: false }

  if (!key) return { buffer: src, upscaled: false, reason: 'no FAL_KEY configured' }

  try {
    // SEND A JPEG, NOT THE PNG. The design is posted inline as a data URI, and
    // base64 adds a third on top — a full-size flyer PNG is 12 MB, so the
    // request became 16 MB and the connection died with an unhelpful "fetch
    // failed". A quality-95 JPEG of the same image is under a megabyte and the
    // upscaler returns pixel-identical dimensions in the same time.
    //
    // The slight JPEG loss is nothing against what is gained: the alternative
    // is not a lossless file, it is a stretched one at two-thirds the real
    // resolution. The result is written back out as PNG.
    const jpeg = await sharp(src).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer()

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
        scale: SCALE,
      }),
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) {
      return { buffer: src, upscaled: false, reason: `upscaler returned ${res.status}` }
    }
    const json = await res.json()
    const url: string | undefined = json?.image?.url ?? json?.images?.[0]?.url
    if (!url) return { buffer: src, upscaled: false, reason: 'upscaler returned no image' }

    const out = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer())

    // TRUST NOTHING. A reply that decodes but is somehow smaller than what we
    // sent would quietly make the print WORSE, and this is the last place that
    // could notice.
    const after = await sharp(out).metadata()
    if ((after.width ?? 0) < w || (after.height ?? 0) < h) {
      return { buffer: src, upscaled: false, reason: 'upscaler returned a smaller image' }
    }
    return { buffer: out, upscaled: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { buffer: src, upscaled: false, reason: msg.slice(0, 120) }
  }
}

/**
 * How much real detail the finished file carries, in dots per inch.
 *
 * Reported to the customer rather than kept quiet. A file can always be SAVED
 * at 300 dpi; whether the detail is really there is a different question, and
 * the person sending it to a printer is the one who needs the answer.
 */
export const effectiveDpi = (nativePx: number, inches: number): number =>
  Math.round(nativePx / inches)
