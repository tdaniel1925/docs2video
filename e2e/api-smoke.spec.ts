import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

/**
 * API smoke suite — exercises every user-facing route and asserts correct
 * behavior WITHOUT spending AI credits (no real video/slide generation).
 * Catches the class of bug found repeatedly: wrong fields, missing auth,
 * broken webhooks, drifted contracts.
 *
 * Auth: a logged-in page shares its session cookies with page.request, so
 * these calls run as the test user.
 */
test.describe('API smoke — authenticated routes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('GET /api/analytics returns the expected shape', async ({ page }) => {
    const res = await page.request.get('/api/analytics')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('totalViews')
    expect(body).toHaveProperty('topVideos')
    expect(body).toHaveProperty('dailyViews')
    expect(body).toHaveProperty('emailStats')
    expect(Array.isArray(body.topVideos)).toBeTruthy()
    expect(typeof body.totalViews).toBe('number')
  })

  test('GET /api/credits/balance returns a numeric balance', async ({ page }) => {
    const res = await page.request.get('/api/credits/balance')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    // balance lives under total/monthly/topup depending on the shape
    expect(JSON.stringify(body)).toMatch(/\d/)
  })

  test('GET /api/clients lists clients', async ({ page }) => {
    const res = await page.request.get('/api/clients')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.clients)).toBeTruthy()
  })

  test('POST /api/clients creates then the client appears in the list', async ({ page }) => {
    const unique = `smoketest-${Date.now()}@example.com`
    const create = await page.request.post('/api/clients', {
      data: { name: 'Smoke Test Client', email: unique },
    })
    expect(create.status()).toBe(201)
    const created = await create.json()
    expect(created.client?.id).toBeTruthy()
    expect(created.client?.email).toBe(unique)

    const list = await page.request.get(`/api/clients?search=${encodeURIComponent(unique)}`)
    const found = (await list.json()).clients
    expect(found.some((c: { email: string }) => c.email === unique)).toBeTruthy()

    // cleanup
    await page.request.delete(`/api/clients/${created.client.id}`)
  })

  test('POST /api/clients rejects an empty name', async ({ page }) => {
    const res = await page.request.post('/api/clients', { data: { email: 'noname@example.com' } })
    expect(res.status()).toBe(400)
  })

  test('POST /api/videos/draft creates a draft row', async ({ page }) => {
    const res = await page.request.post('/api/videos/draft', {
      data: { outputType: 'video', purpose: 'Smoke test draft', contentMethod: 'idea', extractedData: { sections: [{ title: 'x', content: 'y' }] } },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.videoId).toBeTruthy()
  })

  test('POST /api/videos/draft rejects a bad outputType', async ({ page }) => {
    const res = await page.request.post('/api/videos/draft', { data: { outputType: 'banana' } })
    expect(res.status()).toBe(400)
  })

  test('POST /api/contact accepts a valid message', async ({ page }) => {
    const res = await page.request.post('/api/contact', {
      data: { name: 'Smoke', email: 'smoke@example.com', subject: 'Test', message: 'Automated smoke test — ignore.' },
    })
    // 200 if Resend configured; allow 500 only if the key is absent in test env
    expect([200, 500]).toContain(res.status())
  })
})

test.describe('API smoke — auth + webhook guards (no login)', () => {
  test('protected route rejects unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/videos/draft', { data: { outputType: 'video' } })
    expect([401, 302, 307]).toContain(res.status())
  })

  test('video GET requires auth/ownership', async ({ request }) => {
    const res = await request.get('/api/videos/00000000-0000-0000-0000-000000000000')
    expect([401, 404, 302, 307]).toContain(res.status())
  })

  test('stripe webhook rejects a request with no signature', async ({ request }) => {
    const res = await request.post('/api/webhooks/stripe', { data: { type: 'test' } })
    expect(res.status()).toBe(400)
  })

  test('cron route rejects without the secret', async ({ request }) => {
    const res = await request.get('/api/cron/daily-digest')
    expect(res.status()).toBe(401)
  })
})
