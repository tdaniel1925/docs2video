import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

const EXPENSIVE = process.env.RUN_EXPENSIVE_TESTS === 'true'

test.describe('Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  // --- TEXT EXTRACTION ---
  test('extract data from typed text', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/create')
    await page.waitForLoadState('networkidle')

    // Click the "Type or Paste" tab
    const textTab = page.getByRole('button', { name: 'Type or Paste' })
    await textTab.click()
    await page.waitForTimeout(500)

    // Type some content into the textarea
    const textarea = page.locator('textarea.input').first()
    await textarea.fill('Company Revenue Report Q4 2025. Total Revenue: $2.5 million. Net Profit: $450,000. Year-over-year growth: 18%. Key highlights: Expanded into 3 new markets. Launched 2 new products. Customer retention rate: 94%.')

    // Click "Extract & Continue" button
    const extractBtn = page.getByRole('button', { name: /Extract & Continue/i })
    await extractBtn.click()

    // Wait for extraction to complete (may take 10-30s)
    await page.waitForTimeout(20000)

    // Verify we moved past extracting step — look for extracted data displayed
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    // Should show extracted metrics like revenue, profit, etc.
    const hasData = body?.includes('Revenue') || body?.includes('revenue') || body?.includes('2.5') || body?.includes('Profit') || body?.includes('profit')
    expect(hasData).toBeTruthy()
  })

  // --- BRAND SCRAPING ---
  test('scrape brand from website URL', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/brands/new')
    await page.waitForLoadState('networkidle')

    // Find the website URL input with placeholder "www.youragency.com"
    const urlInput = page.locator('input[placeholder="www.youragency.com"]')
    await urlInput.fill('botmakers.ai')

    // Click "Analyze brand" button
    const scrapeBtn = page.getByRole('button', { name: /Analyze brand/i })
    await scrapeBtn.click()

    // Wait for scraping (10-30s)
    await page.waitForTimeout(25000)

    // Verify brand name was populated after scrape
    const nameInput = page.locator('input[name="name"]')
    await expect(nameInput).toBeVisible({ timeout: 10000 })
    const nameValue = await nameInput.inputValue()
    expect(nameValue.length).toBeGreaterThan(0)
  })

  // --- IDEA GENERATION ---
  test('generate content from idea', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/create')
    await page.waitForLoadState('networkidle')

    // Click "Start from Idea" tab
    const ideaTab = page.getByRole('button', { name: 'Start from Idea' })
    await ideaTab.click()
    await page.waitForTimeout(500)

    // Fill in topic — placeholder: "e.g. Q3 Sales Performance, Benefits of Solar Energy, Company Culture..."
    const topicInput = page.locator('input[placeholder*="Q3 Sales Performance"]')
    await topicInput.fill('Benefits of Remote Work for Small Businesses')

    // Fill audience — placeholder: "e.g. Executive team, Prospective clients, New employees..."
    const audienceInput = page.locator('input[placeholder*="Executive team"]')
    await audienceInput.fill('Small business owners')

    // Click "Generate Content" button
    const generateBtn = page.getByRole('button', { name: /Generate Content/i })
    await generateBtn.click()

    // Wait for generation
    await page.waitForTimeout(20000)

    // Verify we got data back
    const body = await page.textContent('body')
    const hasContent = body?.includes('Remote') || body?.includes('remote') || body?.includes('Business') || body?.includes('business')
    expect(hasContent).toBeTruthy()
  })

  // --- EXPENSIVE: VIDEO GENERATION (only with flag) ---
  test('full video generation pipeline', async ({ page }) => {
    test.skip(!EXPENSIVE, 'Skipped: set RUN_EXPENSIVE_TESTS=true to run')
    test.setTimeout(300000) // 5 min timeout

    await page.goto('/create')
    await page.waitForLoadState('networkidle')

    // Use text tab for speed
    const textTab = page.getByRole('button', { name: 'Type or Paste' })
    await textTab.click()
    await page.waitForTimeout(500)

    const textarea = page.locator('textarea.input').first()
    await textarea.fill('Q4 Business Report. Revenue: $1.2M. Growth: 15%. Key achievement: Launched mobile app. Next quarter goal: Expand to Europe.')

    // Extract
    const extractBtn = page.getByRole('button', { name: /Extract & Continue/i })
    await extractBtn.click()
    await page.waitForTimeout(25000)

    // Continue through wizard steps until generation starts
    // Click continue/next buttons as they appear
    for (let i = 0; i < 5; i++) {
      const nextBtn = page.getByRole('button', { name: /continue|next|generate|create/i }).first()
      if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(5000)
      }
    }

    // Wait for video generation (up to 4 minutes)
    await page.waitForTimeout(240000)

    // Verify video completed - check for video player or completed status
    const body = await page.textContent('body')
    const isComplete = body?.includes('completed') || body?.includes('Download') || body?.includes('Share') || body?.includes('download')
    expect(isComplete).toBeTruthy()
  })

  // --- TEMPLATE AI CHAT ---
  test('AI template chat responds to messages', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/templates')
    await page.waitForLoadState('networkidle')

    // Click create template (the "Create Your Own" link or a create button)
    const createLink = page.locator('a[href="/templates"]').filter({ hasText: /create/i }).first()
    const createBtn = page.getByRole('button', { name: /create/i }).first()

    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click()
    } else if (await createLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createLink.click()
    } else {
      // Navigate directly to template creation if available
      await page.goto('/templates/new')
    }
    await page.waitForTimeout(2000)

    // Find chat input or textarea in describe step
    const chatInput = page.locator('input[placeholder*="describe"], input[placeholder*="message"], textarea[placeholder*="describe"]').first()
    if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.fill('I want a dark blue professional style with gold accents')

      // Send message (press Enter or click send)
      await chatInput.press('Enter')
      await page.waitForTimeout(15000)

      // Verify AI responded
      const body = await page.textContent('body')
      // AI response should contain color-related words or confirmation
      const hasResponse = body?.includes('blue') || body?.includes('gold') || body?.includes('#') || body?.includes('style') || body?.includes('template')
      expect(hasResponse).toBeTruthy()
    }
  })
})
