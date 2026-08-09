import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'
import { FLYER_LAYOUTS, artPrompt } from '../../_lib/flyer'

// =============================================================================
// Background artwork for flyers — PROOF OF CONCEPT.
//
// Returns several options at once so the picker can show a wall of choices and
// "show me 10 more" means another call. Generated in PARALLEL: ten sequential
// image calls is most of a minute, and nobody browses a gallery that arrives
// one tile per five seconds.
//
// For production this should serve from a PRE-GENERATED library tagged by
// vibe, built once overnight — then browsing is instant and free, and only the
// finished flyer costs anything. Generating on demand is fine for a proof and
// exactly the wrong shape for a gallery users idly click through.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 120

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

async function makeArt(prompt: string): Promise<string | null> {
  try {
    const res = await genai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseFormat: {
          // PORTRAIT. The helper used by the video pipeline is hardcoded to
          // 16:9; a flyer cropped from a landscape frame loses the composition
          // the prompt just asked for.
          image: { aspectRatio: '3:4', imageSize: '2K' },
        },
      } as never,
    })
    for (const p of res.candidates?.[0]?.content?.parts ?? []) {
      if (p.inlineData?.data) return `data:image/png;base64,${p.inlineData.data}`
    }
  } catch {
    // One dud tile should never empty the gallery — the caller filters nulls.
  }
  return null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    subject?: string
    layoutId?: string
    accent?: string
    count?: number
  } | null

  const subject = String(body?.subject ?? '').trim().slice(0, 300) || 'an event'
  const accent = /^#[0-9a-f]{6}$/i.test(String(body?.accent)) ? String(body!.accent) : '#C0392B'
  const count = Math.min(Math.max(Number(body?.count) || 6, 1), 10)
  const layout = FLYER_LAYOUTS.find((l) => l.id === body?.layoutId) ?? FLYER_LAYOUTS[0]

  // Vary the direction per tile so the wall isn't six near-identical images.
  const angles = [
    'wide establishing view', 'tight detail, shallow depth of field', 'dramatic low angle',
    'overhead / top down', 'silhouette against strong light', 'texture and atmosphere, abstract',
    'reflections and glass', 'motion blur, long exposure', 'golden hour warmth', 'deep night, neon',
  ]

  const art = (await Promise.all(
    Array.from({ length: count }, (_, i) =>
      makeArt(`${artPrompt(layout, subject, accent)} Treatment: ${angles[i % angles.length]}.`)
    )
  )).filter(Boolean) as string[]

  if (!art.length) {
    return NextResponse.json({ error: 'Could not generate artwork just now — try again.' }, { status: 502 })
  }
  return NextResponse.json({ art, asked: count })
}
