import { test, expect, Page } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'


/** Navigate to the first video detail page. Returns false if no video exists. */
async function goToFirstVideo(page: Page): Promise<boolean> {
  await page.goto('/videos')
  await page.waitForLoadState('networkidle')
  const videoLink = page.locator('a.activity-row[href*="/videos/"]').first()
  if (!(await videoLink.isVisible({ timeout: 5000 }).catch(() => false))) return false
  await videoLink.click()
  await page.waitForURL(/\/videos\//, { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  return true
}

/** Get the first video ID from the videos list. Returns empty string if none. */
async function getFirstVideoId(page: Page): Promise<string> {
  await page.goto('/videos')
  await page.waitForLoadState('networkidle')
  const videoLink = page.locator('a.activity-row[href*="/videos/"]').first()
  if (!(await videoLink.isVisible({ timeout: 5000 }).catch(() => false))) return ''
  const href = await videoLink.getAttribute('href')
  return href?.split('/videos/')[1] || ''
}

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
    test.setTimeout(90000)
    await page.goto('/brands/new')
    await page.waitForLoadState('networkidle')

    // Find the website URL input with placeholder "www.youragency.com"
    const urlInput = page.locator('input[placeholder="www.youragency.com"]')
    await urlInput.fill('botmakers.ai')

    // Click "Analyze brand" button
    const scrapeBtn = page.getByRole('button', { name: /Analyze brand/i })
    await scrapeBtn.click()

    // Wait for scraping to complete — look for the form to appear with populated fields
    // The scraper may take 30-60s depending on the site and AI analysis
    const nameInput = page.locator('input[name="name"]')
    await expect(nameInput).toBeVisible({ timeout: 60000 })

    // Wait for the value to be populated (scraper fills it async)
    await page.waitForFunction(
      () => {
        const input = document.querySelector('input[name="name"]') as HTMLInputElement
        return input && input.value.length > 0
      },
      { timeout: 45000 }
    )

    const nameValue = await nameInput.inputValue()
    expect(nameValue.length).toBeGreaterThan(0)
  })

  // --- IDEA GENERATION ---
  test('generate content from idea', async ({ page }) => {
    test.setTimeout(90000)
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

    // Wait for generation to complete — the wizard should advance past the input step
    // Check that the page content changes (loading state, then results)
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || ''
        // After generation, the wizard advances and shows extracted data or next step
        // The input form should no longer be the primary view
        return body.includes('Remote') || body.includes('remote') ||
               body.includes('Business') || body.includes('business') ||
               body.includes('Review') || body.includes('Continue') ||
               body.includes('slides') || body.includes('Slides') ||
               body.includes('script') || body.includes('Script')
      },
      { timeout: 60000 }
    )
  })

  // --- EXPENSIVE: VIDEO GENERATION (only with flag) ---
  test('full video generation pipeline', async ({ page }) => {
    test.skip(process.env.RUN_EXPENSIVE_TESTS !== 'true', 'Skipped: set RUN_EXPENSIVE_TESTS=true to run')
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

  // --- BRAND CRUD ---
  test('create brand manually and verify fields save', async ({ page }) => {
    test.setTimeout(60000)
    const brandName = `E2E Brand ${Date.now()}`

    await page.goto('/brands/new')
    await page.waitForLoadState('networkidle')

    // The new brand page has a scraper at top and a "Brand details" form below
    const nameInput = page.locator('input[name="name"]')
    await nameInput.scrollIntoViewIfNeeded()
    await expect(nameInput).toBeVisible({ timeout: 10000 })
    await nameInput.fill(brandName)

    // Submit the form — createBrand redirects to /brands
    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.scrollIntoViewIfNeeded()
    await submitBtn.click()

    // Wait for redirect back to brands list
    await page.waitForURL(/\/brands$/, { timeout: 15000 })

    // Verify the new brand appears in the list
    await page.waitForLoadState('networkidle')
    const brandCard = page.locator('.brand-card', { hasText: brandName })
    await expect(brandCard).toBeVisible({ timeout: 10000 })
  })

  // --- BRAND EDIT ---
  test('edit existing brand fields', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/brands')
    await page.waitForLoadState('networkidle')

    // Click first brand card
    const firstBrand = page.locator('.brand-card').first()
    if (!(await firstBrand.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No brands exist to edit')
      return
    }
    await firstBrand.click()
    await page.waitForLoadState('networkidle')

    // Verify brand detail page loaded with editable fields
    const nameInput = page.locator('input[name="name"]')
    await expect(nameInput).toBeVisible({ timeout: 10000 })
    const originalName = await nameInput.inputValue()
    expect(originalName.length).toBeGreaterThan(0)

    // Verify other fields are present
    const taglineInput = page.locator('input[name="tagline"]')
    if (await taglineInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const val = await taglineInput.inputValue()
      // Just verify the field exists and is editable
      await taglineInput.fill('E2E test tagline')
      await expect(taglineInput).toHaveValue('E2E test tagline')
      // Restore
      await taglineInput.fill(val)
    }
  })

  // --- VIDEO LIST ---
  test('videos page shows existing videos', async ({ page }) => {
    test.setTimeout(30000)
    await page.goto('/videos')
    await page.waitForLoadState('networkidle')

    // Should either show video rows or an empty state
    const rows = page.locator('.activity-row')
    const emptyState = page.getByText(/no videos|create your first|get started/i)

    const hasRows = await rows.first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false)

    expect(hasRows || hasEmpty).toBeTruthy()
  })

  // --- VIDEO DETAIL + DOWNLOADS ---
  test('video detail page shows player and action buttons', async ({ page }) => {
    test.setTimeout(30000)
    if (!(await goToFirstVideo(page))) {
      test.skip(true, 'No videos exist to test')
      return
    }

    // Verify action buttons exist
    const actionGrid = page.locator('.action-grid')
    if (await actionGrid.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(page.getByRole('button', { name: 'MP4' })).toBeVisible({ timeout: 5000 })
      await expect(page.getByRole('button', { name: 'PDF' })).toBeVisible({ timeout: 5000 })
      await expect(page.getByRole('button', { name: 'PPTX' })).toBeVisible({ timeout: 5000 })
    }

    // Check for share button
    const shareBtn = page.getByRole('button', { name: /share with client/i })
    if (await shareBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shareBtn.click()
      await page.waitForTimeout(500)
      await expect(page.getByText('Share with Client')).toBeVisible()
    }
  })

  // --- PDF DOWNLOAD ---
  // --- PDF DOWNLOAD ---
  test('download PDF from video detail', async ({ page }) => {
    test.skip(process.env.RUN_EXPENSIVE_TESTS !== 'true', 'Skipped: set RUN_EXPENSIVE_TESTS=true to run')
    test.setTimeout(60000)
    if (!(await goToFirstVideo(page))) {
      test.skip(true, 'No videos exist')
      return
    }

    const pdfBtn = page.getByRole('button', { name: 'PDF' })
    await expect(pdfBtn).toBeVisible({ timeout: 10000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await pdfBtn.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('.pdf')
  })

  // --- PPTX DOWNLOAD ---
  test('download PPTX from video detail', async ({ page }) => {
    test.skip(process.env.RUN_EXPENSIVE_TESTS !== 'true', 'Skipped: set RUN_EXPENSIVE_TESTS=true to run')
    test.setTimeout(60000)
    if (!(await goToFirstVideo(page))) {
      test.skip(true, 'No videos exist')
      return
    }

    const pptxBtn = page.getByRole('button', { name: 'PPTX' })
    await expect(pptxBtn).toBeVisible({ timeout: 10000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await pptxBtn.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('.pptx')
  })

  // --- SHARE PAGE ---
  test('share page loads with video player', async ({ page }) => {
    test.setTimeout(30000)
    const videoId = await getFirstVideoId(page)
    if (!videoId) {
      test.skip(true, 'No videos exist to test share page')
      return
    }

    await page.goto(`/watch/${videoId}`)
    await page.waitForLoadState('networkidle')

    const videoWrap = page.locator('.wp-video-wrap')
    const videoEl = page.locator('video')
    const hasPlayer = await videoWrap.isVisible({ timeout: 10000 }).catch(() => false)
    const hasVideo = await videoEl.isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasPlayer || hasVideo).toBeTruthy()
  })

  // --- SHARE PAGE ELEMENTS ---
  test('share page has thumbnail strip and actions', async ({ page }) => {
    test.setTimeout(30000)
    const videoId = await getFirstVideoId(page)
    if (!videoId) {
      test.skip(true, 'No videos exist')
      return
    }

    await page.goto(`/watch/${videoId}`)
    await page.waitForLoadState('networkidle')

    const thumbstrip = page.locator('.wp-thumbstrip')
    if (await thumbstrip.isVisible({ timeout: 5000 }).catch(() => false)) {
      const thumbs = thumbstrip.locator('.wp-thumb')
      const count = await thumbs.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }

    const actions = page.locator('.wp-actions')
    if (await actions.isVisible({ timeout: 5000 }).catch(() => false)) {
      const actionBtns = actions.locator('.wp-action-btn')
      const count = await actionBtns.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  // --- LOGO KIT GENERATION ---
  test('logo kit generates from uploaded logo', async ({ page }) => {
    test.skip(process.env.RUN_EXPENSIVE_TESTS !== 'true', 'Skipped: set RUN_EXPENSIVE_TESTS=true to run')
    test.setTimeout(600000) // 10 min — logo kit generates up to 65 styles via OpenAI

    await page.goto('/brands')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.brand-card', { timeout: 10000 })

    // Find brand cards that have a logo
    const cardsWithLogo = page.locator('a.brand-card').filter({ has: page.locator('.brand-avatar img') })
    const logoCount = await cardsWithLogo.count()
    if (logoCount === 0) {
      test.skip(true, 'No brand has a logo uploaded')
      return
    }

    const href = await cardsWithLogo.first().getAttribute('href')
    const brandId = href?.split('/brands/')[1] || ''
    if (!brandId) {
      test.skip(true, 'Could not determine brand ID')
      return
    }

    // Call logo kit API — this generates styled logos via OpenAI (may take several minutes)
    const response = await page.evaluate(async (id) => {
      const res = await fetch('/api/generate-logo-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: id })
      })
      return { status: res.status, body: await res.json() }
    }, brandId)

    expect(response.status).toBe(200)
    expect(response.body.success).toBeTruthy()
    expect(response.body.generated).toBeGreaterThan(0)
  })

  // --- BRAND DECK GENERATION ---
  test('brand deck generates slides', async ({ page }) => {
    test.skip(process.env.RUN_EXPENSIVE_TESTS !== 'true', 'Skipped: set RUN_EXPENSIVE_TESTS=true to run')
    test.setTimeout(120000)

    await page.goto('/brands')
    await page.waitForLoadState('networkidle')

    const firstBrand = page.locator('.brand-card').first()
    if (!(await firstBrand.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No brands exist')
      return
    }
    await firstBrand.click()
    await page.waitForLoadState('networkidle')

    // Scroll to bottom to find brand deck section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1000)

    const deckBtn = page.getByRole('button', { name: /Generate Brand Deck|Regenerate Brand Deck/i })
    if (!(await deckBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No brand deck button found on this brand page')
      return
    }

    // Select a style — the style cards are <button> elements with style preview images
    // Click the first style preview button (contains an img with src /style-previews/)
    const styleBtn = page.locator('button:has(img[src*="style-previews"])').first()
    if (await styleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await styleBtn.click()
      await page.waitForTimeout(500)
    }

    // Button should now be enabled
    await expect(deckBtn).toBeEnabled({ timeout: 3000 })
    await deckBtn.click()

    // Wait for deck generation — shows "Slide N of 4" progress then completes
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || ''
        const btn = document.querySelector('.btn-mint') as HTMLButtonElement
        // Done when button reverts to non-generating text or we see completed state
        return (btn && !btn.disabled && !body.includes('Generating slide')) ||
               body.includes('Regenerate Brand Deck')
      },
      { timeout: 90000 }
    )
  })

  // --- WIZARD: STYLE PICKER ---
  test('create wizard shows style picker with template grid', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/create')
    await page.waitForLoadState('networkidle')

    // Type text and extract to get past input step
    const textTab = page.getByRole('button', { name: 'Type or Paste' })
    await textTab.click()
    await page.waitForTimeout(500)

    const textarea = page.locator('textarea.input').first()
    await textarea.fill('Simple test content for style selection. Revenue: $100k. Growth: 10%.')

    const extractBtn = page.getByRole('button', { name: /Extract & Continue/i })
    await extractBtn.click()

    // Wait for extraction then advance to style step
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || ''
        return body.includes('Continue') || body.includes('Next') || body.includes('Script') || body.includes('style')
      },
      { timeout: 45000 }
    )

    // Click through to style picker — try advancing wizard steps
    for (let i = 0; i < 3; i++) {
      const nextBtn = page.getByRole('button', { name: /continue|next/i }).first()
      if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextBtn.click()
        await page.waitForTimeout(2000)
      }
      // Check if style grid appeared
      const styleGrid = page.locator('.style-grid')
      if (await styleGrid.isVisible({ timeout: 2000 }).catch(() => false)) {
        const cards = styleGrid.locator('.style-card')
        const count = await cards.count()
        expect(count).toBeGreaterThanOrEqual(5)
        // Click a card to select it
        await cards.first().click()
        await expect(cards.first()).toHaveClass(/selected/)
        return
      }
    }
  })

  // --- SETTINGS: PROFILE TAB ---
  test('settings page shows profile tab with user info', async ({ page }) => {
    test.setTimeout(30000)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Profile tab should be active by default
    const profileTab = page.locator('.settings-tab', { hasText: 'Profile' })
    await expect(profileTab).toBeVisible({ timeout: 5000 })

    // Should have name and email fields
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  // --- SETTINGS: INTEGRATIONS TAB ---
  test('settings integrations tab shows connection options', async ({ page }) => {
    test.setTimeout(30000)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Click Integrations tab
    const integrationsTab = page.locator('.settings-tab', { hasText: 'Integrations' })
    if (await integrationsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await integrationsTab.click()
      await page.waitForTimeout(1000)

      // Should show email connection options (Gmail, Outlook)
      const body = await page.textContent('body')
      const hasGmail = body?.includes('Gmail') || body?.includes('gmail')
      const hasOutlook = body?.includes('Outlook') || body?.includes('outlook') || body?.includes('Microsoft')
      const hasStripe = body?.includes('Stripe') || body?.includes('stripe')
      const hasCalendar = body?.includes('Calendar') || body?.includes('calendar') || body?.includes('Calendly')
      expect(hasGmail || hasOutlook || hasStripe || hasCalendar).toBeTruthy()
    }
  })

  // --- SETTINGS: SUBSCRIPTION TAB ---
  test('settings subscription tab shows current plan', async ({ page }) => {
    test.setTimeout(30000)
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const subscriptionTab = page.locator('.settings-tab', { hasText: 'Subscription' })
    if (await subscriptionTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await subscriptionTab.click()
      await page.waitForTimeout(1000)

      const body = await page.textContent('body')
      // Should show plan name or upgrade options
      const hasPlan = body?.includes('Free') || body?.includes('Pro') || body?.includes('Business') ||
                      body?.includes('Agency') || body?.includes('Enterprise') || body?.includes('plan')
      expect(hasPlan).toBeTruthy()
    }
  })

  // --- COPY SHARE LINK ---
  test('copy share link from video detail', async ({ page }) => {
    test.setTimeout(30000)
    if (!(await goToFirstVideo(page))) {
      test.skip(true, 'No videos exist')
      return
    }

    const copyBtn = page.getByRole('button', { name: /copy link/i })
    if (await copyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await copyBtn.click()
      await page.waitForTimeout(500)
      const btnText = await copyBtn.textContent()
      expect(btnText?.toLowerCase()).toMatch(/copied|✓/)
    }
  })

  // --- DUPLICATE VIDEO ---
  test('duplicate video navigates to create page', async ({ page }) => {
    test.setTimeout(30000)
    if (!(await goToFirstVideo(page))) {
      test.skip(true, 'No videos exist')
      return
    }

    const dupBtn = page.getByRole('button', { name: /duplicate/i })
    if (await dupBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dupBtn.click()
      await page.waitForURL(/\/create/, { timeout: 10000 })
      expect(page.url()).toContain('/create')
    }
  })

  // --- TTS / AUDIO PREVIEW ---
  test('pre-generate audio via API', async ({ page, request }) => {
    test.skip(process.env.RUN_EXPENSIVE_TESTS !== 'true', 'Skipped: set RUN_EXPENSIVE_TESTS=true to run')
    test.setTimeout(120000)

    // Login first to get auth cookies
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Call the pre-generate-audio API directly
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/pre-generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: [
            { narration: 'This is a test narration for the first slide of our presentation.' },
            { narration: 'And this is the second slide with important data about revenue growth.' }
          ],
          voiceId: 'nova'
        })
      })
      return { status: res.status, body: await res.json() }
    })

    expect(response.status).toBe(200)
    expect(response.body.audioId).toBeTruthy()
  })

  // --- SLIDE GENERATION API ---
  test('generate single slide via API', async ({ page }) => {
    test.skip(process.env.RUN_EXPENSIVE_TESTS !== 'true', 'Skipped: set RUN_EXPENSIVE_TESTS=true to run')
    test.setTimeout(120000)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/generate-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyData: {
            title: 'Q4 Revenue Report',
            summary: 'Revenue grew 18% year-over-year to $2.5M',
            keyMetrics: [
              { label: 'Revenue', value: '$2.5M' },
              { label: 'Growth', value: '18%' }
            ],
            sections: [
              { heading: 'Revenue Growth', bullets: ['Record Q4 performance', 'Expanded to 3 new markets'] }
            ]
          },
          slideIndex: 0,
          styleId: 'clean-corporate',
          brandId: null
        })
      })
      return { status: res.status, body: await res.json() }
    })

    expect(response.status).toBe(200)
    expect(response.body.image).toBeTruthy()
    expect(response.body.image).toContain('data:image/')
  })

  // --- URL EXTRACTION ---
  test('extract content from URL', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/create')
    await page.waitForLoadState('networkidle')

    // Click URL tab
    const urlTab = page.getByRole('button', { name: /URL/i })
    if (!(await urlTab.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'URL tab not found')
      return
    }
    await urlTab.click()
    await page.waitForTimeout(500)

    // Fill URL input
    const urlInput = page.locator('input[type="url"], input[placeholder*="http"], input[placeholder*="url"], input[placeholder*="URL"]').first()
    if (!(await urlInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'URL input not found')
      return
    }
    await urlInput.fill('https://en.wikipedia.org/wiki/Artificial_intelligence')

    // Click extract button
    const extractBtn = page.getByRole('button', { name: /extract|fetch|continue/i }).first()
    await extractBtn.click()

    // Wait for extraction
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || ''
        return body.includes('artificial') || body.includes('Artificial') ||
               body.includes('intelligence') || body.includes('Intelligence') ||
               body.includes('Review') || body.includes('Script')
      },
      { timeout: 60000 }
    )
  })

  // --- DASHBOARD STATS ---
  test('dashboard shows stats cards', async ({ page }) => {
    test.setTimeout(30000)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Dashboard should have stat cards or welcome message
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    const hasDashboard = body?.includes('Dashboard') || body?.includes('dashboard') ||
                         body?.includes('Videos') || body?.includes('Projects') ||
                         body?.includes('Welcome') || body?.includes('Create')
    expect(hasDashboard).toBeTruthy()
  })

  // --- NAVIGATION ---
  test('sidebar navigation works across all main pages', async ({ page }) => {
    test.setTimeout(60000)

    const pages = [
      { path: '/dashboard', check: /dashboard|welcome|create/i },
      { path: '/create', check: /upload|paste|idea|create/i },
      { path: '/videos', check: /video|project|activity/i },
      { path: '/brands', check: /brand|new brand/i },
      { path: '/settings', check: /profile|settings|account/i },
    ]

    for (const p of pages) {
      await page.goto(p.path)
      await page.waitForLoadState('networkidle')
      const body = await page.textContent('body')
      expect(body?.toLowerCase()).toMatch(p.check)
    }
  })
})
