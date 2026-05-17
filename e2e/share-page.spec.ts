import { test, expect } from '@playwright/test'

test.describe('Public Share Page', () => {
  // Use a known or mock video ID for testing
  const shareUrl = '/share/test-video-id'

  test.skip('share page loads for a valid video ID', async ({ page }) => {
    await page.goto(shareUrl)
    await expect(page.locator('body')).not.toContainText('404')
  })

  test.skip('video player is present', async ({ page }) => {
    await page.goto(shareUrl)
    const videoPlayer = page.locator('video, [data-testid="video-player"], [class*="player"]').first()
    await expect(videoPlayer).toBeVisible()
  })

  test.skip('agent branding is visible (name, company)', async ({ page }) => {
    await page.goto(shareUrl)
    const branding = page.locator('[data-testid="agent-branding"], [class*="branding"], [class*="agent-info"]').first()
    await expect(branding).toBeVisible()
  })

  test.skip('Book a Meeting section exists', async ({ page }) => {
    await page.goto(shareUrl)
    const bookingSection = page.locator('text=/book.*meeting|schedule|calendar/i').first()
    await expect(bookingSection).toBeVisible()
  })

  test.skip('Ask AI chat widget is present', async ({ page }) => {
    await page.goto(shareUrl)
    const chatWidget = page.locator('[data-testid="ask-ai"], [class*="chat-widget"], button:has-text("Ask")').first()
    await expect(chatWidget).toBeVisible()
  })

  test.skip('download buttons exist', async ({ page }) => {
    await page.goto(shareUrl)
    const downloadButtons = page.locator('button:has-text("download"), a[download], [data-testid="download"]')
    const count = await downloadButtons.count()
    expect(count).toBeGreaterThan(0)
  })
})
