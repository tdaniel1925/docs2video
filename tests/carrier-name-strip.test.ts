import { describe, it, expect } from 'vitest'

/**
 * F18 — Carrier Name Leak Test
 *
 * Tests the carrier name stripping logic that runs in generate-video/route.ts.
 * We extract the logic into a testable function here.
 */

function stripCarrierFromScenes(scenes: any[], policyData: any): any[] {
  if (policyData && typeof policyData === 'object' && 'carrier' in policyData) {
    const carrierName = policyData.carrier
    if (carrierName && typeof carrierName === 'string' && carrierName.length > 1) {
      const carrierRegex = new RegExp(carrierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      scenes.forEach((scene: any) => {
        if (scene.slidePrompt) {
          scene.slidePrompt = scene.slidePrompt.replace(carrierRegex, 'the carrier')
        }
        if (scene.slideData) {
          if (scene.slideData.headline) {
            scene.slideData.headline = scene.slideData.headline.replace(carrierRegex, 'the carrier')
          }
          if (scene.slideData.bullets) {
            scene.slideData.bullets = scene.slideData.bullets.map((b: string) =>
              typeof b === 'string' ? b.replace(carrierRegex, 'the carrier') : b
            )
          }
          if (scene.slideData.stats) {
            scene.slideData.stats = scene.slideData.stats.map((st: any) => ({
              ...st,
              label: st.label ? st.label.replace(carrierRegex, 'the carrier') : st.label,
              value: st.value ? st.value.replace(carrierRegex, 'the carrier') : st.value,
            }))
          }
        }
      })
    }
  }
  return scenes
}

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
    // Narration is NOT stripped (handled separately by H5 hard constraint)
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
