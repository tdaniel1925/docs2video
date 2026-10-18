import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { STEPS, stepPath, neighbours, stepIndexFor } from '../app/(dashboard)/create/_components/workspace/steps'
import { nextStepAfterBrand } from '../app/(dashboard)/create/_components/make/nextStep'

/*
 * THE EIGHT STEPS (approved redesign, 2026-10-18). One job per screen, built
 * by splitting the three old screens — not rewriting them — so every save,
 * check and price stays as it was. These checks keep it that way.
 */
const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
const CREATE = 'app/(dashboard)/create'
const pageOf = (route: string) => `app/(dashboard)${route}/page.tsx`

describe('every step is a real page, drawing its own part', () => {
  const parts: Record<string, [string, string]> = {
    story: ['StoryScenes', 'story'], brand: ['BrandCovers', 'brand'], look: ['LookVoiceReview', 'look'],
    scenes: ['StoryScenes', 'scenes'], voice: ['LookVoiceReview', 'voice'], opening: ['BrandCovers', 'covers'], review: ['LookVoiceReview', 'review'],
  }
  it.each(STEPS.slice(1).map((s) => [s.key, s.paths[0]] as const))('%s → %s', (key, route) => {
    const file = pageOf(route)
    expect(existsSync(path.join(ROOT, file)), file).toBe(true)
    const [comp, part] = parts[key]
    expect(read(file)).toContain(`<${comp} part="${part}" />`)
  })

  it('each step names the next and the one before', () => {
    expect(neighbours('story')).toMatchObject({ prev: { key: 'content' }, next: { key: 'brand' } })
    expect(neighbours('look')).toMatchObject({ prev: { key: 'brand' }, next: { key: 'scenes' } })
    expect(neighbours('review')).toMatchObject({ prev: { key: 'opening' }, next: null })
    expect(stepPath('opening', 'a b')).toBe('/create/opening?id=a%20b')
  })
})

describe('old addresses still land in the right place', () => {
  it('/create/script → the story, /create/theme → the review, every parameter kept', () => {
    const script = read(`${CREATE}/script/page.tsx`)
    expect(script).toMatch(/redirect\(qs \? `\/create\/story\?\$\{qs\}` : '\/create\/story'\)/)
    const theme = read(`${CREATE}/theme/page.tsx`)
    expect(theme).toMatch(/redirect\(qs \? `\/create\/review\?\$\{qs\}` : '\/create\/review'\)/)
    for (const f of [script, theme]) expect(f).toMatch(/for \(const \[k, v\] of Object\.entries\(sp\)\) if \(typeof v === 'string'\) q\.set\(k, v\)/)
    expect(read(`${CREATE}/brief/page.tsx`)).toContain("redirect(qs ? `/create/story?${qs}` : '/create/story')")
    // The header still places them.
    expect(stepIndexFor('/create/script')).toBe(1)
    expect(stepIndexFor('/create/theme')).toBe(7)
  })

  it('after the brand: the look once the story is written, else the story', () => {
    expect(nextStepAfterBrand('v', { scenes: [{}] })).toBe('/create/style?id=v')
    expect(nextStepAfterBrand('v', { scenes: [] })).toBe('/create/story?id=v')
  })

  it('no link anywhere still points at the old addresses (except the forwarders and the step list)', () => {
    const files = ['app/(dashboard)/create/_components/Step1Content.tsx', 'app/(dashboard)/create/generating/page.tsx', 'app/(dashboard)/videos/[id]/useVideoRow.ts',
      'app/api/videos/draft/duplicate/copy-draft.ts', 'app/(dashboard)/clients/[id]/review/page.tsx', 'app/_components/look/LookWizard.tsx',
      `${CREATE}/_components/steps/StoryScenes.tsx`, `${CREATE}/_components/steps/LookVoiceReview.tsx`, `${CREATE}/_components/steps/BrandCovers.tsx`,
      `${CREATE}/_components/make/nextStep.ts`, 'app/(dashboard)/dashboard/_home/derive.ts']
    for (const f of files) expect(read(f), f).not.toMatch(/\/create\/(script|theme)\b/)
  })
})

describe('nothing chosen on one step is lost on the way to the next', () => {
  const lvr = read(`${CREATE}/_components/steps/LookVoiceReview.tsx`)
  it('look and voice save every choice to the draft before Next (the same save Make uses)', () => {
    const next = lvr.slice(lvr.indexOf('async function goNext'), lvr.indexOf('async function handleMake'))
    expect(next).toMatch(/const problem = await saveChoices\(\)/)
    expect(next.indexOf('saveChoices()')).toBeLessThan(next.indexOf('router.push(stepPath(next.key, videoId))'))
    const make = lvr.slice(lvr.indexOf('async function handleMake'))
    expect(make).toMatch(/const problem = await saveChoices\(\)\n\s*if \(problem\) return stop/)
    // …and every choice is read back from the draft on arrival.
    for (const k of ['d.voiceId', 'd.aiMusic', 'd.slidePhotos', 'd.drawStyle', 'd.presentationTemplate', 'd.allowSourceDownload', 'd.agentNote']) expect(lvr, k).toContain(k)
  })

  it('the opener step saves the presenter choices, exactly as the brand step does', () => {
    const bc = read(`${CREATE}/_components/steps/BrandCovers.tsx`)
    const covers = bc.slice(bc.indexOf('async function saveCovers'), bc.indexOf('if (loading) {'))
    for (const k of ['updates.presenterIntro = presenterIntro.trim() || undefined', 'updates.photoPlacement = perVideoPlacement', 'updates.introduceInOpening = introduceInOpening', 'updates.showContactClosing = showContactClosing']) {
      expect(covers, k).toContain(k)
      expect(bc.slice(bc.indexOf('async function handleSubmit')), k.replace('presenterIntro.trim()', 'introVal.trim()').replace('perVideoPlacement', 'placementVal')).toContain(k.replace('presenterIntro.trim()', 'introVal.trim()').replace('perVideoPlacement', 'placementVal'))
    }
  })

  it('the scenes step sends you to the story when there is nothing written yet', () => {
    const ss = read(`${CREATE}/_components/steps/StoryScenes.tsx`)
    expect(ss).toMatch(/if \(part === 'scenes' && !running\) \{ router\.replace\(stepPath\('story', videoId\)\); return \}/)
  })
})

describe('the side panels scroll on their own; the middle never moves', () => {
  it('cf-side is sticky with its own scroll on a wide screen, and stacks on a phone', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/@media \(min-width: 900px\) \{\s*\.cf-side \{\s*position: sticky;[\s\S]*?overflow-y: auto;/)
    expect(css).toMatch(/@media \(max-width: 900px\) \{\s*\.cf-split \{ grid-template-columns: minmax\(0, 1fr\); \}/)
    for (const f of ['StoryScenes', 'LookVoiceReview', 'BrandCovers']) expect(read(`${CREATE}/_components/steps/${f}.tsx`), f).toContain('<aside className="cf-side"')
  })
})
