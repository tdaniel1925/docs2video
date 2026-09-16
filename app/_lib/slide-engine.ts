/**
 * WHICH ENGINE DRAWS AN EXPLAINER SLIDE — and the logo that goes on it.
 *
 * MEASURED, not argued. The same hard slide (proper nouns, "$4,280 to $4,715",
 * "10.2%", a semicolon, a date) drawn on both engines with the same prompt:
 *
 *                        fal gpt-image-2.5      Gemini 3 Pro Image
 *   every character right       yes                    yes
 *   reserved corner empty    0.6 variation          0.9 variation
 *   time                       ~19 s                  ~21 s
 *   size returned           1920x1088              2752x1536
 *   cost per slide             3.7c                  ~4-6c
 *
 * THE ARGUMENT I EXPECTED TO MAKE AND COULD NOT. This repo's own notes say
 * cheap models "treat text as decoration" — measured on FLYERS, where the
 * copy is dense marketing prose. On a slide, which is a heading and five
 * short lines, Gemini got every character right. The text case does not
 * decide this.
 *
 * WHY FAL IS THE DEFAULT ANYWAY: layout. Given identical instructions fal
 * returned numbered badges and a clearer hierarchy where Gemini returned a
 * plain list. It is also marginally cheaper and returns exactly the frame
 * asked for rather than one that must be resampled.
 *
 * NOTHING IS DELETED. Gemini stays one env var away —
 * SLIDE_IMAGE_ENGINE=gemini — because "their model will improve" is a real
 * possibility and this is a decision with an expiry date, not a closed door.
 */
import { logoSpacePrompt, pinLogo } from './logo-space'

export type SlideEngine = 'fal' | 'gemini'

/** 16:9 at a size both engines accept; fal wants multiples of 16. */
const SLIDE_W = 1920
const SLIDE_H = 1088

export const slideEngine = (): SlideEngine =>
  (process.env.SLIDE_IMAGE_ENGINE === 'gemini' ? 'gemini' : 'fal')

const falKey = () => process.env.FAL_KEY ?? ''

/**
 * A MISSING KEY MUST NOT BE SILENT.
 *
 * Restylez lost days to exactly this: FAL_KEY was absent in production, the
 * code fell through to its second choice as designed, and NOTHING WAS LOGGED
 * — so every image quietly came from the worse provider and the first
 * evidence was a customer complaint. Warned once per process, because this
 * is called per slide and a warning each time buries itself.
 */
let warnedNoKey = false
function noteMissingKey(): void {
  if (warnedNoKey) return
  warnedNoKey = true
  console.warn('[slide-engine] FAL_KEY is not set — slides will be drawn by Gemini instead. Set it in the environment (and in the ECS task definition for the renderer).')
}

async function drawOnFal(prompt: string): Promise<Buffer> {
  const res = await fetch('https://fal.run/openai/gpt-image-2.5/flare/text-to-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Key ${falKey()}` },
    body: JSON.stringify({
      prompt,
      image_size: { width: SLIDE_W, height: SLIDE_H },
      quality: 'high',
      num_images: 1,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`fal ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
  const url = (json as { images?: { url?: string }[] }).images?.[0]?.url
  if (!url) throw new Error('fal returned no image')
  return Buffer.from(await (await fetch(url)).arrayBuffer())
}

async function drawOnGemini(prompt: string): Promise<Buffer> {
  const model = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        /* WITHOUT imageConfig Gemini returns 1376x768 — BELOW 1080p, so a
           1920 video frame upscales it and the type goes soft. Asked for a
           size it returns 2752x1536. */
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '16:9', imageSize: '2K' },
        },
      }),
    },
  )
  const txt = await res.text()
  if (!res.ok) throw new Error(`gemini ${res.status}: ${txt.slice(0, 200)}`)
  const part = (JSON.parse(txt).candidates?.[0]?.content?.parts ?? [])
    .find((p: { inlineData?: { data?: string } }) => p.inlineData?.data)
  if (!part) throw new Error('gemini returned no image')
  return Buffer.from(part.inlineData.data, 'base64')
}

/**
 * Draw one slide and pin the real logo into the corner held open for it.
 *
 * The reserved-space sentence is added ONLY when there is a logo — a slide
 * with none should use its whole frame rather than hold a corner open for
 * nothing.
 *
 * A worse picture beats no picture on work already paid for, so a failure on
 * the chosen engine falls through to the other one.
 */
export async function drawSlide(prompt: string, logo?: Buffer | null): Promise<Buffer> {
  const full = logo?.length ? `${prompt}\n\n${logoSpacePrompt()}` : prompt
  const wanted = slideEngine()
  if (wanted === 'fal' && !falKey()) noteMissingKey()

  const order: SlideEngine[] = wanted === 'fal' && falKey() ? ['fal', 'gemini'] : ['gemini', 'fal']
  let lastErr: unknown
  for (const engine of order) {
    if (engine === 'fal' && !falKey()) continue
    try {
      const png = engine === 'fal' ? await drawOnFal(full) : await drawOnGemini(full)
      return await pinLogo(png, logo)
    } catch (e) {
      lastErr = e
      console.warn(`[slide-engine] ${engine} failed, trying the other:`, e instanceof Error ? e.message.slice(0, 160) : e)
    }
  }
  throw new Error(`Both slide engines failed: ${lastErr instanceof Error ? lastErr.message : lastErr}`)
}

/* Re-exported so a caller needing the rectangle does not import two modules. */
export { LOGO_SPACE, logoRect } from './logo-space'
