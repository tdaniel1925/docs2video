import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { LOGO_SPACE, logoRect, logoSpacePrompt } from '../app/_lib/logo-space'

/**
 * THE RESERVED LOGO CORNER.
 *
 * A real logo is never drawn by the image model — the prompt holds a corner
 * open and sharp pastes the file into it afterwards. The failure this guards
 * is not a crash: it is a logo landing on top of a number, or an AI-invented
 * brand mark shipping to a customer.
 */
const ROOT = join(__dirname, '..')
const space = readFileSync(join(ROOT, 'app/_lib/logo-space.ts'), 'utf8')
const engine = readFileSync(join(ROOT, 'app/_lib/slide-engine.ts'), 'utf8')

describe('the prompt and the paste describe the same rectangle', () => {
  it('quotes the real percentages rather than typed ones', () => {
    /*
     * THE BUG THIS PREVENTS. If the sentence says 22% and the composite uses
     * 30%, the logo lands outside the space the model held open — on top of
     * whatever is there. Both read LOGO_SPACE, so the figures in the prompt
     * are generated from it.
     */
    const p = logoSpacePrompt()
    expect(p).toContain(`${Math.round(LOGO_SPACE.w * 100)}% of the width`)
    expect(p).toContain(`${Math.round(LOGO_SPACE.h * 100)}% of the height`)
    expect(p).toContain(`${Math.round(LOGO_SPACE.margin * 100)}% in from the right`)
  })

  it('puts the box in the bottom-right, inside the canvas', () => {
    const { boxW, boxH, right, bottom } = logoRect(1920, 1088)
    expect(boxW).toBe(Math.round(1920 * LOGO_SPACE.w))
    expect(boxH).toBe(Math.round(1088 * LOGO_SPACE.h))
    /* The paste anchors at right/bottom minus the logo, so the box must sit
       wholly inside the frame. */
    expect(right).toBeLessThan(1920)
    expect(bottom).toBeLessThan(1088)
    expect(right - boxW).toBeGreaterThan(0)
    expect(bottom - boxH).toBeGreaterThan(0)
  })

  it('scales with the canvas, so every size gets the same relative spot', () => {
    const small = logoRect(1920, 1088)
    const big = logoRect(2752, 1536)
    expect(big.boxW / 2752).toBeCloseTo(small.boxW / 1920, 3)
  })
})

describe('the model is never asked to draw a logo', () => {
  it('forbids drawing one, in the same breath as reserving the space', () => {
    /*
     * The standing rule in this product: real uploaded logos only, never
     * AI-drawn. A prompt that reserves a corner without forbidding a drawn
     * mark gets one drawn somewhere else on the slide.
     */
    const p = logoSpacePrompt().toLowerCase()
    expect(p).toContain('do not draw a logo')
    expect(p).toMatch(/monogram|badge|emblem/)
  })

  it('names what may not enter the box, not just that it is "clear"', () => {
    /*
     * MEASURED. An earlier version said only "leave the bottom-right corner
     * clear" and the model DREW A WHITE RECTANGLE there — it read "clear" as
     * an object to make. Naming the content that must stay out gives a
     * genuinely empty corner: 0.6 pixel variation against 32.9 with no
     * instruction at all.
     */
    const p = logoSpacePrompt().toLowerCase()
    expect(p).toContain('no text')
    expect(p).toContain('plain background only')
    expect(p).toContain('placeholder box')
  })

  it('only holds the corner open when there IS a logo', () => {
    /* A slide with no logo should use its whole frame rather than keep a
       corner empty for nothing. */
    expect(engine).toContain('logo?.length ?')
    expect(engine).toContain('logoSpacePrompt()')
  })
})

describe('the engine', () => {
  it('asks Gemini for a size, because its default is below 1080p', () => {
    /*
     * Gemini returns 1376x768 unless imageConfig is sent — BELOW a 1080p
     * frame, so the video upscales it and the type goes soft. Measured at
     * 2752x1536 once asked.
     */
    expect(engine).toContain("imageConfig: { aspectRatio: '16:9', imageSize: '2K' }")
  })

  it('says so out loud when FAL_KEY is missing', () => {
    /*
     * Restylez lost days to this exact silence: the key was absent, the code
     * fell through to its second choice as designed, nothing was logged, and
     * every image quietly came from the worse provider until a customer
     * complained.
     */
    expect(engine).toContain('FAL_KEY is not set')
    expect(engine).toMatch(/warnedNoKey/)
  })

  it('falls through to the other engine rather than failing the job', () => {
    /* A worse picture beats no picture on work already paid for. */
    expect(engine).toMatch(/for \(const engine of order\)/)
    expect(engine).toContain('Both slide engines failed')
  })

  it('returns the slide unchanged if pinning the logo fails', () => {
    /* This runs at the END of work the customer has paid for. A slide
       without a logo is a small disappointment; a crash is a lost job. */
    expect(space).toMatch(/catch \(e\) \{[\s\S]*?return slidePng/)
  })
})
