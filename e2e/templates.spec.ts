import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Template Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/templates')
  })

  test('templates gallery page loads with heading', async ({ page }) => {
    await expect(page.locator('.page-head h1')).toHaveText('Your templates', { timeout: 10000 })
  })

  test('clicking create template shows describe step with textarea', async ({ page }) => {
    // Click the "+ Create template" button in the page-head
    await page.click('button.btn.btn-primary:has-text("+ Create template")', { timeout: 10000 })
    // Verify the wizard card with describe step appears
    await expect(page.locator('.wizard-card h2')).toContainText('template', { timeout: 10000 })
    // Switch to "Describe It" tab to reveal the textarea
    await page.click('button:has-text("Describe It")')
    await expect(page.locator('textarea.input')).toBeVisible({ timeout: 10000 })
  })
})
