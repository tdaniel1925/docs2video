import { describe, it, expect } from 'vitest'
import {
  calculateVideoCost,
  costForUser,
  CREDIT_COSTS,
  GRANDFATHERED_USER_IDS,
  MULTI_FILE_SURCHARGE,
} from '../app/_lib/credits'

// The cost calculator IS the price the customer pays — display and charge both
// call it, so a regression here is a silent mis-charge.

const AZIZ = [...GRANDFATHERED_USER_IDS][0] // grandfathered at pre-2x rates

describe('costForUser (grandfathering)', () => {
  it('charges current rates for normal users', () => {
    expect(costForUser('video', 'some-random-user')).toBe(CREDIT_COSTS.video)
    expect(costForUser('video', null)).toBe(CREDIT_COSTS.video)
    expect(costForUser('video')).toBe(CREDIT_COSTS.video)
  })
  it('charges OLD (pre-2x) rates for grandfathered users', () => {
    expect(AZIZ).toBeTruthy()
    const old = costForUser('video', AZIZ)
    expect(old).toBeLessThan(CREDIT_COSTS.video)
  })
})

describe('calculateVideoCost', () => {
  it('prices the base video by detail level', () => {
    const quick = calculateVideoCost({ outputType: 'video', detailLevel: 'quick' })
    const standard = calculateVideoCost({ outputType: 'video', detailLevel: 'standard' })
    const detailed = calculateVideoCost({ outputType: 'video', detailLevel: 'detailed' })
    expect(quick).toBeGreaterThan(0)
    expect(standard).toBeGreaterThanOrEqual(quick)
    expect(detailed).toBeGreaterThanOrEqual(standard)
  })
  it('adds the multi-file surcharge per EXTRA file only', () => {
    const one = calculateVideoCost({ outputType: 'video', fileCount: 1 })
    const three = calculateVideoCost({ outputType: 'video', fileCount: 3 })
    expect(three).toBe(one + 2 * MULTI_FILE_SURCHARGE)
    // no fileCount = single file = no surcharge
    expect(calculateVideoCost({ outputType: 'video' })).toBe(one)
  })
  it('prices pptx/pdf as flat costs (no surcharge path)', () => {
    expect(calculateVideoCost({ outputType: 'pptx' })).toBe(costForUser('pptx', null))
    expect(calculateVideoCost({ outputType: 'pdf' })).toBe(costForUser('pdf', null))
  })
  it('honors grandfathered users end-to-end', () => {
    const normal = calculateVideoCost({ outputType: 'video', userId: 'nobody' })
    const legacy = calculateVideoCost({ outputType: 'video', userId: AZIZ })
    expect(legacy).toBeLessThan(normal)
  })
})
