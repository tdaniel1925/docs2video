import { describe, it, expect } from 'vitest'
import { scrubComplianceText } from '../app/_lib/compliance'

/**
 * Guarantee-language scrub: promise vs. term of art.
 *
 * The scrub softens promissory "guaranteed" so nothing implies a guaranteed
 * result. But on an insurance illustration, "the guaranteed column" is the NAME
 * of the contractual-minimum ledger. Substituting "projected" there inverts the
 * meaning and produces the single most dangerous sentence you can show a
 * client — a claim that projected values are contractually owed.
 *
 * This regression exists because that shipped: a real illustration deck
 * rendered "the guaranteed column is what the contract must do" as
 * "the projected column is what the contract must do", and the leak checker
 * passed it, because no blocked NAME had survived — nothing verified meaning.
 */
describe('scrubComplianceText — guarantee language', () => {
  describe('keeps illustration terms of art literal', () => {
    const cases = [
      'The guaranteed column is what the contract must do.',
      'The guaranteed column shows $5,500 at year ten.',
      'Compare the guaranteed columns against the projected ones.',
      'The guaranteed element is the contractual floor.',
      'Values on the guaranteed basis are lower.',
      'Read the guaranteed ledger before you decide.',
    ]
    for (const input of cases) {
      it(`preserves: ${input.slice(0, 44)}…`, () => {
        const out = scrubComplianceText(input)
        expect(out).toContain('guaranteed')
        expect(out).not.toContain('projected column')
        expect(out).not.toContain('assurance')
      })
    }

    it('never claims projections are contractually owed', () => {
      const out = scrubComplianceText('The guaranteed column is what the contract must do.')
      expect(out).not.toMatch(/projected column is what the contract must do/i)
    })

    it('keeps the two columns distinguishable in one sentence', () => {
      const out = scrubComplianceText(
        'The illustration projects $84,900; the guaranteed column shows $5,500.')
      expect(out).toContain('guaranteed column')
      expect(out).toContain('$84,900')
      expect(out).toContain('$5,500')
    })
  })

  describe('still softens promissory use', () => {
    it('rewrites a bare guarantee promise', () => {
      expect(scrubComplianceText('Returns are 100% guaranteed.')).not.toContain('guaranteed')
    })

    it('rewrites the noun form', () => {
      expect(scrubComplianceText('We offer guarantees you can count on.')).toContain('assurance')
    })

    it('drops the promise word but keeps the concept', () => {
      const out = scrubComplianceText('A guaranteed minimum floor protects you.')
      expect(out).not.toMatch(/\bguaranteed\b/)
      expect(out.toLowerCase()).toContain('minimum floor')
    })

    it('strips risk-free claims', () => {
      expect(scrubComplianceText('This is a risk-free investment.').toLowerCase())
        .not.toContain('risk-free')
    })
  })

  describe('accurate disclaimers survive', () => {
    it('rewrites non-guaranteed to illustrated rather than inverting it', () => {
      const out = scrubComplianceText('These values are non-guaranteed.')
      expect(out.toLowerCase()).toContain('illustrated')
    })

    it('handles "not guaranteed" the same way', () => {
      const out = scrubComplianceText('Projected values are not guaranteed.')
      expect(out.toLowerCase()).toContain('illustrated')
      expect(out.toLowerCase()).not.toContain('not projected')
    })
  })
})
