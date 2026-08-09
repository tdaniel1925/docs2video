import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '../../_lib/supabase/server'
import { FLYER_TEMPLATES, FLYER_SIZES, flyerPrompt, nearestGptSize } from '../../_lib/flyer'
import type { FlyerFields } from '../../_lib/flyer'

// =============================================================================
// Generate complete flyers — artwork AND lettering — at every ticked size.
//
// gpt-image only offers three shapes, so each target size is generated at the
// nearest one and then cropped to the exact pixels. Cropping a flyer is risky
// (it can eat the edge of a headline), so the prompt asks for generous margins
// and wide formats are told to keep the text to one side.
//
// EACH SIZE IS ITS OWN GENERATION, not one image stretched. A portrait poster
// squashed into a 1500x500 header is unusable; asking for a banner gets a
// banner composition. They are siblings in the same style rather than clones.
//
// Sizes run in parallel. Six sequential image calls is several minutes, and
// nobody waits that long watching a spinner.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 300

let _ai: OpenAI | null = null
const ai = () => (_ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' }))
const MODEL = process.env.FLYER_IMAGE_MODEL || 'gpt-image-2'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    templateId?: string
    sizeIds?: string[]
    fields?: FlyerFields
    /** Extra art direction typed by the user, appended verbatim. */
    note?: string
  } | null

  const template = FLYER_TEMPLATES.find((t) => t.id === body?.templateId) ?? FLYER_TEMPLATES[0]
  const sizes = (body?.sizeIds ?? []).map((id) => FLYER_SIZES.find((s) => s.id === id)).filter(Boolean) as typeof FLYER_SIZES
  if (!sizes.length) return NextResponse.json({ error: 'Tick at least one size' }, { status: 400 })
  if (sizes.length > 8) return NextResponse.json({ error: 'Up to 8 sizes at a time' }, { status: 400 })

  const fields = body?.fields ?? {}
  const note = String(body?.note ?? '').trim().slice(0, 400)

  const one = async (size: typeof FLYER_SIZES[number]) => {
    const prompt = flyerPrompt(template, fields, size) + (note ? `\n\nALSO: ${note}` : '')
    try {
      const res = await ai().images.generate({
        model: MODEL, prompt, size: nearestGptSize(size), quality: 'high', n: 1,
      })
      const b64 = res.data?.[0]?.b64_json
      if (!b64) return { sizeId: size.id, label: size.label, error: 'no image returned' }

      const sharp = (await import('sharp')).default
      const targetW = size.unit === 'in' ? Math.round(size.w * 150) : size.w
      const targetH = size.unit === 'in' ? Math.round(size.h * 150) : size.h
      const src = Buffer.from(b64, 'base64')

      // HOW MUCH WOULD CROPPING THROW AWAY?
      //
      // gpt-image tops out at 3:2, so anything wider is trimmed to fit — and
      // the trim is brutal at the far end: a Facebook cover loses 43% of the
      // picture's height, an X header 50%, a LinkedIn banner 63%. That is why
      // the first cover came back with its text sliced off, and no amount of
      // "keep the text central" in the prompt survives losing two thirds of
      // the frame.
      //
      // So past a modest trim the flyer is not cropped at all. It is placed
      // whole, centred, on a blurred blow-up of itself — the standard way a
      // tall image is adapted to a letterbox, and the design stays intact.
      const srcRatio = 1536 / 1024
      const dstRatio = targetW / targetH
      const cropLoss = dstRatio > srcRatio ? 1 - srcRatio / dstRatio : 1 - dstRatio / srcRatio

      let png: Buffer
      if (cropLoss <= 0.25) {
        png = await sharp(src).resize(targetW, targetH, { fit: 'cover', position: 'centre' }).png().toBuffer()
      } else {
        const bg = await sharp(src)
          .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
          .blur(40)
          .modulate({ brightness: 0.55 })
          .toBuffer()
        const fg = await sharp(src)
          .resize(targetW, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer()
        png = await sharp(bg).composite([{ input: fg }]).png().toBuffer()
      }

      return {
        sizeId: size.id, label: size.label, w: targetW, h: targetH,
        png: `data:image/png;base64,${png.toString('base64')}`,
      }
    } catch (err) {
      return { sizeId: size.id, label: size.label, error: err instanceof Error ? err.message.slice(0, 160) : 'failed' }
    }
  }

  const all = await Promise.all(sizes.map(one))
  const images = all.filter((r) => 'png' in r) as { sizeId: string; label: string; w: number; h: number; png: string }[]
  const failed = all.filter((r) => 'error' in r) as { label: string; error: string }[]

  if (!images.length) {
    // Say WHY. "Generation failed" sends someone into the code when the answer
    // was a billing state or a content refusal.
    return NextResponse.json({ error: failed[0]?.error || 'Generation failed', failed }, { status: 502 })
  }
  return NextResponse.json({ images, ...(failed.length ? { failed } : {}), model: MODEL })
}
