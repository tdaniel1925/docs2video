import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

// Creating and deleting a profile end to end lives in app-pages.spec.ts
// (it removes what it makes). These are the quick page checks.
test.describe('Brand Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('brands page loads with heading', async ({ page }) => {
    await page.goto('/brands')
    await expect(page.locator('.page-head h1')).toHaveText('Your profiles', { timeout: 10000 })
  })

  test('new profile form has name input and color pickers', async ({ page }) => {
    await page.goto('/brands/new')
    await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 })
    // Primary color picker is present (hidden input[type="color"])
    await expect(page.locator('input[type="color"][name="primary_color"]').first()).toBeAttached({ timeout: 10000 })
  })
})
