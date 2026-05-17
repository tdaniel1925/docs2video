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
        await expect(page.locator('text=The problem').first()).toBeVisible()
      })

      test(`has solutions section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        await expect(page.locator('text=The solution').first()).toBeVisible()
      })

      test(`has testimonial section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        await expect(page.locator('.testimonial-section').first()).toBeVisible()
      })

      test(`has FAQ section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        await expect(page.locator('.faq-section').first()).toBeVisible()
      })

      test(`has CTA section`, async ({ page }) => {
        await page.goto(`/for/${industry}`)
        await expect(page.locator('.final-cta').first()).toBeVisible()
      })
    })
  }
})
