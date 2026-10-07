import { test, expect } from '@playwright/test'
import { guardRealWorld, expectNoBlockedCalls, type Guard } from './helpers/guard'

/**
 * THE COMPLAINT THIS GUARDS: "it says Copy email — I cannot figure out if it
 * sent the video or not… there is nowhere to insert an email… no clear screen
 * of what just happened."
 *
 * Since phase 4 there is ONE send panel ("Ready to send") — the older send
 * window is gone. It must have: a client-email field when none is known, a
 * real Send button, refuse a bad address out loud, a copy-link control and a
 * copy-the-email control labelled as NOT sending. No real email is sent (the
 * send path is exercised only through its validation branch; the guard blocks
 * the send route).
 */
let guard: Guard
test.beforeEach(async ({ page }) => { guard = await guardRealWorld(page) })
test.afterEach(() => expectNoBlockedCalls(guard))

test.describe('the one send panel', () => {
  test('send flow is explicit: email field, validation, honest copy label, no second window', async ({ page }) => {
    const res = await page.request.get('/api/videos')
    expect(res.ok(), '/api/videos should answer for a logged-in user').toBeTruthy()
    const rows = (await res.json()) as { id: string; status: string; video_url: string | null }[]
    const done = Array.isArray(rows) ? rows.find((v) => v.status === 'completed' && v.video_url) : undefined
    test.skip(!done, 'no completed video on this account')

    // Pretend no client is known, so the email box shows.
    await page.route('**/rest/v1/videos?**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const real = await route.fetch()
      const body = await real.json()
      const patch = (v: Record<string, unknown>) => ({ ...v, client_id: null, recipient_name: null, draft_data: null })
      await route.fulfill({ response: real, json: Array.isArray(body) ? body.map(patch) : patch(body) })
    })
    await page.route('**/rest/v1/quotes?**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: [] }) : r.fallback())

    await page.goto(`/videos/${done!.id}`)
    const panel = page.getByRole('region', { name: 'Ready to send' })
    await expect(panel).toBeVisible({ timeout: 20000 })

    // The older window and its button are gone for good.
    await expect(page.getByRole('button', { name: 'Send to Client' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Send to Your Client' })).toHaveCount(0)

    const email = panel.getByLabel('Client email')
    await expect(email).toBeVisible()
    await expect(panel.getByLabel('Their name (optional)')).toBeVisible()
    await email.fill('not-an-email')
    await panel.getByRole('button', { name: /^Send to / }).click()
    await expect(panel.getByText(/Enter your client.?s email address first/i)).toBeVisible()

    await expect(panel.getByText(/Copying sends nothing/i)).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Copy the email' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'or copy the link' })).toBeVisible()
  })
})
