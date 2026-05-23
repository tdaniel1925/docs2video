import { describe, it, expect } from 'vitest'
import { validateScript } from '../app/_lib/script-validator'

function makeScene(overrides: Record<string, any> = {}) {
  return {
    scene: 1,
    title: 'Test Scene',
    narration: 'This is a valid narration for the test scene that has enough characters to pass validation.',
    slidePrompt: 'A professional slide about testing',
    ...overrides,
  }
}

function makeValidScript(count = 3) {
  return Array.from({ length: count }, (_, i) =>
    makeScene({
      scene: i + 1,
      title: `Scene ${i + 1}`,
      narration: `This is the narration for scene ${i + 1}. It contains enough text to pass the minimum character requirements for validation.`,
    })
  )
}

describe('validateScript', () => {
  it('valid script passes', () => {
    const result = validateScript(makeValidScript())
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('empty scenes array fails', () => {
    const result = validateScript([])
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.code === 'MIN_SCENES')).toBe(true)
  })

  it('single scene fails minimum check', () => {
    const result = validateScript([makeScene()])
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.code === 'MIN_SCENES')).toBe(true)
  })

  it('scene missing narration fails', () => {
    const scenes = makeValidScript()
    scenes[1].narration = ''
    const result = validateScript(scenes)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.code === 'MISSING_NARRATION' && e.scene === 2)).toBe(true)
  })

  it('scene missing title fails', () => {
    const scenes = makeValidScript()
    scenes[0].title = ''
    const result = validateScript(scenes)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.code === 'MISSING_TITLE' && e.scene === 1)).toBe(true)
  })

  it('scene missing slidePrompt and slideData fails', () => {
    const scenes = makeValidScript()
    delete scenes[0].slidePrompt
    const result = validateScript(scenes)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.code === 'MISSING_SLIDE_PROMPT' && e.scene === 1)).toBe(true)
  })

  it('scene with slideData instead of slidePrompt passes', () => {
    const scenes = makeValidScript()
    delete scenes[0].slidePrompt
    scenes[0].slideData = { headline: 'Test', bullets: ['a', 'b'] }
    const result = validateScript(scenes)
    expect(result.ok).toBe(true)
  })

  it('scene with narration over 4000 chars fails', () => {
    const scenes = makeValidScript()
    scenes[1].narration = 'A'.repeat(4001)
    const result = validateScript(scenes)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.code === 'NARRATION_TOO_LONG' && e.scene === 2)).toBe(true)
  })

  it('insurance script without disclaimer fails when requireDisclaimer is true', () => {
    const scenes = makeValidScript()
    const result = validateScript(scenes, { requireDisclaimer: true })
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.code === 'MISSING_DISCLAIMER')).toBe(true)
  })

  it('insurance script with disclaimer passes', () => {
    const scenes = makeValidScript()
    scenes[2].narration = 'This product is subject to terms and conditions. Please review your policy carefully.'
    const result = validateScript(scenes, { requireDisclaimer: true })
    expect(result.ok).toBe(true)
  })

  it('non-insurance script without disclaimer passes', () => {
    const scenes = makeValidScript()
    const result = validateScript(scenes, { requireDisclaimer: false })
    expect(result.ok).toBe(true)
  })

  it('total narration under 100 chars fails', () => {
    const scenes = [
      makeScene({ narration: 'Short one.', title: 'A', scene: 1 }),
      makeScene({ narration: 'Short two.', title: 'B', scene: 2 }),
    ]
    const result = validateScript(scenes)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.code === 'NARRATION_TOO_SHORT_TOTAL')).toBe(true)
  })

  // --- WARNINGS ---

  it('banned phrase triggers warning not error', () => {
    const scenes = makeValidScript()
    scenes[0].narration = 'Please click here to learn more about our wonderful service offering for your business needs.'
    const result = validateScript(scenes)
    expect(result.ok).toBe(true)
    expect(result.warnings.some(w => w.code === 'BANNED_PHRASE' && w.scene === 1)).toBe(true)
  })

  it('short narration triggers warning', () => {
    const scenes = makeValidScript()
    scenes[1].narration = 'Very short text.'
    const result = validateScript(scenes)
    expect(result.ok).toBe(true)
    expect(result.warnings.some(w => w.code === 'SHORT_NARRATION' && w.scene === 2)).toBe(true)
  })

  it('narration approaching TTS limit triggers warning', () => {
    const scenes = makeValidScript()
    scenes[0].narration = 'A'.repeat(3500)
    const result = validateScript(scenes)
    expect(result.ok).toBe(true)
    expect(result.warnings.some(w => w.code === 'LONG_NARRATION' && w.scene === 1)).toBe(true)
  })

  it('contact info mismatch triggers warning', () => {
    const scenes = makeValidScript()
    scenes[1].narration = 'Call us at 555-123-4567 for more information about our complete range of services and products.'
    const result = validateScript(scenes, {
      contactInfo: { phone: '800-999-8888' },
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.some(w => w.code === 'CONTACT_MISMATCH' && w.scene === 2)).toBe(true)
  })

  it('matching contact info does not trigger warning', () => {
    const scenes = makeValidScript()
    scenes[1].narration = 'Call us at 800-999-8888 for more information about our complete range of services and products.'
    const result = validateScript(scenes, {
      contactInfo: { phone: '800-999-8888' },
    })
    expect(result.warnings.some(w => w.code === 'CONTACT_MISMATCH')).toBe(false)
  })

  it('more than 12 scenes triggers warning', () => {
    const scenes = makeValidScript(13)
    const result = validateScript(scenes)
    expect(result.ok).toBe(true)
    expect(result.warnings.some(w => w.code === 'TOO_MANY_SCENES')).toBe(true)
  })

  it('duplicate titles trigger warning', () => {
    const scenes = makeValidScript()
    scenes[1].title = scenes[0].title
    const result = validateScript(scenes)
    expect(result.ok).toBe(true)
    expect(result.warnings.some(w => w.code === 'DUPLICATE_TITLE')).toBe(true)
  })
})
