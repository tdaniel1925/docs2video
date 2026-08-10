import Anthropic from '@anthropic-ai/sdk'
import type { FlyerFields } from './flyer-engine'

// =============================================================================
// Turning "a deck about our new pricing" into an actual running order.
//
// This is NOT the older deck-planner.ts, which maps source content onto layouts
// extracted from an uploaded PowerPoint template. This one starts from nothing
// but a sentence, which is what the chat maker gives you, and its output is a
// list of slides described in the SAME shape a flyer is described in — headline,
// supporting line, detail lines, call to action — so the existing image engine
// can draw each one with no translation layer in between.
//
// WHY IT MATTERS THAT THE SHAPE MATCHES. Every rule already learned about
// getting legible type out of an image model — quote the words verbatim, never
// invent a figure, hold the text off the edges — lives in flyerPrompt. A deck
// that took a different route to the model would have to learn all of it again,
// and would learn it by shipping broken slides.
// =============================================================================

let _client: Anthropic | null = null
const client = () => (_client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' }))

/** What a slide is FOR. Drives how much text it is allowed to carry. */
export type SlideRole = 'cover' | 'point' | 'numbers' | 'quote' | 'closing'

export type PlannedSlide = {
  role: SlideRole
  /** Exactly the fields the image engine already understands. */
  fields: FlyerFields
}

export type DeckPlan = {
  title: string
  slides: PlannedSlide[]
}

/** Below 3 it is not a deck; above 20 the cost surprises people. */
export const MIN_SLIDES = 3
export const MAX_SLIDES = 20

const SYSTEM = `You plan presentation decks. You are given a plain-language brief and a slide count, and you return the running order.

A SLIDE IS NOT A DOCUMENT. It is read from the back of a room in a few seconds while somebody talks over it. So:
- ONE idea per slide.
- The headline is a short phrase, not a sentence. Under about 45 characters. No full stop.
- At most THREE supporting lines, each under about 60 characters. Often zero is better.
- Never a paragraph. Never a wall of bullets. If an idea needs a paragraph, it needs two slides.

ROLES, and what each is allowed:
- "cover"   — first slide. headline = the deck's title. subhead = who it is for or the date. Nothing else.
- "point"   — one idea. headline + up to three short supporting lines in details.
- "numbers" — a figure that matters. headline = the figure itself, large and alone (e.g. "3x faster", "$1.2M"). subhead = what it means, one short line.
- "quote"   — a customer or expert line. headline = the quote, short. subhead = who said it.
- "closing" — last slide. headline = the ask or the next step. cta = what to do. contact = how to reach them, ONLY if the brief gave you contact details.

NEVER INVENT A FACT. This is the most important rule here, and it is broken most often in ways that look harmless:
- No statistic, price, percentage or multiple.
- No DURATION or TIMEFRAME. "Set up in under an hour", "a 30-minute call", "results in 90 days", "same-day response" are all invented promises unless the brief says so. These slip past most easily because they sound like modest detail rather than a claim.
- No customer name, company name, job title or quotation attributed to a real person.
- No date, deadline or availability.
- No guarantee, and no superlative you were not given ("the leading", "the fastest").

If the brief gives you nothing numeric, do not produce a "numbers" slide. For a "quote" slide with no real quotation in the brief, write the line as the FEELING or promise and attribute it to nobody, rather than inventing a customer.

A made-up figure on a slide someone presents to a room is the worst failure this can have — worse than a dull deck. When in doubt, say less.

Vary the roles. A deck that is fifteen "point" slides in a row is exhausting to sit through.

Return ONLY valid JSON, no prose and no code fence:
{"title":"...","slides":[{"role":"cover","fields":{"headline":"...","subhead":"..."}}]}

Allowed fields: headline, subhead, details (array of strings), cta, contact. Leave out anything you have nothing real to put in — an empty field is dropped, an invented one is a lie on a screen.`

/**
 * Plan a deck from a sentence.
 *
 * Costs nothing but a text call, and returns something the customer can read and
 * correct BEFORE any image is paid for. Twelve slides is a lot of credits to
 * spend on a running order nobody checked.
 */
export async function planDeck(brief: string, slideCount: number): Promise<DeckPlan> {
  const n = Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Math.round(slideCount)))

  const res = await client().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Plan a deck of EXACTLY ${n} slides.\n\nBrief:\n${brief.slice(0, 4000)}`,
    }],
  })

  const text = res.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('')

  // Models add a code fence about a third of the time however firmly you ask.
  const json = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  let parsed: DeckPlan
  try {
    parsed = JSON.parse(json)
  } catch {
    // Last resort: the outermost object. Better than failing a paid flow on a
    // stray sentence before the JSON.
    const start = json.indexOf('{')
    const end = json.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('The planner did not return a deck. Try describing it again.')
    parsed = JSON.parse(json.slice(start, end + 1))
  }

  return {
    title: String(parsed.title ?? 'Untitled deck').slice(0, 120),
    slides: normalise(parsed.slides ?? [], n),
  }
}

const ROLES: SlideRole[] = ['cover', 'point', 'numbers', 'quote', 'closing']

/**
 * Force the plan into something the image engine can actually draw.
 *
 * The model is asked for a slide count and usually obeys, but "usually" is not
 * good enough when the number drives what the customer is charged. Everything
 * here is a hard clamp rather than a hope.
 */
function normalise(raw: PlannedSlide[], want: number): PlannedSlide[] {
  const out: PlannedSlide[] = raw.slice(0, want).map((s) => {
    const f = s.fields ?? {}
    const trim = (v: unknown, max: number) => {
      const t = String(v ?? '').trim()
      return t ? t.slice(0, max) : undefined
    }
    return {
      role: ROLES.includes(s.role) ? s.role : 'point',
      fields: {
        headline: trim(f.headline, 90) ?? 'Untitled',
        subhead: trim(f.subhead, 110),
        // Three lines is the limit a slide can carry and stay readable from the
        // back of a room; the model is told three and occasionally sends six.
        details: (f.details ?? []).map((d) => trim(d, 90)).filter(Boolean).slice(0, 3) as string[] | undefined,
        cta: trim(f.cta, 60),
        contact: trim(f.contact, 90),
      },
    }
  })

  // Short is possible — the model sometimes stops early. Pad rather than fail:
  // the customer can delete a slide, but a missing closing slide in a deck they
  // are about to present is worse.
  while (out.length < want) {
    out.push({ role: 'point', fields: { headline: `Slide ${out.length + 1}` } })
  }
  return out
}

/**
 * Extra art direction per slide, on top of the chosen style.
 *
 * A cover and a numbers slide want completely different weight even in the same
 * look, and the image model will not infer that from the words alone.
 */
export const roleDirection = (role: SlideRole): string => ({
  cover: 'This is the OPENING slide. The title dominates — the largest type in the whole deck. Nothing else competes with it. Generous empty space.',
  point: 'This is a body slide. One idea. The headline leads; any supporting lines sit quietly beneath it at a much smaller size.',
  numbers: 'This slide exists for ONE FIGURE. Set the headline enormous — it should fill a third of the frame on its own. The supporting line is small and sits directly underneath.',
  quote: 'This is a QUOTATION. Set it as a quote — larger, lighter, more space around it than a normal headline, with the attribution small and quiet beneath.',
  closing: 'This is the FINAL slide. Calm and uncluttered. The ask reads first; contact details are small and sit at the bottom.',
}[role])
