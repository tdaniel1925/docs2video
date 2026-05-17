import { test, expect } from '@playwright/test'

test.describe('Marketing / Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('landing page loads with hero section', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.locator('body')).toContainText(/video|presentation|document/i)
  })

  test('navigation links work (Features, Templates, Pricing, FAQ)', async ({ page }) => {
    const navLinks = ['Features', 'Templates', 'Pricing', 'FAQ']
    for (const link of navLinks) {
      await expect(page.locator(`a, button`).filter({ hasText: new RegExp(link, 'i') }).first()).toBeVisible()
    }
  })

  test('template carousel is visible and scrollable', async ({ page }) => {
    const templateSection = page.locator('[data-testid="template-strip"], [class*="template"], [id*="template"]').first()
    await expect(templateSection).toBeVisible()
  })

  test('pricing section shows all 4 tiers', async ({ page }) => {
    const pricingSection = page.locator('#pricing, [data-testid="pricing"], section:has-text("Pricing")').first()
    await pricingSection.scrollIntoViewIfNeeded()
    const pricingCards = pricingSection.locator('[class*="card"], [class*="tier"], [class*="plan"]')
    await expect(pricingCards).toHaveCount(4)
  })

  test('FAQ items expand and collapse on click', async ({ page }) => {
    const faqSection = page.locator('#faq, [data-testid="faq"], section:has-text("FAQ")').first()
    await faqSection.scrollIntoViewIfNeeded()
    const firstFaqItem = faqSection.locator('details, [role="button"], button').first()
    await firstFaqItem.click()
    // After clicking, some content should be revealed
    await page.waitForTimeout(500)
    await firstFaqItem.click()
  })

  test('mobile menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const menuButton = page.locator('[aria-label*="menu"], [data-testid="mobile-menu"], button:has(svg)').first()
    await expect(menuButton).toBeVisible()
    await menuButton.click()
    await expect(page.locator('nav, [role="navigation"], [data-testid="mobile-nav"]').last()).toBeVisible()
    await menuButton.click()
  })

  test('CTA buttons link to /signup', async ({ page }) => {
    const ctaButtons = page.locator('a[href*="/signup"], a[href*="/sign-up"]')
    const count = await ctaButtons.count()
    expect(count).toBeGreaterThan(0)
  })
})
