import { describe, it, expect } from 'vitest'
import { estimateVideoCost } from '../app/_lib/cost-estimator'

describe('estimateVideoCost', () => {
  it('calculates cost for a typical video', () => {
    const result = estimateVideoCost(8, 5000, true)
    // 8 slides * 8 = 64, ceil(5000/1000) * 3 = 15, music = 5
    expect(result.estimated_cost_cents).toBe(84)
    expect(result.cost_breakdown.slide_image).toBe(64)
    expect(result.cost_breakdown.tts_hd_per_1k_chars).toBe(15)
    expect(result.cost_breakdown.music).toBe(5)
  })

  it('calculates cost without music', () => {
    const result = estimateVideoCost(4, 2000, false)
    // 4 * 8 = 32, ceil(2000/1000) * 3 = 6, no music = 0
    expect(result.estimated_cost_cents).toBe(38)
    expect(result.cost_breakdown.music).toBe(0)
  })

  it('handles zero scenes and chars', () => {
    const result = estimateVideoCost(0, 0, false)
    expect(result.estimated_cost_cents).toBe(0)
  })

  it('rounds narration chars up to next 1K', () => {
    const result = estimateVideoCost(1, 1, false)
    // 1 slide * 8 = 8, ceil(1/1000) * 3 = 3
    expect(result.cost_breakdown.tts_hd_per_1k_chars).toBe(3)
  })
})
