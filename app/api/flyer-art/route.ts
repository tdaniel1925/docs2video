import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '../../_lib/supabase/server'
import { FLYER_TEMPLATES, FLYER_SIZES, flyerPrompt, apiSize } from '../../_lib/flyer'
import type { FlyerFields } from '../../_lib/flyer'

// =============================================================================
// Generate complete flyers — artwork AND lettering — at every ticked size.
//
// Each size is generated at ITS OWN aspect ratio — the API takes any dimensions
// divisible by 16 up to 3:1, so nothing is cropped. Only a 4:1 LinkedIn strip
// falls outside that and is composed as a band inside 3:1, then trimmed 12%.

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
      // Ask for THIS size's own shape. The API takes any dimensions divisible
      // by 16 up to 3:1 and about 4 MP, so almost everything is generated
      // natively and never cropped — see apiSize for the measured limits.
      const res = await ai().images.generate({
        model: MODEL, prompt, size: apiSize(size).size as '1024x1024', quality: 'high', n: 1,
      })
      const b64 = res.data?.[0]?.b64_json
      if (!b64) return { sizeId: size.id, label: size.label, error: 'no image returned' }

      const sharp = (await import('sharp')).default
      // Print comes out at 300 dpi — the size the printer asked for, not half
      // of it. The generation is capped by a pixel budget rather than by this,
      // so a big poster is scaled up to its true dimensions.
      const targetW = size.unit === 'in' ? Math.round(size.w * 300) : size.w
      const targetH = size.unit === 'in' ? Math.round(size.h * 300) : size.h
      const src = Buffer.from(b64, 'base64')

      // EVERY SIZE IS ITS OWN ORIGINAL DESIGN, generated at its own aspect
      // ratio. For all but one shape this resize is a pure scale — the aspect
      // already matches, so not a pixel of the design is cut.
      //
      // The exception is the 4:1 LinkedIn strip, which exceeds the API's 3:1
      // limit. That one is composed as a band inside a 3:1 frame, with the
      // prompt naming the band and asking for empty space around it, so the
      // trim takes only the margin it was told to leave.
      const png = await sharp(src)
        .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer()

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
