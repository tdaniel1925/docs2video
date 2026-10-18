import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/*
 * THE CREATE FLOW, AS THE OWNER APPROVED IT (sketch, 2026-10-09; the eight
 * steps of the approved redesign, 2026-10-18): wide, big type, few words.
 *
 *  - EIGHT steps in the focus header: Content · Story · Brand · Look ·
 *    Scenes · Voice · Opener & close · Review. The making screen and the
 *    result page come after them (not a step).
 *  - No step list on the left and no "Your video so far" panel on any step.
 *  - ONE bottom bar per screen, fixed to the bottom (clear of the phone's
 *    home bar): the price on the left, the ONE main button on the right, the
 *    way back beside it. No other main (primary) button on a step.
 *  - The look step's cards come from one list, so adding a look is one entry.
 *
 * Each source check is shown to fail on a planted bad value first.
 */

let pathname = '/create'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
}))

import { STEPS, stepIndexFor } from '../app/(dashboard)/create/_components/workspace/steps'
import { VIDEO_LOOKS, PRES_LOOKS, lookCards, RECOMMENDED_VIDEO_LOOK } from '../app/(dashboard)/create/_components/make/looks'
import { settingsLine } from '../app/(dashboard)/create/_components/workspace/facts'
import Header from '../app/_components/Header'
import { DOCS2VIDEO } from '../app/_lib/brand'
import type { Profile } from '../app/_lib/types'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
const CREATE = 'app/(dashboard)/create'
/** Source minus comments (the notes name the very things they forbid). */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

function walk(p: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, p)
  if (statSync(abs).isDirectory()) { for (const e of readdirSync(abs)) walk(path.join(p, e), out) }
  else if (/\.(tsx?|css)$/.test(p)) out.push(p.replace(/\\/g, '/'))
  return out
}

/** The steps' screens (steps 2+5, 3+7 and 4+6+8 share one each) and the parts drawn on them. */
const STEP_FILES = {
  content: `${CREATE}/_components/Step1Content.tsx`,
  story: `${CREATE}/_components/steps/StoryScenes.tsx`,
  brand: `${CREATE}/_components/steps/BrandCovers.tsx`,
  look: `${CREATE}/_components/steps/LookVoiceReview.tsx`,
}
/** How many screens each file draws — each draws exactly one bottom bar. */
const SCREENS_IN: Record<keyof typeof STEP_FILES, number> = { content: 1, story: 1, brand: 2, look: 2 }
const STEP_PARTS = [
  `${CREATE}/_components/ClientPicker.tsx`,
  `${CREATE}/_components/story/OnePoint.tsx`,
  `${CREATE}/_components/story/AskPanel.tsx`,
  `${CREATE}/_components/story/LengthPicker.tsx`,
  `${CREATE}/_components/story/SceneCard.tsx`,
  `${CREATE}/_components/make/Pickers.tsx`,
  `${CREATE}/_components/make/FirstScenePreview.tsx`,
  `${CREATE}/_components/make/AddBrandPiece.tsx`,
]

/** Main (primary) buttons drawn outside the bottom bar. */
function primaryButtons(src: string): string[] {
  const s = code(src)
  const hits = [...s.matchAll(/kit-btn--primary|btn-primary|variant="primary"/g)].map((m) => m[0])
  // A kit <Button> with no variant is a primary one.
  for (const m of s.matchAll(/<Button\b[^>]*>/g)) if (!/variant="(secondary|quiet)"/.test(m[0])) hits.push(m[0].slice(0, 60))
  return hits
}

