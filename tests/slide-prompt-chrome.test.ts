import { describe, it, expect } from 'vitest'
import { buildSimpleSlidePrompt, getStylePrompt } from '../app/_lib/slide-engine/simple-prompt'

/**
 * Slide-prompt chrome: things the model must NOT be told to draw.
 *
 * Both regressions here shipped and were visible in generated decks:
 *
 *  1. `Slide 3 of 6.` was pushed into contentLines — the same list as the
 *     headline and bullets — directly above "Show only the text listed above".
 *     The model correctly treated it as copy and printed it on every slide of
 *     every template.
 *
 *  2. The logo-corner reservation was emitted unconditionally. With no logo to
 *     composite (the video pipeline never sends one), the model drew a literal
 *     blank white plaque in the top-right of every slide and nothing covered it.
 */
const base = {
  stylePrompt: getStylePrompt('steampunk'),
  brandColors: { primary: '#D4A843', secondary: '#8C5A2B' },
  headline: 'What It Becomes',
  pageNumber: 3,
  totalPages: 6,
} as const

describe('buildSimpleSlidePrompt — deck position', () => {
  it('does not put the slide number in the render list', () => {
    const p = buildSimpleSlidePrompt({ ...base, type: 'content' })
    const renderBlock = p.split('CONTEXT (background for you')[0]
    expect(renderBlock).not.toMatch(/Slide \d+ of \d+/i)
  })

  it('still tells the model where it is, as context', () => {
    const p = buildSimpleSlidePrompt({ ...base, type: 'content' })
    const contextBlock = p.split('CONTEXT (background for you')[1] ?? ''
    expect(contextBlock).toMatch(/slide 3 of 6/i)
  })

  it('explicitly forbids drawing page furniture', () => {
    const p = buildSimpleSlidePrompt({ ...base, type: 'content' })
    expect(p).toMatch(/do not draw slide numbers/i)
  })
})

describe('buildSimpleSlidePrompt — logo corner', () => {
  it('reserves the corner when a logo is coming', () => {
    const p = buildSimpleSlidePrompt({ ...base, type: 'content', hasLogo: true })
    expect(p).toMatch(/top-right corner clear/i)
  })

  it('does NOT reserve the corner with no logo', () => {
    const p = buildSimpleSlidePrompt({ ...base, type: 'content', hasLogo: false })
    expect(p).not.toMatch(/top-right corner/i)
  })

  it('defaults to not reserving when the flag is absent', () => {
    const p = buildSimpleSlidePrompt({ ...base, type: 'content' })
    expect(p).not.toMatch(/top-right corner/i)
  })
})

describe('buildSimpleSlidePrompt — content still renders', () => {
  it('keeps the headline and figures in the render list', () => {
    const p = buildSimpleSlidePrompt({
      ...base, type: 'content',
      stats: [{ label: 'Projected cash value', value: '$176,204' }],
    })
    const renderBlock = p.split('CONTEXT (background for you')[0]
    expect(renderBlock).toContain('What It Becomes')
    expect(renderBlock).toContain('$176,204')
  })

  it('keeps contact details on the closing slide', () => {
    const p = buildSimpleSlidePrompt({
      ...base, type: 'closing', headline: 'Let’s Talk',
      contactInfo: { phone: '1-555-014-2200', email: 'Agent@Example.com' },
    })
    expect(p).toContain('1-555-014-2200')
    expect(p).toContain('agent@example.com')
  })
})
