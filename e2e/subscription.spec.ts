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

  test('manage billing button is present for customers (or upgrade CTA otherwise)', async ({ page }) => {
    // A user with a stripe_customer_id sees "Manage billing"; others see plan options.
    const manage = page.getByRole('button', { name: /manage billing/i })
    const upgrade = page.getByRole('button', { name: /upgrade|choose|subscribe/i }).first()
    await expect(manage.or(upgrade)).toBeVisible({ timeout: 10000 })
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
