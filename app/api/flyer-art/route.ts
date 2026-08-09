import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'
import { FLYER_TEMPLATES, artPrompt } from '../../_lib/flyer'

// =============================================================================
// Flyer artwork — OpenAI GPT Image.
//
// Returns several options at once so the picker shows a wall of choices and
// "show me more" is another call. Generated in PARALLEL: six sequential image
// calls is most of a minute, and nobody browses a gallery that arrives one
// tile every ten seconds.
//
// Portrait and landscape are generated at DIFFERENT aspect ratios, not cropped
// from one another — a banner cut out of a portrait frame loses the very
// composition the prompt asked for.
//
// For production this should serve a PRE-GENERATED library tagged by template,
// built once overnight: browsing becomes instant and free, and only the
// finished flyer costs anything. On-demand is right for a proof and exactly
// the wrong shape for a gallery people click through idly.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 300

let _ai: OpenAI | null = null
const ai = () => (_ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' }))

const MODEL = process.env.FLYER_IMAGE_MODEL || 'gpt-image-2'

let _g: GoogleGenAI | null = null
const gem = () => (_g ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }))

/** Why a fallback exists: the first live run of this feature returned nothing
 *  because the OpenAI account was out of credits. A billing state on one
 *  vendor should degrade the artwork, not delete the feature — so it tries
 *  the requested engine, then the other one, and REPORTS which it used rather
 *  than quietly substituting. */
async function viaOpenAI(prompt: string, portrait: boolean): Promise<string | null> {
  const res = await ai().images.generate({
    model: MODEL, prompt,
    size: portrait ? '1024x1536' : '1536x1024',
    quality: 'high', n: 1,
  })
  const b64 = res.data?.[0]?.b64_json
  return b64 ? `data:image/png;base64,${b64}` : null
}

async function viaGemini(prompt: string, portrait: boolean): Promise<string | null> {
  const res = await gem().models.generateContent({
    model: process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseFormat: { image: { aspectRatio: portrait ? '3:4' : '4:3', imageSize: '2K' } } } as never,
  })
  for (const p of res.candidates?.[0]?.content?.parts ?? []) {
    if (p.inlineData?.data) return `data:image/png;base64,${p.inlineData.data}`
  }
  return null
}

async function makeArt(prompt: string, portrait: boolean, engine: { used: string; note?: string }): Promise<string | null> {
  try {
    const img = await viaOpenAI(prompt, portrait)
    if (img) { engine.used = MODEL; return img }
  } catch (err) {
    engine.note = err instanceof Error ? err.message.slice(0, 140) : 'OpenAI unavailable'
  }
  try {
    const img = await viaGemini(prompt, portrait)
    if (img) { engine.used = 'gemini (OpenAI unavailable)'; return img }
  } catch {
    // One dud tile must never empty the gallery — the caller filters nulls.
  }
  return null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    subject?: string
    templateId?: string
    count?: number
    portrait?: boolean
  } | null

  const subject = String(body?.subject ?? '').trim().slice(0, 300) || 'an event'
  const count = Math.min(Math.max(Number(body?.count) || 6, 1), 8)
  const portrait = body?.portrait !== false
  const template = FLYER_TEMPLATES.find((t) => t.id === body?.templateId) ?? FLYER_TEMPLATES[0]

  // Vary the direction per tile, or the wall is six near-identical images.
  const angles = [
    'wide establishing shot',
    'tight portrait detail, shallow depth of field',
    'dramatic low angle',
    'silhouettes against strong backlight',
    'atmosphere and texture, near-abstract',
    'motion blur, long exposure energy',
    'overhead view',
    'reflections, glass and light',
  ]

  const engine: { used: string; note?: string } = { used: MODEL }
  const art = (await Promise.all(
    Array.from({ length: count }, (_, i) =>
      makeArt(`${artPrompt(template, subject, portrait)} Treatment: ${angles[i % angles.length]}.`, portrait, engine)
    )
  )).filter(Boolean) as string[]

  if (!art.length) {
    // Say WHY. "Could not generate artwork" sends someone hunting through code
    // for a bug when the real answer was an unpaid invoice.
    return NextResponse.json({
      error: 'Could not generate artwork. ' + (engine.note ?? 'Both image services failed — try again.'),
    }, { status: 502 })
  }
  return NextResponse.json({ art, asked: count, engine: engine.used, ...(engine.note ? { note: engine.note } : {}) })
}
