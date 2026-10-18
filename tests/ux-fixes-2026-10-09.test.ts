import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { bellItems, bellLabel, tidyNotice, unreadLines, DIDNT_FINISH, type BellNotification } from '../app/_lib/bell'
import { brandNameKey, groupBrands, sameNameBrand } from '../app/_lib/brand-dupes'
import { isClientSharePage } from '../app/_components/CookieBanner'
import { libraryTabs, tabFor, videosFilterFor, isServerPagedTab, searchPattern, OLDER_OUTPUT_TYPES } from '../app/(dashboard)/videos/library-tabs'
import { shortDate } from '../app/(dashboard)/videos/library-items'
import { kindOfOutput, NAMES, planLabel, planName } from '../app/_lib/names'
import { PLANS, getPlan } from '../app/_lib/pricing'
import { VIDEO_LOOKS, PRES_LOOKS, lookCards, RECOMMENDED_VIDEO_LOOK } from '../app/(dashboard)/create/_components/make/looks'
import { numTileSize } from '../app/(dashboard)/create/_components/story/OnePoint'
import { statusWords, CLIENT_STATUSES, STATUS_WORDS } from '../app/(dashboard)/clients/client-status'
import { MISSING_AFTER_MS } from '../app/(dashboard)/videos/[id]/useVideoRow'
import { sizedPicture, pictureSrcSet } from '../app/_lib/picture-size'

/**
 * Guards for the customer-facing fixes from the 2026-10-09 UX audit.
 * Every check here was seen to FAIL against the old code or a planted bad
 * value (see the "fails on" cases), so a pass means something.
 */
const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
const DAY = 86_400_000
const NOW = Date.parse('2026-10-09T12:00:00Z')
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString()
const VID = '8436c587-7954-4001-b2d6-1fec56e13d4b'
const VID2 = '11111111-2222-4333-8444-555555555555'
const note = (o: Partial<BellNotification>): BellNotification => ({
  id: Math.random().toString(36).slice(2), type: 'system', title: 'Hi', message: null, link: null, read: false, created_at: at(1), ...o,
})

describe('1. a missing video never spins forever', () => {
  it('the result page shows "We can\'t find this video" + Back to Library', () => {
    const page = read('app/(dashboard)/videos/[id]/page.tsx')
    expect(page).toMatch(/if \(missing\)/)
    expect(page).toMatch(/We can('|&apos;|’)t find this video/)
    expect(page).toMatch(/<Button href="\/videos">Back to Library<\/Button>/)
  })
  it('the row hook gives up on an empty answer and after a few seconds', () => {
    const hook = read('app/(dashboard)/videos/[id]/useVideoRow.ts')
    expect(hook).toMatch(/if \(!cancelled && !row\) \{ setMissing\(true\); stop\(\); return \}/)
    expect(MISSING_AFTER_MS).toBeGreaterThanOrEqual(4000)
    expect(MISSING_AFTER_MS).toBeLessThanOrEqual(8000)
  })
  it('the share page says it plainly and stops waiting after 10 s', () => {
    const watch = read('app/(public)/watch/[id]/page.tsx')
    expect(watch).toContain('We can&apos;t find this video')
    expect(watch).not.toContain('This presentation is no longer available')
    expect(watch).toMatch(/AbortController\(\)[\s\S]{0,120}ctl\.abort\(\), 10000/)
  })
})

describe('2. step 2 number tiles never cut a fact off', () => {
  it('figure and label are wrapping text boxes, not one-line inputs', () => {
    const tile = read('app/(dashboard)/create/_components/story/OnePoint.tsx')
    expect(tile).toMatch(/<textarea\s+className="cf-num-value"/)
    expect(tile).toMatch(/<textarea\s+className="cf-num-label"/)
    expect(tile).not.toMatch(/<input className="cf-num-(value|label)"/)
    const css = read('app/globals.css')
    expect(css).toMatch(/\.cf-num textarea \{[^}]*white-space: pre-wrap[^}]*\}/)
    expect(css).toMatch(/\.cf-num-value\[data-size='mid'\]/)
  })
  it('long figures step down a size', () => {
    expect(numTileSize('$176,204')).toBe('big')
    expect(numTileSize('$10,000 for 20 years')).toBe('mid')
    expect(numTileSize('Preferred Non-Tobacco')).toBe('mid')
    expect(numTileSize('100% High Cap Rate Index Allocation')).toBe('small')
  })
})

