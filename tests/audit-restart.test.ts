import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDb, fakeClient, type FakeDb } from './fixtures/fake-supabase'

/*
 * AUDIT 2026-10-09 #1 — "Restart = free video".
 *
 * Restart refunded a job that was still working; the job then finished and
 * the customer had the video with the money back. These run the REAL restart
 * route against a pretend database (filters really filter) with the refund
 * mocked, and check: a job that wrote progress in the last 15 minutes is left
 * alone (no refund, no write); a quiet one or a failed one is restarted.
 */

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  user: { id: 'u1' } as { id: string } | null,
  refund: vi.fn(),
}))

vi.mock('../app/_lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('../app/_lib/supabase/admin', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createAdminClient: () => fakeClient(h.db) }
})
vi.mock('../app/_lib/video-billing', async () => ({
  IN_PROGRESS_STATUSES: (await import('../app/_lib/video-running')).IN_PROGRESS_STATUSES,
  refundVerifiedCharge: h.refund,
}))
vi.mock('../app/_lib/ops-alert', () => ({ alertOps: vi.fn(async () => true) }))

import { POST } from '../app/api/videos/[id]/restart/route'
import { restartDecision, RESTART_QUIET_MS } from '../app/_lib/video-running'

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const call = (id = 'v1') => POST(new Request('http://x/api/videos/v1/restart', { method: 'POST' }), { params: Promise.resolve({ id }) })

beforeEach(() => {
  h.user = { id: 'u1' }
  h.refund.mockReset().mockResolvedValue(500)
  h.db = makeDb({ videos: [] })
})

describe('restartDecision (pure rule)', () => {
  const now = Date.now()
  it('a job that wrote progress less than 15 minutes ago is still working', () => {
    expect(restartDecision({ status: 'generating_slides', progress_updated_at: new Date(now - 5 * 60_000).toISOString() }, now))
      .toEqual({ ok: false, reason: 'still_working' })
  })
  it('a job quiet for 15+ minutes may be restarted; so may a failed one', () => {
    expect(restartDecision({ status: 'assembling', progress_updated_at: new Date(now - RESTART_QUIET_MS - 1000).toISOString() }, now))
      .toEqual({ ok: true, kind: 'stalled' })
    expect(restartDecision({ status: 'failed' }, now)).toEqual({ ok: true, kind: 'failed' })
  })
  it('a finished video, or a job with no time at all, is not restarted', () => {
    expect(restartDecision({ status: 'completed' }, now)).toEqual({ ok: false, reason: 'not_running' })
    expect(restartDecision({ status: 'rendering', progress_updated_at: null, created_at: null }, now)).toEqual({ ok: false, reason: 'still_working' })
  })
})

describe('POST /api/videos/{id}/restart (real route, pretend database)', () => {
  it('a job still writing progress is NOT refunded or touched', async () => {
    h.db.tables.videos.push({ id: 'v1', user_id: 'u1', status: 'generating_slides', progress_updated_at: ago(5), created_at: ago(40), deducted_cost: 500 })
    const res = await call()
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('still_working')
    expect(h.refund).not.toHaveBeenCalled()
    expect(h.db.log.filter((l) => l.startsWith('update'))).toEqual([])
    expect(h.db.tables.videos[0].status).toBe('generating_slides')
  })

  it('a job quiet for 20 minutes is failed, refunded once, and set back to pending', async () => {
    h.db.tables.videos.push({ id: 'v1', user_id: 'u1', status: 'assembling', progress_updated_at: ago(20), created_at: ago(60), deducted_cost: 500 })
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, refunded: 500 })
    expect(h.refund).toHaveBeenCalledTimes(1)
    expect(h.db.tables.videos[0].status).toBe('pending')
    expect(h.db.storageRemoved).toEqual(['u1/v1.mp4'])
  })

  it('an old row with no progress stamp counts as quiet from when it was made', async () => {
    h.db.tables.videos.push({ id: 'v1', user_id: 'u1', status: 'rendering', progress_updated_at: null, created_at: ago(30), deducted_cost: 500 })
    expect((await call()).status).toBe(200)
  })

  it('a failed video can be restarted (ledger-checked refund, then pending)', async () => {
    h.db.tables.videos.push({ id: 'v1', user_id: 'u1', status: 'failed', progress_updated_at: ago(1), created_at: ago(5), deducted_cost: 0 })
    h.refund.mockResolvedValue(0)
    const res = await call()
    expect(res.status).toBe(200)
    expect(h.db.tables.videos[0].status).toBe('pending')
  })

  it('someone else’s video is not found, and nothing is written', async () => {
    h.db.tables.videos.push({ id: 'v1', user_id: 'other', status: 'assembling', progress_updated_at: ago(60), created_at: ago(90), deducted_cost: 500 })
    expect((await call()).status).toBe(404)
    expect(h.refund).not.toHaveBeenCalled()
    expect(h.db.log).toEqual([])
  })

  it('a finished video is not restarted', async () => {
    h.db.tables.videos.push({ id: 'v1', user_id: 'u1', status: 'completed', progress_updated_at: ago(60), created_at: ago(90), deducted_cost: 0 })
    expect((await call()).status).toBe(409)
    expect(h.refund).not.toHaveBeenCalled()
  })
})
