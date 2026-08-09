import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '../../_lib/supabase/server'
import { FLYER_TEMPLATES, FLYER_SIZES, type FlyerFields } from '../../_lib/flyer-engine'

// =============================================================================
// The conversation that fills in a flyer — PROOF OF CONCEPT.
//
// "Design a flyer 8.5 by 11 for a club" then "doors at nine, twenty dollar
// cover, DJ Sable headlining" — each message returns the FULL updated field
// set, so the preview redraws after every line and the user watches the flyer
// assemble itself.
//
// It returns fields, never markup. The layout is code; letting a model emit
// HTML into the artboard would put the design at the mercy of whatever it felt
// like writing that time — and is how you end up with unprintable flyers.
//
// It also picks the size and layout when the user names one ("8.5 x 11",
// "make it a poster"), because asking someone to fill a form they already
// described in a sentence is the opposite of what a chat interface is for.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 60

let _c: Anthropic | null = null
const claude = () => (_c ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' }))

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    message?: string
    fields?: FlyerFields
    layoutId?: string
    sizeId?: string
    history?: { role: 'user' | 'assistant'; text: string }[]
  } | null

  const message = String(body?.message ?? '').trim().slice(0, 1500)
  if (!message) return NextResponse.json({ error: 'Say what you want on the flyer' }, { status: 400 })

  const system = `You turn a conversation into the contents of a printed flyer.

Return ONLY a JSON object, no commentary and no markdown fence:
{
  "fields": {
    "eyebrow": string,     // tiny line above the headline, e.g. "SATURDAY NIGHT"
    "headline": string,    // the big one. Short. 2-5 words is ideal.
    "subhead": string,     // one supporting sentence
    "date": string, "time": string, "venue": string, "address": string, "price": string,
    "details": string[],   // up to 4 short lines
    "cta": string,         // the action, e.g. "TICKETS AT THE DOOR"
    "contact": string      // phone / website / handle
  },
  "sizeId": string,        // one of: ${FLYER_SIZES.map((s) => s.id).join(', ')}
  "layoutId": string,      // one of: ${FLYER_TEMPLATES.map((t) => t.id).join(', ')}
  "subject": string,       // 1 sentence describing the ARTWORK to generate — a scene, no text in it
  "reply": string          // one short friendly line back to the user
}

Rules:
- MERGE with the current values. Keep anything the user has not asked to change; never blank a field just because this message didn't mention it.
- Omit a field entirely rather than inventing it. No placeholder text, no "TBD", no made-up phone numbers, prices or addresses.
- The headline goes on a poster read from across a room. Short and punchy beats complete sentences.
- If the user names a size ("8.5 by 11", "poster", "square"), set sizeId to match. If they describe a mood, pick the layoutId that fits it.
- "subject" describes a photograph or illustration only — never mention words, signs or lettering, because the artwork must contain none.`

  const context = [
    `Current fields: ${JSON.stringify(body?.fields ?? {})}`,
    `Current size: ${body?.sizeId ?? 'letter'}   Current layout: ${body?.layoutId ?? 'rnb'}`,
    ...(body?.history ?? []).slice(-6).map((h) => `${h.role}: ${h.text}`),
    `user: ${message}`,
  ].join('\n')

  try {
    const msg = await claude().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: context }],
    })
    const text = msg.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
    const a = text.indexOf('{')
    const b = text.lastIndexOf('}')
    if (a < 0 || b <= a) throw new Error('no fields came back')
    const out = JSON.parse(text.slice(a, b + 1)) as {
      fields?: FlyerFields; sizeId?: string; layoutId?: string; subject?: string; reply?: string
    }

    // Trust nothing about ids — an unknown one would render a blank artboard.
    const sizeId = FLYER_SIZES.some((s) => s.id === out.sizeId) ? out.sizeId : (body?.sizeId ?? 'letter')
    const layoutId = FLYER_TEMPLATES.some((t) => t.id === out.layoutId) ? out.layoutId : (body?.layoutId ?? 'rnb')

    return NextResponse.json({
      fields: out.fields ?? body?.fields ?? {},
      sizeId, layoutId,
      subject: String(out.subject ?? '').slice(0, 300),
      reply: String(out.reply ?? 'Updated.').slice(0, 300),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Chat failed' }, { status: 500 })
  }
}
