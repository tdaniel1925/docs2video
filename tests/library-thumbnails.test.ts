import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import {
  videoThumbnail, coverFrameAt, coverPlan, uploadProblem, backfillPlan, thumbMeta, withThumbMeta, sceneChoices, isEngineStill, thumbPaths,
  UPLOAD_MAX_BYTES,
} from '../app/_lib/video-thumbnail'
import { sweepThumbnails, toThumbJpeg } from '../app/_lib/video-thumbnail-make'
import { cardAction, canChangeThumbnail, lengthChip, statusLine, type LibraryItem } from '../app/(dashboard)/videos/library-items'
import { libraryTabs, tabFor, videosFilterFor, isServerPagedTab } from '../app/(dashboard)/videos/library-tabs'
import Library from '../app/(dashboard)/videos/Library'
import CardMenu from '../app/(dashboard)/videos/CardMenu'

vi.mock('next/navigation', () => ({
  usePathname: () => '/videos',
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
}))

/*
 * Library thumbnails, option A (owner, 2026-10-18): each video's own cover,
 * made once at 1280×720 when it finishes; Send under the picture; drafts and
 * failed videos look like what they are; "Change thumbnail" in the ⋯ menu.
 */
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const S = 'https://x.supabase.co/storage/v1/object/public/videos/u/v'

describe('which picture a video shows', () => {
  it('custom → cover → frame → poster → first still → none', () => {
    const meta = (m: object) => ({ thumbnail: m })
    expect(videoThumbnail({ thumbnail_url: `${S}_thumb.png`, draft_data: meta({ cover: `${S}_cover.jpg`, custom: `${S}_thumb_custom.jpg`, chosen: 'custom' }) })).toBe(`${S}_thumb_custom.jpg`)
    // A custom picture kept but the cover chosen again → the cover.
    expect(videoThumbnail({ draft_data: meta({ cover: `${S}_cover.jpg`, custom: `${S}_thumb_custom.jpg`, chosen: 'cover' }) })).toBe(`${S}_cover.jpg`)
    expect(videoThumbnail({ draft_data: meta({ frame: `${S}_thumb.png` }) })).toBe(`${S}_thumb.png`)
    expect(videoThumbnail({ thumbnail_url: `${S}_thumb.png` })).toBe(`${S}_thumb.png`)
    expect(videoThumbnail({ slide_urls: [`${S}_slide_01.png`] })).toBe(`${S}_slide_01.png`)
    expect(videoThumbnail({})).toBeNull()
    // Not a picture (a film) is never shown as one.
    expect(videoThumbnail({ thumbnail_url: `${S}.mp4` })).toBeNull()
    // A noted-but-empty cover (sweep couldn't make one) falls through.
    expect(videoThumbnail({ thumbnail_url: `${S}_thumb.png`, draft_data: meta({ cover: '' }) })).toBe(`${S}_thumb.png`)
  })

  it('the cover is the engine’s drawn page, else a frame from the middle of the cover scene — never frame 0', () => {
    expect(isEngineStill(`${S}_slide_01.png`)).toBe(true)
    expect(coverPlan({ status: 'completed', slide_urls: [`${S}_slide_01.png`], video_url: `${S}.mp4` })).toEqual({ kind: 'still', url: `${S}_slide_01.png` })
    expect(coverPlan({ status: 'completed', video_url: `${S}.mp4`, slide_durations: [7] })).toEqual({ kind: 'frame', url: `${S}.mp4`, at: 5.6 })
    expect(coverPlan({ status: 'failed', video_url: `${S}.mp4` }).kind).toBe('none')
    expect(coverPlan({ status: 'completed' }).kind).toBe('none')
    for (const d of [undefined, [], [0], [0.4], [1.2], [30]]) {
      const at = coverFrameAt(d as number[] | undefined)
      expect(at, String(d)).toBeGreaterThan(0)
      if (d && d[0] && d[0] > 1) expect(at).toBeLessThan(d[0])
    }
  })

  it('a person’s pick is stored beside the rest of the draft, nothing else touched', () => {
    const d = withThumbMeta({ recipientName: 'Ana', step: 9 }, { cover: 'c', chosen: 'cover' })
    expect(d.recipientName).toBe('Ana')
    expect(thumbMeta(d)).toMatchObject({ cover: 'c', chosen: 'cover' })
    expect(thumbPaths('u', 'v')).toEqual({ cover: 'u/v_cover.jpg', custom: 'u/v_thumb_custom.jpg' })
    expect(sceneChoices({ slide_urls: [`${S}_slide_01.png`, 'not a url', `${S}_slide_03.png`] }).map((x) => x.index)).toEqual([0, 2])
  })
})

