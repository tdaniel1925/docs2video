import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { STEPS, stepHref, stepIndexFor } from '../app/(dashboard)/create/_components/workspace/steps'
import MainAction from '../app/(dashboard)/create/_components/workspace/MainAction'
import { waitingStages } from '../app/(dashboard)/create/generating/stages'
import { IN_PROGRESS_STATUSES } from '../app/_lib/video-running'
import { announceVideoReady, markReadySeen, sweepReadyVideos, type SendReadyEmail } from '../app/_lib/video-ready'

/*
 * THE CREATE FLOW (phase 3, reshaped 2026-10-09 to the owner-approved sketch).
 * Guards for what the customer was promised:
 *  - three steps in the focus header; no step rail and no "so far" panel
 *    (tests/create-flow-sketch.test.ts has the layout guards);
 *  - no percentage is made up by a timer;
 *  - a main button that can't be pressed says why (and "Show me");
 *  - "we'll email you when it's ready" is true, and the email goes once.
 */
const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
const CREATE = 'app/(dashboard)/create'
const STEP_SCREENS = [
  `${CREATE}/_components/Step1Content.tsx`,
  `${CREATE}/script/page.tsx`,
  `${CREATE}/theme/page.tsx`,
  `${CREATE}/generating/page.tsx`,
]

describe('three steps, then the making screen', () => {
  it('the steps are Your content · The story · The look; the making screen comes after them', () => {
    expect(STEPS.map((s) => s.label)).toEqual(['Your content', 'The story', 'The look'])
    expect(stepIndexFor('/create')).toBe(0)
    expect(stepIndexFor('/create/script')).toBe(1)
    expect(stepIndexFor('/create/brief')).toBe(1)
    expect(stepIndexFor('/create/theme')).toBe(2)
    expect(stepIndexFor('/create/brand')).toBe(2)
    // all three done on the making screen
    expect(stepIndexFor('/create/generating')).toBe(3)
    expect(stepIndexFor('/create/commercial')).toBe(-1)
  })

  it('a step already done links back to it for the same draft', () => {
    expect(stepHref(0, 'abc')).toBe('/create?id=abc')
    expect(stepHref(1, 'abc')).toBe('/create/script?id=abc')
    expect(stepHref(2, 'abc')).toBe('/create/theme?id=abc')
    expect(stepHref(0, null)).toBeNull()
  })
})

