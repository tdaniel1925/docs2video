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
export type SlideRole = 'cover' | 'agenda' | 'section' | 'point' | 'numbers' | 'quote' | 'closing'

export type PlannedSlide = {
  role: SlideRole
  /** Exactly the fields the image engine already understands. */
  fields: FlyerFields
  /** ONE line on why this slide is here in the argument — drives its art weight
   *  and lets the user see the story, not just the words. Not drawn on the slide. */
  purpose?: string
}

export type DeckPlan = {
  title: string
  /** The deck's job, detected from the brief. Shown back to the user. */
  purpose?: string
  /** Who it's for. */
  audience?: string
  slides: PlannedSlide[]
}

/** Below 3 it is not a deck; above 24 the cost surprises people. */
export const MIN_SLIDES = 3
export const MAX_SLIDES = 24

/** The three lengths the UX offers. A RANGE, filled by the content — not a fixed
 *  count, so a story that needs 11 slides isn't crammed into 8 or padded to 15. */
export type DeckLength = 'short' | 'medium' | 'long'
export const LENGTH_RANGE: Record<DeckLength, [number, number]> = {
  short: [5, 7],
  medium: [8, 14],
  long: [15, 24],
}

const SYSTEM = `You are a presentation strategist. You are given a brief — often a wall of raw notes, pasted copy, or a document — and a target length range. You do TWO things, in order, and the FIRST is what makes a deck worth sitting through.

━━ JOB 1: UNDERSTAND THE MATERIAL BEFORE PLANNING ANYTHING ━━
Read the WHOLE brief and work out:
- PURPOSE — what this deck is FOR. Look for it stated outright ("an investor deck", "a sales pitch", "onboarding training", "our quarterly report") and infer it when it isn't. Common purposes: investor pitch, sales pitch, training/onboarding, internal report/update, all-hands/team, conference talk, product overview.
- AUDIENCE — who sits in the room (investors? prospects? new hires? the whole company?). Their knowledge and what they came to decide changes everything.
- THE ONE MESSAGE — the single sentence the audience should leave repeating.
- THE REAL FACTS — every figure, name, quote, and date the brief actually contains. These are the ONLY facts allowed on a slide (see the honesty rule). Note what you have and what you don't.

━━ JOB 2: PLAN A STORY, NOT A PILE OF TOPICS ━━
A great deck is ONE ARGUMENT told across slides, where each slide sets up the next. It is NOT a table of contents with the material sprinkled across it. Choose the arc that fits the PURPOSE and adapt it to the actual content:

- INVESTOR PITCH: hook (the big idea) → the problem (who hurts, how much) → your solution → why now → market size → business model (how money is made) → traction (proof it's working) → team (why you win) → the ask (what you want and what they get).
- SALES PITCH: their pain → what it's costing them → your fix → proof it works → how it works / what they get → the next step.
- TRAINING / ONBOARDING: where we're going (the goal) → why it matters → the parts, one concept per slide, simplest first → how it fits together → what to do next.
- INTERNAL REPORT / UPDATE: the headline result → context → what happened (the numbers) → what we learned → what's next.
- ALL-HANDS / TEAM: where we are → wins → challenges honestly → the plan → the ask of the room.
- CONFERENCE TALK: a hook → the tension/problem → the insight → evidence → the takeaway.

If none fits cleanly, build the best arc you can from: set the stakes → make the case in ordered beats → prove it → tell them what to do. EVERY slide must earn its place in the arc — if you cannot say why a slide moves the argument forward, cut it. Open by grabbing attention; close by telling them exactly what to do next.

Give each slide a one-line "purpose" (why it's here in the argument, for the planner and the user — NOT drawn on the slide). Ban filler headlines: never "Overview", "Introduction", "Information", "More Details", "Agenda" as a point headline — a slide with a generic title is a slide with no job.

━━ SLIDE CRAFT (a slide is read from the back of a room in seconds) ━━
- ONE idea per slide. Headline is a short phrase, not a sentence. Under ~45 characters, no full stop.
- At most THREE supporting lines, each under ~60 characters. Often zero is better. Never a paragraph, never a wall of bullets — if an idea needs a paragraph it needs two slides.

ROLES (pick the role that serves the story beat):
- "cover"   — first slide. headline = the deck's title. subhead = who it's for or the date. Nothing else.
- "agenda"  — OPTIONAL, only for a long formal deck. The 3-5 chapters ahead, as short details. Skip it for short decks.
- "section" — a divider that names the next chapter of the argument ("The Market", "How It Works"). headline = the chapter name, big; nothing else. Use these to give a long deck rhythm.
- "point"   — one idea that moves the argument. headline + up to three short supporting lines.
- "numbers" — a figure that matters. headline = the figure itself, large and alone ("3x faster", "$1.2M"). subhead = what it means, one short line.
- "quote"   — a real customer/expert line. headline = the quote, short. subhead = who said it.
- "closing" — last slide. headline = the ask or next step. cta = what to do. contact = how to reach them, ONLY if the brief gave contact details.

Vary the roles — a run of fifteen "point" slides is exhausting. Use "numbers", "quote", and "section" to change the rhythm where the story allows.

━━ THE HONESTY RULE — this OVERRIDES the arc, always ━━
NEVER INVENT A FACT, even to complete an arc. If the brief has no traction numbers, SKIP the traction slide — do not fabricate one. Specifically forbidden unless the brief states it:
- No statistic, price, percentage or multiple.
- No DURATION or TIMEFRAME ("set up in under an hour", "results in 90 days", "same-day") — these slip past most easily because they sound like modest detail.
- No customer/company name, job title, or quotation attributed to a real person.
- No date, deadline or availability. No guarantee. No superlative you weren't given ("the leading", "the fastest").
For a "quote" slide with no real quotation, write the line as the promise/feeling attributed to NOBODY. A made-up figure on a slide someone presents to a room is the worst failure possible — worse than a shorter deck. When in doubt, say less and use fewer slides.

━━ OUTPUT ━━
Fill the length the CONTENT needs, within the range you're given — do not pad to hit a number, do not cram a long story into too few slides. Return ONLY valid JSON, no prose and no code fence:
{"title":"...","purpose":"investor pitch","audience":"seed investors","slides":[{"role":"cover","purpose":"open with the big idea","fields":{"headline":"...","subhead":"..."}}]}

Allowed fields: headline, subhead, details (array of strings), cta, contact. Leave out anything you have nothing real to put in — an empty field is dropped, an invented one is a lie on a screen.`

