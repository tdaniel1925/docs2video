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

    test('hero title is visible and contains Docs2Video', async ({ page }) => {
      const heroTitle = page.locator('h1.hero-title')
      await expect(heroTitle).toBeVisible()
      const text = await heroTitle.textContent()
      expect(text).toContain('Docs2Video for')
    })

    test('hero has start free trial CTA', async ({ page }) => {
      const ctaButton = page.locator('.hero a[href="/signup"]')
      await expect(ctaButton).toBeVisible()
    })

    test('problem section exists with eyebrow', async ({ page }) => {
      const problemEyebrow = page.locator('.section-eyebrow', { hasText: 'The problem' })
      await expect(problemEyebrow).toBeVisible()
    })

    test('problem section has pain point feature cards', async ({ page }) => {
      // Pain points rendered as feature-card inside the problem section
      const featureCards = page.locator('.feature-card')
      const count = await featureCards.count()
      expect(count).toBeGreaterThanOrEqual(3)
    })

    test('solution section exists with eyebrow', async ({ page }) => {
      const solutionEyebrow = page.locator('.section-eyebrow', { hasText: 'The solution' })
      await expect(solutionEyebrow).toBeVisible()
    })

    test('comparison table shows before/after', async ({ page }) => {
      const compTable = page.locator('.comparison-table')
      await expect(compTable).toBeVisible()
      const compRows = compTable.locator('.comp-row')
      const count = await compRows.count()
      expect(count).toBeGreaterThanOrEqual(3)
    })

    test('testimonial section exists', async ({ page }) => {
      const testimonialSection = page.locator('.testimonial-section')
      await testimonialSection.scrollIntoViewIfNeeded()
      await expect(testimonialSection).toBeVisible()
      // Has a testimonial card with stars
      await expect(testimonialSection.locator('.testimonial-card')).toBeVisible()
      await expect(testimonialSection.locator('.testimonial-stars')).toBeVisible()
    })

    test('FAQ section exists with questions', async ({ page }) => {
      const faqSection = page.locator('.faq-section')
      await faqSection.scrollIntoViewIfNeeded()
      await expect(faqSection).toBeVisible()
      const faqItems = faqSection.locator('.faq-item')
      const count = await faqItems.count()
      expect(count).toBeGreaterThanOrEqual(1)
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