describe('eight steps in the focus header', () => {
  it('Content · Story · Brand · Look · Scenes · Voice · Opener & close · Review — no "send it" step', () => {
    expect(STEPS.map((s) => s.label)).toEqual(['Content', 'Story', 'Brand', 'Look', 'Scenes', 'Voice', 'Opener & close', 'Review'])
    expect(STEPS.some((s) => /send it/i.test(s.label))).toBe(false)
    // The making screen comes after the steps: all of them show done there.
    expect(stepIndexFor('/create/generating')).toBe(STEPS.length)
  })

  it('the header shows the eight, the current one marked, and links a done step back to its draft', () => {
    const profile = { id: 'u', email: 'sam@example.com', full_name: 'Sam', subscription_status: 'pro', is_admin: false } as unknown as Profile
    pathname = '/create/story'
    const html = renderToStaticMarkup(h(Header, { profile, brand: DOCS2VIDEO, lowCreditsAt: 1000 }))
    for (const w of ['Content', 'Story', 'Brand', 'Look', 'Scenes', 'Voice', 'Opener &amp; close', 'Review']) expect(html).toContain(w)
    expect(html.match(/class="kit-focusbar-step /g) ?? []).toHaveLength(8)
    expect(html).toMatch(/aria-current="step"[^>]*>.*?<span class="kit-focusbar-num"[^>]*>2</)
    // Phone: the words hide, the numbers stay.
    const kit = read('app/kit.css')
    expect(kit).toMatch(/@media \(max-width: 900px\) \{[\s\S]*?\.kit-focusbar-step \.kit-focusbar-word \{ display: none; \}/)
  })
})

describe('one centred column — no step rail, no "so far" panel', () => {
  it('the rail and the panel are gone from every create screen (and their styles)', () => {
    expect(existsSync(path.join(ROOT, CREATE, '_components/workspace/SoFarPanel.tsx'))).toBe(false)
    expect(existsSync(path.join(ROOT, CREATE, '_components/workspace/Workspace.tsx'))).toBe(false)
    const bad = /SoFarPanel|<Workspace\b|steps-rail|ws-sofar|Your (video|\{noun\}) so far/
    const hits = walk(CREATE).filter((f) => bad.test(code(read(f))))
    expect(hits).toEqual([])
    expect(bad.test('<Workspace soFar={x}>'), 'the check can fail').toBe(true)
    const css = read('app/globals.css')
    expect(css).not.toMatch(/\.steps-rail|\.ws-sofar|\.ws-grid/)
    expect(code(read(`${CREATE}/layout.tsx`))).not.toMatch(/<nav\b/)
  })

  it('the column is wide (1080) and leaves room for the bar, so nothing hides behind it', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/\.cf-page \{[^}]*max-width: 1080px;[^}]*padding-bottom: calc\(var\(--cf-bar-h/)
    expect(read(`${CREATE}/_components/workspace/BottomBar.tsx`)).toMatch(/setProperty\('--cf-bar-h'/)
  })
})

describe('one bottom bar per step, with the one main button', () => {
  it('the bar is fixed to the bottom, above the cookie notice and the phone’s home bar', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/\.cf-bar \{\s*position: fixed; left: 0; right: 0; bottom: var\(--bottom-bar, 0px\);[^}]*env\(safe-area-inset-bottom/)
    // Phone: the buttons fill the width.
    expect(css).toMatch(/@media \(max-width: 760px\) \{[\s\S]*?\.cf-bar-buttons > \* \{ flex: 1;/)
  })

  it.each(Object.entries(STEP_FILES))('"%s" draws one bottom bar per screen', (key, file) => {
    const src = code(read(file))
    expect(src.match(/<BottomBar\b/g) ?? []).toHaveLength(SCREENS_IN[key as keyof typeof STEP_FILES])
    expect(src, 'a main button outside the bar').not.toMatch(/<MainAction\b/)
  })

  it('the words on each bar', () => {
    const one = code(read(STEP_FILES.content))
    expect(one).toMatch(/info="Free"/)
    expect(one).toMatch(/sub="Nothing charged yet"/)
    expect(one).toMatch(/'Read it →'/)
    const two = code(read(STEP_FILES.story))
    expect(two).toMatch(/sub="Changes cost nothing"/)
    // Every step's main button names the next one, and the step before is beside it.
    for (const f of [STEP_FILES.story, STEP_FILES.brand, STEP_FILES.look]) {
      expect(code(read(f)), f).toMatch(/`Next: \$\{next\?\.label \?\? ''\} →`/)
      expect(code(read(f)), f).toMatch(/back=\{back\b|back=\{prev && videoId/)
    }
    const three = code(read(STEP_FILES.look))
    expect(three).toMatch(/const makeLabel = 'Make it'/)
    // The price is the server's quote, never typed.
    expect(three).toMatch(/formatCredits\(shown\.total\)/)
    expect(three).toMatch(/left after/)
    // The free preview is the bar's one helper button.
    expect(three).toMatch(/helper=\{/)
    expect(read(`${CREATE}/_components/make/FirstScenePreview.tsx`)).toMatch(/'Free preview'/)
  })

  it('no other main button on a step, or in the parts drawn on it', () => {
    expect(primaryButtons('<Button onClick={go}>Go</Button>'), 'the check can fail').toHaveLength(1)
    expect(primaryButtons('<button className="kit-btn kit-btn--primary">Go</button>')).toHaveLength(1)
    expect(primaryButtons('<Button variant="secondary" onClick={go}>Go</Button>')).toHaveLength(0)
    const hits = [...Object.values(STEP_FILES), ...STEP_PARTS].flatMap((f) => primaryButtons(read(f)).map((x) => `${f}: ${x}`))
    expect(hits).toEqual([])
    // The bar's own button is the primary one.
    expect(read(`${CREATE}/_components/workspace/MainAction.tsx`)).toMatch(/<Button variant="primary"/)
  })
})

describe('the look, voice and review steps: looks from one list, one settings line', () => {
  it('every look card comes from looks.ts; one is BEST; adding a look is one entry', () => {
    const video = lookCards('video')
    expect(video.map((c) => c.id)).toEqual(VIDEO_LOOKS.map((l) => l.id))
    expect(video.filter((c) => c.recommended).map((c) => c.id)).toEqual([RECOMMENDED_VIDEO_LOOK])
    for (const c of video) expect(c.thumb).toEqual({ kind: 'img', src: `/style-samples/${c.id}-cover.png` })
    expect(lookCards('interactive').map((c) => c.id)).toEqual(PRES_LOOKS.map((l) => l.id))
    const page = code(read(STEP_FILES.look))
    // (with the scene engine on, the same list is asked for its kit set)
    // (and, with the look screen, "Your look" when the brand or project has one)
    expect(page).toMatch(/const cards = lookCards\(output(, \{ kit: kitOn(, yourLook: kitOn \? yourLook : null)? \})?\)/)
    // No look named in the screen itself.
    for (const l of VIDEO_LOOKS) expect(page, l.name).not.toContain(`'${l.name}'`)
  })

  it('the one line reads "Sarah · music on · standard"', () => {
    expect(settingsLine({ output: 'video', voiceId: 'nova', aiMusic: true, length: 'Standard' })).toBe('Sarah · music on · standard')
    expect(settingsLine({ output: 'interactive', voiceId: 'onyx', aiMusic: true, length: 'Standard' })).toBe('James · presentation')
    const page = code(read(STEP_FILES.look))
    // Each choice has a step of its own now (no "More options" fold).
    expect(page).not.toMatch(/<summary>More options<\/summary>/)
    for (const row of ['Make', 'Voice', 'Music', 'Length', 'Photos']) expect(page).toContain(`<span className="cf-row-name">${row}</span>`)
    for (const label of ['On their watch page', 'The price']) expect(page).toContain(`<span className="cf-label">${label}</span>`)
  })
})

describe('step 1 opens on what was picked on Home; step 2 holds what we read', () => {
  it('a headline per way in, and chips to switch', () => {
    const one = code(read(STEP_FILES.content))
    for (const w of ['document.', 'website.', 'text.', 'idea.']) expect(one).toContain(`'${w}'`)
    for (const c of ['Use a website', 'Paste text', 'Describe an idea']) expect(one).toContain(`'${c}'`)
    // "For" and "Goal" are optional, side by side.
    expect(one).toMatch(/className="cf-two"/)
    expect(one).toMatch(/For <small>optional<\/small>/)
    // No "Here's what we read" here any more.
    expect(one).not.toMatch(/Here’s what we read|ReadReview/)
  })

  it('the one point and the numbers are edited on step 2, and a changed one offers a rewrite', () => {
    const two = code(read(STEP_FILES.story))
    expect(two).toMatch(/onEdit=\{editBrief\}/)
    expect(two).toMatch(/if \(briefChangedRef\.current && !\(await saveBrief\(\)\)\) return false/)
    expect(two).toMatch(/briefChanged && scenes\.length > 0 \? \{ reason: /)
    const point = read(`${CREATE}/_components/story/OnePoint.tsx`)
    expect(point).toMatch(/aria-label="The one point"/)
    expect(point).toMatch(/aria-label=\{`Remove \$\{f\.value \|\| 'this number'\}`\}/)
  })
})
