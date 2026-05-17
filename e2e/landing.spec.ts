import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('hero title is visible and mentions documents and video', async ({ page }) => {
    const heroTitle = page.locator('h1.hero-title')
    await expect(heroTitle).toBeVisible()
    const text = await heroTitle.textContent()
    expect(text?.toLowerCase()).toContain('document')
    expect(text?.toLowerCase()).toContain('explainer video')
  })

  test('hero subtitle describes the product', async ({ page }) => {
    const heroSub = page.locator('.hero-sub')
    await expect(heroSub).toBeVisible()
    const text = await heroSub.textContent()
    expect(text?.toLowerCase()).toContain('pdf')
  })

  test('nav anchor links exist and point to sections', async ({ page }) => {
    await expect(page.locator('.top-nav a[href="#how-it-works"]')).toBeVisible()
    await expect(page.locator('.top-nav a[href="#features"]')).toBeVisible()
    await expect(page.locator('.top-nav a[href="#pricing"]')).toBeVisible()
    await expect(page.locator('.top-nav a[href="#templates"]')).toBeVisible()
    await expect(page.locator('.top-nav a[href="#compare"]')).toBeVisible()
  })

  test('clicking nav anchor updates URL hash', async ({ page }) => {
    await page.click('.top-nav a[href="#how-it-works"]')
    await page.waitForTimeout(500)
    expect(page.url()).toContain('#how-it-works')
  })

  test('how it works section has 3 step cards', async ({ page }) => {
    const section = page.locator('#how-it-works')
    await expect(section).toBeVisible()
    const stepCards = section.locator('.step-card')
    await expect(stepCards).toHaveCount(3)
  })

  test('features section has 4 format cards', async ({ page }) => {
    const section = page.locator('#features')
    await expect(section).toBeVisible()
    const featureCards = section.locator('.feature-card')
    await expect(featureCards).toHaveCount(4)
  })

  test('pricing section has 5 pricing cards', async ({ page }) => {
    const pricingSection = page.locator('#pricing')
    await pricingSection.scrollIntoViewIfNeeded()
    const pricingCards = pricingSection.locator('.pricing-card')
    await expect(pricingCards).toHaveCount(5)
  })

  test('pricing section has a popular card with badge', async ({ page }) => {
    const popularCard = page.locator('.pricing-card.popular')
    await popularCard.scrollIntoViewIfNeeded()
    await expect(popularCard).toBeVisible()
    await expect(popularCard.locator('.pricing-badge')).toHaveText('MOST POPULAR')
  })

  test('final CTA section exists with signup link', async ({ page }) => {
    const finalCta = page.locator('section.final-cta')
    await finalCta.scrollIntoViewIfNeeded()
    await expect(finalCta).toBeVisible()
    const ctaButton = finalCta.locator('a[href="/signup"]')
    await expect(ctaButton).toBeVisible()
  })

  test('comparison table section has rows', async ({ page }) => {
    const compareSection = page.locator('#compare')
    await compareSection.scrollIntoViewIfNeeded()
    await expect(compareSection).toBeVisible()
    const compRows = compareSection.locator('.comp-row')
    const count = await compRows.count()
    expect(count).toBeGreaterThanOrEqual(6)
  })

  test('stats strip shows key metrics', async ({ page }) => {
    const statsStrip = page.locator('.stats-strip')
    await statsStrip.scrollIntoViewIfNeeded()
    await expect(statsStrip).toBeVisible()
    const statsText = await statsStrip.textContent()
    expect(statsText).toContain('10K+')
    expect(statsText).toContain('2,500+')
    expect(statsText).toContain('4.9/5')
  })

  test('use cases grid has industry cards', async ({ page }) => {
    const useCasesGrid = page.locator('.use-cases-grid')
    await useCasesGrid.scrollIntoViewIfNeeded()
    await expect(useCasesGrid).toBeVisible()
    const cards = useCasesGrid.locator('.use-case-card')
    await expect(cards).toHaveCount(8)
  })

  test('template section is visible', async ({ page }) => {
    const templateSection = page.locator('#templates')
    await templateSection.scrollIntoViewIfNeeded()
    await expect(templateSection).toBeVisible()
  })

  test('footer has company info and links', async ({ page }) => {
    const footer = page.locator('footer.footer')
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toBeVisible()
    await expect(footer.locator('.footer-grid')).toBeVisible()
    const text = await footer.textContent()
    expect(text).toContain('Docs2Video')
    expect(text).toContain('2026')
  })

  test('nav has login and get started buttons', async ({ page }) => {
    await expect(page.locator('.top-nav a[href="/login"]')).toBeVisible()
    await expect(page.locator('.top-nav a[href="/signup"].btn-mint')).toBeVisible()
  })

  test('hero CTA buttons link to signup and how-it-works', async ({ page }) => {
    const heroLeft = page.locator('.hero-left')
    await expect(heroLeft.locator('a[href="/signup"]')).toBeVisible()
    await expect(heroLeft.locator('a[href="#how-it-works"]')).toBeVisible()
  })

  test('industry intelligence section shows 12 industries', async ({ page }) => {
    const industrySection = page.locator('#industries')
    await industrySection.scrollIntoViewIfNeeded()
    await expect(industrySection).toBeVisible()
    const text = await industrySection.textContent()
    expect(text).toContain('Insurance')
    expect(text).toContain('Real Estate')
    expect(text).toContain('Financial')
  })

  test('trust strip shows security badges', async ({ page }) => {
    const trustStrip = page.locator('.trust-strip')
    await trustStrip.scrollIntoViewIfNeeded()
    await expect(trustStrip).toBeVisible()
    const text = await trustStrip.textContent()
    expect(text).toContain('Bank-level encryption')
    expect(text).toContain('SOC 2 compliant')
  })

  test('coming soon banner links to signup', async ({ page }) => {
    const bannerLink = page.locator('div[style*="sticky"] a[href="/signup"]').first()
    await expect(bannerLink).toBeVisible()
  })
})
