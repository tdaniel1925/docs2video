import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin page loads for admin user', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('h1, h2').filter({ hasText: /admin|dashboard/i }).first()).toBeVisible()
  })

  test('stats cards are visible', async ({ page }) => {
    await page.goto('/admin')
    const statCards = page.locator('[data-testid="stat-card"], [class*="stat"], [class*="metric"]')
    const count = await statCards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('recent signups table exists', async ({ page }) => {
    await page.goto('/admin')
    const signupsTable = page.locator('table, [data-testid="signups-table"], [class*="signup"]').first()
    await expect(signupsTable).toBeVisible()
  })

  test('recent generations table exists', async ({ page }) => {
    await page.goto('/admin')
    const generationsTable = page.locator('table, [data-testid="generations-table"], [class*="generation"]').last()
    await expect(generationsTable).toBeVisible()
  })
})
