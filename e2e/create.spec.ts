import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Create Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/create')
    await page.waitForLoadState('networkidle')
  })

  test('wizard card is visible with heading', async ({ page }) => {
    const wizardCard = page.locator('.wizard-card').first()
    await expect(wizardCard).toBeVisible()
    const heading = wizardCard.locator('h2')
    await expect(heading).toHaveText('What would you like to explain?')
  })

  test('upload zone is visible by default', async ({ page }) => {
    const uploadZone = page.locator('.upload-zone')
    await expect(uploadZone).toBeVisible()
  })

  test('tab pills are visible for input methods', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Upload PDF' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Type or Paste' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start from Idea' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'From URL' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'AI Research' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Narrate Slides' })).toBeVisible()
  })

  test('switching to text tab shows textarea', async ({ page }) => {
    await page.getByRole('button', { name: 'Type or Paste' }).click()
    const textarea = page.locator('textarea.input')
    await expect(textarea).toBeVisible()
    const placeholder = await textarea.getAttribute('placeholder')
    expect(placeholder?.toLowerCase()).toContain('paste')
  })

  test('typing text in text tab enables extract button', async ({ page }) => {
    await page.getByRole('button', { name: 'Type or Paste' }).click()
    const textarea = page.locator('textarea.input')
    await textarea.fill('This is a test document about quarterly earnings report for Q3 2025.')

    const extractBtn = page.locator('button.btn-primary', { hasText: /extract/i })
    await expect(extractBtn).toBeEnabled()
  })

  test('extract button is disabled when textarea is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Type or Paste' }).click()
    const extractBtn = page.locator('button.btn-primary', { hasText: /extract/i })
    await expect(extractBtn).toBeDisabled()
  })

  test('character count displays in text tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Type or Paste' }).click()
    const textarea = page.locator('textarea.input')
    await textarea.fill('Hello world test content')
    const charCount = page.locator('text=/\\d+ \\/ 50,000 characters/')
    await expect(charCount).toBeVisible()
  })

  test('switching to idea tab shows idea form', async ({ page }) => {
    await page.getByRole('button', { name: 'Start from Idea' }).click()
    // Idea tab renders textarea/input fields for topic
    const inputs = page.locator('textarea.input, input.input')
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('switching to URL tab shows URL input', async ({ page }) => {
    await page.getByRole('button', { name: 'From URL' }).click()
    const urlInput = page.locator('input.input[type="url"], input.input[placeholder*="http"]')
    await expect(urlInput.first()).toBeVisible()
  })

  test('switching back to upload tab restores upload zone', async ({ page }) => {
    await page.getByRole('button', { name: 'Type or Paste' }).click()
    await expect(page.locator('textarea.input')).toBeVisible()
    await page.getByRole('button', { name: 'Upload PDF' }).click()
    await expect(page.locator('.upload-zone')).toBeVisible()
  })
})
