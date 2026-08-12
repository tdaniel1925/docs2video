import { describe, it, expect } from 'vitest'
import { stripFalseDelivery } from '../no-false-claims'

// =============================================================================
// The sentence that started this, verbatim:
//
//   "Here's your webinar flyer for September 1st — let me know if you want to
//    add a registration link, price, or your logo!"
//
// No format had been picked. No style, no photos. Nothing had been drawn and
// nothing had been charged. The assistant simply wrote the sentence a designer
// would write.
//
// Two things have to be true for the fix to be worth anything, and the SECOND
// is the one that is easy to get wrong: it has to catch the lie, AND it has to
// leave the identical sentence alone once it is true. A check that fires on a
// correct sentence gets ignored, and then it protects nothing.
// =============================================================================

describe('it must not claim a design that does not exist', () => {
  const REAL = "Here's your webinar flyer for September 1st — let me know if you want to add a registration link, price, or your logo!"

  it('catches the exact sentence that shipped', () => {
    const r = stripFalseDelivery(REAL, 0)
    expect(r.corrected).toBe(true)
    expect(r.reply).not.toMatch(/here's your/i)
  })

  it('leaves that same sentence alone once a design really exists', () => {
    const r = stripFalseDelivery(REAL, 1)
    expect(r.corrected).toBe(false)
    expect(r.reply).toBe(REAL)
  })

  it('catches the other ways of saying it', () => {
    for (const said of [
      "I've created your flyer!",
      'I made you a poster.',
      'Your flyer is ready.',
      'Take a look at your design.',
      'Here are your designs.',
      'I have designed a business card for you.',
    ]) {
      expect(stripFalseDelivery(said, 0).corrected, said).toBe(true)
    }
  })

  it('leaves honest sentences alone', () => {
    // EVERY ONE OF THESE WAS REWRITTEN BY MY FIRST ATTEMPT.
    //
    // I wrote the patterns loosely — "here's your", "I've made", "take a look
    // at" — and the tests above passed, because I had chosen the sentences I
    // tested against. Ten honest replies run through it afterwards were all
    // mangled. A guard that breaks correct sentences is worse than no guard:
    // it makes the assistant stilted and teaches everyone to ignore it.
    //
    // So this list is the real test, and it is longer than the list of lies on
    // purpose.
    for (const said of [
      "Here's a thought — do you want a price on it?",
      "Here's an idea: put the phone number bigger.",
      "Here's the thing — a business card cannot hold that much text.",
      "Here's a question: is this for print or for Instagram?",
      "I've made a note of the date.",
      'I made a change to the headline wording.',
      "I've designed things like this before — it will work.",
      'Take a look at the formats below.',
      'Check out the styles and pick one.',
      'All set — just pick a format.',
      'All done — anything else to change?',
      'Hope you like it!',
      'Got it — a webinar flyer for 1 September. Pick a format and press Make.',
      'That will look good in a warm, hand-lettered style.',
      'I can put your logo in the bottom corner.',
      'Bleed is the extra edge a printer trims off.',
      'Do you want a price on it?',
      'Here we go — which format?',
    ]) {
      expect(stripFalseDelivery(said, 0).corrected, said).toBe(false)
    }
  })

  /**
   * A GAP, WRITTEN DOWN RATHER THAN PAPERED OVER.
   *
   * "All done!" and "Hope you like it!" ARE lies when nothing has been drawn.
   * They are also perfectly honest right after a field has been changed — the
   * same words, both times. Nothing in the sentence itself tells them apart, so
   * this cannot catch them without also mangling the honest version, and
   * mangling honest replies is the exact failure that makes a guard worthless.
   *
   * Left alone deliberately. The prompt asks the assistant not to end on a
   * flourish; this does not enforce it. If they start showing up for real, the
   * answer is to change the prompt so it stops signing off at all — not to
   * widen the net until it catches correct sentences too.
   */
  it('admits what it cannot judge from words alone', () => {
    expect(stripFalseDelivery('All done!', 0).corrected).toBe(false)
    expect(stripFalseDelivery('Hope you like it!', 0).corrected).toBe(false)
  })

  it('catches the plural, which the first version let through', () => {
    // "designs" failed because the pattern demanded a word boundary straight
    // after "design". Found by running the lies back through after fixing the
    // false positives — the fix for one direction broke the other.
    expect(stripFalseDelivery('Here are your designs.', 0).corrected).toBe(true)
    expect(stripFalseDelivery('Your slides are ready.', 0).corrected).toBe(true)
  })

  it('says what is true and what happens next', () => {
    const r = stripFalseDelivery(REAL, 0, 'pick a format')
    expect(r.reply).toMatch(/nothing is drawn yet/i)
    expect(r.reply).toMatch(/pick a format/i)
    // Never cut off mid-thought: a truncated reply reads as a broken app,
    // which is the impression the whole thing exists to avoid.
    expect(r.reply.endsWith('.')).toBe(true)
  })

  it('does not choke on an empty reply', () => {
    expect(stripFalseDelivery('', 0).reply).toBe('')
    expect(stripFalseDelivery('   ', 0).corrected).toBe(false)
  })
})