describe('honest waiting — no timer-driven percentages', () => {
  it('step 1 no longer invents a reading percentage', () => {
    const src = read(`${CREATE}/_components/Step1Content.tsx`)
    expect(src).not.toMatch(/setProgressPct|progressPct|Simulate progress/)
    expect(src).not.toMatch(/setInterval\(/)
    expect(src).toMatch(/<Stages /)
  })

  it('the waiting screen shows the real number and the real detail', () => {
    const src = read(`${CREATE}/generating/page.tsx`)
    expect(src).not.toMatch(/displayPct|setDisplayPct/)
    expect(src).toMatch(/displayProgress\(row\?\.progress_pct\)/)
    expect(src).toMatch(/detail=\{row\?\.progress_detail/)
  })

  it('every running status lands on a real stage', () => {
    for (const status of IN_PROGRESS_STATUSES) {
      for (const outputType of ['video', 'interactive', 'deck']) {
        const { stages, current } = waitingStages({ status, outputType, detail: '', slidesLook: false })
        expect(current, `${outputType}/${status}`).toBeGreaterThanOrEqual(0)
        expect(current).toBeLessThan(stages.length)
      }
    }
    // a silent slide deck never "records the voice"
    expect(waitingStages({ status: 'pending', outputType: 'deck', detail: '', slidesLook: false }).stages.map((s) => s.key)).not.toContain('voice')
    // the Slide Deck look names the wait in line for what it is
    expect(waitingStages({ status: 'pending', outputType: 'video', detail: 'Waiting in line for the video server', slidesLook: true }).current).toBe(0)
  })

  it('"we’ll email you" is only said where the email is really sent', () => {
    const page = read(`${CREATE}/generating/page.tsx`)
    expect(page).toMatch(/we’ll email you when it’s ready/)
    const cron = read('app/api/cron/fix-stuck-videos/route.ts')
    expect(cron).toMatch(/sweepReadyVideos\(admin\)/)
  })
})

describe('a main button that can’t be pressed says why', () => {
  it('shows the reason and a "Show me" link under the disabled button', () => {
    const html = renderToStaticMarkup(h(MainAction, { onClick: () => {}, missing: { reason: 'Describe what you want first', target: 's1-goal' }, children: 'Read it and plan the story →' }))
    expect(html).toMatch(/<button[^>]*disabled/)
    expect(html).toContain('Describe what you want first')
    expect(html).toContain('Show me')
    expect(html).toMatch(/aria-describedby=/)
  })

  it('puts the price on the button when it spends', () => {
    const html = renderToStaticMarkup(h(MainAction, { onClick: () => {}, price: '1,000 credits', children: 'Make it' }))
    expect(html).toContain('— 1,000 credits')
    expect(html).not.toMatch(/disabled/)
  })

  it.each(STEP_SCREENS.slice(0, 3))('%s moves on with the bottom bar (its MainAction), not a bare disabled button', (file) => {
    const src = read(file)
    expect(src).toMatch(/<BottomBar\b/)
    expect(src).not.toMatch(/className="btn btn-primary btn-lg btn-full"/)
    expect(read(`${CREATE}/_components/workspace/BottomBar.tsx`)).toMatch(/<MainAction onClick=\{onMain\}/)
  })
})

/* ── the ready email ─────────────────────────────────────────────────────── */

type Rec = Record<string, any>
function fakeAdmin(tables: { videos?: Rec[]; profiles?: Rec[]; notifications?: Rec[] }) {
  const db: Record<string, Rec[]> = { videos: [], profiles: [], notifications: [], ...tables }
  return {
    db,
    from(table: string) {
      const filters: ((r: Rec) => boolean)[] = []
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q },
        in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); return q },
        or: () => q,
        limit: () => Promise.resolve({ data: db[table].filter((r) => filters.every((f) => f(r))), error: null }),
        maybeSingle: () => Promise.resolve({ data: db[table].find((r) => filters.every((f) => f(r))) ?? null, error: null }),
        insert: (row: Rec) => { db[table].push({ read: false, ...row }); return Promise.resolve({ error: null }) },
      }
      return q
    },
  }
}

describe('the "ready" email goes once per finished project', () => {
  const done = { id: 'v1', user_id: 'u1', title: 'Family plan', status: 'completed', output_type: 'video' }
  const profiles = [{ id: 'u1', email: 'owner@example.com' }]

  it('the cron sweep sends it once, however many times it runs', async () => {
    const admin = fakeAdmin({ videos: [done], profiles })
    const send = vi.fn<SendReadyEmail>(async () => {})
    expect(await sweepReadyVideos(admin as any, { send })).toBe(1)
    expect(await sweepReadyVideos(admin as any, { send })).toBe(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toBe('owner@example.com')
    expect(send.mock.calls[0][2]).toMatch(/\/videos\/v1$/)
    expect(admin.db.notifications.filter((n) => n.type === 'video_ready')).toHaveLength(1)
  })

  it('never for a draft, and never for the admin’s prospect demos', async () => {
    const admin = fakeAdmin({ profiles })
    const send = vi.fn<SendReadyEmail>(async () => {})
    expect(await announceVideoReady(admin as any, { ...done, status: 'draft' }, { send })).toBe('skipped')
    expect(await announceVideoReady(admin as any, { ...done, title: 'Prospect: acme.com' }, { send })).toBe('skipped')
    expect(send).not.toHaveBeenCalled()
  })

  it('watching it finish on the waiting screen means no email', async () => {
    const admin = fakeAdmin({ profiles })
    const send = vi.fn<SendReadyEmail>(async () => {})
    await markReadySeen(admin as any, done)
    expect(await announceVideoReady(admin as any, done, { send })).toBe('skipped')
    expect(send).not.toHaveBeenCalled()
    expect(admin.db.notifications[0].read).toBe(true)
  })

  it('with no sender passed in, tests never reach the real email service', async () => {
    const admin = fakeAdmin({ profiles })
    expect(await announceVideoReady(admin as any, done)).toBe('no-email')
  })
})
