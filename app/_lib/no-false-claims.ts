// =============================================================================
// The assistant must not say it made something it has not made.
//
// WHAT WENT WRONG. Before a single format had been picked, before any style,
// before any photo, the assistant said:
//
//   "Here's your webinar flyer for September 1st — let me know if you want to
//    add a registration link, price, or your logo!"
//
// There was no flyer. Nothing had been drawn and nothing had been charged. It
// was writing the sentence a designer would write, because that is what it was
// asked to sound like.
//
// This is the worst class of bug in the whole app. It is not a broken button
// somebody can work around — it makes the app a liar, and a customer who is
// told their flyer is ready and cannot find it does not conclude "odd wording",
// they conclude the thing they paid for is broken or gone.
//
// WHY THIS IS CODE AND NOT A PROMPT LINE. A rule in a prompt is a request. A
// model that is asked to be warm and conversational, and is also told not to
// say a particular kind of warm conversational sentence, will say it anyway —
// not often, but often enough, and the failure is invisible to us and obvious
// to the customer. The app KNOWS whether a design exists. That fact is not a
// matter of opinion, so it should not be left to one.
//
// Same shape as reading the words back off a finished image: the model is asked
// to do the judgement, and the CODE checks the one thing that has a right
// answer.
// =============================================================================

/**
 * The things this app makes. A claim only counts as a claim if it is attached
 * to one of these.
 */
// The trailing `s?` matters: "here are your designS" slipped through the first
// version because the pattern demanded a word boundary straight after "design".
const THING = '(?:flyer|poster|design|card|graphic|artwork|deck|slide|banner|postcard|sign|sell ?sheet|rack card|door hanger|table tent)s?'

/** Up to two words of padding — "your new webinar flyer", "the finished card". */
const PADDING = '(?:\\w+[\\s-]+){0,3}'

/**
 * Ways of saying "here is the thing I made for you".
 *
 * EVERY ONE OF THESE REQUIRES A DESIGN WORD, and that is the whole lesson of
 * the first version. I wrote these patterns loosely — "here's your", "I've
 * made", "take a look at" — and my own tests passed, because I had chosen the
 * sentences I tested against. Ten honest replies put through it afterwards
 * were ALL rewritten:
 *
 *   "Here's a thought — do you want a price on it?"
 *   "I've made a note of the date."
 *   "Take a look at the formats below."
 *   "All set — just pick a format."
 *
 * A guard that mangles correct sentences is worse than no guard: it makes the
 * assistant stilted, and everybody learns to ignore what it says. So the bar is
 * now "claims a FLYER exists", not "sounds a bit finished".
 *
 * "All done" and "hope you like it" are gone entirely. Both can be perfectly
 * honest before anything is drawn, and neither can be tied to a design word
 * without contorting them.
 */
const CLAIMS = [
  new RegExp(`\\bhere(?:'s| is|\\s+are)\\s+(?:your|the|a|an)\\s+${PADDING}${THING}\\b`, 'i'),
  new RegExp(`\\bi(?:'ve| have)\\s+(?:made|created|designed|drawn|built|put together|finished|generated)\\s+(?:you\\s+)?(?:your|the|a|an)?\\s*${PADDING}${THING}\\b`, 'i'),
  new RegExp(`\\bi\\s+(?:made|created|designed|drew|built|generated)\\s+(?:you\\s+)?(?:your|the|a|an)\\s+${PADDING}${THING}\\b`, 'i'),
  new RegExp(`\\byour\\s+${PADDING}${THING}\\s+(?:is|are)\\s+(?:ready|done|finished|complete|all set)\\b`, 'i'),
  new RegExp(`\\b(?:take a look at|check out|have a look at)\\s+(?:your|the)\\s+${PADDING}${THING}\\b`, 'i'),
  new RegExp(`\\b${THING}\\s+(?:is|are)\\s+(?:ready|done|finished|complete)\\b`, 'i'),
]

export type ClaimCheck = {
  /** The reply as it should be shown. */
  reply: string
  /** Did we have to step in? Worth logging: it means the prompt is not holding. */
  corrected: boolean
  /** What tripped it, for the log. */
  matched?: string
}

/**
 * Take out any claim that a design exists, when none does.
 *
 * Only runs when the app knows there is NOTHING on screen. Once a design has
 * been made, "here's your flyer" is simply true and must be left alone — a
 * check that fires on a correct sentence trains everyone to ignore it.
 *
 * Replaces rather than deletes. A reply cut off mid-thought reads as a broken
 * app, which is the impression we are here to avoid.
 */
export function stripFalseDelivery(reply: string, designCount: number, nextStep?: string): ClaimCheck {
  const text = String(reply ?? '').trim()
  if (designCount > 0 || !text) return { reply: text, corrected: false }

  const hit = CLAIMS.find((re) => re.test(text))
  if (!hit) return { reply: text, corrected: false }

  // SAY WHAT IS ACTUALLY TRUE. It has understood the brief; it has not drawn
  // anything. Naming the next step turns a correction into something useful,
  // rather than an apology for a sentence the customer never saw.
  const honest = nextStep
    ? `Got all that. Nothing is drawn yet — ${nextStep} and then press Make.`
    : 'Got all that. Nothing is drawn yet — press Make when you are ready.'

  return { reply: honest, corrected: true, matched: hit.source }
}
