import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { stripCarrierFromScenes } from '../app/_lib/compliance'

/**
 * F18 — THE CARRIER'S NAME NEVER REACHES A SLIDE.
 *
 * THIS TEST USED TO BE A LIE, and it is worth writing down exactly how,
 * because it is the most dangerous false green found in the audit.
 *
 * It defined its OWN private copy of the stripping logic at the top of this
 * file and tested that copy. The real thing was twenty identical lines inline
 * inside generate-video's POST handler, imported by nothing. Delete the
 * production block and all five tests stayed green — while every carrier name
 * shipped into slide headlines, bullets and stat labels, on the one path where
 * a carrier name reaching a customer is a compliance failure.
 *
 * The logic now lives in app/_lib/compliance, the route calls it, and this
 * file imports it. The cases below are the original ones, unchanged: they were
 * good cases pointed at the wrong function.
 *
 * The last block is the part that stops this happening again.
 */
const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
/** Source minus comments — this file's own notes name what they forbid. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('stripCarrierFromScenes (F18)', () => {
  it('strips carrier name from slidePrompt', () => {
    const scenes = [{
      scene: 1,
      slidePrompt: 'A beautiful slide showing Prudential life insurance benefits',
      narration: 'This policy from Prudential offers great coverage',
      slideData: { headline: 'Coverage Overview', bullets: [], stats: [] },
    }]
    const policyData = { carrier: 'Prudential', policyType: 'Whole Life' }

    const result = stripCarrierFromScenes(scenes, policyData)
    expect(result[0].slidePrompt).toBe('A beautiful slide showing the carrier life insurance benefits')
    // Narration is NOT stripped here — scrubComplianceText handles that, with
    // the wider blocklist and the grammar repair afterwards.
    expect(result[0].narration).toContain('Prudential')
  })

  it('strips carrier name from slideData headline', () => {
    const scenes = [{
      scene: 1,
      slidePrompt: 'overview slide',
      slideData: {
        headline: 'Your Prudential Policy Overview',
        bullets: ['Prudential guarantees the death benefit'],
        stats: [{ label: 'Prudential Rating', value: 'A++' }],
      },
    }]
    const policyData = { carrier: 'Prudential' }

    const result = stripCarrierFromScenes(scenes, policyData)
    expect(result[0].slideData.headline).toBe('Your the carrier Policy Overview')
    expect(result[0].slideData.bullets[0]).toBe('the carrier guarantees the death benefit')
    expect(result[0].slideData.stats[0].label).toBe('the carrier Rating')
  })

  it('is case-insensitive', () => {
    const scenes = [{
      scene: 1,
      slidePrompt: 'NATIONWIDE policy details',
      slideData: { headline: 'nationwide benefits', bullets: [], stats: [] },
    }]
    const policyData = { carrier: 'Nationwide' }

    const result = stripCarrierFromScenes(scenes, policyData)
    expect(result[0].slidePrompt).toBe('the carrier policy details')
    expect(result[0].slideData.headline).toBe('the carrier benefits')
  })

  it('does nothing when no carrier in policyData', () => {
    const scenes = [{
      scene: 1,
      slidePrompt: 'generic slide',
      slideData: { headline: 'Test', bullets: ['Point 1'], stats: [] },
    }]
    const policyData = { title: 'Report', sections: [] }

    const result = stripCarrierFromScenes(scenes, policyData)
    expect(result[0].slidePrompt).toBe('generic slide')
    expect(result[0].slideData.headline).toBe('Test')
  })

  it('handles carrier names with special regex characters', () => {
    const scenes = [{
      scene: 1,
      slidePrompt: 'Policy from New York Life (NYL) details',
      slideData: { headline: 'New York Life (NYL) Overview', bullets: [], stats: [] },
    }]
    const policyData = { carrier: 'New York Life (NYL)' }

    const result = stripCarrierFromScenes(scenes, policyData)
    expect(result[0].slidePrompt).toBe('Policy from the carrier details')
    expect(result[0].slideData.headline).toBe('the carrier Overview')
  })
})

describe('the edges a customer file will actually hit', () => {
  /* A carrier name is customer data — whatever their carrier happens to be —
     so it is not in any blocklist and these are the shapes it arrives in. */

  it('survives a carrier with a regex-special name without mangling the text', () => {
    /* Unescaped, "A.M. Best" would match "ABM Best", "A1M-Best" and more. */
    const scenes = [{ slidePrompt: 'Rated by A.M. Best and by ABM Best', slideData: {} }]
    stripCarrierFromScenes(scenes, { carrier: 'A.M. Best' })
    expect(scenes[0].slidePrompt).toBe('Rated by the carrier and by ABM Best')
  })

  it('ignores a one-character carrier', () => {
    /* A single letter would replace half the alphabet. */
    const scenes = [{ slidePrompt: 'A policy summary', slideData: { headline: 'A' } }]
    stripCarrierFromScenes(scenes, { carrier: 'A' })
    expect(scenes[0].slidePrompt).toBe('A policy summary')
  })

  it('leaves a scene with no slideData alone', () => {
    const scenes = [{ slidePrompt: 'Prudential overview' }] as { slidePrompt?: string; slideData?: Record<string, unknown> }[]
    expect(() => stripCarrierFromScenes(scenes, { carrier: 'Prudential' })).not.toThrow()
    expect(scenes[0].slidePrompt).toBe('the carrier overview')
  })

  it('leaves a non-string bullet or stat alone rather than crashing', () => {
    /* The model does occasionally return a number or a null in these arrays. */
    const scenes = [{
      slidePrompt: '',
      slideData: {
        bullets: ['Prudential pays', 42, null],
        stats: [{ label: 'Prudential', value: 1200 }, null],
      },
    }] as { slidePrompt?: string; slideData?: Record<string, unknown> }[]
    expect(() => stripCarrierFromScenes(scenes, { carrier: 'Prudential' })).not.toThrow()
    const d = scenes[0].slideData as { bullets: unknown[]; stats: { label: unknown; value: unknown }[] }
    expect(d.bullets[0]).toBe('the carrier pays')
    expect(d.bullets[1]).toBe(42)
    expect(d.stats[0].value).toBe(1200)
  })

  it('handles no scenes, and a null policy, without throwing', () => {
    expect(() => stripCarrierFromScenes([], { carrier: 'Prudential' })).not.toThrow()
    expect(() => stripCarrierFromScenes([{ slidePrompt: 'x' }], null)).not.toThrow()
    expect(() => stripCarrierFromScenes([{ slidePrompt: 'x' }], undefined)).not.toThrow()
  })

  it('strips every occurrence, not just the first', () => {
    const scenes = [{ slidePrompt: 'Prudential and Prudential again', slideData: {} }]
    stripCarrierFromScenes(scenes, { carrier: 'Prudential' })
    expect(scenes[0].slidePrompt).toBe('the carrier and the carrier again')
  })
})

