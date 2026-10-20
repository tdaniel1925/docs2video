/**
 * FAL IMAGE — every picture the website side asks for (2026-10-19).
 *
 * The OpenAI account ran out of credits, so covers, logo styling, flyers,
 * social images and demo slides now draw with the SAME model family on fal:
 * OpenAI gpt-image-2.5 (flare), billed by fal. Text-to-image when there is no
 * picture to work from; the `edit` endpoint when there is (a logo to restyle,
 * a customer's photo, a reference design).
 *
 * Plain fetch to fal's synchronous endpoint (fal.run) — no client package.
 * fal can answer 200 with no usable result, so a call only counts when the
 * JSON carries an image URL AND that URL downloads to a real picture.
 *
 * COST: ~1.77c per megapixel at high quality; low ×0.078, medium ×0.174
 * (render-service/fal-image.js falImageCost — invoice-checked).
 */
export const FAL_IMAGE_MODEL = process.env.FAL_IMAGE_MODEL || 'openai/gpt-image-2.5/flare'
const FAL_BASE = 'https://fal.run'

export type FalImageQuality = 'low' | 'medium' | 'high'

const PER_MP_HIGH = 1.77
const QUALITY_SCALE: Record<FalImageQuality, number> = { low: 0.078, medium: 0.174, high: 1 }

/** Estimated cents for one picture at this size and quality. */
export function falImageCostCents(width: number, height: number, quality: FalImageQuality = 'high'): number {
  return PER_MP_HIGH * ((width * height) / 1e6) * (QUALITY_SCALE[quality] ?? 1)
}

/** "1536x1024" (OpenAI's size strings, kept by callers) → { width, height }. */
export function falSizeFrom(size: string | undefined, fallback = { width: 1024, height: 1024 }): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(String(size || ''))
  return m ? { width: Number(m[1]), height: Number(m[2]) } : fallback
}

/** True when the bytes are a PNG, JPEG or WebP picture. */
export function isRealImage(buf: Buffer | null | undefined): boolean {
  if (!buf || buf.length < 256) return false
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return true
  if (buf[0] === 0xff && buf[1] === 0xd8) return true
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true
  return false
}

function mimeOf(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf.toString('ascii', 0, 4) === 'RIFF') return 'image/webp'
  return 'image/png'
}

class FalImageError extends Error {
  constructor(message: string, public status?: number) { super(message) }
}

export type FalImageOptions = {
  width?: number
  height?: number
  quality?: FalImageQuality
  /** Pictures to work from — sends the request to the edit endpoint. */
  images?: Buffer[]
  /** With images: a PNG whose TRANSPARENT pixels mark where it may repaint. */
  mask?: Buffer
  /** 'transparent' for a cut-out (a logo); the model's own choice otherwise. */
  background?: 'auto' | 'transparent' | 'opaque'
  outputFormat?: 'png' | 'jpeg' | 'webp'
  attempts?: number
  timeoutMs?: number
  backoffMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Draw one picture with gpt-image-2.5 on fal. Retries 429/5xx/network errors;
 * a 4xx (bad key, a prompt refused) fails at once. Throws on any doubt.
 */
export async function falImage(prompt: string, opts: FalImageOptions = {}): Promise<Buffer> {
  const key = process.env.FAL_KEY
  if (!key) throw new Error('FAL_KEY is not set')
  const doFetch = opts.fetchImpl || fetch
  const attempts = Math.max(1, opts.attempts ?? 2)
  const backoff = opts.backoffMs ?? 2000
  const timeoutMs = opts.timeoutMs ?? 180_000
  const refs = (opts.images || []).filter((b) => b?.length)
  const body = {
    prompt,
    image_size: { width: opts.width ?? 1024, height: opts.height ?? 1024 },
    quality: opts.quality ?? 'high',
    num_images: 1,
    ...(refs.length ? { image_urls: refs.map((b) => `data:${mimeOf(b)};base64,${b.toString('base64')}`) } : {}),
    ...(refs.length && opts.mask?.length ? { mask_url: `data:image/png;base64,${opts.mask.toString('base64')}` } : {}),
    ...(opts.background ? { background: opts.background } : {}),
    ...(opts.outputFormat ? { output_format: opts.outputFormat } : {}),
  }
  const url = `${FAL_BASE}/${FAL_IMAGE_MODEL}/${refs.length ? 'edit' : 'text-to-image'}`
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { authorization: `Key ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
      const json = (await res.json().catch(() => ({}))) as { images?: { url?: string }[]; detail?: unknown; error?: unknown }
      if (!res.ok) {
        const why = json?.detail ?? json?.error ?? ''
        throw new FalImageError(`fal image ${res.status}: ${(typeof why === 'string' ? why : JSON.stringify(why)).slice(0, 200)}`, res.status)
      }
      const imgUrl = json?.images?.[0]?.url
      if (!imgUrl) throw new FalImageError('fal image: answered OK but no image URL')
      const dl = await doFetch(imgUrl, { signal: AbortSignal.timeout(60_000) })
      if (!dl.ok) throw new FalImageError(`fal image download ${dl.status}`)
      const buf = Buffer.from(await dl.arrayBuffer())
      if (!isRealImage(buf)) throw new FalImageError(`fal image: result is not a picture (${buf.length} bytes)`)
      return buf
    } catch (err) {
      lastErr = err
      const st = (err as FalImageError)?.status
      const retry = st === undefined || st === 429 || st >= 500
      if (attempt < attempts && retry) {
        await new Promise((r) => setTimeout(r, backoff * attempt))
        continue
      }
      break
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fal image failed')
}

/** The same picture as PNG bytes (callers that store or composite PNG). */
export async function falImagePng(prompt: string, opts: FalImageOptions = {}): Promise<Buffer> {
  const buf = await falImage(prompt, opts)
  if (buf[0] === 0x89) return buf
  const sharp = (await import('sharp')).default
  return sharp(buf).png().toBuffer()
}
