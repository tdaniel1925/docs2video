import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { HOW_TO, GETTING_AROUND, howToFor, boldParts } from '../app/_lib/how-to-use'
import { NAMES } from '../app/_lib/names'

/**
 * "How to use" (overhaul phase 2, step 4). Each screen's steps live in
 * app/_lib/how-to-use.ts. These checks keep them TRUE:
 *  - every route a guide is for is a real page, and so is its Help link;
 *  - every **bold** phrase (the screen's own words) really appears in the
 *    files that draw that screen — rename a button and this fails until the
 *    guide is changed too;
 *  - the screens the overhaul asked for all have a guide;
 *  - no price is typed into a guide.
 */
const ROOT = path.resolve(__dirname, '..')
const pageFile = (route: string) => path.join(ROOT, 'app', '(dashboard)', ...route.split('/').filter(Boolean), 'page.tsx')

/** Source text as the screen shows it: entities and curly quotes made plain. */
function plain(text: string): string {
  return text
    // Words a screen reads from names.ts count as its own words.
    .replace(/\$?\{NAMES\.(\w+)\}/g, (m, k: string) => (k in NAMES ? NAMES[k as keyof typeof NAMES] : m))
    // What shows is the text, not the tags around part of it ("Import from <em>website</em>").
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/&rsquo;|&lsquo;|&apos;|&#39;|’|‘/g, "'")
    .replace(/&ldquo;|&rdquo;|&quot;|“|”/g, '"')
    .replace(/&rarr;|\\u2192/g, '→')
    .replace(/&mdash;|\\u2014/g, '—')
    .replace(/&ndash;|\\u2013/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

describe('How to use — routes', () => {
  it('every route a guide is for is a real page', () => {
    for (const entry of HOW_TO) {
      for (const route of entry.routes) {
        expect(existsSync(pageFile(route)), `${entry.title}: ${route} has no page`).toBe(true)
      }
    }
  })

  it('every Help Center link opens a real article', () => {
    for (const g of [...HOW_TO, GETTING_AROUND]) {
      expect(g.helpHref.startsWith('/help'), g.title).toBe(true)
      expect(existsSync(pageFile(g.helpHref)), `${g.title}: ${g.helpHref}`).toBe(true)
    }
  })

  it('covers Home, the create steps, the send step, Library, a result page, Brands, Clients and Settings', () => {
    const routes = HOW_TO.flatMap((e) => e.routes)
    for (const r of ['/dashboard', '/create', '/create/script', '/create/theme', '/create/generating', '/videos', '/videos/[id]', '/brands', '/clients', '/settings']) {
      expect(routes, r).toContain(r)
    }
  })

  it('finds the right guide for an address', () => {
    expect(howToFor('/dashboard').title).toBe('Home')
    expect(howToFor('/create').title).toMatch(/^Step 1/)
    expect(howToFor('/create/script').title).toMatch(/^Step 2/)
    expect(howToFor('/create/theme').title).toMatch(/^Step 3/)
    expect(howToFor('/create/generating').title).toBe('Making it')
    expect(howToFor('/videos').title).toBe('Library')
    expect(howToFor('/videos/0b8d2c1e-1111-4a4a-9a9a-123456789abc').title).toBe('Your finished project')
    expect(howToFor('/brands/new').title).toBe('Brands')
    expect(howToFor('/brands/abc').title).toBe('Brands')
    expect(howToFor('/clients/abc').title).toBe('Clients')
    // A screen without its own guide gets "Getting around", never nothing.
    const other = howToFor('/analytics')
    expect(other.own).toBe(false)
    expect(other.title).toBe(GETTING_AROUND.title)
    expect(howToFor('/videos/abc/edit').own).toBe(false)
  })
})

describe('How to use — the words are the screen’s own', () => {
  for (const g of [...HOW_TO, GETTING_AROUND]) {
    it(`${g.title}: every bold phrase appears on that screen`, () => {
      const source = plain(g.sources.map((s) => {
        const file = path.join(ROOT, s)
        expect(existsSync(file), `${g.title}: source ${s} is missing`).toBe(true)
        return readFileSync(file, 'utf8')
      }).join('\n'))
      const missing: string[] = []
      for (const step of g.steps) {
        for (const part of boldParts(step)) {
          if (part.bold && !source.includes(plain(part.text))) missing.push(part.text)
        }
      }
      expect(missing, `not found in ${g.sources.join(', ')}`).toEqual([])
    })
  }

  it('the checker can fail: a made-up button is not found', () => {
    const home = HOW_TO.find((e) => e.routes.includes('/dashboard'))!
    const source = plain(home.sources.map((s) => readFileSync(path.join(ROOT, s), 'utf8')).join('\n'))
    expect(source.includes(plain('Start from a document'))).toBe(false)
    expect(source.includes(plain('Make your first video'))).toBe(false)
  })

  it('steps are short, numbered by the pop-up, and type no prices', () => {
    for (const g of [...HOW_TO, GETTING_AROUND]) {
      expect(g.steps.length, g.title).toBeGreaterThanOrEqual(3)
      expect(g.steps.length, g.title).toBeLessThanOrEqual(6)
      for (const step of g.steps) {
        expect(step, `${g.title}: a price is typed`).not.toMatch(/\$\d|\d[\d,]*\s*credits/)
        expect(step, `${g.title}: number it in the pop-up, not the text`).not.toMatch(/^\d+[.)]/)
      }
    }
  })

  it('no video is recorded yet, and the pop-up shows nothing in its place', () => {
    for (const g of HOW_TO) expect(g.video, g.title).toBeUndefined()
    const dialog = readFileSync(path.join(ROOT, 'app/_components/HowToUse.tsx'), 'utf8')
    expect(dialog).toMatch(/\{guide\.video && \(/)
    expect(dialog).toMatch(/More in the Help Center/)
  })
})
