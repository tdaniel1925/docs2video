import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/admin')
  })

  test('admin page loads with heading', async ({ page }) => {
    await expect(page.locator('.page-head h1')).toHaveText('Admin', { timeout: 10000 })
  })

  test('dashboard tab shows stats and content', async ({ page }) => {
    // Dashboard is the default tab; stat cards use .stats-row > .stat-card
    await expect(page.locator('.stats-row .stat-card').first()).toBeVisible({ timeout: 10000 })
    // Verify the "Total Users" stat label is present
    await expect(page.locator('.stat-label:has-text("Total Users")')).toBeVisible({ timeout: 10000 })
  })
})
