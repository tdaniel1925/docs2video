import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isFrontPage, isClientSharePage } from '../app/_components/CookieBanner'

/*
 * Guards for the rebuilt front page (approved design "Home-after", 2026-10-14).
 * Each check was run against a planted mistake first (see the "catches" lines)
 * so a pass means something.
 */

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const HOME = read('app/_components/marketing/Docs2VideoHome.tsx')
const CSS = read('app/_components/marketing/home.css')

/** Prices or video counts typed into the page instead of read from pricing.ts. */
export function hardcodedPrices(src: string): string[] {
  const hits: string[] = []
  for (const m of src.matchAll(/\$(29|79|199|499)\b/g)) hits.push(m[0])
  for (const m of src.matchAll(/About (2|5|25|75|200) videos/g)) hits.push(m[0])
  return hits
}

/** Any border-radius above 10px, except 50% circles. */
export function bigCorners(css: string): string[] {
  return [...css.matchAll(/border-radius:\s*([^;]+);/g)]
    .map((m) => m[1].trim())
    .filter((v) => v !== '50%' && v.split(/\s+/).some((p) => parseFloat(p) > 10))
}

describe('front page', () => {
  it('reads prices and video counts from pricing.ts', () => {
    expect(hardcodedPrices('<b>$79/mo</b> About 25 videos a month')).toEqual(['$79', 'About 25 videos'])
    expect(hardcodedPrices(HOME)).toEqual([])
    expect(HOME).toMatch(/from '\.\.\/\.\.\/_lib\/pricing'/)
    expect(HOME).toMatch(/approxStandardVideos/)
    expect(HOME).toMatch(/key: 'free', name: free\.label/)
  })

  it('shows the four current looks with their real sample pictures', () => {
    for (const name of ['Animated slides', 'Editorial', 'Bright', 'Drawn slides']) expect(HOME).toContain(`name: '${name}'`)
    for (const pic of ['kit-animated-slides-data.png', 'kit-editorial-cover.png', 'kit-bright-data.png', 'drawn-3d.png', 'kit-animated-slides-cover.png']) {
      expect(HOME).toContain(`/style-samples/${pic}`)
    }
    for (const old of ['aurora', 'cinematic', 'infographic', 'explainer-']) expect(HOME.toLowerCase()).not.toContain(`style-samples/${old}`)
  })

  it('has no comparison table and no "Most popular" claim', () => {
    expect(HOME).not.toMatch(/<table/)
    expect(HOME).not.toMatch(/COMPARE/)
    expect(HOME.toLowerCase()).not.toContain('most popular')
  })

  it('loads only the hero picture eagerly', () => {
    expect((HOME.match(/\bpriority\b/g) ?? []).length).toBe(1)
    expect((HOME.match(/\bpreload\b(?!: false)/g) ?? []).length).toBe(0)
    // every next/image on the page says how wide it is drawn
    const images = HOME.match(/<Image[\s\S]*?\/>/g) ?? []
    expect(images.length).toBeGreaterThan(4)
    for (const img of images) expect(img, img.slice(0, 80)).toMatch(/sizes=/)
  })

  it('keeps the house corner rule (10px at most)', () => {
    expect(bigCorners('.a { border-radius: 12px; } .b { border-radius: 50%; } .c { border-radius: 8px 14px; }')).toEqual(['12px', '8px 14px'])
    expect(bigCorners(CSS)).toEqual([])
  })

  it('fonts are scoped to the page, not the app', () => {
    expect(HOME).toMatch(/Schibsted_Grotesk/)
    expect(HOME).toMatch(/JetBrains_Mono/)
    expect(read('app/layout.tsx')).not.toMatch(/Schibsted|JetBrains/)
    // light only: fixed colours, not the app's theme tokens
    expect(CSS).not.toMatch(/var\(--(bg|ink|accent|link)\b/)
  })

  it('the cookie notice is the small front-page version only on the Docs2Video home', () => {
    expect(isFrontPage('/', 'docs2video')).toBe(true)
    expect(isFrontPage('/', 'text2art')).toBe(false)
    expect(isFrontPage('/pricing', 'docs2video')).toBe(false)
    expect(isClientSharePage('/watch/abc')).toBe(true)
  })
})
