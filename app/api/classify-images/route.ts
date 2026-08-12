import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import type { PhotoRole } from '../../_lib/flyer-engine'

// =============================================================================
// Look at what somebody just dropped in and work out what each thing IS.
//
// WHY. The app used to make you say. Open the photos panel, add a file, then
// pick "A person" or "A place" from a dropdown — per image. That is a form,
// and the answer is almost always obvious from the picture itself. Asking a
// question you can answer yourself is the thing that makes software feel like
// paperwork.
//
// So: drop everything in at once. A headshot, the shop front, your logo, and a
// poster you liked the look of. Each gets sorted, and the only thing you have
// to do is glance at the labels and fix any that are wrong.
//
// IT GUESSES, AND IT SAYS SO. Every answer comes back with how sure it is, and
// anything below the bar is marked unsure so the app can ask rather than
// quietly file a logo as a product. Confidently wrong is far worse here than
// admitting to a coin flip: a mislabelled logo gets REDRAWN by the image model,
// which is the one thing that must never happen to somebody's real mark.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'gemini-2.5-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Everything a dropped image is allowed to be. */
type Kind = PhotoRole | 'reference'

const KINDS: Kind[] = ['person', 'place', 'product', 'logo', 'reference']

/** Below this we ask instead of assuming. */
const SURE_ENOUGH = 0.7

const GUIDE = `You are sorting images a small business just dropped into a design tool.
For EACH image, say which ONE of these it is:

  person    — a photograph of a real person: headshot, team photo, someone at work
  place     — a real building, room, shop, venue, property, street
  product    — a real object being sold or served: a dish, a bottle, a tool, a car
  logo      — a brand mark, wordmark or emblem. Flat artwork, usually on plain or
              transparent background, often just type or a symbol. NOT a photograph.
  reference — a finished piece of DESIGN: a poster, flyer, advert, social post,
              packaging. It has laid-out text, a headline, a composition. Somebody
              is showing it as an example of a LOOK they like.

The hardest calls, and how to make them:
- A photograph of a shop with its sign in it is a PLACE, not a logo.
- A poster with a big photograph on it is a REFERENCE, not a place — if it has a
  headline and laid-out text, it is a design.
- A product shot on white with no text is a PRODUCT, not a reference.
- A logo photographed on a van or a shirt is a PLACE or PRODUCT, not a logo — a
  logo means clean artwork of the mark itself.

Also give confidence from 0 to 1: how sure you are. Be honest. 0.5 means you are
guessing. Anything you are genuinely unsure about MUST be below 0.7 — a wrong
answer stated confidently is worse than an admitted guess, because a logo filed
as a product gets redrawn instead of placed.

Reply with ONLY a JSON array, one object per image, in the same order:
[{"kind":"logo","confidence":0.9,"what":"a black wordmark reading NORTHSIDE"}]
"what" is a SHORT plain description, five words or so, so a person can tell which
image you meant without opening it.`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as { images?: string[] } | null
  const images = (body?.images ?? []).filter((s) => typeof s === 'string' && s.startsWith('data:image'))
  if (!images.length) return NextResponse.json({ error: 'No images' }, { status: 400 })
  if (images.length > 8) return NextResponse.json({ error: 'Up to 8 at a time' }, { status: 400 })

  const key = process.env.GEMINI_API_KEY
  // NO KEY IS NOT AN ERROR. Everything still works, it just cannot pre-fill the
  // labels — so hand back "unsure" for each and let the customer say. Refusing
  // the upload because a nice-to-have is unavailable would be the wrong trade.
  if (!key) {
    return NextResponse.json({
      results: images.map(() => ({ kind: 'person', confidence: 0, what: '', sure: false })),
      guessed: false,
    })
  }

  try {
    const parts: Record<string, unknown>[] = [{ text: GUIDE }]
    images.forEach((src, i) => {
      const [meta, data] = src.split(',')
      parts.push({ text: `Image ${i + 1}:` })
      parts.push({ inlineData: { mimeType: meta.slice(5).split(';')[0] || 'image/png', data } })
    })

    const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) throw new Error(`sorter returned ${res.status}`)

    const json = await res.json()
    const text: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('no list came back')

    const raw = JSON.parse(match[0]) as { kind?: string; confidence?: number; what?: string }[]

    // ONE ANSWER PER IMAGE, whatever came back. A short list would silently
    // shift every label onto the wrong picture, which is the worst possible
    // failure here — it looks like it worked.
    const results = images.map((_, i) => {
      const r = raw[i]
      const kind = KINDS.includes(r?.kind as Kind) ? (r!.kind as Kind) : 'person'
      const confidence = typeof r?.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0
      return {
        kind,
        confidence,
        what: String(r?.what ?? '').slice(0, 60),
        sure: Boolean(r) && confidence >= SURE_ENOUGH,
      }
    })

    return NextResponse.json({ results, guessed: true })
  } catch (e) {
    console.error('[classify-images]', e instanceof Error ? e.message : e)
    // Same reasoning as the missing key: the upload succeeds, the labels are
    // just blank. Never lose somebody's files because the convenience broke.
    return NextResponse.json({
      results: images.map(() => ({ kind: 'person', confidence: 0, what: '', sure: false })),
      guessed: false,
    })
  }
}
