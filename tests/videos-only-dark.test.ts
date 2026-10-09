import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import {
  D2V_OUTPUTS, RETIRED_MAKER_APIS, RETIRED_PAGES, d2vOutputs, isRetiredMakerCall, isRetiredOutput, retiredPageRedirect,
} from '../app/_lib/videos-only'
import { outputsOffered } from '../app/_lib/price-quote'
import { DOCS2VIDEO, TEXT2ART } from '../app/_lib/brand'
import { ACCOUNT_MENU } from '../app/_lib/top-bar'
import { START_CARDS } from '../app/(dashboard)/dashboard/_home/start-cards'
import { HOW_TO } from '../app/_lib/how-to-use'
import { libraryTabs, tabFor, isOlderKind, OLDER_LABEL } from '../app/(dashboard)/videos/library-tabs'
import { openHref, canDelete } from '../app/(dashboard)/videos/library-items'
import { kindOfOutput } from '../app/_lib/names'
import { outputKind } from '../app/(dashboard)/videos/[id]/result/output'
import { downloadsFor } from '../app/(dashboard)/videos/[id]/result/downloads'
import { DEFAULT_PREF, THEME_BOOT_SCRIPT, THEME_KEY, parsePref, resolveTheme } from '../app/_lib/theme-pref'

/**
 * VIDEOS ONLY + DARK BY DEFAULT (owner decisions 2026-10-09).
 *
 *  - Docs2Video offers no way to START a slide deck, a PowerPoint/PDF project
 *    or a custom graphic: not on Home, the top bar, step 1, step 3, the help
 *    or the help assistant. Old maker addresses redirect; the routes that
 *    start one refuse on Docs2Video. Text2Art keeps all of it.
 *  - Things already made still open, download and delete (Library → Older items).
 *  - Nothing saved = Dark. The share page /watch stays light.
 *  - Admin, pricing, AI Social and the photo fixer follow dark (no LightOnly).
 * Each rule is also shown to FAIL on a planted bad value.
 */
const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
function walk(p: string, out: string[] = []): string[] {
  const abs = path.join(ROOT, p)
  if (statSync(abs).isDirectory()) { for (const e of readdirSync(abs)) walk(path.join(p, e), out) }
  else if (/\.tsx?$/.test(p)) out.push(p)
  return out
}

