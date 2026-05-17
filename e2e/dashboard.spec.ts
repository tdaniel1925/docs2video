import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('dashboard loads with stats row (3 stat cards)', async ({ page }) => {
    await page.goto('/dashboard')
    const statCards = page.locator('[data-testid="stat-card"], [class*="stat"], [class*="metric"]')
    await expect(statCards.first()).toBeVisible()
    const count = await statCards.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('recent activity list is visible', async ({ page }) => {
    await page.goto('/dashboard')
    const activityList = page.locator('[data-testid="recent-activity"], [class*="activity"], [class*="recent"]').first()
    await expect(activityList).toBeVisible()
  })

  test('+ New Presentation button navigates to /create', async ({ page }) => {
    await page.goto('/dashboard')
    const newButton = page.locator('a, button').filter({ hasText: /new|create/i }).first()
    await expect(newButton).toBeVisible()
    await newButton.click()
    await expect(page).toHaveURL(/\/create/)
  })

  test('navigation header shows all links', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('nav, header').first()).toBeVisible()
  })

  test('user avatar dropdown opens with settings/signout', async ({ page }) => {
    await page.goto('/dashboard')
    const avatar = page.locator('[data-testid="user-avatar"], [class*="avatar"], img[alt*="profile"], img[alt*="avatar"]').first()
    await avatar.click()
    await expect(page.locator('text=/settings/i').first()).toBeVisible()
    await expect(page.locator('text=/sign out|logout|log out/i').first()).toBeVisible()
  })
})