describe('the route actually calls it', () => {
  /*
   * THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL BUG.
   *
   * Everything above tests a function. None of it proves the function is
   * WIRED IN — and that was the entire defect: a correct implementation,
   * tested, that production did not use.
   */
  const route = code(src('app/api/generate-video/route.ts'))

  it('imports the shared function', () => {
    expect(route).toMatch(/import \{[^}]*stripCarrierFromScenes[^}]*\} from '\.\.\/\.\.\/_lib\/compliance'/)
  })

  it('calls it on the scenes before they are rendered', () => {
    expect(route, 'the carrier strip is no longer called').toMatch(/stripCarrierFromScenes\(scenes/)
  })

  it('does not keep a second private copy of the logic', () => {
    /*
     * The shape of the original bug: the same twenty lines in two places, one
     * tested and one used. If this string appears in the route again, someone
     * has re-inlined it.
     */
    expect(route, 'the logic has been inlined into the route again')
      .not.toMatch(/const carrierRegex = new RegExp/)
  })

  it('and neither does this test file', () => {
    /* The original sin, asserted against itself. */
    const self = code(src('tests/carrier-name-strip.test.ts'))
    /* A DEFINITION, not the import or a call. `function stripCarrier…` alone
       also matched `import { stripCarrierFromScenes }` on the first line,
       which made this fail against a correct file. Caught by running it. */
    expect(self, 'this test has grown its own copy of the logic again')
      .not.toMatch(/(function|const)\s+stripCarrierFromScenes\s*[=(]/)
    expect(self, 'this test builds its own carrier regex again')
      .not.toMatch(/new RegExp\(carrierName/)
  })
})
