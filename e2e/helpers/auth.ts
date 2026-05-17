import { Page } from '@playwright/test'

export async function loginAsTestUser(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL || 'test@example.com')
  await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD || 'testpass123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|setup)/)
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', process.env.E2E_ADMIN_EMAIL || 'admin@example.com')
  await page.fill('input[name="password"]', process.env.E2E_ADMIN_PASSWORD || 'adminpass123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|admin)/)
}
