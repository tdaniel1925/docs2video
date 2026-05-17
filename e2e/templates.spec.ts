import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Template Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('templates page loads', async ({ page }) => {
    await page.goto('/templates')
    await expect(page.locator('h1, h2').filter({ hasText: /template/i }).first()).toBeVisible()
  })

  test('+ Create template opens the wizard', async ({ page }) => {
    await page.goto('/templates')
    const createButton = page.locator('a, button').filter({ hasText: /create template|new template/i }).first()
    await expect(createButton).toBeVisible()
    await createButton.click()
    await expect(page.locator('[data-testid="template-wizard"], [class*="wizard"], [class*="modal"]').first()).toBeVisible()
  })

  test('AI chat interface is visible in describe step', async ({ page }) => {
    await page.goto('/templates/new')
    const chatInterface = page.locator('[data-testid="ai-chat"], [class*="chat"], textarea[placeholder*="describe"]').first()
    await expect(chatInterface).toBeVisible()
  })

  test('reference image upload zone exists', async ({ page }) => {
    await page.goto('/templates/new')
    const uploadZone = page.locator('[data-testid="reference-upload"], input[accept*="image"], [class*="upload"]').first()
    await expect(uploadZone).toBeVisible()
  })
})
