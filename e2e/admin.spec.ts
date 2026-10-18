import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/admin')
  })

  test('admin page loads with heading', async ({ page }) => {
    await expect(page.locator('.page-head h1')).toHaveText('Admin', { timeout: 10000 })
  })

  test('dashboard tab shows stats and content', async ({ page }) => {
    // Dashboard is the default tab; stat cards use .stats-row > .stat-card
    await expect(page.locator('.stats-row .stat-card').first()).toBeVisible({ timeout: 10000 })
    // Verify the "Total Users" stat label is present
    await expect(page.locator('.stat-label:has-text("Total Users")')).toBeVisible({ timeout: 10000 })
  })
})

// Admin fixes 2026-10-09 — read only: every pop-up is opened and CANCELLED,
// and any write that slips through is blocked by the route guard below.
test.describe('Admin — what needs you, filters, confirm pop-ups', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (route) => {
      const m = route.request().method()
      return m === 'GET' || m === 'HEAD' ? route.continue() : route.abort()
    })
  })

  test('home shows "What needs you"', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'What needs you' })).toBeVisible({ timeout: 20000 })
  })

  test('videos tab has the "Waiting for your OK" and "Last 24 hours" filters', async ({ page }) => {
    await page.goto('/admin?tab=videos&filter=failed&since=24h')
    await expect(page.getByRole('tab', { name: 'Waiting for your OK' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('radio', { name: 'Last 24 hours' })).toHaveAttribute('aria-checked', 'true')
  })

  test('Give credits asks for a reason before it can run', async ({ page }) => {
    await page.goto('/admin?tab=users')
    await page.getByRole('button', { name: /Give credits/ }).first().click()
    const dialog = page.locator('dialog.kit-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Give .* credits/ })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
  })

  test('the plan dropdown opens a pop-up that warns Stripe keeps billing', async ({ page }) => {
    await page.goto('/admin?tab=users')
    await page.locator('select[aria-label^="Change plan"]').first().selectOption('pro')
    const dialog = page.locator('dialog.kit-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/Stripe keeps billing|Stripe could not be read/)).toBeVisible({ timeout: 20000 })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
  })
})
