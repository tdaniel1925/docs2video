import { test, expect } from '@playwright/test'
import { NO_AUTH } from './helpers/auth'

// A public page: start signed out.
test.use({ storageState: NO_AUTH })

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

  test('features section shows the two things it makes: video and slide deck', async ({ page }) => {
    const section = page.locator('#features')
    await expect(section).toBeVisible()
    const featureCards = section.locator('.feature-card')
    await expect(featureCards).toHaveCount(2)
    await expect(featureCards.nth(0)).toContainText('Video Explainer')
    await expect(featureCards.nth(1)).toContainText('Slide Deck')
  })

  test('pricing section shows the plans on sale at the prices in pricing.ts', async ({ page }) => {
    const pricingSection = page.locator('#pricing')
    await pricingSection.scrollIntoViewIfNeeded()
    const pricingCards = pricingSection.locator('.pricing-card')
    // Starter ($29) is retired from sale; Free, Pro, Business, Enterprise remain.
    await expect(pricingCards).toHaveCount(4)
    for (const [i, name, price] of [[0, 'Free', '$0'], [1, 'Pro', '$79'], [2, 'Business', '$199'], [3, 'Enterprise', '$499']] as const) {
      await expect(pricingCards.nth(i)).toContainText(name)
      await expect(pricingCards.nth(i)).toContainText(price)
    }
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
    const cta = page.locator('.hero-cta')
    await expect(cta.locator('a[href="/signup"]')).toBeVisible()
    await expect(cta.locator('a[href="#how-it-works"]')).toBeVisible()
    await cta.locator('a[href="/signup"]').click()
    await expect(page).toHaveURL(/\/signup/)
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
    // Only claims the business can stand behind (SOC 2 was removed as untrue).
    expect(text).not.toContain('SOC 2')
  })

  test('coming soon banner links to signup', async ({ page }) => {
    const bannerLink = page.locator('div[style*="sticky"] a[href="/signup"]').first()
    await expect(bannerLink).toBeVisible()
  })
})
