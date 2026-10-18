import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { scrubComplianceText, productTokens } from '../app/_lib/compliance'

/**
 * A NAME IS REMOVED ONLY AS A WHOLE WORD.
 *
 * Shipped slide-deck videos said "or inal illness", "The Long- Upside" and
 * "And an strategy". A source mentioning "Term Life" made "Term" a detected
 * product token; the strip pattern had a word boundary in FRONT of the name
 * but not BEHIND it, so it cut "term" out of "terminal" too. And ordinary
 * insurance words (Term, Long, Whole) were harvested as product names at all.
 *
 * The render service has its own copy of this scrub (render-service/slides.js,
 * scrubSlidePlan / productTokens). The last test keeps the two in step.
 */
describe('product-name scrub never cuts inside a word', () => {
  it('keeps "terminal" when "Term" is a detected token', () => {
    expect(scrubComplianceText('Covers chronic, critical or terminal illness.', ['term'])).toContain('terminal illness')
  })

  it('keeps words that merely start with a detected name', () => {
    const out = scrubComplianceText('An index strategy with long-lasting protection.', ['index', 'long'])
    expect(out).toContain('long-lasting')
  })

  it('still removes a blocklisted carrier next to a hyphen', () => {
    expect(scrubComplianceText('An AIG-backed policy with level premiums.', [])).not.toMatch(/aig/i)
  })

  it('keeps a hyphenated word whole when a detected token is inside it', () => {
    expect(scrubComplianceText('The Long-Term Upside of staying funded.', ['term'])).toContain('Long-Term Upside')
  })

  it('still removes the name when it stands alone', () => {
    const out = scrubComplianceText('Your Acme Protector policy builds value.', ['acme protector'])
    expect(out.toLowerCase()).not.toContain('acme protector')
  })

  it('does not harvest ordinary insurance words as product names', () => {
    const toks = productTokens('Term Life with a Long-Term Care rider and Whole Life options')
    for (const w of ['Term', 'Long', 'Whole']) expect(toks, `"${w}" was taken for a product name`).not.toContain(w)
  })

  it('the render service copy has the same whole-word rule', () => {
    const js = readFileSync(join(__dirname, '..', 'render-service', 'slides.js'), 'utf8')
    const scrub = js.slice(js.indexOf('function scrubSlidePlan'), js.indexOf('function scrubSlidePlan') + 1200)
    expect(scrub, 'slides.js strips names without the whole-word rule').toContain("blocked.has(t) ? 'a-z0-9' : 'a-z0-9-'")
    const app = readFileSync(join(__dirname, '..', 'app', '_lib', 'compliance.ts'), 'utf8')
    expect(app).toContain("blocked.has(t) ? 'a-z0-9' : 'a-z0-9-'")
    const stop = js.match(/const PRODUCT_STOP = (.*)/)
    expect(stop, 'slides.js has no shared PRODUCT_STOP list').toBeTruthy()
    const tokens = stop![1]
    for (const w of ['Term', 'Long', 'Whole']) expect(tokens, `slides.js would harvest "${w}"`).toMatch(new RegExp('[|(]' + w + '[|)]'))
  })
})