describe('3. Library "All" = videos + presentations; Home counts the same', () => {
  it('All hides older kinds; Older items holds them', () => {
    const [all] = libraryTabs(true)
    expect(all.shows('video')).toBe(true)
    expect(all.shows('presentation')).toBe(true)
    expect(all.shows('graphic')).toBe(false)
    expect(all.shows('deck')).toBe(false)
    expect(all.shows(null)).toBe(false)
    expect(tabFor('older')!.shows('graphic')).toBe(true)
  })
  it('the database filter agrees with kindOfOutput for every output type', () => {
    const types = [null, 'video', 'interactive', 'deck', 'pptx', 'pdf', 'commercial']
    const inAll = (t: string | null) => t === null || !videosFilterFor('').or!.match(/not\.in\.\(([^)]*)\)/)![1].split(',').includes(t)
    for (const t of types) expect(inAll(t)).toBe(kindOfOutput(t) !== 'deck')
    expect([...OLDER_OUTPUT_TYPES].sort()).toEqual(['deck', 'pdf', 'pptx'])
    expect(videosFilterFor('presentation').eq).toEqual(['output_type', 'interactive'])
    expect(isServerPagedTab('')).toBe(true)
    expect(isServerPagedTab('older')).toBe(false)
  })
  it('Home "See all N" uses the Library rule (not every row + creations)', () => {
    const load = read('app/(dashboard)/dashboard/_home/load.ts')
    expect(load).toMatch(/\.or\(videosFilterFor\(''\)\.or!\)/)
    expect(load).not.toMatch(/allIds\.length \+ \(deckCountRes/)
  })
  it('the Library pages in the database and searches safely', () => {
    const page = read('app/(dashboard)/videos/page.tsx')
    expect(page).toMatch(/\.range\(from, from \+ per - 1\)/)
    expect(page).toMatch(/count: 'exact'/)
    expect(searchPattern('a,b(c)%_*')).toBe('*a b c*')
    expect(searchPattern('   ')).toBeNull()
    expect(searchPattern('botmakersa.ai')).toBe('*botmakersa.ai*')
  })
})

describe('4. the recommended look is "Animated slides", every card has a short line', () => {
  it('names.ts holds the name; no "Slide Deck" look left', () => {
    expect(NAMES.animatedSlidesLook).toBe('Animated slides')
    expect(VIDEO_LOOKS.find((l) => l.id === RECOMMENDED_VIDEO_LOOK)!.name).toBe(NAMES.animatedSlidesLook)
    for (const f of ['app/(dashboard)/help/page.tsx', 'app/(dashboard)/help/creating-videos/page.tsx', 'app/(dashboard)/help/faq/page.tsx',
      'app/(dashboard)/help/making-changes/page.tsx', 'app/_lib/how-to-use.ts', 'app/api/help-chat/route.ts']) {
      expect(read(f), f).not.toContain('Slide Deck')
    }
  })
  it('every look card has one short line (and BEST stays)', () => {
    for (const out of ['video', 'interactive']) {
      for (const c of lookCards(out)) {
        expect(c.short.length, c.id).toBeGreaterThan(5)
        expect(c.short.length, c.id).toBeLessThanOrEqual(48)
      }
    }
    expect(lookCards('video').filter((c) => c.recommended).map((c) => c.id)).toEqual([RECOMMENDED_VIDEO_LOOK])
    expect(PRES_LOOKS.every((l) => l.short)).toBe(true)
    expect(read('app/(dashboard)/create/_components/make/Pickers.tsx')).toMatch(/className="cf-look-short">\{l\.short\}/)
  })
})

