import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDb, type FakeDb } from './fixtures/fake-supabase'

/*
 * AUDIT 2026-10-09 #2 — scene cap.
 *
 * generate-video takes the scenes the browser sends, but charges by the
 * length saved on the draft. A Short-priced request could carry 60 scenes.
 * These run the REAL generate-video route (database, credits and settings
 * mocked — no AI, no render) and check that a story bigger than the paid
 * length is refused BEFORE the row is claimed or any credit is taken, and that
 * a normal story of that length still goes through to the charge.
 */

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  checkCredits: vi.fn(),
  deductCredits: vi.fn(),
}))

vi.mock('../app/_lib/supabase/server', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return {
    createClient: async () => ({
      ...fakeClient(h.db),
      auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'a@b.c' } } }) },
    }),
  }
})
vi.mock('../app/_lib/supabase/admin', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createAdminClient: () => fakeClient(h.db) }
})
vi.mock('../app/_lib/app-settings', () => ({ getFlag: async () => false, getSetting: async () => null }))
vi.mock('../app/_lib/brand-server', () => ({ getBrand: async () => ({ id: 'docs2video' }) }))
vi.mock('../app/_lib/credits', async (orig) => ({
  ...(await orig<typeof import('../app/_lib/credits')>()),
  checkCredits: h.checkCredits,
  deductCredits: h.deductCredits,
  refundVideoCredits: vi.fn(),
}))
vi.mock('../app/_lib/ops-alert', () => ({ alertOps: vi.fn(async () => true) }))

import { POST } from '../app/api/generate-video/route'
import { storyTooBigMessage, LENGTH_LIMITS } from '../app/_lib/length-limits'

const scene = (i: number, words = 25) => ({
  scene: i, title: `Scene ${i}`, slidePrompt: 'A slide', narration: Array.from({ length: words }, (_, k) => `word${k}`).join(' '),
})

function seed(detailLevel: 'quick' | 'standard' | 'detailed') {
  h.db = makeDb({
    profiles: [{ id: 'u1', subscription_status: 'pro', is_admin: false, is_beta: false }],
    videos: [{ id: 'v1', user_id: 'u1', status: 'draft', output_type: 'video', detail_level: null, draft_data: { detailLevel } }],
  })
}

const post = (scenes: unknown[]) => POST(new Request('http://x/api/generate-video', {
  method: 'POST',
  body: JSON.stringify({ videoId: 'v1', purpose: 'Explain it', policyData: { sections: [{ title: 'a', content: 'b' }] }, preGeneratedScenes: scenes, voiceId: 'nova' }),
}))

beforeEach(() => {
  h.checkCredits.mockReset().mockResolvedValue({ allowed: true, remaining: 99999, blockedReason: null })
  // Refuse the charge so a story that passes the cap stops right there (no AI, no render).
  h.deductCredits.mockReset().mockResolvedValue(false)
})

describe('storyTooBigMessage (pure)', () => {
  it('a story the writer would produce fits its length', () => {
    expect(storyTooBigMessage(Array.from({ length: 6 }, (_, i) => scene(i, 30)), 'quick')).toBeNull()
    expect(storyTooBigMessage(Array.from({ length: 10 }, (_, i) => scene(i, 50)), 'standard')).toBeNull()
    expect(storyTooBigMessage(Array.from({ length: 14 }, (_, i) => scene(i, 180)), 'detailed')).toBeNull()
  })
  it('too many scenes, or too many words, is refused in plain words', () => {
    expect(storyTooBigMessage(Array.from({ length: LENGTH_LIMITS.quick.maxScenes + 1 }, (_, i) => scene(i, 5)), 'quick')).toMatch(/more than a Short video can have/)
    expect(storyTooBigMessage([scene(1, LENGTH_LIMITS.standard.maxWords + 1)], 'standard')).toMatch(/words of narration/)
  })
})

describe('POST /api/generate-video — story bigger than the paid length (real route)', () => {
  it('a Short video with 60 scenes is refused before the claim or any charge', async () => {
    seed('quick')
    const res = await post(Array.from({ length: 60 }, (_, i) => scene(i + 1)))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('story_too_long')
    expect(h.deductCredits).not.toHaveBeenCalled()
    expect(h.db.tables.videos[0].status).toBe('draft')
    expect(h.db.log.filter((l) => l.startsWith('update videos'))).toEqual([])
  })

  it('a Standard video with a 9,000-word narration is refused too', async () => {
    seed('standard')
    const res = await post([scene(1, 9000), scene(2), scene(3)])
    expect(res.status).toBe(400)
    expect(h.deductCredits).not.toHaveBeenCalled()
  })

  it('a normal Short story goes on to the charge (the cap does not block real use)', async () => {
    seed('quick')
    const res = await post(Array.from({ length: 5 }, (_, i) => scene(i + 1)))
    expect(h.deductCredits).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(402) // our mock refused the charge; the cap let it through
  })
})
