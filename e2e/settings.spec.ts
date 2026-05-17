import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
  })

  test('settings page loads with heading', async ({ page }) => {
    await expect(page.locator('.page-head h1')).toHaveText('Settings', { timeout: 10000 })
  })

  test('profile tab has name and email fields', async ({ page }) => {
    // Profile tab is the default active tab
    await expect(page.locator('input[name="full_name"]')).toBeVisible({ timeout: 10000 })
    // Email field is a readonly input[type="email"]
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
  })

  test('profile tab has save changes button', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button[type="submit"]')).toHaveText(/Save changes/, { timeout: 10000 })
  })
})
