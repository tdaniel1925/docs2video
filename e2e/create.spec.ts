import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Create Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/create')
  })

  test.skip('create page loads with 3 input tabs', async ({ page }) => {
    const tabs = page.locator('[role="tab"], button[data-tab], [class*="tab"]')
    await expect(tabs.filter({ hasText: /upload|pdf/i }).first()).toBeVisible()
    await expect(tabs.filter({ hasText: /type|paste/i }).first()).toBeVisible()
    await expect(tabs.filter({ hasText: /idea|topic/i }).first()).toBeVisible()
  })

  test.skip('switching between tabs works', async ({ page }) => {
    const tabs = page.locator('[role="tab"], button[data-tab], [class*="tab"]')
    const secondTab = tabs.nth(1)
    await secondTab.click()
    await expect(secondTab).toHaveAttribute('aria-selected', 'true')
  })

  test.skip('Type or Paste tab shows textarea', async ({ page }) => {
    const pasteTab = page.locator('[role="tab"], button[data-tab], [class*="tab"]').filter({ hasText: /type|paste/i }).first()
    await pasteTab.click()
    await expect(page.locator('textarea')).toBeVisible()
  })

  test.skip('Start from Idea tab shows topic/audience/tone fields', async ({ page }) => {
    const ideaTab = page.locator('[role="tab"], button[data-tab], [class*="tab"]').filter({ hasText: /idea|topic/i }).first()
    await ideaTab.click()
    await expect(page.locator('input[name*="topic"], input[placeholder*="topic"], [data-testid="topic-input"]').first()).toBeVisible()
    await expect(page.locator('input[name*="audience"], [data-testid="audience-input"], select[name*="audience"]').first()).toBeVisible()
    await expect(page.locator('input[name*="tone"], [data-testid="tone-input"], select[name*="tone"]').first()).toBeVisible()
  })

  test.skip('file upload zone accepts drag events', async ({ page }) => {
    const uploadZone = page.locator('[data-testid="upload-zone"], [class*="dropzone"], [class*="upload"], input[type="file"]').first()
    await expect(uploadZone).toBeVisible()
  })

  test.skip('brand selection step loads brands', async ({ page }) => {
    // Navigate to brand selection step (assumes multi-step wizard)
    const brandStep = page.locator('[data-testid="brand-select"], [class*="brand"]').first()
    await expect(brandStep).toBeVisible()
  })

  test.skip('style picker shows template grid', async ({ page }) => {
    const styleGrid = page.locator('[data-testid="style-picker"], [class*="template-grid"], [class*="style"]').first()
    await expect(styleGrid).toBeVisible()
  })

  test.skip('voice selection shows 6 voices with preview buttons', async ({ page }) => {
    const voiceCards = page.locator('[data-testid="voice-card"], [class*="voice"]')
    await expect(voiceCards).toHaveCount(6)
    const previewButtons = page.locator('button:has-text("preview"), button:has-text("play"), button[aria-label*="preview"]')
    const count = await previewButtons.count()
    expect(count).toBeGreaterThanOrEqual(6)
  })
})