describe('5. the bell: recent, merged, "Didn\'t finish", linked to Try again', () => {
  it('drops notices older than 30 days', () => {
    const items = bellItems([note({ title: 'Old', created_at: at(88) }), note({ title: 'New', created_at: at(29) })], NOW)
    expect(items).toHaveLength(1)
  })
  it('merges the same notice about the same video', () => {
    const items = bellItems([
      note({ type: 'video_failed', title: 'Video generation failed', message: 'What This Plan Does For You could not be completed.', link: `/videos/${VID}`, created_at: at(1) }),
      note({ type: 'video_failed', title: 'Video generation failed', message: 'What This Plan Does For You could not be completed.', link: `/videos/${VID}`, created_at: at(1.1), read: true }),
      note({ type: 'video_failed', title: 'Video generation failed', message: 'Other could not be completed.', link: `/videos/${VID2}`, created_at: at(2) }),
    ], NOW)
    expect(items).toHaveLength(2)
    expect(items[0].count).toBe(2)
    expect(items[0].ids).toHaveLength(2)
    expect(items[0].read).toBe(false)
    expect(unreadLines(items)).toBe(2)
  })
  it('says "Didn\'t finish" and links to the result page', () => {
    const t = tidyNotice(note({ type: 'video_failed', title: 'Video generation failed', message: 'colonialstock.com could not be completed. Your credits were refunded.', link: `/videos/${VID}` }))
    expect(t.title).toBe(DIDNT_FINISH)
    expect(t.message).toBe('colonialstock.com didn’t finish. Your credits were refunded.')
    expect(t.link).toBe(`/videos/${VID}`)
    // A plain notice is left alone.
    expect(tidyNotice(note({ title: 'Your video is ready' })).title).toBe('Your video is ready')
  })
  it('writers say "Didn\'t finish" too', () => {
    for (const f of ['app/api/cron/fix-stuck-videos/route.ts', 'app/api/webhooks/creatomate/route.ts', 'app/_lib/inngest/render-video.ts']) {
      expect(read(f), f).not.toContain(`title: 'Video generation failed'`)
    }
  })
  it('the bell button has a spoken name with the count', () => {
    expect(bellLabel(5)).toBe('Notifications, 5 new')
    expect(bellLabel(0)).toBe('Notifications')
    expect(read('app/_components/NotificationBell.tsx')).toMatch(/aria-label=\{bellLabel\(unreadShown, hasActiveJobs\)\}/)
  })
})

