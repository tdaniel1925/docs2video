import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

// The Slide Deck renderer used to throw away the user's edited script, chosen
// voice and length (audit H2). These pin the three pieces that carry them.
const require = createRequire(import.meta.url)
const slides = require('../render-service/slides.js') as {
  planFromSuppliedScenes: (s: unknown[]) => { title: string; scenes: any[]; cta: { line: string } }
  sceneCountRule: (d?: string) => string
  wantsChosenVoice: (v?: string) => boolean
}

const supplied = [
  { role: 'cover', title: 'Your Plan', narration: 'Sam, thank you for letting Pat share this summary with you. Your Plan.', slideData: { headline: 'Your Plan' } },
  { role: 'content', title: 'What you get', narration: 'You get three things. First, coverage for the whole family.', slideData: { headline: 'What you get', bullets: ['Coverage for the whole family', 'Low monthly cost'] } },
  { role: 'content', title: 'The number', narration: 'Your benefit is five hundred thousand dollars.', slideData: { headline: 'The number', stats: [{ label: 'Death benefit', value: '$500,000' }] } },
  { role: 'content', title: 'No points', narration: 'This part has no bullets written. It still needs something on screen.' },
  { role: 'closing', title: 'Thank You', narration: 'Thank you for watching. Call Pat any time.', slideData: { headline: 'Thank You', cta: 'Call Pat today' } },
]

describe('planFromSuppliedScenes', () => {
  const plan = slides.planFromSuppliedScenes(supplied)

  it('keeps every scene, in order, with the user’s own narration', () => {
    expect(plan.scenes.map((s) => s.narration)).toEqual(supplied.map((s) => s.narration))
  })

  it('opens with the cover and ends with the closing', () => {
    expect(plan.scenes[0].beat).toBe('intro')
    expect(plan.scenes[plan.scenes.length - 1].beat).toBe('cta')
    expect(plan.cta.line).toBe('Call Pat today')
  })

  it('puts the user’s bullets and figures on the slides', () => {
    const bullets = plan.scenes[1].blocks.find((b: any) => b.type === 'bullets')
    expect(bullets.items.map((i: any) => i.text)).toEqual(['Coverage for the whole family', 'Low monthly cost'])
    const fig = plan.scenes[2].blocks.find((b: any) => b.type === 'figure')
    expect(fig.figure.value).toBe(500000)
    expect(fig.figure.prefix).toBe('$')
  })

  it('never leaves a content slide as a bare heading', () => {
    for (const s of plan.scenes.filter((x) => x.beat !== 'intro' && x.beat !== 'cta')) {
      expect(s.blocks.length).toBeGreaterThan(0)
    }
  })

  it('skips scenes with no narration', () => {
    const p = slides.planFromSuppliedScenes([{ role: 'content', title: 'x', narration: '  ' }, supplied[1]])
    expect(p.scenes).toHaveLength(1)
  })
})

describe('sceneCountRule (the length the user paid for)', () => {
  it('leaves Standard exactly as before', () => {
    expect(slides.sceneCountRule('standard')).toBe('')
    expect(slides.sceneCountRule(undefined)).toBe('')
  })
  it('makes Quick shorter and Detailed longer', () => {
    expect(slides.sceneCountRule('quick')).toMatch(/6-8 scenes/)
    expect(slides.sceneCountRule('detailed')).toMatch(/15-18 scenes/)
  })
})

describe('wantsChosenVoice', () => {
  it('keeps the default female voice on the usual engine', () => {
    expect(slides.wantsChosenVoice('nova')).toBe(false)
    expect(slides.wantsChosenVoice(undefined)).toBe(false)
  })
  it('honors any other voice the user picked', () => {
    expect(slides.wantsChosenVoice('onyx')).toBe(true)
    expect(slides.wantsChosenVoice('fable')).toBe(true)
  })
  it('ignores ids it does not know', () => {
    expect(slides.wantsChosenVoice('not-a-voice')).toBe(false)
  })
})
