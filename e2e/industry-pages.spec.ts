import { test, expect } from '@playwright/test'

const industries = [
  'insurance',
  'real-estate',
  'financial-services',
  'legal',
  'healthcare',
  'consulting',
  'education',
  'mortgage',
  'coaching',
  'fitness',
  'human-resources',
  'medical',
  'non-profit',
  'property-management',
]

test.describe('Industry Landing Pages', () => {
  for (const industry of industries) {
    test.describe(`/for/${industry}`, () => {
      test(`page loads with hero section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        await expect(page.locator('h1').first()).toBeVisible()
      })

      test(`has pain points section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        const painPoints = page.locator('[data-testid="pain-points"], [class*="pain"], section:has-text("challenge"), section:has-text("problem")').first()
        await expect(painPoints).toBeVisible()
      })

      test(`has solutions section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        const solutions = page.locator('[data-testid="solutions"], [class*="solution"], section:has-text("solution"), section:has-text("how it works")').first()
        await expect(solutions).toBeVisible()
      })

      test(`has testimonial section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        const testimonial = page.locator('[data-testid="testimonial"], [class*="testimonial"], blockquote, [class*="quote"]').first()
        await expect(testimonial).toBeVisible()
      })

      test(`has FAQ section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        const faq = page.locator('[data-testid="faq"], [class*="faq"], section:has-text("FAQ"), section:has-text("Frequently")').first()
        await expect(faq).toBeVisible()
      })

      test(`has CTA section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        const cta = page.locator('a[href*="/signup"], a[href*="/sign-up"], button:has-text("Start"), button:has-text("Try")').first()
        await expect(cta).toBeVisible()
      })
    })
  }
})