/** Links that would start a removed maker. */
const MAKER_LINK = /["'`](\/design|\/flyers?|\/deck-builder|\/demo-slide|\/template-demo)(["'`/?])|\/create\?[^"'`]*type=(deck|slides)/
/** Words that offer a slide deck / graphic as something to make now. */
const OFFERS_DECK = /(Narrated video[^.]{0,60}(Slide deck|slide deck))|Custom [Gg]raphics:|Making custom graphics|>Custom graphics</

describe('Docs2Video offers no slide-deck or graphics maker', () => {
  it('step 3 offers a video or a presentation, whatever the server or an old draft says', () => {
    expect([...D2V_OUTPUTS]).toEqual(['video', 'interactive'])
    expect(d2vOutputs(['video', 'interactive', 'deck', 'pptx', 'pdf'])).toEqual(['video', 'interactive'])
    for (const cur of ['video', 'interactive', 'deck', 'pptx', 'pdf']) expect(outputsOffered(cur)).toEqual(['video', 'interactive'])
    const step3 = read('app/(dashboard)/create/theme/page.tsx')
    expect(step3).toContain('offered={d2vOutputs(')
    expect(step3).not.toMatch(/Make the deck/)
    // An old draft saved as a deck / PowerPoint / PDF opens as a video.
    expect(step3).toMatch(/return v === 'video' \|\| v === 'interactive' \? v : null/)
    for (const o of ['deck', 'pptx', 'pdf']) expect(isRetiredOutput(o)).toBe(true)
    for (const o of ['video', 'interactive', null, 42]) expect(isRetiredOutput(o)).toBe(false)
  })

  it('no entry on Home, the top bar, the account menu or step 1', () => {
    const links = [...START_CARDS.map((c) => c.href), ...DOCS2VIDEO.nav.map((n) => n.href), DOCS2VIDEO.create!.href, ...ACCOUNT_MENU.map((m) => m.href)]
    expect(links.filter((h) => MAKER_LINK.test(`'${h}'`))).toEqual([])
    const step1 = read('app/(dashboard)/create/_components/Step1Content.tsx')
    expect(step1).not.toMatch(MAKER_LINK)
    expect(step1).not.toMatch(/Custom graphics/)
    expect(step1).toMatch(/useState<OutputType>\(wizType === 'interactive' \? 'interactive' : 'video'\)/)
    // The check can fail: a planted link is caught.
    expect(MAKER_LINK.test(`<a href="/design">Custom graphics</a>`)).toBe(true)
    expect(MAKER_LINK.test(`'/create?type=deck&for=general'`)).toBe(true)
  })

  it('no Docs2Video screen links to a removed maker (Text2Art’s own screens excepted)', () => {
    const skip = /^app\/\(dashboard\)\/(design|flyer|flyers|deck-builder|demo-slide|template-demo|logo-creator|library)\/|^app\/\(dashboard\)\/help\/(flyers|restyle-deck)\//
    const files = [...walk('app/(dashboard)'), ...walk('app/_components')].map((f) => f.replace(/\\/g, '/')).filter((f) => !skip.test(f))
    // Text2Art's storefront definition legitimately points at /design.
    const hits = files.filter((f) => MAKER_LINK.test(read(f)) && !/Text2Art|text2art/.test(f))
    expect(hits).toEqual([])
  })

  it('the help, How to use and the help assistant don’t offer decks or graphics', () => {
    const texts = [
      read('app/api/help-chat/route.ts'), read('app/_lib/how-to-use.ts'), read('app/(dashboard)/help/page.tsx'),
      read('app/(dashboard)/help/creating-videos/page.tsx'), read('app/(dashboard)/help/pricing/page.tsx'),
      JSON.stringify(HOW_TO),
    ]
    for (const t of texts) expect(t).not.toMatch(OFFERS_DECK)
    expect(read('app/(dashboard)/help/pricing/page.tsx')).not.toMatch(/\['(Custom Graphics|Slide deck|PowerPoint \(PPTX\)|PDF document)/)
    // Docs2Video's help index hides the Text2Art-only guides; Text2Art keeps them.
    const help = read('app/(dashboard)/help/page.tsx')
    expect(help).toMatch(/GUIDES\.filter\(\(g\) => !TEXT2ART_ONLY_GUIDES\.includes\(g\.href\)\)/)
    expect(help).toMatch(/\[\.\.\.TEXT2ART_ONLY_GUIDES, '\/help\/pricing'/)
    // The check can fail.
    expect(OFFERS_DECK.test('pick **Narrated video**, **Interactive presentation** or **Slide deck**')).toBe(true)
  })

  it('old maker addresses redirect on Docs2Video only; Text2Art keeps them', () => {
    for (const { prefix, to } of RETIRED_PAGES) {
      expect(retiredPageRedirect(prefix, 'docs2video'), prefix).toBe(to)
      expect(retiredPageRedirect(prefix + '/x', 'docs2video'), prefix).toBe(to)
      expect(retiredPageRedirect(prefix, 'text2art'), prefix).toBeNull()
    }
    expect(retiredPageRedirect('/design', 'docs2video')).toBe('/dashboard')
    expect(retiredPageRedirect('/design/results', 'docs2video')).toBe('/dashboard')
    expect(retiredPageRedirect('/deck-builder', 'docs2video')).toBe('/dashboard')
    expect(retiredPageRedirect('/library', 'docs2video')).toBe('/videos?type=older')
    expect(retiredPageRedirect('/help/flyers', 'docs2video')).toBe('/help')
    // Segment match: these are NOT retired.
    for (const p of ['/designs', '/dashboard', '/videos', '/help', '/fix', '/create', '/create/commercial', '/watch/abc'])
      expect(retiredPageRedirect(p, 'docs2video'), p).toBeNull()
    expect(TEXT2ART.home).toBe('/design') // Text2Art's own home is untouched
  })

  it('routes that start a deck or graphic refuse on Docs2Video; reading old files still works', () => {
    for (const api of RETIRED_MAKER_APIS) {
      expect(isRetiredMakerCall(api, 'POST', 'docs2video'), api).toBe(true)
      expect(isRetiredMakerCall(api, 'POST', 'text2art'), api).toBe(false)
    }
    expect(isRetiredMakerCall('/api/flyer-file/123', 'GET', 'docs2video')).toBe(false)
    expect(isRetiredMakerCall('/api/flyer-chats/123', 'DELETE', 'docs2video')).toBe(false)
    expect(isRetiredMakerCall('/api/generate-video', 'POST', 'docs2video')).toBe(false)
    expect(isRetiredMakerCall('/api/generate-commercial', 'POST', 'docs2video')).toBe(false)
    // proxy.ts refuses AFTER the server's own (x-internal-service) calls are let through.
    const proxy = read('proxy.ts')
    expect(proxy.indexOf('isRetiredMakerCall(pathname')).toBeGreaterThan(proxy.indexOf('if (diff === 0) return response'))
    expect(proxy).toMatch(/retiredPageRedirect\(pathname, brand\.id\)/)
    // The shared make routes refuse the deck outputs themselves (browser calls on Docs2Video).
    expect(read('app/api/generate-presentation/route.ts')).toMatch(/outputType === 'deck' && !isInternalCall && \(await getBrand\(\)\)\.id === 'docs2video'/)
    expect(read('app/api/generate-video/route.ts')).toMatch(/!isInternalCall && isRetiredOutput\(priceInputs\.draftOutputType\) && \(await getBrand\(\)\)\.id === 'docs2video'/)
  })
})

describe('old decks and graphics still open, download and delete', () => {
  it('the Library files them under Older items, shown only when there are some', () => {
    expect(libraryTabs(false).map((t) => t.label)).toEqual(['All', 'Videos', 'Presentations'])
    expect(libraryTabs(true).map((t) => t.label)).toEqual(['All', 'Videos', 'Presentations', OLDER_LABEL])
    expect(isOlderKind('deck') && isOlderKind('graphic') && isOlderKind(null)).toBe(true)
    expect(isOlderKind('video') || isOlderKind('presentation')).toBe(false)
    // Old bookmarks still land on just those.
    expect(tabFor('deck')!.shows('deck')).toBe(true)
    expect(tabFor('deck')!.shows('graphic')).toBe(false)
    expect(tabFor('flyer')!.shows('graphic')).toBe(true)
    expect(tabFor('older')!.shows('video')).toBe(false)
    expect(tabFor('nonsense')).toBeNull()
  })

  it('an old slide deck opens its page with its downloads; an old graphic opens its picture', () => {
    expect(kindOfOutput('deck')).toBe('deck')
    expect(kindOfOutput('pptx')).toBe('deck')
    const deckRow = { type: 'video', status: 'completed', videoId: 'v1', id: 'v1', draftStep: undefined, fileUrl: null }
    expect(openHref(deckRow)).toBe('/videos/v1')
    expect(canDelete(deckRow)).toBe(true)
    expect(outputKind({ output_type: 'deck' })).toBe('deck')
    const keys = downloadsFor({ output_type: 'deck', draft_data: { scenes: [{ title: 'a' }] } }).map((d) => d.key)
    expect(keys).toEqual(expect.arrayContaining(['pdf', 'pptx']))
    const graphic = { type: 'flyer', status: null, videoId: null, id: 'c1', draftStep: undefined, fileUrl: '/api/flyer-file/abc' }
    expect(openHref(graphic)).toBe('/api/flyer-file/abc')
    // A video still offers its own MP4 + slides downloads.
    const video = downloadsFor({ output_type: 'video', video_url: 'x.mp4', slide_urls: ['a.png'] }).map((d) => d.key)
    expect(video).toEqual(expect.arrayContaining(['mp4', 'pdf', 'pptx']))
  })
})

describe('dark by default; the share page stays light', () => {
  const run = (saved: string | null | 'throw', systemDark: boolean) => {
    const attrs: Record<string, string> = {}
    const document = { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v } } }
    const localStorage = { getItem: (k: string) => { if (saved === 'throw') throw new Error('blocked'); expect(k).toBe(THEME_KEY); return saved } }
    const window = { matchMedia: () => ({ matches: systemDark }) }
    new Function('document', 'localStorage', 'window', THEME_BOOT_SCRIPT)(document, localStorage, window)
    return attrs['data-theme']
  }

  it('nothing saved (or a blocked store) is Dark, even on a light computer', () => {
    expect(DEFAULT_PREF).toBe('dark')
    expect(parsePref(null)).toBe('dark')
    expect(resolveTheme(parsePref(null), false)).toBe('dark')
    expect(run(null, false)).toBe('dark')
    expect(run('throw', false)).toBe('dark')
    expect(run('nonsense', false)).toBe('dark')
  })

  it('saved choices are respected: Light stays light, System follows the computer', () => {
    expect(run('light', true)).toBe('light')
    expect(run('dark', false)).toBe('dark')
    expect(run('system', false)).toBe('light')
    expect(run('system', true)).toBe('dark')
    // System is saved as a word now (it used to clear the key, which now means Dark).
    const theme = read('app/_components/theme.tsx')
    expect(theme).not.toMatch(/removeItem\(THEME_KEY\)/)
    expect(theme).toMatch(/setItem\(THEME_KEY, pref\)/)
  })

  it('the share page stays light: it is outside the themed dashboard', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/html\[data-brand='docs2video'\]\[data-theme='dark'\]:has\(\.app-themed\)/)
    expect(read('app/(public)/watch/[id]/page.tsx')).not.toContain('app-themed')
    expect(read('app/(public)/watch/[id]/page.tsx')).not.toContain('data-theme')
  })

  it('admin, pricing, AI Social and the photo fixer follow dark, with no white boxes left behind', () => {
    for (const d of ['admin', 'pricing', 'social-media', 'fix']) {
      const files = walk(`app/(dashboard)/${d}`).map((f) => f.replace(/\\/g, '/'))
      for (const f of files) {
        const src = read(f)
        expect(src, f).not.toContain('<LightOnly')
        // White boxes / words that vanish in dark. Allowed on purpose: the
        // campaign email preview (copies the real email) and logo backings.
        const bad = src.split('\n').filter((l) =>
          /(background|color): 'white'/.test(l) &&
          !/borderRadius: 8, padding: 20, border: '1px solid var\(--border-light\)'/.test(l) && // email preview page
          !/#1a1a1a/.test(l) && !/#635bff/.test(l) && // email button, Stripe LIVE badge
          !/objectFit: 'contain'/.test(l)) // logo backing
        expect(bad, f).toEqual([])
      }
    }
  })
})
