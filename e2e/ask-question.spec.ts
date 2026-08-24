import { test, expect } from '@playwright/test'

/**
 * "Ask a question" on the public share page must be a REAL action, not a dead
 * button: it emails the presenter. This spec exercises the endpoint's guard
 * rails WITHOUT sending a real email — empty question is refused, and an unknown
 * video is refused — so we never spam a real owner from CI. (A genuine send is
 * covered by the endpoint's happy path, which requires a real video id + owner.)
 */
test.describe('Ask a question — public endpoint guards', () => {
  test('empty question is refused (400), never sent', async ({ request }) => {
    const res = await request.post('/api/watch/any-id/ask', {
      data: { question: '   ' },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/type your question/i)
  })

  test('unknown video is refused (404), never sent', async ({ request }) => {
    const res = await request.post('/api/watch/definitely-not-a-real-video-id/ask', {
      data: { question: 'Is this real?' },
    })
    // 404 (no such video) — the endpoint looked it up and found nothing.
    expect([404, 422]).toContain(res.status())
  })

  test('an over-long question is refused', async ({ request }) => {
    const res = await request.post('/api/watch/any-id/ask', {
      data: { question: 'x'.repeat(2100) },
    })
    expect(res.status()).toBe(400)
  })
})
