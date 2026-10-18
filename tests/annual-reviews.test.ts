import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDb, fakeClient, type FakeDb } from './fixtures/fake-supabase'

// ANNUAL REVIEW AUTOPILOT — the date rules, and the real daily job run twice
// on a fake database (it must not make, remind or send anything twice).

let db: FakeDb
const emails: { to: string; subject: string }[] = []
const shares: { videoId: string; clientEmail: string }[] = []
let shareOk = true

vi.mock('../app/_lib/supabase/admin', () => ({ createAdminClient: () => fakeClient(db) }))
vi.mock('../app/_lib/cron-heartbeat', () => ({ recordCronRun: async () => {} }))
vi.mock('../app/_lib/ops-alert', () => ({ alertOps: vi.fn(async () => true) }))
vi.mock('../app/_lib/client-email', async (orig) => ({
  ...(await orig<typeof import('../app/_lib/client-email')>()),
  sendWithResend: async (p: { to: string; subject: string }) => { emails.push(p); return { ok: true, id: 'x' } },
}))
vi.mock('../app/_lib/share-send', () => ({
  sendShareEmail: async (_a: unknown, o: { videoId: string; clientEmail: string }) => {
    shares.push(o)
    return shareOk ? { ok: true, via: 'docs2video', tracked: true } : { ok: false, status: 502, error: 'refused' }
  },
}))

import {
  addDays, anniversaryIn, daysBetween, dueWords, inferIssueDate, nextAnniversary, parseLooseDate, planReviewRun, reviewDue, todayIn,
} from '../app/_lib/annual-review'
import { cleanAnniversary } from '../app/_lib/annual-review-db'
import { GET as cron } from '../app/api/cron/annual-reviews/route'

