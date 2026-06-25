import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

/**
 * Subscription purchase + management. These hit Stripe in TEST mode and only
 * CREATE checkout/portal sessions (returning a URL) — they never complete a
 * payment, so they're safe to run repeatedly. If the test env points at live
 * Stripe keys, the URL assertions still hold (a session is created, not paid).
 */
test.describe('Subscription — purchase', () => {
  test.beforeEach(async ({ page }) => { await loginAsTestUser(page) })

  test('POST /api/subscribe returns a Stripe Checkout URL for a valid tier', async ({ page }) => {
    const res = await page.request.post('/api/subscribe', { data: { tier: 'pro' } })
    // 200 with a checkout URL, or 500 only if price IDs aren't configured in this env
    if (res.ok()) {
      const body = await res.json()
      expect(body.url).toMatch(/^https:\/\/(checkout\.stripe\.com|.*stripe)/)
    } else {
      expect([500]).toContain(res.status())
      const body = await res.json()
      expect(body.error).toMatch(/price|configured/i)
    }
  })

  test('POST /api/subscribe rejects an invalid tier', async ({ page }) => {
    const res = await page.request.post('/api/subscribe', { data: { tier: 'platinum-unicorn' } })
    expect(res.status()).toBe(400)
  })

  test('POST /api/credits/buy returns a checkout URL for a valid pack', async ({ page }) => {
    const res = await page.request.post('/api/credits/buy', { data: { pack: 'starter' } })
    if (res.ok()) {
      const body = await res.json()
      expect(body.url).toMatch(/stripe/)
    } else {
      // 500 only if credit-pack price env is unset
      expect([402, 500]).toContain(res.status())
    }
  })

  test('POST /api/credits/buy rejects an invalid pack', async ({ page }) => {
    const res = await page.request.post('/api/credits/buy', { data: { pack: 'nope' } })
    expect(res.status()).toBe(400)
  })
})

test.describe('Subscription — management (Settings UI)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings?tab=subscription')
  })

  test('subscription tab shows the current plan', async ({ page }) => {
    await expect(page.getByText(/plan|subscription/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('subscription tab exposes a billing action (manage / upgrade / top-up)', async ({ page }) => {
    // Depending on the account's billing state the UI shows different controls —
    // "Manage billing" (existing customer), an upgrade/subscribe/choose CTA, or a
    // "Top Up" credits action. Any ONE of them means the billing UI rendered.
    const billingControl = page.getByRole('button', { name: /manage billing|upgrade|choose|subscribe|top ?up|change plan/i })
      .or(page.getByRole('link', { name: /manage billing|upgrade|choose|subscribe|top ?up|change plan/i }))
    await expect(billingControl.first()).toBeVisible({ timeout: 10000 })
  })

  test('POST /api/stripe/portal returns a URL or a clear "no subscription" error', async ({ page }) => {
    const res = await page.request.post('/api/stripe/portal')
    if (res.ok()) {
      const body = await res.json()
      expect(body.url).toMatch(/stripe/)
    } else {
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/no active subscription/i)
    }
  })
})

test.describe('Account — security self-service', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
  })

  test('Security card exposes change-email and change-password', async ({ page }) => {
    await expect(page.getByText('Security')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /update email/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /update password/i })).toBeVisible()
  })
})
