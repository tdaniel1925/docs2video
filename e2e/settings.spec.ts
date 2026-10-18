import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
  })

  test('settings page loads with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profile', { timeout: 10000 })
  })

  test('Profile has name and email fields', async ({ page }) => {
    // Profile tab is the default active tab
    await expect(page.locator('input[name="full_name"]')).toBeVisible({ timeout: 10000 })
    // Email field is a readonly input[type="email"]
    await expect(page.locator('input[type="email"][readonly]')).toBeVisible({ timeout: 10000 })
  })

  test('Profile has a Save changes button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible({ timeout: 10000 })
  })
})
