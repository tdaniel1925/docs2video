import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { scrubComplianceText, productTokens } from '../app/_lib/compliance'

/**
 * THE HALF OF THE SCRUB THAT WAS NEVER TESTED.
 *
 * `scrubComplianceText(input, extraTokens = [])` takes two arguments. Every
 * one of the nine calls in compliance-guarantee-sense.test.ts passes ONE —
 * so `extraTokens` was always `[]`, the `nameRegexes(extraTokens)` loop never
 * had anything to remove, and the name-removal branch never ran. Production
 * always passes the second argument.
 *
 * So the part that actually strips carrier and product names — the reason the
 * module exists — had no test at all, and neither did the grammar repair that
 * only fires once a name HAS been removed. Every blocked name could have
 * leaked while that file stayed green.
 *
 * These call it the way production does.
 */
const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('names are actually removed', () => {
  it('removes a product name passed as an extra token', () => {
    /* The branch that was never entered. */
    const out = scrubComplianceText('Income Advantage builds cash value over time.', ['income advantage'])
    expect(out.toLowerCase(), 'the product name survived the scrub').not.toContain('income advantage')
    expect(out.length, 'the whole sentence was destroyed').toBeGreaterThan(10)
  })

  it('removes a carrier from the blocklist without being told', () => {
    /* CARRIER_BLOCKLIST is built in, so this needs no extra token. */
    const out = scrubComplianceText('Mutual of Omaha pays the death benefit.')
    expect(out.toLowerCase()).not.toContain('mutual of omaha')
    expect(out.toLowerCase()).toContain('death benefit')
  })

  it('leaves "guaranteed column" alone, which is the whole point of the other file', () => {
    /* Both halves have to hold at once: names go, accurate contract language
       stays. Tested here WITH tokens, which the other file never does. */
    const out = scrubComplianceText(
      'The guaranteed column shows what Income Advantage must do.',
      ['income advantage'],
    )
    expect(out.toLowerCase()).not.toContain('income advantage')
    expect(out.toLowerCase(), 'the contract term was scrubbed too').toContain('guaranteed column')
  })
})

describe('the sentence still reads like English afterwards', () => {
  /*
   * The repair only runs when a name was ACTUALLY removed — which, with an
   * empty token list, never happened. So none of this was covered either.
   */
  it('drops an article left dangling by the removal', () => {
    /* "The Income Advantage gives you…" must not become "The gives you…" */
    const out = scrubComplianceText('The Income Advantage gives you flexibility.', ['income advantage'])
    expect(out).not.toMatch(/^The\s+gives/i)
    expect(out.toLowerCase()).toContain('flexibility')
  })

  it('does NOT drop an article when nothing was removed', () => {
    /*
     * The documented failure this guard exists for: applying the repair
     * unconditionally turned "The guaranteed column shows…" into "Guaranteed
     * column shows…" on every scrubbed sentence that opened with an article.
     */
    const out = scrubComplianceText('The policy value grows each year.')
    expect(out).toMatch(/^The policy value/)
  })

  it('clears a possessive stranded by the removal', () => {
    /* "Mutual of Omaha's plan" would otherwise leave "'s plan". */
    const out = scrubComplianceText("Mutual of Omaha's plan covers you.")
    expect(out).not.toMatch(/^['’]s/)
    expect(out.toLowerCase()).toContain('plan covers you')
  })

  it('does not leave double spaces or floating punctuation', () => {
    const out = scrubComplianceText('Your Income Advantage , issued today, is active.', ['income advantage'])
    expect(out, 'double space left behind').not.toMatch(/ {2}/)
    expect(out, 'space before punctuation').not.toMatch(/\s[,.]/)
  })

  it('capitalises the first letter after a leading name is removed', () => {
    const out = scrubComplianceText('Income Advantage builds value.', ['income advantage'])
    expect(out[0], `got: ${out}`).toBe(out[0].toUpperCase())
  })
})

describe('it cannot be talked into mangling a document', () => {
  it('survives a regex-special token', () => {
    /* Tokens come from customer documents, so they can contain anything. */
    expect(() => scrubComplianceText('A (Plus+) policy.', ['(plus+)'])).not.toThrow()
  })

  it('leaves text alone when the token is not present', () => {
    const input = 'Your coverage continues to age 121.'
    expect(scrubComplianceText(input, ['income advantage'])).toBe(input)
  })

  it('handles an empty or non-string input without throwing', () => {
    expect(scrubComplianceText('', ['x'])).toBe('')
    expect(() => scrubComplianceText(null as unknown as string, ['x'])).not.toThrow()
  })

  it('works with the tokens productTokens actually produces', () => {
    /* End to end: the real token source, not a hand-written list. */
    const tokens = productTokens('Income Advantage IUL Illustration')
    const out = scrubComplianceText('The Income Advantage IUL is shown here.', tokens)
    expect(out.toLowerCase()).not.toContain('income advantage')
  })
})

describe('production passes the tokens', () => {
  /*
   * THE ASSERTION THAT EXPLAINS WHY THIS FILE EXISTS. The tests above prove
   * the two-argument path works. This proves production uses it — which is
   * the difference between the old file and this one.
   */
  it('generate-video sends tokens, not the default empty list', () => {
    const route = code(src('app/api/generate-video/route.ts'))
    expect(route).toMatch(/scrubComplianceText\([^)]+,\s*\w+\)/)
  })
})
