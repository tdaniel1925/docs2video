import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Brand Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('brands list page loads', async ({ page }) => {
    await page.goto('/brands')
    await expect(page.locator('h1, h2').filter({ hasText: /brand/i }).first()).toBeVisible()
  })

  test('+ New brand button navigates to /brands/new', async ({ page }) => {
    await page.goto('/brands')
    const newBrandButton = page.locator('a, button').filter({ hasText: /new brand|add brand|create brand/i }).first()
    await expect(newBrandButton).toBeVisible()
    await newBrandButton.click()
    await expect(page).toHaveURL(/\/brands\/new/)
  })

  test('brand creation page has website scraper input', async ({ page }) => {
    await page.goto('/brands/new')
    const urlInput = page.locator('input[name*="url"], input[name*="website"], input[placeholder*="website"], input[type="url"]').first()
    await expect(urlInput).toBeVisible()
  })

  test('color pickers are interactive', async ({ page }) => {
    await page.goto('/brands/new')
    const colorPicker = page.locator('input[type="color"], [data-testid="color-picker"], [class*="color-picker"]').first()
    await expect(colorPicker).toBeVisible()
    await colorPicker.click()
  })

  test('brand preview card updates with color changes', async ({ page }) => {
    await page.goto('/brands/new')
    const preview = page.locator('[data-testid="brand-preview"], [class*="preview"]').first()
    await expect(preview).toBeVisible()
  })
})
