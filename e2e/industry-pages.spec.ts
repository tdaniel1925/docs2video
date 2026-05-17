import { test, expect } from '@playwright/test'

const INDUSTRIES = [
  { slug: 'insurance', name: 'Insurance' },
  { slug: 'real-estate', name: 'Real Estate' },
  { slug: 'financial-services', name: 'Financial Services' },
  { slug: 'mortgage', name: 'Mortgage' },
  { slug: 'healthcare', name: 'Healthcare' },
  { slug: 'legal', name: 'Legal' },
  { slug: 'consulting', name: 'Consulting' },
  { slug: 'education', name: 'Education' },
  { slug: 'human-resources', name: 'Human Resources' },
  { slug: 'coaching', name: 'Coaching' },
  { slug: 'fitness', name: 'Fitness' },
  { slug: 'medical', name: 'Medical' },
  { slug: 'non-profit', name: 'Non-Profit' },
  { slug: 'property-management', name: 'Property Management' },
]

for (const industry of INDUSTRIES) {
  test.describe(`Industry Page: ${industry.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/for/${industry.slug}`)
      await page.waitForLoadState('networkidle')
    })

    test('hero title is visible', async ({ page }) => {
      const heroTitle = page.locator('h1.hero-title')
      await expect(heroTitle).toBeVisible({ timeout: 10000 })
      const text = await heroTitle.textContent()
      expect(text!.length).toBeGreaterThan(10)
    })

    test('hero has signup CTA', async ({ page }) => {
      const ctaButton = page.locator('.hero a[href="/signup"]')
      await expect(ctaButton).toBeVisible()
    })

    test('problem section exists with eyebrow', async ({ page }) => {
      const problemEyebrow = page.locator('.section-eyebrow', { hasText: 'The problem' })
      await expect(problemEyebrow).toBeVisible()
    })

    test('problem section has pain point feature cards', async ({ page }) => {
      const featureCards = page.locator('.feature-card')
      const count = await featureCards.count()
      expect(count).toBeGreaterThanOrEqual(3)
    })

    test('how it works section exists with eyebrow', async ({ page }) => {
      const howEyebrow = page.locator('.section-eyebrow', { hasText: 'How it works' })
      await expect(howEyebrow).toBeVisible({ timeout: 10000 })
    })

    test('comparison table shows before/after', async ({ page }) => {
      const compTable = page.locator('.comparison-table')
      await expect(compTable).toBeVisible()
      const compRows = compTable.locator('.comp-row')
      const count = await compRows.count()
      expect(count).toBeGreaterThanOrEqual(3)
    })

    test('features section exists with eyebrow', async ({ page }) => {
      const featuresEyebrow = page.locator('.section-eyebrow', { hasText: 'Features' })
      await expect(featuresEyebrow).toBeVisible()
    })

    test('final CTA exists with signup link', async ({ page }) => {
      const finalCta = page.locator('section.final-cta')
      await finalCta.scrollIntoViewIfNeeded()
      await expect(finalCta).toBeVisible()
      const signupLink = finalCta.locator('a[href="/signup"]')
      await expect(signupLink).toBeVisible()
    })
  })
}
