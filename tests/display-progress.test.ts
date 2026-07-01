import { describe, it, expect } from 'vitest'
import { displayProgress } from '../app/_lib/video-progress'

// Single source of truth for the building-% shown to users — the builder
// screen eases toward it and the dashboard shows it directly, so a mapping
// regression makes the two screens disagree again (the original bug).

describe('displayProgress', () => {
  it('never shows 0 — a just-started job shows a little movement', () => {
    expect(displayProgress(0)).toBe(5)
    expect(displayProgress(null)).toBe(5)
    expect(displayProgress(undefined)).toBe(5)
    expect(displayProgress(NaN)).toBe(5)
  })
  it('caps at 100 and floors early progress at 10', () => {
    expect(displayProgress(100)).toBe(100)
    expect(displayProgress(150)).toBe(100)
    expect(displayProgress(3)).toBe(10)
    expect(displayProgress(17)).toBe(17)
  })
  it('maps the coarse milestones to stable representative values', () => {
    expect(displayProgress(18)).toBe(25) // scripting
    expect(displayProgress(25)).toBe(25)
    expect(displayProgress(30)).toBe(65) // asset generation
    expect(displayProgress(60)).toBe(65)
    expect(displayProgress(90)).toBe(95) // finalizing
    expect(displayProgress(99)).toBe(95)
  })
  it('passes real frame % through during the render window, capped under finalize', () => {
    expect(displayProgress(72)).toBe(72)
    expect(displayProgress(87)).toBe(87) // the "stuck at 82" display value came from raw 87
    expect(displayProgress(89.6)).toBe(90)
    expect(displayProgress(89.9)).toBe(90)
  })
  it('is monotonic non-decreasing across the whole raw range', () => {
    let prev = -1
    for (let raw = 0; raw <= 100; raw++) {
      const shown = displayProgress(raw)
      expect(shown).toBeGreaterThanOrEqual(prev)
      prev = shown
    }
  })
})
