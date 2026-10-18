import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { makeDb, type FakeDb } from './fixtures/fake-supabase'

/*
 * AUDIT 2026-10-09 #3, #4, #8 — free AI without a cap.
 *  #3  every signed-in free AI step counts toward a daily cap: the no-card cap
 *      AND a per-account ceiling for everyone (routes nothing calls were
 *      deleted — tests/retired-tools.test.ts keeps them deleted);
 *  #8  the counters FAIL CLOSED — a broken counter refuses, never "unlimited";
 *  #4  /api/chat answers only the video's signed-in owner.
 * The gate and the chat route run for real against a pretend database.
 */

const ROOT = path.resolve(__dirname, '..')
const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  user: { id: 'u1' } as { id: string } | null,
  counters: {} as Record<string, number>,
  counterBroken: false,
  claude: vi.fn(),
  alert: vi.fn(async () => true),
}))

vi.mock('../app/_lib/supabase/admin', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createAdminClient: () => fakeClient(h.db) }
})
vi.mock('../app/_lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create: h.claude } } }))
vi.mock('../app/_lib/ops-alert', () => ({ alertOps: h.alert }))

import { cardlessPrepGate, aiDailyGate } from '../app/_lib/cardless-prep'
import { AI_STEPS_PER_DAY, CARDLESS_PREP_PER_DAY, aiDailyKey } from '../app/_lib/light-start'
import { POST as chatPOST } from '../app/api/chat/route'

function seed(profile: Record<string, unknown> | null) {
  h.db = makeDb({ profiles: profile ? [{ id: 'u1', ...profile }] : [], videos: [], chat_messages: [] })
  // The real rate_limit_hit: count per key, allowed while count <= max.
  h.db.rpc.rate_limit_hit = ({ p_key, p_max }: { p_key: string; p_max: number }) => {
    if (h.counterBroken) return { data: null, error: { message: 'relation "rate_limits" does not exist' } }
    h.counters[p_key] = (h.counters[p_key] || 0) + 1
    return { data: h.counters[p_key] <= p_max, error: null }
  }
}

beforeEach(() => {
  h.user = { id: 'u1' }
  h.counters = {}
  h.counterBroken = false
  h.claude.mockReset().mockResolvedValue({ content: [{ type: 'text', text: 'An answer.' }] })
  h.alert.mockClear()
  process.env.ANTHROPIC_API_KEY = 'test'
})

describe('the daily AI gate (real code, pretend counter)', () => {
  it('an account WITH a card now has a daily ceiling too', async () => {
    seed({ subscription_status: 'pro', card_on_file: true })
    for (let i = 0; i < AI_STEPS_PER_DAY; i++) expect(await aiDailyGate('u1')).toBeNull()
    const over = await aiDailyGate('u1')
    expect(over?.status).toBe(429)
    expect((await over!.json()).code).toBe('ai_daily_cap')
    expect(Object.keys(h.counters)).toEqual([aiDailyKey('u1', new Date())])
  })

  it('a no-card account still hits its smaller cap first', async () => {
    seed({ subscription_status: 'free', card_on_file: false })
    for (let i = 0; i < CARDLESS_PREP_PER_DAY; i++) expect(await cardlessPrepGate('u1')).toBeNull()
    expect((await (await cardlessPrepGate('u1'))!.json()).code).toBe('cardless_prep_cap')
  })

  it('admins and beta accounts are not counted', async () => {
    seed({ is_admin: true, subscription_status: 'free', card_on_file: false })
    expect(await aiDailyGate('u1')).toBeNull()
    expect(h.counters).toEqual({})
  })

  it('FAILS CLOSED when the counter is broken (#8) — and Trent is told', async () => {
    seed({ subscription_status: 'free', card_on_file: false })
    h.counterBroken = true
    const res = await cardlessPrepGate('u1')
    expect(res?.status).toBe(503)
    expect((await res!.json()).code).toBe('ai_cap_unavailable')
    seed({ subscription_status: 'pro', card_on_file: true })
    h.counterBroken = true
    expect((await aiDailyGate('u1'))?.status).toBe(503)
    await new Promise((r) => setTimeout(r, 10))
    expect(h.alert).toHaveBeenCalled()
  })

  it('fails closed when the profile can’t be read', async () => {
    seed(null)
    h.db.failOn.profiles = { error: { message: 'timeout' } }
    expect((await aiDailyGate('u1'))?.status).toBe(503)
  })

  it('the free AI routes that are still used now pass through the gate', () => {
    const gated = ['transcribe', 'help-chat', 'deck-parse', 'design-prefill', 'flyer-chat', 'fix-photo', 're-render',
      'brand-from-url', 'generate-logo-kit', 'generate-from-idea', 'generate-social-post', 'scrape-brand', 'extract-text', 'chat']
    for (const r of gated) {
      expect(readFileSync(path.join(ROOT, `app/api/${r}/route.ts`), 'utf8'), r).toMatch(/await aiDailyGate\(user\.id\)\s*\n\s*if \(capped\) return capped/)
    }
  })
})

describe('/api/chat — only the video’s owner (#4)', () => {
  const ask = (videoId = 'v1') => chatPOST(new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({ videoId, message: 'What is it?' }) }))

  it('no sign-in → 401, no AI call', async () => {
    seed({ subscription_status: 'pro', card_on_file: true })
    h.user = null
    expect((await ask()).status).toBe(401)
    expect(h.claude).not.toHaveBeenCalled()
  })

  it('someone else’s video → 404, no AI call, its script never read out', async () => {
    seed({ subscription_status: 'pro', card_on_file: true })
    h.db.tables.videos.push({ id: 'v1', user_id: 'someone-else', status: 'completed', title: 'Secret', script: [{ title: 'x', narration: 'private numbers' }] })
    expect((await ask()).status).toBe(404)
    expect(h.claude).not.toHaveBeenCalled()
  })

  it('the owner gets an answer (and it counts toward the daily ceiling)', async () => {
    seed({ subscription_status: 'pro', card_on_file: true })
    h.db.tables.videos.push({ id: 'v1', user_id: 'u1', status: 'completed', title: 'Mine', script: [{ title: 'x', narration: 'my numbers' }] })
    const res = await ask()
    expect(res.status).toBe(200)
    expect(h.claude).toHaveBeenCalledTimes(1)
    expect(h.counters[aiDailyKey('u1', new Date())]).toBe(1)
  })
})
