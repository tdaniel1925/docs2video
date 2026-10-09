import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeDb, type FakeDb } from './fixtures/fake-supabase'

/*
 * AUDIT 2026-10-09 #6 — SSRF on the app side.
 * generate-commercial sent any website / music / logo address to the render
 * service, which fetched it from inside AWS (169.254.169.254 = the machine's
 * own credentials). The REAL route now refuses a private / loopback /
 * link-local address before anything is charged or sent. The API webhook
 * (an address the API caller gives us) is held to the same rule.
 * Only IP-literal addresses are used here, so no real DNS or network call.
 */

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  checkCredits: vi.fn(),
  deductCredits: vi.fn(),
  fetchSpy: vi.fn(),
}))

vi.mock('../app/_lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'a@b.c', email_confirmed_at: 'x' } } }) } }),
}))
vi.mock('../app/_lib/supabase/admin', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createAdminClient: () => fakeClient(h.db) }
})
vi.mock('../app/_lib/video-service', () => ({ videoServiceUrl: () => 'http://render.test' }))
vi.mock('../app/_lib/credits', async (orig) => ({
  ...(await orig<typeof import('../app/_lib/credits')>()),
  checkCredits: h.checkCredits,
  deductCredits: h.deductCredits,
  refundVideoCredits: vi.fn(),
}))

import { POST } from '../app/api/generate-commercial/route'
import { fireApiWebhook } from '../app/_lib/api-webhook'
import { isSafePublicUrl } from '../app/_lib/brand-scraper'

const realFetch = globalThis.fetch
beforeEach(() => {
  h.db = makeDb({ profiles: [{ id: 'u1', subscription_status: 'pro', is_admin: false, is_beta: false }], videos: [] })
  h.checkCredits.mockReset().mockResolvedValue({ allowed: true, remaining: 99999 })
  h.deductCredits.mockReset().mockResolvedValue(true)
  h.fetchSpy.mockReset().mockResolvedValue(new Response('{}', { status: 200 }))
  globalThis.fetch = h.fetchSpy as unknown as typeof fetch
})
afterEach(() => { globalThis.fetch = realFetch })

const make = (body: Record<string, unknown>) => POST(new Request('http://x/api/generate-commercial', { method: 'POST', body: JSON.stringify(body) }))

describe('generate-commercial refuses addresses inside our network (real route)', () => {
  for (const [label, body] of [
    ['cloud metadata website', { url: 'http://169.254.169.254/latest/meta-data/' }],
    ['loopback music', { text: 'We sell shoes.', musicUrl: 'http://127.0.0.1:4000/health' }],
    ['private-network logo', { text: 'We sell shoes.', logoUrl: 'http://10.0.0.7/logo.png' }],
    ['ECS credentials address', { text: 'We sell shoes.', musicUrl: 'http://169.254.170.2/v2/credentials' }],
  ] as const) {
    it(`${label} → 400, nothing charged, nothing sent to the render service`, async () => {
      const res = await make(body)
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe('blocked_url')
      expect(h.deductCredits).not.toHaveBeenCalled()
      expect(h.fetchSpy).not.toHaveBeenCalled()
      expect(h.db.tables.videos).toEqual([])
    })
  }

  it('the shared address rule covers the ranges the old copy missed', async () => {
    for (const ip of ['192.0.0.8', '198.18.0.1', '224.0.0.1', '240.0.0.1', '0.0.0.0']) {
      expect(await isSafePublicUrl(`http://${ip}/`), ip).toBe(false)
    }
    expect(await isSafePublicUrl('http://93.184.216.34/')).toBe(true)
  })
})

describe('API webhooks never post into our network', () => {
  it('a webhook_url pointing at the metadata address is not called', async () => {
    h.db.tables.videos.push({ id: 'j1', user_id: 'u1', status: 'failed', draft_data: { source: 'api', apiWebhookUrl: 'http://169.254.169.254/latest/' } })
    await fireApiWebhook('j1')
    expect(h.fetchSpy).not.toHaveBeenCalled()
  })

  it('a public webhook is called once, without following redirects', async () => {
    h.db.tables.videos.push({ id: 'j1', user_id: 'u1', status: 'completed', draft_data: { source: 'api', apiWebhookUrl: 'http://93.184.216.34/hook' } })
    await fireApiWebhook('j1')
    expect(h.fetchSpy).toHaveBeenCalledTimes(1)
    expect(h.fetchSpy.mock.calls[0][1]).toMatchObject({ method: 'POST', redirect: 'manual' })
  })
})
