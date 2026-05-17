# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow >> signup page loads with all fields
- Location: e2e\auth.spec.ts:4:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/signup
Call log:
  - navigating to "http://localhost:3001/signup", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Authentication Flow', () => {
  4  |   test('signup page loads with all fields', async ({ page }) => {
> 5  |     await page.goto('/signup')
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/signup
  6  |     await expect(page.locator('input[name="name"]')).toBeVisible()
  7  |     await expect(page.locator('input[name="email"]')).toBeVisible()
  8  |     await expect(page.locator('input[name="phone"]')).toBeVisible()
  9  |     await expect(page.locator('input[name="password"]')).toBeVisible()
  10 |     await expect(page.locator('input[name="referralCode"]')).toBeVisible()
  11 |   })
  12 | 
  13 |   test('login page loads with email and password fields', async ({ page }) => {
  14 |     await page.goto('/login')
  15 |     await expect(page.locator('input[name="email"]')).toBeVisible()
  16 |     await expect(page.locator('input[name="password"]')).toBeVisible()
  17 |     await expect(page.locator('button[type="submit"]')).toBeVisible()
  18 |   })
  19 | 
  20 |   test('forgot-password page loads', async ({ page }) => {
  21 |     await page.goto('/forgot-password')
  22 |     await expect(page.locator('input[name="email"]')).toBeVisible()
  23 |     await expect(page.locator('button[type="submit"]')).toBeVisible()
  24 |   })
  25 | 
  26 |   test('login with invalid credentials shows error', async ({ page }) => {
  27 |     await page.goto('/login')
  28 |     await page.fill('input[name="email"]', 'invalid@example.com')
  29 |     await page.fill('input[name="password"]', 'wrongpassword')
  30 |     await page.click('button[type="submit"]')
  31 |     await expect(page.locator('[role="alert"], .error, [data-testid="error-message"]')).toBeVisible({ timeout: 10000 })
  32 |   })
  33 | 
  34 |   test('signup form validation shows errors for required fields', async ({ page }) => {
  35 |     await page.goto('/signup')
  36 |     await page.click('button[type="submit"]')
  37 |     // Check that validation messages appear for required fields
  38 |     const invalidFields = await page.locator(':invalid').count()
  39 |     expect(invalidFields).toBeGreaterThan(0)
  40 |   })
  41 | })
  42 | 
```