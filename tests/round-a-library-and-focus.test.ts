import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * ROUND A (2026-10) — the Library as picture cards, one icon set, and the
 * focus header while making something.
 *  - every card says where it is in plain words, coloured by state;
 *  - Delete is never one click away: it hides in the "…" menu and only the
 *    "Delete this for good?" box can send the DELETE;
 *  - every /create page wears the focus header (Home · step numbers ·
 *    credits) instead of the full bar.
 * The pages are rendered for real (server markup), with the router mocked.
 */

let pathname = '/videos'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
}))

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

import { statusLine, sendHref, openHref, searchAndSort, clock, type LibraryItem } from '../app/(dashboard)/videos/library-items'
import Library from '../app/(dashboard)/videos/Library'
import Header from '../app/_components/Header'
import { isFocusPath } from '../app/_lib/top-bar'
import { DOCS2VIDEO } from '../app/_lib/brand'
import type { Profile } from '../app/_lib/types'

function item(over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: over.id ?? 'v1', videoId: over.videoId === undefined ? (over.id ?? 'v1') : over.videoId, type: 'video', kind: 'video', label: 'Video',
    title: 'Your Coverage at a Glance', recipient: 'The Rivera Family', fileUrl: null, picture: null,
    duration: 90, status: 'completed', progressPct: null, creditsUsed: 1000, createdAt: '2026-10-01T12:00:00Z',
    ...over,
  }
}

describe('the status line says where it is, in plain words', () => {
  it('ready, making, failed, draft', () => {
    expect(statusLine(item())).toEqual({ words: 'Ready to send · 1:30', tone: 'ready' })
    expect(statusLine(item({ duration: null })).words).toBe('Ready to send')
    expect(statusLine(item({ status: 'processing', progressPct: 40 }))).toEqual({ words: 'Making… 65%', tone: 'making' })
    expect(statusLine(item({ status: 'failed' }))).toEqual({ words: 'Didn’t finish', tone: 'failed' })
    expect(statusLine(item({ status: 'draft' })).tone).toBe('draft')
    // Graphics and built decks have no status column — in the Library = done.
    expect(statusLine(item({ type: 'flyer', status: null })).words).toBe('Ready')
    expect(clock(61)).toBe('1:01')
  })

  it('only ready videos get Send, and it lands on the send panel', () => {
    expect(sendHref(item())).toBe('/videos/v1#send')
    expect(sendHref(item({ status: 'failed' }))).toBeNull()
    expect(sendHref(item({ type: 'flyer', videoId: null }))).toBeNull()
    expect(read('app/(dashboard)/videos/[id]/send/ReadyToSend.tsx')).toMatch(/id="send"/)
  })

  it('a draft opens where it was left; search reads title and client', () => {
    expect(openHref(item({ status: 'draft', draftStep: 3 }))).toBe('/create/script?id=v1')
    const list = [item({ id: 'a', title: 'Alpha' }), item({ id: 'b', title: 'Beta', recipient: 'Jordan Lee' })]
    expect(searchAndSort(list, 'jordan', 'newest').map((i) => i.id)).toEqual(['b'])
    expect(searchAndSort(list, '', 'name').map((i) => i.id)).toEqual(['a', 'b'])
  })
})