describe('an uploaded picture', () => {
  it('is checked for kind, size and dimensions', () => {
    expect(uploadProblem({ type: 'image/png', size: 1000 })).toBeNull()
    expect(uploadProblem({ type: 'image/gif', size: 1000 })).toMatch(/JPG, PNG or WebP/)
    expect(uploadProblem({ type: 'image/jpeg', size: 0 })).toMatch(/empty/)
    expect(uploadProblem({ type: 'image/jpeg', size: UPLOAD_MAX_BYTES + 1 })).toMatch(/over 4 MB/)
    expect(uploadProblem({ type: 'image/jpeg', size: 1000, width: 400, height: 300 })).toMatch(/too small \(400×300\)/)
    expect(uploadProblem({ type: 'image/webp', size: 1000, width: 1920, height: 1080 })).toBeNull()
    // Under Vercel's 4.5 MB request cap.
    expect(UPLOAD_MAX_BYTES).toBeLessThan(4.5 * 1024 * 1024)
  })

  it('is re-made as a 1280×720 JPEG, whatever its shape', async () => {
    const tall = await sharp({ create: { width: 900, height: 1600, channels: 3, background: { r: 30, g: 90, b: 160 } } }).png().toBuffer()
    const out = await toThumbJpeg(tall)
    const m = await sharp(out).metadata()
    expect([m.format, m.width, m.height]).toEqual(['jpeg', 1280, 720])
  })
})

describe('made when a video finishes (the cron) and for older videos (the backfill)', () => {
  it('the backfill plans without writing, and skips what is done or impossible', () => {
    const plan = backfillPlan([
      { id: 'a', status: 'completed', slide_urls: [`${S}_slide_01.png`] },
      { id: 'b', status: 'completed', video_url: `${S}.mp4`, slide_durations: [6] },
      { id: 'c', status: 'completed' },
      { id: 'd', status: 'completed', video_url: `${S}.mp4`, draft_data: { thumbnail: { cover: `${S}_cover.jpg` } } },
    ])
    expect(plan.make.map((m) => [m.id, m.plan.kind])).toEqual([['a', 'still'], ['b', 'frame']])
    expect(plan.skip.map((s) => s.id)).toEqual(['c', 'd'])
    const script = read('scripts/backfill-thumbnails.ts')
    expect(script).toMatch(/const apply = args\.includes\('--apply'\)/)
    expect(script).toMatch(/if \(!apply\) \{ console\.log\('Dry run — nothing written/)
    // The only write is makeCover, after the dry-run return.
    expect(script.indexOf('makeCover(admin')).toBeGreaterThan(script.indexOf('if (!apply)'))
  })

  it('the sweep makes each new cover once, and notes one it can’t make so it moves on', async () => {
    const updates: unknown[] = []
    const calls: string[] = []
    const rows = [{ id: 'ok', user_id: 'u', status: 'completed', draft_data: {} }, { id: 'bad', user_id: 'u', status: 'completed', draft_data: {} }]
    const chain: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'or', 'limit']) chain[k] = (...a: unknown[]) => { calls.push(`${k}:${a.join(',')}`); return chain }
    chain.is = (...a: unknown[]) => { calls.push(`is:${a.join(',')}`); return chain }
    chain.then = (res: (v: unknown) => void) => res({ data: rows, error: null })
    const upd = { eq: () => upd, then: (res: (v: unknown) => void) => res({ error: null }) }
    const admin = { from: () => ({ ...chain, update: (u: unknown) => { updates.push(u); return upd } }) }
    const make = vi.fn(async (_a: unknown, r: { id: string }) => (r.id === 'ok' ? 'url' : null))
    const n = await sweepThumbnails(admin as never, { make: make as never })
    expect(n).toBe(1)
    expect(make).toHaveBeenCalledTimes(2)
    expect(calls).toContain('is:draft_data->thumbnail->>cover,')
    expect(calls).toContain('eq:status,completed')
    expect(updates).toHaveLength(1)
    expect((updates[0] as { draft_data: { thumbnail: { cover: string } } }).draft_data.thumbnail.cover).toBe('')
    expect(read('app/api/cron/fix-stuck-videos/route.ts')).toMatch(/try \{ await sweepThumbnails\(admin\) \} catch/)
  })
})

function item(over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: over.id ?? 'v1', videoId: over.videoId === undefined ? (over.id ?? 'v1') : over.videoId, type: 'video', kind: 'video', label: 'Video',
    title: 'A video', recipient: null, fileUrl: null, picture: null, duration: 90, status: 'completed', progressPct: null,
    creditsUsed: null, createdAt: '2026-10-01T12:00:00Z', ...over,
  }
}

