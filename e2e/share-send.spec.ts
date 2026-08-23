import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

/**
 * THE COMPLAINT THIS GUARDS: "it says Copy email — I cannot figure out if it
 * sent the video or not… there is nowhere to insert an email… no clear screen
 * of what just happened."
 *
 * The modal must now: have a client-email field, a real Send button, refuse a
 * bad address with a visible message, label the copy path as NOT sending, and
 * offer a copy-link row. No real email is sent by this test (the send path is
 * exercised only through its validation branch).
 */
test.describe('Send to Client modal', () => {
  test('send flow is explicit: email field, validation, honest copy label', async ({ page }) => {
    await loginAsTestUser(page)

    // Ask the app's own API for a finished video — no scraping, no guessing.
    // The send button only renders on status=completed rows with a video_url.
    const res = await page.request.get('/api/videos')
    expect(res.ok(), '/api/videos should answer for a logged-in user').toBeTruthy()
    const rows = (await res.json()) as { id: string; status: string; video_url: string | null }[]
    const done = Array.isArray(rows) ? rows.find((v) => v.status === 'completed' && v.video_url) : undefined
    test.skip(!done, 'no completed video on this account to exercise the send modal')

    await page.goto(`/videos/${done!.id}`)
    const btn = page.getByRole('button', { name: 'Send to Client' })
    await expect(btn, 'completed video page must show the Send to Client button').toBeVisible({ timeout: 15000 })
    await btn.click()

    // ── The modal is send-first and self-explaining. ──
    await expect(page.getByRole('heading', { name: 'Send to Your Client' })).toBeVisible()
    const emailInput = page.getByPlaceholder('e.g. sarah@example.com')
    await expect(emailInput, 'the client-email field the old modal never had').toBeVisible()
    const sendBtn = page.getByRole('button', { name: 'Send Email Now' })
    await expect(sendBtn).toBeVisible()

    // ── A bad address is refused OUT LOUD, before anything sends. ──
    // (Next.js's route announcer is also role=alert, so match the message text.)
    await emailInput.fill('not-an-email')
    await sendBtn.click()
    await expect(page.getByText(/Enter your client.?s email address first/i)).toBeVisible()

    // ── The manual path says plainly that copying does not send. ──
    await expect(page.getByText(/Copying does not send anything/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Copy email for my own inbox/i })).toBeVisible()

    // ── The watch link has its own copy control (exact case: the page behind
    // the modal has an older "Copy Link" button too). ──
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible()

    // Close cleanly.
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('heading', { name: 'Send to Your Client' })).toBeHidden()
  })
})
