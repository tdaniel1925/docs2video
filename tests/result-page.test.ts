import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'
import { CREDIT_COSTS } from '../app/_lib/credits'
import { downloadsFor } from '../app/(dashboard)/videos/[id]/result/downloads'
import { outputKind } from '../app/(dashboard)/videos/[id]/result/output'
import { changeRouteFor, presentationEditorHref } from '../app/(dashboard)/videos/[id]/change/change-route'
import { undoOf } from '../app/(dashboard)/videos/[id]/change/change-log'
import { whatsLeft, FOCUS_IDS, type LeftInput } from '../app/(dashboard)/videos/[id]/send/whats-left'
import { linkToCopy, INSURANCE_DISCLOSURE, isInsuranceVideo } from '../app/(dashboard)/videos/[id]/send/share-email'
import { summarizeViewing, deviceLabel } from '../app/_lib/viewing'

/*
 * THE RESULT PAGE (overhaul phase 4) — guards for what it promises:
 *   1. ONE send panel. The older "Send to Your Client" window is gone, and
 *      everything it could do lives in the one panel.
 *   2. "What's left" only lists things the page can really check.
 *   3. The Download menu matches the kind of project.
 *   4. "Ask for a change" goes to the editor that exists for that kind, with
 *      prices from credits.ts.
 *   5. "Who watched" is built from data the share page already sends, and the
 *      share page sends it for every look.
 * Each check was run against a broken version first to see it fail.
 */

const ROOT = path.resolve(__dirname, '..')
const RESULT = path.join(ROOT, 'app', '(dashboard)', 'videos', '[id]')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p)
  }
  return out
}
const resultFiles = walk(RESULT).filter((f) => !f.includes(`${path.sep}edit${path.sep}`))
const src = (f: string) => readFileSync(f, 'utf8')

// ── 1. ONE SEND PANEL ───────────────────────────────────────────────────────