describe('the cards, option A', () => {
  const items = [
    item({ id: 'ready', title: 'Ready one', picture: `${S}_cover.jpg` }),
    item({ id: 'failed', title: 'Failed one', status: 'failed', picture: `${S}_thumb.png` }),
    item({ id: 'draft', title: 'Draft one', status: 'draft', duration: null }),
    item({ id: 'tdraft', title: 'Template draft', status: 'draft', duration: null, draftTemplate: 'night' }),
  ]
  const html = renderToStaticMarkup(h(Library, { items }))

  it('a ready video: its picture whole, only the length on it, Send below beside the status', () => {
    expect(lengthChip(items[0])).toBe('1:30')
    expect(statusLine(items[0]).words).toBe('Ready to send')
    expect(cardAction(items[0])).toEqual({ kind: 'send', href: '/videos/ready#send', words: 'Send' })
    expect(html).toMatch(/<span class="[^"]*length[^"]*">1:30<\/span>/)
    const send = (html.match(/<a [^>]*href="\/videos\/ready#send"[^>]*>/) ?? [''])[0]
    expect(send).toMatch(/data-kind="send"/)
    // Nothing else written on the picture (no kind badge).
    expect(read('app/(dashboard)/videos/Library.tsx')).not.toMatch(/s\.kind\b|s\.send\b/)
  })

  it('a failed one shows grey with Try again (its page, where Restart lives)', () => {
    expect(cardAction(items[1])).toEqual({ kind: 'retry', href: '/videos/failed', words: 'Try again' })
    expect(html).toMatch(/data-status="failed"/)
    expect(read('app/(dashboard)/videos/library.module.css')).toMatch(/\.card\[data-status='failed'\] \.thumb \{ filter: grayscale\(1\)/)
  })

  it('a draft: stripes and "Pick a look to see it here", or its template faded; Finish it', () => {
    expect(cardAction(items[2])!.kind).toBe('finish')
    expect(cardAction(items[2])!.words).toBe('Finish it')
    expect(html).toContain('Pick a look to see it here')
    expect(html).toContain('src="/templates/night/cover.jpg"')
    expect(lengthChip(items[2])).toBeNull()
  })

  it('“Change thumbnail” is in the ⋯ menu of finished videos only', () => {
    expect(canChangeThumbnail(items[0])).toBe(true)
    expect(canChangeThumbnail(items[1])).toBe(false)
    expect(canChangeThumbnail(items[2])).toBe(false)
    const open = (it: LibraryItem) => renderToStaticMarkup(h(CardMenu, { item: it, open: true, onMenu: () => {}, onDelete: () => {}, onThumb: () => {} }))
    expect(open(items[0])).toContain('Change thumbnail')
    expect(open(items[1])).not.toContain('Change thumbnail')
  })

  it('the list view shows the same picture, small', () => {
    expect(read('app/(dashboard)/videos/LibraryTable.tsx')).toMatch(/className=\{s\.rowThumb\}[^>]*src=\{sizedPicture\(item\.picture, 160\)/)
  })
})

describe('the Drafts tab', () => {
  it('sits beside All / Videos / Presentations and pages in the database', () => {
    expect(libraryTabs(false).map((t) => t.label)).toEqual(['All', 'Videos', 'Presentations', 'Drafts'])
    expect(tabFor('drafts')!.label).toBe('Drafts')
    expect(isServerPagedTab('drafts')).toBe(true)
    expect(videosFilterFor('drafts').eq).toEqual(['status', 'draft'])
    expect(videosFilterFor('drafts').or).toBe(videosFilterFor('').or)
  })
})

describe('Change thumbnail', () => {
  it('owner-only, finished videos only, upload checked again on the server', () => {
    const route = read('app/api/videos/[id]/thumbnail/route.ts')
    expect(route).toMatch(/\.eq\('id', id\)\.eq\('user_id', user\.id\)/)
    expect(route).toMatch(/row\.status !== 'completed'/)
    expect(route).toMatch(/uploadProblem\(\{ type: file\.type, size: file\.size, \.\.\.size \}\)/)
    const dlg = read('app/(dashboard)/videos/ThumbnailDialog.tsx')
    for (const w of ['Change thumbnail', 'Pick a scene', 'Upload your own', 'Use the cover again', 'Save thumbnail']) expect(dlg).toContain(w)
  })
})
