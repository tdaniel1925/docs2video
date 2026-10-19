import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { phaseOf, crewFor, crewHeadline } from '../app/(dashboard)/create/generating/crew-steps'
import { SISTER_APPS } from '../app/(dashboard)/create/generating/SisterApps'

/*
 * The making screen (owner, 2026-10-18): a film crew whose cards follow the
 * REAL steps, and the makers' other apps beside it (layout "B").
 */
const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

/* The words the explainer engine writes (One Dollar Decks render-worker/d2v.ts progressFor), in order. */
const ENGINE = [
  ['starting', ''],
  ['generating_slides', 'Designing your scenes...'],
  ['generating_slides', 'Designing scene 4 of 7...'],
  ['generating_slides', 'Recording the voice...'],
  ['generating_slides', 'Directing the motion...'],
  ['generating_slides', 'Directing the motion — scene 3...'],
  ['generating_slides', 'Composing the music...'],
  ['generating_slides', 'Animating every scene...'],
  ['generating_slides', 'The final cut...'],
  ['generating_slides', 'Saving your video...'],
] as const

describe('the crew follows the real steps', () => {
  it('maps each engine step to its crew member', () => {
    expect(ENGINE.map(([s, d]) => phaseOf(s, d))).toEqual(['director', 'designer', 'designer', 'voice', 'directing', 'directing', 'composer', 'camera', 'editor', 'editor'])
    expect(phaseOf('generating_audio', '')).toBe('voice')
    expect(phaseOf('rendering', '')).toBe('camera')
  })

  it('never un-finishes a card, and exactly the right ones are on set', () => {
    let doneBefore = 0
    for (const [s, d] of ENGINE) {
      const cards = crewFor(s, d)
      const done = cards.filter((c) => c.state === 'done').length
      expect(done).toBeGreaterThanOrEqual(doneBefore)
      doneBefore = done
      expect(cards.filter((c) => c.state === 'on').length).toBeGreaterThanOrEqual(1)
    }
    /* the camera crew sets up the shots before the music and films after: on through both */
    expect(crewFor('generating_slides', 'Composing the music...').find((c) => c.key === 'camera')?.state).toBe('on')
    expect(crewFor('completed', '', true).every((c) => c.state === 'done')).toBe(true)
    expect(crewHeadline('generating_slides', 'Animating every scene...')).toBe('filming every scene.')
  })

  it('animates only the crew member on set, and holds still for reduced motion', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/\.crew-card\[data-state='on'\] \.crew-spin \{ animation:/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.crew-card \* \{ animation: none !important; \} \}/)
    const page = read('app/(dashboard)/create/generating/page.tsx')
    expect(page).toMatch(/crew \? <Crew cards=\{crew\}/)
  })
})

describe('the makers’ other apps, beside the progress', () => {
  it('shows all four, each opening in a new tab', () => {
    expect(SISTER_APPS.map((a) => a.name)).toEqual(['Upcue Presenter', 'Restylez', 'VideoWiz', 'DemoWiz'])
    for (const a of SISTER_APPS) expect(a.url).toMatch(/^https:\/\//)
    const src = read('app/(dashboard)/create/generating/SisterApps.tsx')
    expect(src).toMatch(/target="_blank" rel="noopener noreferrer"/)
    expect(read('app/(dashboard)/create/generating/page.tsx')).toMatch(/<SisterApps \/>/)
  })
})
