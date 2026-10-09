import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { normalizeUrl, tidyUrlInput } from '../app/_lib/normalize-url'
import { cleanWebLink } from '../app/_lib/url-validate'

/**
 * Nobody has to type "https://" (owner request 2026-10-09). One helper cleans
 * every website box and every route that receives one; the customer screens
 * use plain text boxes (type="url" made the browser refuse "botmakers.ai").
 */
const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

describe('normalizeUrl', () => {
  it('adds https://, keeps a typed http://, lower-cases the host, trims', () => {
    expect(normalizeUrl('botmakers.ai')).toBe('https://botmakers.ai')
    expect(normalizeUrl('www.x.com')).toBe('https://www.x.com')
    expect(normalizeUrl('http://x.com')).toBe('http://x.com')
    expect(normalizeUrl('https://x.com')).toBe('https://x.com')
    expect(normalizeUrl('  X.com/path ')).toBe('https://x.com/path')
    expect(normalizeUrl('Acme.COM/About?x=1')).toBe('https://acme.com/About?x=1')
    expect(normalizeUrl('HTTPS://Acme.com/')).toBe('https://acme.com/')
    expect(normalizeUrl('calendly.com/me/30min')).toBe('https://calendly.com/me/30min')
    expect(normalizeUrl('x.com:8080/a')).toBe('https://x.com:8080/a')
  })

  it('refuses junk', () => {
    for (const bad of ['', '   ', 'hello world', 'acme', 'not a site.com', 'javascript:alert(1)', 'JavaScript:alert(1)',
      'mailto:a@b.com', 'data:text/html,hi', 'ftp://x.com', 'https://user:pw@evil.com', 'a..b', 'http://', '...', null, undefined, 42]) {
      expect(normalizeUrl(bad as unknown), String(bad)).toBeNull()
    }
  })

  it('a text box keeps what was typed when it can’t be cleaned', () => {
    expect(tidyUrlInput('botmakers.ai')).toBe('https://botmakers.ai')
    expect(tidyUrlInput('acme')).toBe('acme')
    expect(tidyUrlInput('')).toBe('')
  })

  it('settings links still insist on https (share-page buttons)', () => {
    expect(cleanWebLink('calendly.com/me')).toBe('https://calendly.com/me')
    expect(cleanWebLink('http://buy.stripe.com/x')).toBeNull()
  })
})

describe('customer website boxes and the routes behind them', () => {
  const SCREENS = [
    'app/(dashboard)/create/_components/Step1Content.tsx',
    'app/(dashboard)/create/commercial/page.tsx',
    'app/(dashboard)/create/brand/page.tsx',
    'app/(dashboard)/create/_components/make/AddBrandPiece.tsx',
    'app/(dashboard)/brands/new/page.tsx',
    'app/(dashboard)/brands/[id]/page.tsx',
    'app/(dashboard)/settings/page.tsx',
    'app/(public)/try/[slug]/page.tsx',
  ]

  it('no type="url" box (the browser refuses "botmakers.ai" in one) and no "https://" placeholders', () => {
    for (const f of SCREENS) {
      const src = read(f)
      expect(src, f).not.toMatch(/type=["']url["']/)
      expect(src, f).not.toMatch(/placeholder=\{?["'`]https?:\/\//)
      expect(src, f).toMatch(/normalize-url/)
    }
    // The check can fail.
    expect(/type=["']url["']/.test('<input type="url" />')).toBe(true)
  })

  it('the routes clean the address before using it', () => {
    // ('reference-url' was retired 2026-10-09 — no caller, uncapped AI.)
    for (const r of ['extract-url', 'brand-from-url', 'scrape-brand', 'generate-commercial', 'generate-slides', 'try-demo']) {
      expect(read(`app/api/${r}/route.ts`), r).toMatch(/normalizeUrl\(/)
    }
    // generate-commercial cleans it BEFORE the "does this site exist?" check.
    const gc = read('app/api/generate-commercial/route.ts')
    expect(gc.indexOf('normalizeUrl(rawUrl)')).toBeGreaterThan(0)
    expect(gc.indexOf('normalizeUrl(rawUrl)')).toBeLessThan(gc.indexOf('await lookup('))
  })
})
