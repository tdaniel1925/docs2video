import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { estimateVideoCost, exceedsCeiling, TIER_CEILINGS_CENTS } from '../app/_lib/cost-estimator'

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

describe('exceedsCeiling', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns false when COST_CEILINGS_ENABLED is not set', async () => {
    delete process.env.COST_CEILINGS_ENABLED
    const result = await exceedsCeiling('user-1', 100, 'free', {})
    expect(result).toBe(false)
  })

  it('returns false when COST_CEILINGS_ENABLED is not true', async () => {
    process.env.COST_CEILINGS_ENABLED = 'false'
    const result = await exceedsCeiling('user-1', 100, 'free', {})
    expect(result).toBe(false)
  })

  it('returns true when spend exceeds free tier ceiling', async () => {
    process.env.COST_CEILINGS_ENABLED = 'true'
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { total_cents: 40 } }),
            }),
          }),
        }),
      }),
    }
    // 40 existing + 20 new = 60 > 50 ceiling
    const result = await exceedsCeiling('user-1', 20, 'free', mockSupabase)
    expect(result).toBe(true)
  })

  it('returns false when spend is within ceiling', async () => {
    process.env.COST_CEILINGS_ENABLED = 'true'
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { total_cents: 10 } }),
            }),
          }),
        }),
      }),
    }
    // 10 existing + 20 new = 30 <= 50 ceiling
    const result = await exceedsCeiling('user-1', 20, 'free', mockSupabase)
    expect(result).toBe(false)
  })

  it('uses free tier ceiling for unknown tiers', async () => {
    process.env.COST_CEILINGS_ENABLED = 'true'
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { total_cents: 40 } }),
            }),
          }),
        }),
      }),
    }
    // Unknown tier falls back to free (50 ceiling). 40 + 20 = 60 > 50
    const result = await exceedsCeiling('user-1', 20, 'unknown_tier', mockSupabase)
    expect(result).toBe(true)
  })

  it('handles no existing spend record (null data)', async () => {
    process.env.COST_CEILINGS_ENABLED = 'true'
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null }),
            }),
          }),
        }),
      }),
    }
    // 0 existing + 20 new = 20 <= 50 ceiling
    const result = await exceedsCeiling('user-1', 20, 'free', mockSupabase)
    expect(result).toBe(false)
  })

  it('pro tier has higher ceiling than free', async () => {
    process.env.COST_CEILINGS_ENABLED = 'true'
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { total_cents: 1500 } }),
            }),
          }),
        }),
      }),
    }
    // pro ceiling = 2000. 1500 + 400 = 1900 <= 2000
    const result = await exceedsCeiling('user-1', 400, 'pro', mockSupabase)
    expect(result).toBe(false)
  })
})

describe('TIER_CEILINGS_CENTS', () => {
  it('has all expected tiers', () => {
    expect(TIER_CEILINGS_CENTS).toHaveProperty('free')
    expect(TIER_CEILINGS_CENTS).toHaveProperty('starter')
    expect(TIER_CEILINGS_CENTS).toHaveProperty('pro')
    expect(TIER_CEILINGS_CENTS).toHaveProperty('business')
    expect(TIER_CEILINGS_CENTS).toHaveProperty('enterprise')
  })

  it('tiers increase in ceiling value', () => {
    expect(TIER_CEILINGS_CENTS.free).toBeLessThan(TIER_CEILINGS_CENTS.starter)
    expect(TIER_CEILINGS_CENTS.starter).toBeLessThan(TIER_CEILINGS_CENTS.pro)
    expect(TIER_CEILINGS_CENTS.pro).toBeLessThan(TIER_CEILINGS_CENTS.business)
    expect(TIER_CEILINGS_CENTS.business).toBeLessThan(TIER_CEILINGS_CENTS.enterprise)
  })
})
