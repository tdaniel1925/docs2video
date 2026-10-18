import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { STEP_COPY } from '../app/(dashboard)/create/_components/steps/StepExplain'

/*
 * Owner, 2026-10-18: every create step explained; look vs brand made plain
 * (every scene wears the look); a cover and an inside page shown for the
 * picked look; a reference picture can be PASTED, and the page says so.
 */
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const STEPS = 'app/(dashboard)/create/_components/'

describe('every create step says what it is for and what comes next', () => {
  it('has words for all eight steps', () => {
    expect(Object.keys(STEP_COPY).sort()).toEqual(['brand', 'content', 'look', 'opening', 'review', 'scenes', 'story', 'voice'])
    for (const [k, c] of Object.entries(STEP_COPY)) {
      expect(String(c.what).length, k).toBeGreaterThan(60)
      expect(String(c.next).length, k).toBeGreaterThan(20)
    }
  })

  it('is on every step', () => {
    expect(read(STEPS + 'Step1Content.tsx')).toMatch(/<StepExplain step="content" \/>/)
    const story = read(STEPS + 'steps/StoryScenes.tsx')
    expect(story).toMatch(/<StepExplain step="story" \/>/)
    expect(story).toMatch(/<StepExplain step="scenes" \/>/)
    const brand = read(STEPS + 'steps/BrandCovers.tsx')
    expect(brand).toMatch(/<StepExplain step="brand" \/>/)
    expect(brand).toMatch(/<StepExplain step="opening" \/>/)
    expect(read(STEPS + 'steps/LookVoiceReview.tsx')).toMatch(/<StepExplain step=\{part\} \/>/)
  })
})

describe('look vs brand', () => {
  it('says every scene wears the look, on the brand step, the look step and the look screen', () => {
    expect(String(STEP_COPY.look.what)).toMatch(/Every scene, from the cover to the closing, wears it/)
    expect(read(STEPS + 'steps/BrandCovers.tsx')).toMatch(/<LookVsBrand \/>/)
    expect(read(STEPS + 'steps/LookVoiceReview.tsx')).toMatch(/part === 'look' \? <LookVsBrand \/>/)
    expect(read('app/_components/look/LookWizard.tsx')).toMatch(/data-look-explain/)
  })

  it('shows the picked look on a cover and an inside page', () => {
    const look = read(STEPS + 'steps/LookVoiceReview.tsx')
    expect(look).toMatch(/data-look-pages/)
    expect(look).toMatch(/>Cover</)
    expect(look).toMatch(/>Inside page</)
  })
})

describe('a reference picture can be pasted', () => {
  it('on the look screen, anywhere, with a button and the shortcut shown', () => {
    const w = read('app/_components/look/LookWizard.tsx')
    expect(w).toMatch(/usePasteImage\(\(f\) => \{ setStart\('reference'\)/)
    expect(w).toMatch(/data-testid="reference-paste"/)
    expect(w).toMatch(/Paste a picture \(\$\{pasteKey\}\)/)
    expect(w).toMatch(/takePastedReference\(\)/)
  })

  it('on the Look step, carried to the look screen', () => {
    const step = read(STEPS + 'steps/LookVoiceReview.tsx')
    expect(step).toMatch(/usePasteImage\(\(f\) => \{ void holdPastedReference\(f\)\.then\(openLookScreen\) \}, part === 'look'/)
    expect(step).toMatch(/Paste, drop or upload a picture/)
  })
})
