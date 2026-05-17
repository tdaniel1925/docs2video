import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('dashboard page loads with welcome heading', async ({ page }) => {
    const heading = page.locator('.page-head h1')
    await expect(heading).toBeVisible()
    const text = await heading.textContent()
    expect(text?.toLowerCase()).toContain('welcome back')
  })

  test('page head section is visible', async ({ page }) => {
    const pageHead = page.locator('.page-head')
    await expect(pageHead).toBeVisible()
  })

  test('create video button or CTA links to /quick', async ({ page }) => {
    const createLink = page.locator('a[href="/quick"]').first()
    await expect(createLink).toBeVisible()
    const text = await createLink.textContent()
    expect(text?.toLowerCase()).toContain('create')
  })

  test('activity rows are rendered', async ({ page }) => {
    const activityRows = page.locator('.activity-row')
    const count = await activityRows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('clicking create link navigates to /quick', async ({ page }) => {
    const createLink = page.locator('a[href="/quick"]').first()
    await createLink.click()
    await page.waitForURL(/\/quick/, { timeout: 10000 })
    expect(page.url()).toContain('/quick')
  })

  test('videos link navigates to videos page', async ({ page }) => {
    const videosLink = page.locator('a[href="/videos"]').first()
    if (await videosLink.isVisible()) {
      await videosLink.click()
      await page.waitForURL(/\/videos/, { timeout: 10000 })
      expect(page.url()).toContain('/videos')
    }
  })
})