describe('one send panel', () => {
  it('only the Ready-to-send panel sends; the old window is gone', () => {
    const senders = resultFiles.filter((f) => src(f).includes("'/api/send-video-email'"))
    expect(senders.map((f) => path.relative(RESULT, f))).toEqual([path.join('send', 'ReadyToSend.tsx')])
    for (const f of resultFiles) {
      const s = src(f)
      expect(s, f).not.toContain('Send to Your Client')
      expect(s, f).not.toContain('share-modal-card')
      expect(s, f).not.toContain('Send Email Now')
    }
  })

  it('keeps what the old window could do: a name, someone else, copy the email, the sent trail', () => {
    const panel = read('app/(dashboard)/videos/[id]/send/ReadyToSend.tsx')
    expect(panel).toContain('Their name (optional)')
    expect(panel).toContain('Send to someone else')
    expect(panel).toContain('Copy the email')
    expect(panel).toMatch(/new ClipboardItem\(/)
    expect(panel).toContain('Copying sends nothing')
    // the sent / opened trail moved to "Who watched"
    const viewing = read('app/(dashboard)/videos/[id]/viewing/ClientViewing.tsx')
    expect(viewing).toMatch(/email opened|email not opened yet/)
  })

  it('a copied link on a policy video carries the disclosure; others are the bare link', () => {
    const policy = { _pipeline_input: { policyData: { deathBenefit: 500000 } } }
    expect(isInsuranceVideo(policy)).toBe(true)
    expect(isInsuranceVideo([{ title: 'x' }])).toBe(false)
    expect(linkToCopy('https://x/watch/1', true)).toContain(INSURANCE_DISCLOSURE)
    expect(linkToCopy('https://x/watch/1', false)).toBe('https://x/watch/1')
  })
})

// ── 2. WHAT'S LEFT ──────────────────────────────────────────────────────────

describe("what's left only lists checkable things", () => {
  const full: LeftInput = {
    sendTo: 'a@b.co', note: 'Hi',
    facts: { bookingUrl: 'https://cal.com/x', paymentLink: 'https://pay', agent: { photo_url: 'https://p', full_name: 'Al' }, unpaidQuoteShown: true },
  }
  it('nothing missing → nothing listed', () => {
    expect(whatsLeft(full)).toEqual([])
  })
  it('lists each missing piece once, each with a fix', () => {
    const items = whatsLeft({
      sendTo: '', note: ' ',
      facts: { bookingUrl: '', paymentLink: '', agent: { photo_url: null, full_name: null, company_name: null }, unpaidQuoteShown: true },
    })
    expect(items.map((i) => i.key)).toEqual(['email', 'note', 'booking', 'photo', 'name', 'payment'])
    for (const i of items) expect('focus' in i.fix || 'href' in i.fix).toBe(true)
  })
  it('says nothing about the share page until its facts are known, or about a profile it could not read', () => {
    expect(whatsLeft({ sendTo: '', note: '', facts: null }).map((i) => i.key)).toEqual(['email', 'note'])
    expect(whatsLeft({ ...full, facts: { ...full.facts!, agent: null } })).toEqual([])
  })
  it('no payment chip unless a quote is really on their page', () => {
    expect(whatsLeft({ ...full, facts: { ...full.facts!, paymentLink: '', unpaidQuoteShown: false } })).toEqual([])
  })
  it('never lists a brand (a finished video cannot take one) — only the known keys', () => {
    const allowed = ['email', 'note', 'booking', 'photo', 'name', 'payment']
    const anyItems = whatsLeft({ sendTo: '', note: '', facts: { bookingUrl: '', paymentLink: '', agent: {}, unpaidQuoteShown: true } })
    for (const i of anyItems) expect(allowed).toContain(i.key)
  })
  it('every chip lands somewhere real: the panel has the boxes, Settings exists', () => {
    const panel = read('app/(dashboard)/videos/[id]/send/ReadyToSend.tsx')
    expect(panel).toContain('id={FOCUS_IDS.email}')
    expect(panel).toContain('id={FOCUS_IDS.note}')
    expect(FOCUS_IDS).toEqual({ email: 'rts-email', note: 'rts-note' })
    expect(existsSync(path.join(ROOT, 'app/(dashboard)/settings/page.tsx'))).toBe(true)
    // ?tab=integrations still opens where the email + booking boxes live
    // (round B: the Email & sending section — settings/account-sections.ts)
    expect(read('app/(dashboard)/settings/account-sections.ts')).toMatch(/integrations: 'email'/)
    expect(read('app/(dashboard)/settings/page.tsx')).toContain("section === 'email'")
  })
})

// ── 3. DOWNLOADS MENU ───────────────────────────────────────────────────────

describe('the Download menu matches the kind of project', () => {
  const keys = (row: Record<string, unknown>) => downloadsFor(row).map((d) => d.key)
  const script = [{ title: 'A', narration: 'Hello there' }]

  it('a video with no slide pictures offers the MP4 and script, not a one-page PDF', () => {
    expect(keys({ output_type: 'video', video_url: 'https://v.mp4', slide_urls: [], script })).toEqual(['mp4', 'script'])
  })
  it('a video with slide pictures adds PDF and PowerPoint', () => {
    expect(keys({ output_type: 'video', video_url: 'https://v.mp4', slide_urls: ['a', 'b'], script })).toEqual(['mp4', 'pdf', 'pptx', 'script'])
  })
  it('no script words → no Script', () => {
    expect(keys({ output_type: 'video', video_url: 'https://v.mp4', script: [{ title: 'x' }] })).toEqual(['mp4'])
  })
  it('a presentation: PDF, PowerPoint, Script and Export video at the export price', () => {
    const items = downloadsFor({ output_type: 'interactive', draft_data: { scenes: [{}] }, script })
    expect(items.map((d) => d.key)).toEqual(['pdf', 'pptx', 'script', 'export-video'])
    expect(items.find((d) => d.key === 'export-video')!.credits).toBe(CREDIT_COSTS.videoExport)
  })
  it('an exported presentation offers the video file instead of exporting again', () => {
    expect(keys({ output_type: 'interactive', draft_data: { scenes: [{}] }, export_video_url: 'https://x.mp4' })).toEqual(['pdf', 'pptx', 'video-file'])
  })
  it('a slide deck never offers a video export (the route refuses decks)', () => {
    expect(keys({ output_type: 'deck', draft_data: { scenes: [{}] } })).toEqual(['pdf', 'pptx'])
  })
  it('the menu is the only download control on the page', () => {
    for (const f of resultFiles) {
      if (f.endsWith('DownloadsMenu.tsx')) continue
      expect(src(f), f).not.toMatch(/'\/api\/(download-pdf|download-pptx|presentation-export)'/)
    }
  })
})

// ── 4. ASK FOR A CHANGE ─────────────────────────────────────────────────────

describe('the change bar routes each kind to its own editor', () => {
  it('kinds', () => {
    expect(outputKind({ output_type: 'interactive' })).toBe('presentation')
    expect(outputKind({ output_type: 'deck' })).toBe('deck')
    expect(outputKind({ output_type: 'pptx' })).toBe('slides-file')
    expect(outputKind({ output_type: 'video', slide_plan_url: 'https://plan.json' })).toBe('slide-deck-video')
    expect(outputKind({ output_type: 'video' })).toBe('video')
  })
  it('presentations and decks → the slide editor; Slide Deck videos → Fix-a-Scene', () => {
    expect(changeRouteFor({ output_type: 'interactive' }).editor).toBe('presentation-editor')
    expect(changeRouteFor({ output_type: 'deck' }).editor).toBe('presentation-editor')
    expect(changeRouteFor({ output_type: 'video', slide_plan_url: 'https://p' }).editor).toBe('fix-scene')
  })
  it('other looks with slide pictures keep the older scene editor; without them, a changed copy', () => {
    expect(changeRouteFor({ output_type: 'video', slide_urls: ['a'] }).editor).toBe('older-editor')
    expect(changeRouteFor({ output_type: 'video', slide_urls: [] }).editor).toBe('remake')
  })
  it('prices come from credits.ts', () => {
    const fix = changeRouteFor({ slide_plan_url: 'https://p' })
    expect(fix.suggestions.find((s) => s.fix === 'edit-text')!.credits).toBe(CREDIT_COSTS['slide-scene-fix'])
    expect(fix.suggestions.filter((s) => s.fix !== 'edit-text').every((s) => s.credits === 0)).toBe(true)
    expect(changeRouteFor({ output_type: 'interactive' }).costLine).toContain(CREDIT_COSTS['slide-scene-fix'].toLocaleString('en-US'))
    expect(changeRouteFor({}).costLine).toContain(CREDIT_COSTS.videoQuick.toLocaleString('en-US'))
    const route = read('app/(dashboard)/videos/[id]/change/change-route.ts')
    expect(route, 'a price typed by hand').not.toMatch(/\b(50|400|500|1,?000) credits/)
  })
  it('the presentation editor gets the request and the slide', () => {
    expect(presentationEditorHref('v1', 'Make it shorter', 'scene', 2)).toBe('/videos/v1/edit?ask=Make+it+shorter&slide=2')
    expect(presentationEditorHref('v1', 'Add a slide', 'whole', 2)).toBe('/videos/v1/edit?ask=Add+a+slide')
    const editor = read('app/(dashboard)/videos/[id]/edit/page.tsx')
    expect(editor).toContain("q.get('ask')")
    expect(editor).toContain("q.get('slide')")
    expect(editor).toContain("q.get('restore')")
    expect(editor).toMatch(/history\.map\(/) // every AI change listed, each with Undo
  })
  it('the page opens Fix-a-Scene and the older editor from the bar, and nowhere else', () => {
    const page = read('app/(dashboard)/videos/[id]/page.tsx')
    expect(page).toMatch(/r\.editor === 'fix-scene'/)
    expect(page).toContain('<OlderEditor')
    expect(page).toContain('<FixScene')
    for (const f of resultFiles) {
      expect(src(f), f).not.toMatch(/>\s*Edit Video\s*</)
      expect(src(f), f).not.toMatch(/Fix a scene \(glitch, wording, or pronunciation\)/)
    }
    const bar = read('app/(dashboard)/videos/[id]/change/ChangeBar.tsx')
    expect(bar).toContain('presentationEditorHref(')
    expect(bar).toContain('/create?duplicate=${video.id}')
  })
  it('Undo only where there is something to put back', () => {
    const base = { id: '1', at: '2026-10-07T00:00:00Z', summary: 's' }
    expect(undoOf({ ...base, kind: 'fix-scene', action: 'edit-text', sceneIndex: 0, sceneLabel: 'A', oldText: 'old' }).can).toBe(true)
    expect(undoOf({ ...base, kind: 'fix-scene', action: 'rerecord', sceneIndex: 0, sceneLabel: 'A' }).can).toBe(false)
    expect(undoOf({ ...base, kind: 'presentation', before: [{}] }).can).toBe(true)
  })
})

// ── 5. WHO WATCHED ──────────────────────────────────────────────────────────

describe('who watched — per share, from what the share page sends', () => {
  const S1 = '11111111-1111-4111-8111-111111111111'
  const S2 = '22222222-2222-4222-8222-222222222222'
  const shares = [
    { id: S1, to_email: 'ann@x.co', created_at: '2026-10-01T10:00:00Z', opened_at: '2026-10-01T11:00:00Z' },
    { id: S2, to_email: 'bob@x.co', created_at: '2026-10-02T10:00:00Z', opened_at: null },
  ]
  const ev = (event_type: string, at: string, metadata: Record<string, unknown> | null, ip = '1.1.1.1', ua = 'Mozilla (iPhone) Safari') =>
    ({ event_type, created_at: at, metadata, viewer_ip: ip, user_agent: ua })

  it('groups events by the email they came from, in quarters', () => {
    const out = summarizeViewing([
      ev('view', '2026-10-01T11:05:00Z', { share: S1 }),
      ev('play', '2026-10-01T11:06:00Z', { share: S1 }),
      ev('progress', '2026-10-01T11:07:00Z', { share: S1, percent: 25 }),
      ev('progress', '2026-10-01T11:08:00Z', { share: S1, percent: 50 }),
      ev('booking_click', '2026-10-01T11:09:00Z', { share: S1 }),
      ev('view', '2026-10-03T09:00:00Z', null, '2.2.2.2', 'Windows Chrome'),
    ], shares)
    const ann = out.shares.find((s) => s.to === 'ann@x.co')!
    expect(ann.viewer!.furthest).toBe(50)
    expect(ann.viewer!.reached).toEqual([true, true, false, false])
    expect(ann.viewer!.clicked.booking).toBe(true)
    expect(ann.emailOpenedAt).toBe('2026-10-01T11:00:00Z')
    expect(out.shares.find((s) => s.to === 'bob@x.co')!.viewer).toBeNull()
    expect(out.others).toHaveLength(1)
    expect(out.others[0].device).toBe('Windows computer · Chrome')
    expect(out.steps).toEqual([25, 50, 75, 100])
  })
  it('the end counts as 100; a tag that is not one of these emails is just another viewer', () => {
    const out = summarizeViewing([
      ev('complete', '2026-10-01T11:10:00Z', { share: S1, percent: 100 }),
      ev('view', '2026-10-01T12:00:00Z', { share: '99999999-9999-4999-8999-999999999999' }),
    ], shares)
    expect(out.shares[1].viewer!.furthest).toBe(100) // ann is the older share → second
    expect(out.others).toHaveLength(1)
  })
  it('names devices plainly', () => {
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari')).toBe('iPhone · Safari')
    expect(deviceLabel(null)).toBe('Unknown device')
  })
  it('the email link carries its id, and the share page passes it on with every event', () => {
    expect(read('app/api/send-video-email/route.ts')).toContain('`${shareUrl}?s=${sentEmailId}`')
    const watch = read('app/(public)/watch/[id]/page.tsx')
    expect(watch).toContain("searchParams.get('s')")
    expect(watch).toMatch(/share: shareTag/)
  })
  it('watch milestones are tracked for every look, not only looks with slide pictures', () => {
    const watch = read('app/(public)/watch/[id]/page.tsx')
    const handler = watch.slice(watch.indexOf('const handleTimeUpdate'), watch.indexOf('const jumpToSlide'))
    expect(handler).not.toMatch(/if \(!videoRef\.current \|\| !video\?\.slide_urls\) return/)
    expect(handler).toContain("trackEvent(video.id, 'progress', { percent: milestone })")
  })
  it('the viewing API is owner-only and never sends IPs to the browser', () => {
    const api = read('app/api/videos/[id]/viewing/route.ts')
    expect(api).toContain(".eq('user_id', user.id)")
    expect(read('app/_lib/viewing.ts')).not.toMatch(/viewer_ip\s*:/) // summaries carry no IP field
  })
  it('the "your client watched" email is linked to, not duplicated', () => {
    expect(read('app/(dashboard)/videos/[id]/viewing/ClientViewing.tsx')).toContain('/activity#view-alerts')
  })
})

// ── The split ───────────────────────────────────────────────────────────────

describe('the result page is in pieces', () => {
  it('no part is a 2,000-line file again', () => {
    for (const f of resultFiles) {
      expect(src(f).split('\n').length, path.relative(RESULT, f)).toBeLessThan(600)
    }
  })
})
