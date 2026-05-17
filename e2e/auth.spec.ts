import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('signup page loads with all fields', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="phone"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('input[name="referralCode"]')).toBeVisible()
  })

  test('login page loads with email and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('forgot-password page loads', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    await expect(page.locator('[role="alert"], .error, [data-testid="error-message"]')).toBeVisible({ timeout: 10000 })
  })

  test('signup form validation shows errors for required fields', async ({ page }) => {
    await page.goto('/signup')
    await page.click('button[type="submit"]')
    // Check that validation messages appear for required fields
    const invalidFields = await page.locator(':invalid').count()
    expect(invalidFields).toBeGreaterThan(0)
  })
})
