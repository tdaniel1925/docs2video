import { test, expect } from '@playwright/test'

/**
 * /templates is a RETIRED tool (it charged credits after being hidden from
 * the menus — audit 2026-09-26). It must not open: it forwards to Home.
 */
test.describe('Retired template tool', () => {
  test('/templates forwards to Home instead of opening the old tool', async ({ page }) => {
    await page.goto('/templates')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('button', { name: '+ Create template' })).toHaveCount(0)
  })
})
