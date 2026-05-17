import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
  })

  test.skip('settings page loads with profile form', async ({ page }) => {
    await expect(page.locator('input[name="name"], input[name="full_name"], input[name="displayName"]').first()).toBeVisible()
    await expect(page.locator('input[name="email"]').first()).toBeVisible()
  })

  test.skip('photo upload sections (headshot, mid-level, standing) are visible', async ({ page }) => {
    const photoSections = page.locator('[data-testid*="photo"], [class*="photo-upload"], label:has-text("photo"), label:has-text("headshot")')
    const count = await photoSections.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test.skip('email connections section exists (Gmail, Microsoft, SMTP options)', async ({ page }) => {
    const emailSection = page.locator('text=/email|connection|integration/i').first()
    await expect(emailSection).toBeVisible()
    await expect(page.locator('text=/gmail/i').first()).toBeVisible()
  })

  test.skip('payments section exists (Connect Stripe button)', async ({ page }) => {
    const stripeButton = page.locator('button, a').filter({ hasText: /stripe|connect.*payment|payment/i }).first()
    await expect(stripeButton).toBeVisible()
  })

  test.skip('calendar booking URL input exists', async ({ page }) => {
    const calendarInput = page.locator('input[name*="calendar"], input[name*="booking"], input[placeholder*="calendly"], input[placeholder*="booking"]').first()
    await expect(calendarInput).toBeVisible()
  })

  test.skip('subscription section shows current plan', async ({ page }) => {
    const subscriptionSection = page.locator('text=/subscription|plan|billing/i').first()
    await expect(subscriptionSection).toBeVisible()
  })
})
