import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { shareTheme, contrast, brandColoursOf, NEUTRAL_BRAND } from '../app/_lib/share-theme'
import { endStop } from '../app/(public)/watch/watch-view'

/*
 * The client page wears the presenter's brand (owner, 2026-10-18: "these look
 * like the old share pages"). One layout for the real page and the demo; the
 * brand's colours, corrected until every pair reads.
 */
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const pairs = (t: ReturnType<typeof shareTheme>) => [
  ['hero words', t.heroInk, t.hero], ['hero words, deep end', t.heroInk, t.heroDeep],
  ['soft hero words', t.heroSoft, t.hero], ['hero label', t.heroLabel, t.hero],
  ['button words', t.onAccent, t.accent], ['accent words on the page', t.accentInk, t.paper],
  ['page words', t.ink, t.paper], ['soft page words', t.inkSoft, t.paper], ['faint page words', t.inkFaint, t.paper],
] as const

describe('the brand colours, made to read', () => {
  const BRANDS: [string, Parameters<typeof shareTheme>[0]][] = [
    ['no brand', null],
    ['navy and gold', { primary: '#14263F', accent: '#E0A83E' }],
    ['a yellow main colour with a green second', { primary: '#F2C94C', secondary: '#1B4D3E' }],
    ['white and pale grey', { primary: '#FFFFFF', secondary: '#EEEEEE', accent: '#F5F5F5' }],
    ['black only', { primary: '#000000' }],
    ['a sky blue', { primary: '#7CC4FA' }],
    ['a bright red accent', { primary: '#222222', accent: '#FF3B30' }],
    ['three-digit hex', { primary: '#036', accent: '#fc0' }],
    ['rubbish', { primary: 'blue', accent: 'javascript:alert(1)' }],
  ]
  for (const [name, colours] of BRANDS) {
    it(`${name}: every pair reads at 4.5:1 or better`, () => {
      const t = shareTheme(colours)
      for (const [what, fg, bg] of pairs(t)) expect(contrast(fg, bg), `${name}: ${what} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('a dark main colour is kept as it is', () => {
    expect(shareTheme({ primary: '#14263F' }).hero).toBe('#14263F')
  })

  it("a light main colour hands the hero to the brand's own dark colour, and becomes the button", () => {
    const t = shareTheme({ primary: '#F2C94C', secondary: '#1B4D3E' })
    expect(t.hero).toBe('#1B4D3E')
    expect(t.accent).toBe('#F2C94C')
  })

  it('no brand gets the calm neutral, never Docs2Video blue', () => {
    expect(shareTheme(null).hero).toBe(String(NEUTRAL_BRAND.primary).toUpperCase())
  })

  it('only real colours leave the server', () => {
    expect(brandColoursOf({ primary_color: '#123456', secondary_color: 'red', accent_color: '' })).toEqual({ primary: '#123456', secondary: null, accent: null })
    expect(brandColoursOf({ primary_color: null })).toBeNull()
    expect(brandColoursOf(null)).toBeNull()
  })

  it('a name ending in a full stop gets no second one', () => {
    expect(endStop('Avery & Co.')).toBe('')
    expect(endStop('Jordan Avery')).toBe('.')
  })
})

describe('one layout, shared by the client page and the demo', () => {
  const page = read('app/(public)/watch/[id]/page.tsx')
  const demo = read('app/(public)/share-demo/page.tsx')
  const route = read('app/api/public/watch/[id]/route.ts')

  it('both draw the shared parts and wear the brand', () => {
    for (const src of [page, demo]) {
      expect(src).toMatch(/<style>\{WATCH_CSS\}<\/style>/)
      expect(src).toMatch(/<WatchHero/)
      expect(src).toMatch(/<PresenterPanel/)
      expect(src).toMatch(/shareThemeVars\(shareTheme\(/)
    }
  })

  it("the share data sends the brand's colours and whether it is a person or a company — not the brand row", () => {
    expect(route).toMatch(/colours: brandColoursOf\(brand/)
    expect(route).toMatch(/kind: sender\.kind/)
  })

  it('the old card layouts are gone from the demo', () => {
    for (const old of ['ModernLayout', 'MinimalLayout', 'CorporateLayout', 'TwoColumnLayout', 'Sarah Anderson', 'Anderson Financial']) expect(demo, old).not.toContain(old)
  })

  it('the next step sits with the presenter, beside the video', () => {
    const at = page.indexOf('<PresenterPanel')
    expect(at).toBeGreaterThan(-1)
    expect(page.indexOf('data-testid="watch-next-step"')).toBeGreaterThan(at)
  })
})
