import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { lookCards, LOOK_SAMPLES, PRES_LOOKS } from '../app/(dashboard)/create/_components/make/looks'

/*
 * A SAMPLE VIDEO FOR A LOOK (owner, 2026-10-18). Every look card that offers
 * one points at a real file made by the look's own pipeline
 * (scripts/look-samples); a look without one offers no button.
 */
const ROOT = join(__dirname, '..')
const PICKERS = readFileSync(join(ROOT, 'app/(dashboard)/create/_components/make/Pickers.tsx'), 'utf8')

describe('look samples', () => {
  it('every presentation look has a sample, and its files exist and are small', () => {
    for (const l of PRES_LOOKS) {
      const s = LOOK_SAMPLES[l.id]
      expect(s, l.id).toBeTruthy()
      for (const f of [s.video, s.poster]) {
        const p = join(ROOT, 'public', f)
        expect(existsSync(p), f).toBe(true)
        expect(statSync(p).size, f).toBeLessThan(6 * 1024 * 1024)
      }
    }
  })

  it('the cards carry them, and only them', () => {
    const pres = lookCards('interactive')
    expect(pres.every((c) => c.sample?.video === `/look-samples/${c.id}.mp4`)).toBe(true)
    for (const c of lookCards('video', { kit: true })) {
      if (c.sample) expect(existsSync(join(ROOT, 'public', c.sample.video)), c.id).toBe(true)
    }
  })

  it('each ready video look has its OWN sample on its card (the picked look now reaches the engine); Drawn slides fakes none', async () => {
    const { VIDEO_LOOK_SAMPLES } = await import('../app/(dashboard)/create/_components/make/looks')
    const cards = lookCards('video', { kit: true })
    for (const id of ['slides', 'editorial', 'explainer']) {
      const c = cards.find((x) => x.id === id)
      expect(c?.sample, id).toEqual(VIDEO_LOOK_SAMPLES[id as 'slides'])
      for (const f of [c!.sample!.video, c!.sample!.poster]) {
        expect(existsSync(join(ROOT, 'public', f)), f).toBe(true)
        expect(statSync(join(ROOT, 'public', f)).size, f).toBeLessThan(3 * 1024 * 1024)
      }
    }
    /* each look's sample is its own film, not one file shown three times */
    expect(new Set(['slides', 'editorial', 'explainer'].map((id) => cards.find((x) => x.id === id)!.sample!.video)).size).toBe(3)
    expect(cards.find((x) => x.id === 'drawn')?.sample).toBeUndefined()
    const step = readFileSync(join(ROOT, 'app/(dashboard)/create/_components/steps/LookVoiceReview.tsx'), 'utf8')
    expect(step).not.toMatch(/data-video-sample/)
  })

  it('opens in an accessible dialog: a separate button, focus to Close, Escape closes, focus goes back', () => {
    expect(PICKERS).toMatch(/className="cf-look-watch"/)
    expect(PICKERS).toMatch(/aria-label=\{`Watch a \$\{l\.sample\.seconds\}-second sample of \$\{l\.name\}`\}/)
    expect(PICKERS).toMatch(/role="dialog" aria-modal="true"/)
    expect(PICKERS).toMatch(/closeRef\.current\?\.focus\(\)/)
    expect(PICKERS).toMatch(/if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); onClose\(\) \}/)
    expect(PICKERS).toMatch(/from\?\.focus\(\)/)
    expect(PICKERS).toMatch(/<video src=\{sample\.video\} poster=\{sample\.poster\} controls autoPlay/)
    /* never a button inside the card's own button */
    expect(PICKERS).toMatch(/<div key=\{l\.id\} className="cf-look-wrap">/)
  })
})
