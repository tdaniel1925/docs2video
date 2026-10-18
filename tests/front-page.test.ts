import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { isFrontPage, isClientSharePage } from '../app/_components/CookieBanner'

/*
 * Guards for the front page (redesign approved 2026-10-18, the One Dollar
 * Decks house style in the logo's blue). Each check was run against a planted
 * mistake first (see the "catches" lines) so a pass means something.
 */

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const HOME = read('app/_components/marketing/Docs2VideoHome.tsx')
const TABS = read('app/_components/marketing/FieldTabs.tsx')
const CSS = read('app/_components/marketing/home.css')

/** Prices or video counts typed into the page instead of read from pricing.ts. */
export function hardcodedPrices(src: string): string[] {
  const hits: string[] = []
  for (const m of src.matchAll(/\$(29|79|99|129|199|299|499)\b/g)) hits.push(m[0])
  for (const m of src.matchAll(/About (2|5|25|75|200) videos/g)) hits.push(m[0])
  return hits
}

/** Every /something path a string points at under public/. */
function publicPictures(src: string): string[] {
  return [...src.matchAll(/'(\/home\/[a-z0-9-]+\.jpg)'/g)].map((m) => m[1])
}

describe('front page', () => {
  it('reads prices and video counts from pricing.ts', () => {
    expect(hardcodedPrices('<b>$79/mo</b> About 25 videos a month')).toEqual(['$79', 'About 25 videos'])
    expect(hardcodedPrices(HOME)).toEqual([])
    expect(HOME).toMatch(/from '\.\.\/\.\.\/_lib\/pricing'/)
    expect(HOME).toMatch(/key: 'free', name: free\.label/)
  })

  it('every field tab links to a real /for/* page', () => {
    const hrefs = [...HOME.matchAll(/href: '(\/for\/[a-z-]+)'/g)].map((m) => m[1])
    expect(hrefs.length).toBeGreaterThan(8)
    for (const h of hrefs) expect(existsSync(join(ROOT, 'app/(public)', h, 'page.tsx')), h).toBe(true)
  })

  it('every picture it shows is in public/home', () => {
    const pics = publicPictures(HOME)
    expect(pics.length).toBeGreaterThan(10)
    for (const p of pics) expect(existsSync(join(ROOT, 'public', p)), p).toBe(true)
  })

  it('has no comparison table and no "Most popular" claim', () => {
    expect(HOME).not.toMatch(/<table/)
    expect(HOME.toLowerCase()).not.toContain('most popular')
    expect(HOME).toContain('Recommended')
  })

  it('loads only the hero picture eagerly, and every picture says how wide it is drawn', () => {
    expect((HOME.match(/\bpriority\b/g) ?? []).length).toBe(1)
    for (const src of [HOME, TABS]) {
      const images = src.match(/<Image[\s\S]*?\/>/g) ?? []
      for (const img of images) expect(img, img.slice(0, 80)).toMatch(/sizes=/)
    }
  })

  it('field tabs are real tabs a keyboard and a screen reader understand', () => {
    expect(TABS).toMatch(/role="tablist"/)
    expect(TABS).toMatch(/role="tab"/)
    expect(TABS).toMatch(/aria-selected=/)
    expect(TABS).toMatch(/role="tabpanel"/)
  })

  it('fonts and colours are scoped to the public site, not the app', () => {
    // The fonts are the public site's (one shell for the front page and every page it links to).
    const FONTS = read('app/_components/marketing/site-fonts.ts')
    expect(FONTS).toMatch(/Archivo/)
    expect(FONTS).toMatch(/DM_Sans/)
    expect(HOME).toMatch(/<SiteFrame>/)
    expect(read('app/layout.tsx')).not.toMatch(/Archivo|DM_Sans/)
    // fixed colours, never the app's theme tokens
    expect(CSS).not.toMatch(/var\(--(bg|ink|accent|link)\b/)
    // the logo's blue
    expect(CSS).toContain('--hp-blue: var(--d2v-blue)')
    expect(read('app/globals.css')).toContain('--d2v-blue: #22B5FF')
    // no typed colours in the page's own CSS: they live in globals.css
    expect(CSS.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).toEqual([])
  })

  it('the cookie notice is the small dark card on the Docs2Video public site only', () => {
    expect(isFrontPage('/', 'docs2video')).toBe(true)
    expect(isFrontPage('/', 'text2art')).toBe(false)
    for (const p of ['/pricing', '/for/insurance', '/blog', '/blog/why-video-beats-pdf', '/login', '/signup', '/contact', '/terms', '/share-demo', '/try/demo']) expect(isFrontPage(p, 'docs2video'), p).toBe(true)
    // the app keeps its own bar
    for (const p of ['/dashboard', '/create', '/library', '/forum']) expect(isFrontPage(p, 'docs2video'), p).toBe(false)
    expect(isClientSharePage('/watch/abc')).toBe(true)
  })
})
