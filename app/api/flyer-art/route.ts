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

      // EVERY SIZE IS ITS OWN ORIGINAL DESIGN. Each was generated from a prompt
      // written for its own shape, so this is only reconciling gpt-image's three
      // available frames with the exact pixels asked for.
      //
      // Ultrawide targets were composed as a BAND inside a 3:2 frame — the
      // prompt told the model which band survives and to leave the rest empty —
      // so trimming to that band removes only the blank margin it was asked to
      // leave. Nothing designed is lost, and the result is a real horizontal
      // layout rather than a poster with its head and feet cut off.
      const png = await sharp(src)
        .resize(targetW, targetH, {
          fit: 'cover',
          // Centre is right for the band, and right for everything else too —
          // the portrait and square frames barely trim at all.
          position: 'centre',
        })
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