describe('the Library renders picture cards', () => {
  const items = [
    item({ id: 'ready', title: 'Ready one', picture: 'https://example.com/cover.png' }),
    item({ id: 'making', title: 'Making one', status: 'processing', progressPct: 80 }),
    item({ id: 'failed', title: 'Failed one', status: 'failed' }),
    item({ id: 'graphic', title: 'Poster', type: 'flyer', kind: 'graphic', label: 'Graphic', videoId: null, status: null, picture: 'https://example.com/poster.png', fileUrl: 'https://example.com/poster.png' }),
  ]
  const html = renderToStaticMarkup(h(Library, { items }))

  it('one card per item, each with its status words and a picture or a placeholder', () => {
    expect((html.match(/<li /g) ?? []).length).toBe(4)
    for (const words of ['Ready to send · 1:30', 'Making… 80%', 'Didn’t finish', 'Ready']) expect(html).toContain(words)
    expect(html).toContain('src="https://example.com/cover.png"')
    // The custom graphic shows its own image.
    expect(html).toContain('src="https://example.com/poster.png"')
    // The making and failed ones have no picture: the placeholder, never an empty <img>.
    expect(html).not.toMatch(/<img[^>]*src=""/)
    expect((html.match(/<img /g) ?? []).length).toBe(2)
  })

  it('Send appears on the ready video only', () => {
    expect((html.match(/href="\/videos\/[^"]+#send"/g) ?? [])).toEqual(['href="/videos/ready#send"'])
  })

  it('there is no Delete button until the "…" menu opens — and only the confirm box deletes', () => {
    expect(html).not.toMatch(/>\s*Delete/)
    expect(html).toMatch(/aria-label="More for Ready one"/)
    const lib = read('app/(dashboard)/videos/Library.tsx')
    // The DELETE request lives in confirmDelete…
    const fn = lib.slice(lib.indexOf('async function confirmDelete'), lib.indexOf('const askDelete'))
    expect(fn).toMatch(/method: 'DELETE'/)
    expect(lib.match(/method: 'DELETE'/g)?.length).toBe(1)
    // …which only the dialog's Delete button calls.
    expect(lib.match(/confirmDelete\b/g)?.length).toBe(2)
    expect(lib).toMatch(/title="Delete this for good\?"[\s\S]*onClick=\{confirmDelete\}/)
    // The menu and the list only ASK (they open the confirm box).
    for (const f of ['app/(dashboard)/videos/CardMenu.tsx', 'app/(dashboard)/videos/LibraryTable.tsx']) {
      expect(read(f), f).not.toMatch(/fetch\(|method: 'DELETE'/)
    }
  })

  it('has search, order, cards/list switch, and remembers the switch safely', () => {
    expect(html).toContain('aria-label="Search your library"')
    expect(html).toContain('aria-label="Order"')
    expect(html).toMatch(/aria-label="Cards"/)
    expect(html).toMatch(/aria-label="List"/)
    const lib = read('app/(dashboard)/videos/Library.tsx')
    expect(lib).toMatch(/try \{ if \(window\.localStorage\.getItem\(VIEW_KEY\)/)
    expect(lib).toMatch(/try \{ window\.localStorage\.setItem\(VIEW_KEY/)
  })

  it('reads pictures in the same query (no per-card fetch)', () => {
    const page = read('app/(dashboard)/videos/page.tsx')
    expect(page).toMatch(/first_slide:slide_urls->>0/)
    expect(read('app/(dashboard)/videos/Library.tsx')).not.toMatch(/supabase|\.from\(/)
  })
})

describe('the focus header while making something', () => {
  const profile = { id: 'u', email: 'sam@example.com', full_name: 'Sam', subscription_status: 'pro', is_admin: false } as unknown as Profile

  it('is on every /create page, and nowhere else', () => {
    for (const p of ['/create', '/create/script', '/create/theme', '/create/generating', '/create/commercial']) expect(isFocusPath(p), p).toBe(true)
    for (const p of ['/dashboard', '/videos', '/creator', '/videos/abc']) expect(isFocusPath(p), p).toBe(false)
  })

  it('step 3: Home, the three steps with step 3 current, How to use — no Library/Clients/Brands', () => {
    pathname = '/create/theme'
    const html = renderToStaticMarkup(h(Header, { profile, brand: DOCS2VIDEO, lowCreditsAt: 1000 }))
    expect(html).toContain('data-testid="focus-header"')
    expect(html).toMatch(/href="\/dashboard"[^>]*>.*Home/)
    for (const w of ['Your content', 'The story', 'The look']) expect(html).toContain(w)
    for (const w of ['What it’s about', 'Make it yours', 'Send it']) expect(html).not.toContain(w)
    expect(html).toMatch(/aria-current="step"[^>]*>.*?<span class="kit-focusbar-num"[^>]*>3</)
    expect(html).toContain('How to use')
    expect(html).not.toContain('href="/videos"')
    expect(html).not.toContain('href="/clients"')
  })

  it('the waiting screen keeps it; other screens get the full bar', () => {
    pathname = '/create/generating'
    expect(renderToStaticMarkup(h(Header, { profile, brand: DOCS2VIDEO }))).toContain('data-testid="focus-header"')
    pathname = '/videos'
    const full = renderToStaticMarkup(h(Header, { profile, brand: DOCS2VIDEO }))
    expect(full).not.toContain('focus-header')
    expect(full).toContain('href="/videos"')
  })
})

describe('one icon set', () => {
  it('lucide is the only icon library, and the replaced hand-drawn icons are gone', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.dependencies['lucide-react']).toBeTruthy()
    for (const f of ['app/_components/Header.tsx', 'app/(dashboard)/dashboard/page.tsx', 'app/(dashboard)/videos/[id]/result/ResultHeader.tsx']) {
      expect(read(f), f).not.toMatch(/<svg[\s>]/)
      expect(read(f), f).toMatch(/from 'lucide-react'/)
    }
  })
})
