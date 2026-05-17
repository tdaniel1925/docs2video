import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'tdaniel@botmakers.ai')
    await page.fill('input[name="password"]', '4Xkilla1@')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|setup|create|videos|brands|settings|templates|admin)/, { timeout: 15000 })
    const url = page.url()
    expect(url).not.toContain('/login')
  })

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'tdaniel@botmakers.ai')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')
    expect(body?.toLowerCase()).toContain('invalid')
  })

  test('signup page has all required fields', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[name="full_name"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('input[name="phone"]')).toBeVisible()
    await expect(page.locator('input[name="referred_by"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('signup page shows correct heading', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('h1')).toHaveText('Create your account')
  })

  test('login page has forgot password link', async ({ page }) => {
    await page.goto('/login')
    const forgotLink = page.locator('a[href="/forgot-password"]')
    await expect(forgotLink).toBeVisible()
    await expect(forgotLink).toHaveText('Forgot password?')
  })

  test('login page links to signup', async ({ page }) => {
    await page.goto('/login')
    const signupLink = page.locator('.auth-foot a[href="/signup"]')
    await expect(signupLink).toBeVisible()
    await expect(signupLink).toHaveText('Create an account')
  })

  test('signup page links to login', async ({ page }) => {
    await page.goto('/signup')
    const loginLink = page.locator('.auth-foot a[href="/login"]')
    await expect(loginLink).toBeVisible()
    await expect(loginLink).toHaveText('Sign in')
  })

  test('forgot-password page loads with email field', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('signup form enforces required fields via HTML5 validation', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[name="full_name"]')).toHaveAttribute('required', '')
    await expect(page.locator('input[name="email"]')).toHaveAttribute('required', '')
    await expect(page.locator('input[name="password"]')).toHaveAttribute('required', '')
    // password has minLength of 6
    await expect(page.locator('input[name="password"]')).toHaveAttribute('minLength', '6')
  })

  test('login submit button shows loading state', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'tdaniel@botmakers.ai')
    await page.fill('input[name="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    // Button text should change to "Signing in..."
    await expect(page.locator('button[type="submit"]')).toContainText('Signing in')
  })
})