describe('6. the share page (client-facing)', () => {
  const watch = read('app/(public)/watch/[id]/page.tsx')
  it('no cookie notice there', () => {
    expect(isClientSharePage('/watch/abc')).toBe(true)
    expect(isClientSharePage('/watch')).toBe(true)
    expect(isClientSharePage('/watchlist')).toBe(false)
    expect(isClientSharePage('/dashboard')).toBe(false)
  })
  it('"Powered by Docs2Video" once — the footer', () => {
    expect(watch.match(/>Powered by Docs2Video</g) ?? []).toHaveLength(1)
    expect(watch).not.toContain('Made with Docs2Video\n')
    expect(watch).not.toMatch(/className="wp-powered-header"/)
  })
  it('always a next step: book, else reply (+ call when a phone is set)', () => {
    expect(watch).toMatch(/data-testid="watch-next-step"/)
    expect(watch).toMatch(/\{nextBooking \? \([\s\S]*Book a call with \{agentShort\}[\s\S]*\) : \([\s\S]*Reply to \{agentShort\}[\s\S]*agentPhone &&[\s\S]*Call \{agentShort\}/)
    // The next-step block is not inside a condition that can hide it.
    expect(watch).not.toMatch(/\{hasCalendly && \(\s*<div className="wp-center wp-section" id="calendly-section"/)
  })
})

describe('7. phone create header names the current step', () => {
  it('the current step keeps its word on a phone', () => {
    expect(read('app/kit.css')).toMatch(/\.kit-focusbar-step\.is-now \.kit-focusbar-word \{ display: inline;/)
  })
})

describe('8. one name for the free plan', () => {
  it('is pricing.ts\'s label everywhere', () => {
    const free = getPlan('free').label
    expect(planName('trial')).toBe(free)
    expect(planLabel('trial')).toBe(free)
    expect(planLabel(null)).toBe(free)
    expect(read('app/_components/marketing/Docs2VideoHome.tsx')).toMatch(/key: 'free', name: free\.label/)
    expect(read('app/(public)/plans/page.tsx')).toMatch(/key: 'free', name: free\.label/)
    expect(read('app/(dashboard)/help/page.tsx')).not.toMatch(/\*\*Free\*\* /)
    expect(PLANS.filter((p) => p.tier === 'free')).toHaveLength(1)
  })
})

describe('9. Clients page', () => {
  const page = read('app/(dashboard)/clients/page.tsx')
  it('"Add a client" first, no revenue tile, cards on phones', () => {
    const actions = page.slice(page.indexOf('className="cl-actions"'))
    expect(actions.indexOf('Add a client')).toBeLessThan(actions.indexOf('Import a CSV file'))
    expect(actions.indexOf('Add a client')).toBeLessThan(actions.indexOf('Export CSV'))
    expect(page).not.toMatch(/stat-label">Total revenue/)
    expect(page).toContain('className="cl-cards"')
    expect(read('app/globals.css')).toMatch(/@media \(max-width: 700px\) \{\s*\.cl-cards \{ display: flex; \}\s*\.cl-table \{ display: none; \}/)
  })
  it('statuses in plain, soft words', () => {
    for (const s of CLIENT_STATUSES) expect(statusWords(s)).toBe(STATUS_WORDS[s])
    expect(statusWords('inactive')).not.toMatch(/inactive/i)
    expect(statusWords('nonsense')).toBe(STATUS_WORDS.lead)
    expect(read('app/globals.css')).not.toMatch(/\.cl-status\[data-tone='[^']+'\] \{[^}]*--error/)
  })
})

describe('10. labels and help', () => {
  it('account button, Top up', () => {
    const header = read('app/_components/Header.tsx')
    expect(header).toContain('aria-label="Account menu"')
    expect(header).toContain('+ Top up')
    expect(header).not.toContain('+ Top Up')
  })
  it('help index describes the 3-step flow', () => {
    const help = read('app/(dashboard)/help/page.tsx')
    expect(help).not.toContain('approve the brief')
    expect(help).toMatch(/Three steps: add your content/)
  })
})

describe('11. no server/browser date mismatch on the Library (React #418)', () => {
  it('cards draw the date through LocalDate (UTC first, then local)', () => {
    expect(read('app/(dashboard)/videos/Library.tsx')).toContain('<LocalDate iso={item.createdAt} />')
    expect(read('app/(dashboard)/videos/LibraryTable.tsx')).toContain('<LocalDate iso={item.createdAt} />')
    expect(read('app/(dashboard)/videos/LocalDate.tsx')).toMatch(/awake \? undefined : 'UTC'/)
  })
  it('a pinned time zone gives the same day everywhere', () => {
    const iso = '2026-10-09T02:30:00Z' // Oct 8 in Los Angeles, Oct 9 in UTC
    const now = new Date('2026-10-09T12:00:00Z')
    expect(shortDate(iso, now, 'UTC')).toBe('Oct 9')
    expect(shortDate(iso, now, 'America/Los_Angeles')).toBe('Oct 8')
    expect(shortDate('2025-03-01T12:00:00Z', now, 'UTC')).toBe('Mar 1, 2025')
  })
})

describe('12. same-name brands', () => {
  const brands = [
    { id: 'a', name: 'Darrell Wolfe', created_at: '2026-09-01', is_default: false },
    { id: 'b', name: ' darrell  wolfe ', created_at: '2026-09-20', is_default: false },
    { id: 'c', name: 'Darrell Wolfe', created_at: '2026-09-10', is_default: true },
    { id: 'd', name: 'Other', created_at: '2026-09-05', is_default: false },
  ]
  it('finds a saved brand with the same name', () => {
    expect(brandNameKey('  Darrell   WOLFE ')).toBe('darrell wolfe')
    expect(sameNameBrand('darrell wolfe', brands)!.id).toBe('b')
    expect(sameNameBrand('New one', brands)).toBeNull()
    expect(sameNameBrand('', brands)).toBeNull()
  })
  it('groups copies under one card (the default first) and deletes nothing', () => {
    const groups = groupBrands(brands)
    expect(groups.map((g) => g.lead.id)).toEqual(['c', 'd'])
    expect(groups[0].copies.map((b) => b.id)).toEqual(['b', 'a'])
    expect(groups.flatMap((g) => [g.lead, ...g.copies])).toHaveLength(brands.length)
  })
  it('the create page warns, and the Brands page folds copies', () => {
    expect(read('app/(dashboard)/brands/new/page.tsx')).toMatch(/if \(dup && !dupAsked\)/)
    expect(read('app/(dashboard)/brands/page.tsx')).toMatch(/groupBrands\(brands\)/)
  })
})

describe('13. speed on slow phones', () => {
  it('result page: nothing downloads before Play; the poster stands in', () => {
    expect(read('app/(dashboard)/videos/[id]/send/SharePreview.tsx')).toMatch(/preload="none"/)
    expect(read('app/(dashboard)/videos/[id]/send/SharePreview.tsx')).not.toMatch(/preload="metadata"/)
    expect(read('app/(dashboard)/videos/[id]/send/ReadyToSend.tsx')).toMatch(/posterUrl=\{sizedPicture\(video\.thumbnail_url \|\| video\.slide_urls\?\.\[0\] \|\| null, 960\)\}/)
  })
  it('card and scene pictures load lazily with a size', () => {
    const lib = read('app/(dashboard)/videos/Library.tsx')
    expect(lib).toMatch(/srcSet=\{original \? undefined : \(pictureSrcSet\(item\.picture\)/)
    expect(lib).toMatch(/sizes="\(max-width: 600px\) 100vw, 320px"/)
    expect(lib).toMatch(/loading="lazy"/)
    // A resized picture that fails falls back to the original, then the placeholder.
    expect(lib).toMatch(/setOriginal\(true\); else setFailed\(true\)/)
    expect(read('app/(dashboard)/videos/[id]/change/ChangeBar.tsx')).toMatch(/res-scene-thumb" width=\{160\} height=\{90\} loading="lazy"/)
  })
  it('only our own public stills are resized', () => {
    const host = 'abc.supabase.co'
    const ours = 'https://abc.supabase.co/storage/v1/object/public/videos/x/thumb.png'
    expect(sizedPicture(ours, 480, host)).toBe('https://abc.supabase.co/storage/v1/render/image/public/videos/x/thumb.png?width=480&quality=70')
    expect(sizedPicture('https://other.com/storage/v1/object/public/a.png', 480, host)).toBe('https://other.com/storage/v1/object/public/a.png')
    expect(sizedPicture('https://abc.supabase.co/storage/v1/object/sign/a.png?token=1', 480, host)).toContain('/object/sign/')
    expect(sizedPicture('https://abc.supabase.co/storage/v1/object/public/a.mp4', 480, host)).toContain('/object/public/a.mp4')
    expect(sizedPicture('/api/flyer-file/1', 480, host)).toBe('/api/flyer-file/1')
    expect(sizedPicture(null, 480, host)).toBeNull()
    expect(pictureSrcSet(ours, [320, 640], host)).toBe('https://abc.supabase.co/storage/v1/render/image/public/videos/x/thumb.png?width=320&quality=70 320w, https://abc.supabase.co/storage/v1/render/image/public/videos/x/thumb.png?width=640&quality=70 640w')
    expect(pictureSrcSet('https://other.com/a.png', [320], host)).toBeNull()
  })
})
