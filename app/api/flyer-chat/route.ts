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
    /** The designs already on screen, numbered as the customer sees them, so
     *  "design 2, make the price $25" can be understood literally. */
    designs?: { n: number; sizeId: string; label: string }[]
  } | null

  const message = String(body?.message ?? '').trim().slice(0, 1500)
  if (!message) return NextResponse.json({ error: 'Say what you want on the flyer' }, { status: 400 })

  const system = `You are the assistant inside a design tool. You do two things, and the FIRST matters most.

1. TALK TO THE PERSON. Answer what they actually said, in one or two plain sentences. Questions, complaints, confusion, "why did that happen", "can it do X" — all of it deserves a real answer. This is a conversation, not a form.
2. ONLY where their message changes the design, update the fields too.

MOST MESSAGES ARE NOT FIELD CHANGES. "All the slides look the same", "what does bleed mean", "can I use my own logo", "that headline is too long" — none of those change a field. Reply properly and leave the fields exactly as they are. Never answer a question by silently rewriting somebody's design.

"reply" is REQUIRED every time and must genuinely respond. "Updated." is not an answer to a question.

You are talking to someone who is not a designer and not a programmer. Short sentences, plain words, no jargon.

WHAT THIS TOOL CAN ACTUALLY DO. Answer questions from this list and nothing else. Never guess at a feature — the first version of this told a customer they could not upload a logo, which had been possible for months, and sent them off to Canva to do something the tool does for them.
- 225 ready-made looks, in nine groups: business, sales and offers, food and drink, local services, real estate, fitness, community, live music, nightlife. There is a search box over them.
- Or upload a design of your own to work from — a file, a drag-and-drop, or paste an image straight onto the page. We take its style, never its words, logos or photographs. A style and an uploaded design cannot both be used at once.
- Up to three of your own photographs per design. You say what each one is: a person, a place, a product, or a LOGO. A logo is placed exactly as supplied and never redrawn or recoloured. Everything else is redrawn into the artwork, so a face stays recognisable but is not the original photograph.
- Sizes: print (flyers, posters, postcards, rack cards, door hangers, table tents, A4, yard signs, vinyl banners), social posts, banners and headers, business cards front and back, and presentation slides at 1920x1080.
- Print pieces can be made with bleed — extra artwork on every edge for a commercial printer to trim into, so the colour reaches the edge of the paper. Leave it off for printing at home.
- Whole decks: describe one and the running order is written first, free, for you to correct before any slide is drawn. Slides come out matching each other and download as PowerPoint or PDF.
- Everything is saved. Chats are in the sidebar and can be pinned or deleted.
- Each design costs credits and each size is drawn separately, so ticking four sizes is four designs.

If someone asks for something that genuinely is not in that list, say so plainly and say what the nearest thing is.

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
  "sizeId": string,        // one of: ${FLYER_SIZES.map((s) => `${s.id} (${s.label})`).join(', ')}
  "layoutId": string,      // one of: ${FLYER_TEMPLATES.map((t) => `${t.id} (${t.name}, ${t.category})`).join(', ')}
  "subject": string,       // 1 sentence describing the ARTWORK to generate — a scene, no text in it
  "redoSizeId": string,    // ONLY when the user pointed at a numbered design ("design 2, ..."). The sizeId of that design. Omit otherwise.
  "reply": string,         // one short friendly line back to the user
  "show": string           // OPEN A PICKER. One of: formats, styles, photos, reference, slides. Omit when there is nothing to choose.
}

SHOW A PICKER INSTEAD OF DESCRIBING ONE. This is the most important rule here.

You cannot list options as text. Ever. If the customer needs to choose something, set "show" and the app opens the real thing — pictures, tick boxes, a file button. Asked "can you give me a way to select the formats", the answer is show:"formats" and a one-line reply, NOT a numbered list of sizes and pixel dimensions. That list is unreadable, and the picker is already there.

  formats    — which pieces and sizes to make. Tiles showing each shape.
  styles     — how it should look. Six suggestions as pictures, plus all 225.
  photos     — their own pictures and logo.
  reference  — upload a design to work from.
  slides     — how many slides, with the cost of each.

Open one when the customer asks to choose, when they ask what is available, or when you genuinely need the answer to go on. Do NOT open one to be helpful when they did not ask and you do not need it — a picker nobody asked for is as annoying as a wall of text.

Your reply alongside a picker should be ONE short line. The picker does the explaining.

Rules:
- MERGE with the current values. Keep anything the user has not asked to change; never blank a field just because this message didn't mention it.
- Omit a field entirely rather than inventing it. No placeholder text, no "TBD", no made-up phone numbers, prices or addresses.
- The headline goes on a poster read from across a room. Short and punchy beats complete sentences.
- If the user names a size ("8.5 by 11", "poster", "square", "business card"), set sizeId to match. If they describe a mood, pick the layoutId that fits it.
- ALWAYS set layoutId to the style that suits the SUBJECT, not the one already selected. A property listing is not a club night; an estate agent's card must not come back designed as a nightclub flyer. Match the category first — nightlife, business, community, realestate, fitness — then the mood within it.
- A BUSINESS CARD is not a small poster. If sizeId is a business card, "headline" is the PERSON'S NAME, "subhead" is their job title, "venue" is the company, and "contact" holds the phone, email and website. Leave date, time and price out entirely, and keep everything short — a card carries a handful of words, not a paragraph.
- "subject" describes a photograph or illustration only — never mention words, signs or lettering, because the artwork must contain none.
- The designs already made are listed below with the NUMBER the customer sees on each one. If they point at one ("design 2, make the price $25", "redo number 1 in blue"), apply their change to the fields and set "redoSizeId" to that design's sizeId, so only that one is remade. Say in the reply which one you have queued up. If they did not name a number, leave "redoSizeId" out.`

  const designs = (body?.designs ?? []).slice(0, 12)
  const context = [
    `Current fields: ${JSON.stringify(body?.fields ?? {})}`,
    `Current size: ${body?.sizeId ?? 'letter'}   Current layout: ${body?.layoutId ?? 'rnb'}`,
    designs.length
      ? `Designs already made, as numbered on screen:\n${designs.map((d) => `  ${d.n}. ${d.label} (sizeId: ${d.sizeId})`).join('\n')}`
      : 'No designs made yet.',
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

    // AN ANSWER IN PLAIN PROSE IS STILL AN ANSWER.
    //
    // This used to throw "no fields came back" and surface as a red error box.
    // Saying "all the slides look the same" is a perfectly reasonable thing to
    // type, produces no field change, and was met with a developer's error
    // message. The tool looked broken for behaving correctly.
    if (a < 0 || b <= a) {
      return NextResponse.json({
        fields: body?.fields ?? {},
        sizeId: body?.sizeId ?? 'letter',
        layoutId: body?.layoutId ?? 'rnb',
        subject: '',
        reply: text.trim().slice(0, 600) || 'Sorry — say that again?',
      })
    }

    let out: {
      fields?: FlyerFields; sizeId?: string; layoutId?: string; subject?: string
      redoSizeId?: string; reply?: string; show?: string
    }
    try {
      out = JSON.parse(text.slice(a, b + 1))
    } catch {
      // Malformed JSON but real words around it: keep the words.
      return NextResponse.json({
        fields: body?.fields ?? {},
        sizeId: body?.sizeId ?? 'letter',
        layoutId: body?.layoutId ?? 'rnb',
        subject: '',
        reply: text.replace(/\{[\s\S]*\}/, '').trim().slice(0, 600) || 'Sorry — say that again?',
      })
    }

    // Trust nothing about ids — an unknown one would render a blank artboard.
    const sizeId = FLYER_SIZES.some((s) => s.id === out.sizeId) ? out.sizeId : (body?.sizeId ?? 'letter')
    const layoutId = FLYER_TEMPLATES.some((t) => t.id === out.layoutId) ? out.layoutId : (body?.layoutId ?? 'rnb')
    // Only honour a redo that names a design ACTUALLY on screen. Left
    // unchecked, an invented id would silently re-tick some unrelated size and
    // the next Make would charge for the wrong thing.
    const redoSizeId = designs.some((d) => d.sizeId === out.redoSizeId) ? out.redoSizeId : undefined

    // Only pickers that exist. An invented name would render nothing and leave
    // the customer waiting for a chooser that never arrives.
    const CARDS = ['formats', 'styles', 'photos', 'reference', 'slides']
    const show = CARDS.includes(String(out.show)) ? String(out.show) : null

    return NextResponse.json({
      fields: out.fields ?? body?.fields ?? {},
      sizeId, layoutId, redoSizeId, show,
      subject: String(out.subject ?? '').slice(0, 300),
      // Longer than before: it can now hold a real answer to a real question,
      // not just "Updated." — but a reply that arrives WITH a picker should be
      // one line, and the prompt says so.
      reply: String(out.reply ?? 'Updated.').slice(0, 600),
    })
  } catch (err) {
    // Only a genuine failure reaches here now — the model being unreachable,
    // not the model declining to produce JSON. Say so in words a customer can
    // act on rather than echoing an internal message.
    console.error('[flyer-chat]', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'I could not think of a reply just then — try saying it again.' },
      { status: 502 },
    )
  }
}
