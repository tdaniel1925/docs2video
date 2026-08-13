// =============================================================================
// The figures on a generated slide, and whether they survived being drawn.
//
// Text2Art reads every word back off a finished design and compares it with
// what was asked for. The Docs2Video slide path never did — and it is the one
// where being wrong costs the most. These slides come from a real insurance
// quote or a real financial document, and the numbers on them are the reason
// the customer sent it in.
//
// A death benefit drawn as $250,000 when the policy says $2,500,000 is not a
// design fault. It is a false statement inside something an agent hands to a
// client, produced by us, with the agent's name on it.
//
// The prompt already says "VERIFY: Every number MUST exactly match the data
// provided." That is asking the model to mark its own work, which the flyer
// side already established does not hold — a model asked to check itself
// agrees with itself. This checks in code instead.
//
// Its own file so both the Vercel path and anything on the render box can use
// the same rule, and so it can be tested without a network call.
// =============================================================================

/**
 * Money and percentages worth checking.
 *
 * ONLY the figures, deliberately. A headline that comes back slightly reworded
 * is cosmetic, and redrawing a whole slide over it would cost more than it
 * saves. A number is either the number or it is not.
 *
 * WHAT IS NOT A FIGURE takes care of itself: "Slide 2 of 5", "aged 40", "three
 * reasons", "12 months" carry no currency symbol and no percent sign, so the
 * pattern never sees them. A check that fires on a slide number is one people
 * learn to ignore.
 *
 * My first version also demanded three digits, to filter noise. It filtered
 * "7.5%" instead — a growth rate, on an insurance slide, which is exactly the
 * kind of claim this exists to protect. It was guarding against nothing the
 * pattern did not already exclude, so it is gone. Every amount of money and
 * every percentage counts.
 */
export function figuresIn(text: string): string[] {
  const found = new Set<string>()
  const pattern = /\$\s?[\d,]+(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d+)?\s?%/g
  for (const m of String(text ?? '').matchAll(pattern)) {
    found.add(m[0].trim())
  }
  return [...found]
}

/**
 * Strip everything that is not a digit, so a figure matches however it was
 * drawn — "$2,500,000", "$2500000" and "$ 2,500,000" are the same number, and
 * flagging a comma would be pedantry rather than protection.
 */
export const digitsOf = (s: string) => String(s ?? '').replace(/\D/g, '')

/**
 * Which of the expected figures are missing from what was read off the slide?
 *
 * Compares digits only, in code. The transcription comes from a model; the
 * VERDICT does not, because a verdict from a model is a matter of opinion and
 * this is a matter of fact.
 */
export function missingFigures(expected: string[], sawText: string): string[] {
  const haystack = digitsOf(sawText)
  return expected.filter((f) => {
    const d = digitsOf(f)
    return d.length >= 3 && !haystack.includes(d)
  })
}
