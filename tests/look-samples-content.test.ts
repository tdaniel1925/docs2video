import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { CARRIER_BLOCKLIST, normalizeForMatch } from '../app/_lib/compliance'
import * as SAMPLE from '../scripts/look-samples/sample-content'

// The look sample pictures on step 3 ("Make it yours") and the marketing site
// are seen by every customer. They used to show real names (a real company,
// a real insurance product, real people). They are now drawn only from
// scripts/look-samples/sample-content.ts — this test keeps real names out of it.

const ROOT = path.join(__dirname, '..')

/** Names that were on the old pictures, plus every carrier/product the
 *  compliance scrub knows about. */
const BANNED = [
  'PubcoZone', 'Pubco', 'Valor', 'QoL Max', 'Accumulator', 'Sarah Bennett', 'Trent Daniel',
  'AI in Church', 'ACME', 'EPOCH',
  ...CARRIER_BLOCKLIST,
]

/** Whole-word, case-insensitive, after the same look-alike folding the scrub uses. */
function realNamesIn(text: string): string[] {
  const hay = normalizeForMatch(text)
  return BANNED.filter((name) => {
    const n = normalizeForMatch(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${n}($|[^a-z0-9])`).test(hay)
  })
}

describe('look sample content has no real names', () => {
  it('the checker really catches a real name (so a pass means something)', () => {
    expect(realNamesIn('Welcome to PubcoZone')).toEqual(expect.arrayContaining(['PubcoZone']))
    expect(realNamesIn('QoL Max Accumulator+ III')).toEqual(expect.arrayContaining(['QoL Max', 'Accumulator', 'qol']))
    expect(realNamesIn('Prepared by sarah bennett')).toContain('Sarah Bennett')
    expect(realNamesIn('A policy from Transamerica')).toContain('transamerica')
    // Ordinary words that merely contain a short name are fine.
    expect(realNamesIn('Your coverage plan')).toEqual([])
  })

  it('the sample story itself is clean', () => {
    expect(realNamesIn(JSON.stringify(SAMPLE))).toEqual([])
  })

  it('the sample source files are clean', () => {
    for (const f of ['scripts/look-samples/sample-content.ts']) {
      expect(realNamesIn(readFileSync(path.join(ROOT, f), 'utf8')), f).toEqual([])
    }
  })

  it('the samples carry no logo and no photo', () => {
    const s = JSON.stringify(SAMPLE)
    expect(s).not.toMatch(/logo|photo|\.png|\.jpe?g|https?:/i)
  })
})
