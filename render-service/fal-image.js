// =============================================================================
// FAL IMAGE — draws one "Drawn slides" picture with OpenAI gpt-image-2.5 on
// fal.ai (the same model + endpoint Restylez and app/_lib/slide-engine.ts use).
//
// Used by server.js POST /generate when the request says imageEngine:'fal'
// (the "Drawn slides" look). server.js falls back to Gemini 3 Pro Image for a
// slide whenever this throws, so a fal outage costs looks, not videos.
//
// Plain fetch to fal's synchronous endpoint (fal.run) — no client package.
// fal can answer 200 and still have no picture (its queue even reports
// COMPLETED on validation failures), so a result only counts when it carries
// an image URL AND that URL downloads to a real PNG/JPEG of the right shape.
//
// COST (measured 2026-10-09, scripts/look-samples/make-drawn-samples.ts):
// fal bills gpt-image-2.5 by megapixel × quality. See CREDIT_COSTS.drawnSlides
// in app/_lib/credits.ts for the numbers and the quality picked.
// =============================================================================

const FAL_BASE = 'https://fal.run'
const MODEL = 'openai/gpt-image-2.5/flare'

/** 16:9 at sizes fal accepts (multiples of 16). Resized to 1920x1080 after. */
const DRAWN_W = 1920
const DRAWN_H = 1088

/** Quality used for drawn slides — picked by measurement: 'low' spelled every
 *  word and number right on all 6 test slides (3 styles), 0.29c each. */
const DRAWN_QUALITY = process.env.DRAWN_SLIDE_QUALITY || 'low'

/** cents per megapixel at high quality; low/medium scale down (Restylez lib/fal.ts, invoice-checked). */
const PER_MP_HIGH = 1.77
const QUALITY_SCALE = { low: 0.078, medium: 0.174, high: 1 }

/** Estimated cents for one picture at this size + quality (text-to-image). */
function falImageCost(w, h, quality) {
  return PER_MP_HIGH * ((w * h) / 1e6) * (QUALITY_SCALE[quality] ?? 1)
}

const falKey = () => process.env.FAL_KEY || ''

let warnedNoKey = false
function noteMissingKey() {
  if (warnedNoKey) return
  warnedNoKey = true
  console.warn('[fal-image] FAL_KEY is not set — Drawn slides will be drawn by Gemini instead. Add FAL_KEY to the ECS task (SSM /docs2video/FAL_KEY).')
}

/**
 * Draw one slide. Returns a PNG/JPEG Buffer. Throws on ANY doubt (no key,
 * HTTP error, no image, image that will not decode) so the caller falls back.
 *
 * @param {string} prompt
 * @param {{ quality?: string, refImage?: Buffer|null, signal?: AbortSignal, timeoutMs?: number }} [opts]
 *   refImage: an earlier slide of the SAME video, sent as a style reference
 *   (fal "edit" endpoint) so the set looks like one deck.
 */
async function drawWithFal(prompt, opts = {}) {
  const key = falKey()
  if (!key) { noteMissingKey(); throw new Error('FAL_KEY is not set') }
  const quality = opts.quality || DRAWN_QUALITY
  const ref = opts.refImage && opts.refImage.length ? opts.refImage : null
  const signal = opts.signal || AbortSignal.timeout(opts.timeoutMs || 150000)
  const body = {
    prompt: ref
      ? `${prompt}\n\nThe attached image is an EARLIER SLIDE FROM THE SAME DECK. Match its visual style, colours, lighting and type treatment exactly so the two look like one set — but take every word ONLY from the text listed above, never from the attached image.`
      : prompt,
    image_size: { width: DRAWN_W, height: DRAWN_H },
    quality,
    num_images: 1,
    ...(ref ? { image_urls: [`data:image/png;base64,${ref.toString('base64')}`] } : {}),
  }
  const res = await fetch(`${FAL_BASE}/${MODEL}/${ref ? 'edit' : 'text-to-image'}`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Key ${key}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const why = json.detail ?? json.error ?? ''
    throw new Error(`fal ${res.status}: ${String(typeof why === 'string' ? why : JSON.stringify(why)).slice(0, 200)}`)
  }
  const url = json && Array.isArray(json.images) && json.images[0] && json.images[0].url
  if (!url) throw new Error('fal answered without an image')
  const imgRes = await fetch(url, { signal })
  if (!imgRes.ok) throw new Error(`fal image download ${imgRes.status}`)
  const buf = Buffer.from(await imgRes.arrayBuffer())
  // Must really be a picture of about the right shape (fal can clamp sizes).
  const sharp = require('sharp')
  const meta = await sharp(buf).metadata()
  if (!meta.width || !meta.height) throw new Error('fal image did not decode')
  const aspect = meta.width / meta.height
  if (Math.abs(aspect / (16 / 9) - 1) > 0.05) throw new Error(`fal image wrong shape ${meta.width}x${meta.height}`)
  return buf
}

/**
 * The closing slide's contact line, added as REAL text (never drawn by the
 * model, which invents and misspells phone numbers). A dark, rounded strip
 * near the bottom of a 1920x1080 slide; the line is shrunk to fit its width.
 */
async function addContactStrip(slidePng, line) {
  const sharp = require('sharp')
  const text = String(line || '').trim()
  if (!text) return slidePng
  const W = 1920, H = 1080
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // ~0.55em per character in a sans-serif; keep the strip inside 80% of the width.
  const maxW = W * 0.8
  const size = Math.max(22, Math.min(36, Math.floor(maxW / (text.length * 0.55))))
  const stripW = Math.min(maxW + 64, Math.ceil(text.length * size * 0.55) + 96)
  const stripH = size + 40
  const x = Math.round((W - stripW) / 2)
  const y = H - stripH - 56
  const svg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="${x}" y="${y}" width="${stripW}" height="${stripH}" rx="10" fill="rgba(15,23,42,0.82)"/>` +
    `<text x="${W / 2}" y="${y + stripH / 2 + size * 0.35}" text-anchor="middle" font-size="${size}" font-weight="700" font-family="Liberation Sans, Arial, sans-serif" fill="#FFFFFF">${esc(text)}</text>` +
    `</svg>`,
  )
  const base = await sharp(slidePng).resize(W, H, { fit: 'cover' }).png().toBuffer()
  return sharp(base).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer()
}

module.exports = { drawWithFal, addContactStrip, falImageCost, DRAWN_W, DRAWN_H, DRAWN_QUALITY, MODEL }
