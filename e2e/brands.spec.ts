import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Brand Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('brands page loads with heading', async ({ page }) => {
    await page.goto('/brands')
    await expect(page.locator('.page-head h1')).toHaveText('Your brands', { timeout: 10000 })
  })

  test('new brand form has name input and color pickers', async ({ page }) => {
    await page.goto('/brands/new')
    await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 })
    // Primary color picker is present (hidden input[type="color"])
    await expect(page.locator('input[type="color"][name="primary_color"]')).toBeAttached({ timeout: 10000 })
  })

  test('create brand with name and redirect to /brands', async ({ page }) => {
    await page.goto('/brands/new')
    await page.fill('input[name="name"]', 'E2E Test Brand')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/brands/, { timeout: 10000 })
  })
})