describe('when is a review due', () => {
  it('next anniversary, counted in whole calendar days', () => {
    expect(nextAnniversary('2019-11-08', '2026-10-09')).toBe('2026-11-08')
    expect(daysBetween('2026-10-09', '2026-11-08')).toBe(30)
    expect(nextAnniversary('2019-03-01', '2026-10-09')).toBe('2027-03-01')
    expect(nextAnniversary('2019-10-09', '2026-10-09')).toBe('2026-10-09') // today counts
    expect(dueWords(30)).toBe('Review due in 30 days')
    expect(dueWords(1)).toBe('Review due tomorrow')
    expect(dueWords(0)).toBe('Review due today')
  })
  it('leap years: a 29 February policy has its anniversary on 28 February in other years', () => {
    expect(anniversaryIn(2027, 2, 29)).toBe('2027-02-28')
    expect(anniversaryIn(2028, 2, 29)).toBe('2028-02-29')
    expect(anniversaryIn(2100, 2, 29)).toBe('2100-02-28') // not a leap year
    expect(nextAnniversary('2024-02-29', '2027-02-01')).toBe('2027-02-28')
    expect(nextAnniversary('2024-02-29', '2027-03-01')).toBe('2028-02-29')
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29)
  })
  it('time zones: "today" is the agent\'s wall calendar, not the server\'s', () => {
    // 03:30 UTC on 9 Oct is still 8 Oct in Chicago.
    const now = new Date('2026-10-09T03:30:00Z')
    expect(todayIn('UTC', now)).toBe('2026-10-09')
    expect(todayIn('America/Chicago', now)).toBe('2026-10-08')
    expect(todayIn('Not/AZone', now)).toBe('2026-10-08') // falls back to New York
    expect(reviewDue('2020-11-07', 'UTC', now)!.daysLeft).toBe(29)
    expect(reviewDue('2020-11-07', 'America/Chicago', now)!.daysLeft).toBe(30)
    expect(reviewDue('2020-11-09', 'America/Chicago', now)!.due).toBe(false) // 32 days out
    // Across a daylight-saving change the count is still whole days.
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('reads the issue date out of a document (a suggestion the agent confirms)', () => {
    expect(inferIssueDate({ issueDate: '03/14/2021' })).toBe('2021-03-14')
    expect(inferIssueDate({ sections: [{ title: 'Policy', content: 'Policy issue date: March 14, 2021. Owner: …' }] })).toBe('2021-03-14')
    expect(inferIssueDate({ keyMetrics: [{ label: 'Effective date', value: '2022-07-01' }] })).toBe('2022-07-01')
    expect(inferIssueDate({ sections: [{ title: 'x', content: 'no dates here' }] })).toBeNull()
    expect(parseLooseDate('02/30/2021')).toBeNull()
  })
  it('a date read from a document waits for the agent; one they type is confirmed', () => {
    expect(cleanAnniversary({ anniversary_date: '2021-03-14', anniversary_source: 'document' })).toMatchObject({ ok: true, patch: { anniversary_confirmed: false } })
    expect(cleanAnniversary({ anniversary_date: '2021-03-14' })).toMatchObject({ ok: true, patch: { anniversary_confirmed: true, anniversary_source: 'agent' } })
    expect(cleanAnniversary({ anniversary_date: '2021-02-30' })).toMatchObject({ ok: false })
    expect(cleanAnniversary({ name: 'x' })).toBeNull()
  })
})

describe('the daily job', () => {
  const NOW = new Date('2026-10-09T13:00:00Z')
  const VID = '22222222-2222-4222-8222-222222222222'
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    process.env.CRON_SECRET = 'test-secret'
    emails.length = 0; shares.length = 0; shareOk = true
    db = makeDb({
      clients: [
        { id: 'c-due30', user_id: 'agent-1', name: 'Rivera Family', email: 'r@example.com', anniversary_date: '2019-11-08', anniversary_confirmed: true, anniversary_tz: 'America/New_York' },
        { id: 'c-due5', user_id: 'agent-1', name: 'Lee Family', email: 'l@example.com', anniversary_date: '2018-10-14', anniversary_confirmed: true, anniversary_tz: 'America/New_York' },
        { id: 'c-far', user_id: 'agent-1', name: 'Far Off', anniversary_date: '2018-04-01', anniversary_confirmed: true, anniversary_tz: null },
        { id: 'c-unconfirmed', user_id: 'agent-1', name: 'Not Yet', anniversary_date: '2018-10-20', anniversary_confirmed: false, anniversary_tz: null },
        { id: 'c-sched', user_id: 'agent-1', name: 'Scheduled', anniversary_date: '2018-10-12', anniversary_confirmed: true, anniversary_tz: 'America/New_York' },
      ],
      client_reviews: [
        { id: 'r-sched', user_id: 'agent-1', client_id: 'c-sched', cycle_date: '2026-10-12', status: 'scheduled', video_id: VID, send_on: '2026-10-09', send_to: 's@example.com', send_tz: 'America/New_York', send_attempts: 0, sent_at: null, reminded_30_at: '2026-09-12T00:00:00Z', reminded_7_at: '2026-10-05T00:00:00Z' },
      ],
      profiles: [{ id: 'agent-1', email: 'agent@example.com', full_name: 'Sam' }],
      notifications: [],
    })
    db.autoId = true
  })
  afterEach(() => { vi.useRealTimers() })
  const run = () => cron(new Request('http://x/api/cron/annual-reviews', { headers: { authorization: 'Bearer test-secret' } }))

  it('refuses without the cron secret', async () => {
    expect((await cron(new Request('http://x'))).status).toBe(401)
  })
  it('makes one review per due client, reminds once, sends the scheduled one — and a second run does nothing', async () => {
    const first = await (await run()).json()
    expect(first).toMatchObject({ created: 2, reminders: 2, agentsEmailed: 1, sent: 1, failed: 0 })
    const rows = db.tables.client_reviews
    expect(rows.filter((r) => r.client_id === 'c-due30')).toHaveLength(1)
    expect(rows.find((r) => r.client_id === 'c-due30')!.reminded_30_at).toBeTruthy()
    expect(rows.find((r) => r.client_id === 'c-due5')!.reminded_7_at).toBeTruthy() // 5 days out: the 7-day one
    expect(rows.some((r) => r.client_id === 'c-far' || r.client_id === 'c-unconfirmed')).toBe(false)
    expect(rows.find((r) => r.id === 'r-sched')).toMatchObject({ status: 'sent' })
    expect(shares).toEqual([expect.objectContaining({ videoId: VID, clientEmail: 's@example.com' })])
    expect(emails).toHaveLength(1)
    expect(emails[0].to).toBe('agent@example.com')

    const second = await (await run()).json()
    expect(second).toMatchObject({ created: 0, reminders: 0, agentsEmailed: 0, sent: 0 })
    expect(db.tables.client_reviews).toHaveLength(3)
    expect(shares).toHaveLength(1)
    expect(emails).toHaveLength(1)
  })
  it('a failed send stays scheduled to retry tomorrow (and is never sent twice the same day)', async () => {
    shareOk = false
    await run()
    expect(db.tables.client_reviews.find((r) => r.id === 'r-sched')).toMatchObject({ status: 'scheduled', send_attempts: 1, last_error: 'refused' })
  })
  it('the plan on its own: applied once, then empty', () => {
    const clients = db.tables.clients as never[]
    const p1 = planReviewRun(clients, [], NOW)
    expect(p1.create.map((c) => c.client_id).sort()).toEqual(['c-due30', 'c-due5', 'c-sched'])
    const applied = p1.create.map((c, i) => ({ id: `r${i}`, ...c, status: 'due', video_id: null, send_on: null, send_tz: null, sent_at: null, reminded_30_at: 'x', reminded_7_at: 'x' }))
    const p2 = planReviewRun(clients, applied, NOW)
    expect(p2).toEqual({ create: [], remind: [], send: [] })
  })
})
