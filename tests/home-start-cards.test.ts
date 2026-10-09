import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { CREATE_SOURCES, createHref, methodFromSource } from '../app/_lib/create-sources'
import { START_CARDS, PASTE_HREF } from '../app/(dashboard)/dashboard/_home/start-cards'

/**
 * Home (overhaul phase 2, step 4): start cards first, then today's clients,
 * then projects. Each card opens step 1 with its source already chosen —
 * /create?source=upload|url|paste|ai — and step 1 must honour it.
 */
const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('?source= on step 1', () => {
  it('maps each address word to step 1’s own choice', () => {
    expect(methodFromSource('upload')).toBe('upload')
    expect(methodFromSource('url')).toBe('url')
    expect(methodFromSource('paste')).toBe('text')
    expect(methodFromSource('ai')).toBe('idea')
    for (const junk of [null, undefined, '', 'pdf', 'idea', 'toString', '__proto__']) {
      expect(methodFromSource(junk as string | null), String(junk)).toBeNull()
    }
    expect(createHref('url')).toBe('/create?source=url')
  })

  it('step 1 starts with the chosen source picked', () => {
    const step1 = code('app/(dashboard)/create/_components/Step1Content.tsx')
    expect(step1).toMatch(/useState<InputMethod>\(\(\) => methodFromSource\(searchParams\.get\('source'\)\)\)/)
    // Every value the table can produce is one of step 1's real choices.
    const ids = [...step1.matchAll(/^ {2}(\w+): \{ lead: /gm)].map((m) => m[1])
    expect(ids.length).toBe(4)
    for (const method of Object.values(CREATE_SOURCES)) expect(ids, method).toContain(method)
  })
})

describe('the start cards', () => {
  it('are the six round-B tiles, in order (two rows of three)', () => {
    expect(START_CARDS.map((c) => c.title)).toEqual(['From a document', 'From a website', 'From an idea', 'Paste your text', 'A commercial', 'Your brand'])
    // One line each, short enough for a compact tile.
    for (const c of START_CARDS) expect(c.text.length, c.title).toBeLessThanOrEqual(45)
  })

  it('each opens step 1 with a source step 1 knows — the commercial opens its own maker', () => {
    const want: Record<string, string | null> = { document: 'upload', website: 'url', idea: 'idea', paste: 'text', commercial: null, brand: null }
    for (const card of START_CARDS) {
      const url = new URL(card.href, 'https://x.test')
      if (card.key === 'brand') {
        expect(url.pathname).toBe('/brands')
      } else if (card.key === 'commercial') {
        expect(url.pathname).toBe('/create/commercial')
        expect(existsSync(path.join(ROOT, 'app/(dashboard)/create/commercial/page.tsx'))).toBe(true)
      } else {
        expect(url.pathname, card.title).toBe('/create')
        expect(methodFromSource(url.searchParams.get('source')), card.title).toBe(want[card.key])
      }
    }
    expect(methodFromSource(new URL(PASTE_HREF, 'https://x.test').searchParams.get('source'))).toBe('text')
  })
})

describe('Home', () => {
  const home = code('app/(dashboard)/dashboard/page.tsx')

  it('shows the Create tiles, then today’s clients, then recent projects — under small grey labels', () => {
    const start = home.indexOf('className="kit-label">Create<')
    const today = home.indexOf('className="kit-label">Today’s clients<')
    const projects = home.indexOf('className="kit-label">Recent<')
    expect(start).toBeGreaterThan(0)
    expect(today).toBeGreaterThan(start)
    expect(projects).toBeGreaterThan(today)
    expect(home).toMatch(/START_CARDS\.map/)
  })

  it('keeps the today’s-clients cards and This month', () => {
    expect(home).toMatch(/home\.cards\.map/)
    expect(home).toMatch(/This month/)
    for (const label of ['Emails sent', 'Projects watched', 'Clicked to book a call', 'Credits left']) expect(home).toContain(label)
  })

  it('dropped the "Start from a document" box and the separate 4-step explainer', () => {
    expect(home).not.toMatch(/Start from a document/)
    expect(home).not.toMatch(/Make your first video|Four short steps|FirstVisit/)
    // New users get the cards plus a short welcome instead.
    expect(home).toMatch(/!home\.hasAnyProject && \(\s*<p className=\{s\.welcome\}>/)
  })

  it('is built from the kit', () => {
    expect(home).toMatch(/from '\.\.\/\.\.\/_components\/kit'/)
    expect(home).not.toMatch(/className="btn /)
  })
})