/**
 * Plan a deck from a brief.
 *
 * The length is a RANGE, not a fixed number — the model fills the slide count
 * the STORY needs within it, so a tight argument isn't padded and a rich one
 * isn't crammed. Costs nothing but a text call, and returns a plan the user can
 * read and correct BEFORE any image is paid for.
 *
 * Back-compat: callers that pass a bare number (the API / MCP) still work — it's
 * read as "aim for about this many", clamped to [MIN, MAX].
 */
export async function planDeck(brief: string, length: DeckLength | number = 'medium'): Promise<DeckPlan> {
  const [lo, hi] = typeof length === 'number'
    ? [Math.max(MIN_SLIDES, Math.round(length) - 1), Math.min(MAX_SLIDES, Math.round(length) + 1)]
    : LENGTH_RANGE[length]

  const res = await client().messages.create({
    model: 'claude-sonnet-4-6',
    // Roomy: a long deck's JSON plus per-slide purpose lines needs the space, and
    // truncation mid-array reads as "the planner failed".
    max_tokens: 6000,
    system: SYSTEM,
    messages: [{
      role: 'user',
      // The WHOLE brief — the old 4,000-char cap threw away most of a real
      // investor paste, so the planner never saw the material it was judged on.
      content: `Plan a deck. Aim for ${lo}-${hi} slides — use the number the story genuinely needs within that range, no padding, no cramming.\n\nBrief:\n${brief.slice(0, 24000)}`,
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
    purpose: parsed.purpose ? String(parsed.purpose).slice(0, 80) : undefined,
    audience: parsed.audience ? String(parsed.audience).slice(0, 80) : undefined,
    slides: normalise(parsed.slides ?? [], hi),
  }
}

const ROLES: SlideRole[] = ['cover', 'agenda', 'section', 'point', 'numbers', 'quote', 'closing']

/**
 * Clamp the plan to something the image engine can draw — WITHOUT padding.
 *
 * We only enforce the hard MAX (cost) and per-field limits (legibility). We do
 * NOT pad a short honest deck up to a target: a placeholder "Slide 9" on a deck
 * someone presents is worse than an 8-slide deck that tells its story. The model
 * now fills the count the story needs, so short is a real answer, not a failure.
 */
function normalise(raw: PlannedSlide[], max: number): PlannedSlide[] {
  return raw.slice(0, Math.min(max, MAX_SLIDES)).map((s) => {
    const f = s.fields ?? {}
    const trim = (v: unknown, m: number) => {
      const t = String(v ?? '').trim()
      return t ? t.slice(0, m) : undefined
    }
    return {
      role: ROLES.includes(s.role) ? s.role : 'point',
      purpose: trim(s.purpose, 120),
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
}

/**
 * Extra art direction per slide, on top of the chosen style. A cover and a
 * numbers slide want completely different weight even in the same look, and the
 * image model will not infer that from the words alone.
 */
export const roleDirection = (role: SlideRole): string => ({
  cover: 'This is the OPENING slide. The title dominates — the largest type in the whole deck. Nothing else competes with it. Generous empty space.',
  agenda: 'This is an AGENDA slide. A short numbered or listed set of chapters, evenly spaced, calm. No single item dominates.',
  section: 'This is a SECTION DIVIDER — it names the next chapter. The chapter name is large and centred with lots of empty space around it; nothing else on the slide. It should feel like a breath between chapters.',
  point: 'This is a body slide. One idea. The headline leads; any supporting lines sit quietly beneath it at a much smaller size.',
  numbers: 'This slide exists for ONE FIGURE. Set the headline enormous — it should fill a third of the frame on its own. The supporting line is small and sits directly underneath.',
  quote: 'This is a QUOTATION. Set it as a quote — larger, lighter, more space around it than a normal headline, with the attribution small and quiet beneath.',
  closing: 'This is the FINAL slide. Calm and uncluttered. The ask reads first; contact details are small and sit at the bottom.',
}[role] ?? 'This is a body slide. One idea, headline leading.')
