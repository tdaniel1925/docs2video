import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('signup page loads with all fields', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[name="full_name"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="phone"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('input[name="referred_by"]')).toBeVisible()
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
    // Wait for error message — could be styled text, not a role="alert"
    await page.waitForTimeout(3000)
    const pageContent = await page.textContent('body')
    expect(pageContent).toContain('Invalid')
  })

  test('signup form validation shows errors for required fields', async ({ page }) => {
    await page.goto('/signup')
    await page.click('button[type="submit"]')
    // HTML5 validation prevents submission — check required fields exist
    const fullName = page.locator('input[name="full_name"]')
    await expect(fullName).toHaveAttribute('required', '')
    const email = page.locator('input[name="email"]')
    await expect(email).toHaveAttribute('required', '')
    const password = page.locator('input[name="password"]')
    await expect(password).toHaveAttribute('required', '')
  })
})
