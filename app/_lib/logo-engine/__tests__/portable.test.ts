import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  HOUSE_RULES, STYLE_STEERS, MARK_TYPES, ALL_RULE_IDS, buildLogoPrompt,
} from '../index'

// The logo engine is the piece worth lifting into a standalone product, so it
// imports nothing — same rule as the flyer engine, enforced the same way.
describe('logo engine stays portable', () => {
  it('imports nothing at all', () => {
    const src = readFileSync(join(process.cwd(), 'app/_lib/logo-engine/index.ts'), 'utf8')
    const imports = src.match(/^\s*(import\s|export\s+\*\s+from|const\s+\w+\s*=\s*require\()/gm) ?? []
    expect(imports, `engine gained ${imports.length} import(s)`).toEqual([])
  })
})

// The research depends on being able to change ONE thing at a time. If these
// break, the experiments stop measuring what they claim to.
describe('every part under test is separately addressable', () => {
  const brief = { name: 'THICKET', what: 'botanical skincare' }

  it('can drop exactly one house rule', () => {
    const all = buildLogoPrompt(brief, {})
    const minus = buildLogoPrompt(brief, { rules: ALL_RULE_IDS.filter((r) => r !== 'flat') })
    expect(all).toContain('FLAT VECTOR')
    expect(minus).not.toContain('FLAT VECTOR')
    // Everything else must survive, or the ablation measures two changes.
    expect(minus).toContain('ONE IDEA')
  })

  it('can swap only the style steer', () => {
    const studios = buildLogoPrompt(brief, { steer: 'studios' })
    const plain = buildLogoPrompt(brief, { steer: 'plain' })
    expect(studios).toContain('Chermayeff')
    expect(plain).not.toContain('Chermayeff')
    // The house rules must be identical either way.
    for (const r of HOUSE_RULES) {
      expect(studios.includes(r.text)).toBe(plain.includes(r.text))
    }
  })

  it('has a no-steer control to measure against', () => {
    expect(STYLE_STEERS.none).toBe('')
  })

  it('quotes the name exactly, and never invents extra words', () => {
    const p = buildLogoPrompt({ name: 'HALDEN & CO.', what: 'wealth' }, {})
    expect(p).toContain('"HALDEN & CO."')
    expect(p).toMatch(/EXACTLY as written/)
  })
})

describe('symbol-only mode really removes the lettering', () => {
  // The architecture worth testing: the model draws the symbol, code sets the
  // type. If the name leaks into a symbol-only prompt the experiment is void.
  const brief = { name: 'THICKET', what: 'botanical skincare' }

  it('never mentions the company name', () => {
    const p = buildLogoPrompt(brief, { symbolOnly: true })
    expect(p).not.toContain('THICKET')
    expect(p).toMatch(/NO lettering/)
  })

  it('still carries the craft rules', () => {
    expect(buildLogoPrompt(brief, { symbolOnly: true })).toContain('FLAT VECTOR')
  })
})

describe('the positioning word is direction, never copy', () => {
  // It was phrased "IT MUST SAY ONE THING: steady care", and the model printed
  // "steady care." under the monogram as a tagline. A feeling to design toward
  // must never read as words to set.
  const brief = { name: 'AFFINITY HEALTH GROUP', initials: 'AHG', what: 'clinics', positioning: 'steady care' }

  it('says outright that it is not text to render', () => {
    const p = buildLogoPrompt(brief, { monogramStyle: 'interlock' })
    expect(p).toMatch(/NOT text to render/)
    expect(p).toMatch(/must appear nowhere in the image/)
  })

  it('never phrases it as something the logo should SAY', () => {
    expect(buildLogoPrompt(brief, {})).not.toMatch(/MUST SAY/)
  })

  it('a monogram asks for the initials and nothing else', () => {
    const p = buildLogoPrompt(brief, { monogramStyle: 'stacked' })
    expect(p).toMatch(/NO tagline/)
    expect(p).toMatch(/NO company name/)
    // The full company name must not be in a monogram prompt at all.
    expect(p).not.toContain('AFFINITY HEALTH GROUP')
  })
})

describe('colour stays flat, because gradients break two things at once', () => {
  const brief = { name: 'BOXWORTH', initials: 'BX', what: 'trading' }

  it('forbids gradients on every colour strategy', () => {
    for (const way of ['two-tone', 'overlap-blend', 'block', 'accent', 'duo-split'] as const) {
      const p = buildLogoPrompt(brief, { monogramStyle: 'interlock', colourWay: way })
      expect(p, `${way} allowed a gradient`).toMatch(/no gradients/i)
    }
  })

  it('builds the overlap colour from solid shapes, not transparency', () => {
    const p = buildLogoPrompt(brief, { monogramStyle: 'overlap', colourWay: 'overlap-blend' })
    expect(p).toMatch(/THIRD flat colour/)
  })
})

describe('mark types are distinct instructions', () => {
  it('a wordmark forbids a symbol and an emblem requires a container', () => {
    const brief = { name: 'HALDEN', what: 'wealth' }
    expect(buildLogoPrompt(brief, { markType: 'wordmark' })).toMatch(/No symbol, no icon/)
    expect(buildLogoPrompt(brief, { markType: 'emblem' })).toMatch(/contained shape/)
  })

  it('covers the six kinds a designer would actually choose between', () => {
    expect(MARK_TYPES.map((m) => m.id).sort()).toEqual(
      ['abstract', 'combination', 'emblem', 'monogram', 'pictorial', 'wordmark'])
  })
})
