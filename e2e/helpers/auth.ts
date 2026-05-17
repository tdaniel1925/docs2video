import { Page } from '@playwright/test'

export async function loginAsTestUser(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL || 'tdaniel@botmakers.ai')
  await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD || '4Xkilla1@')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|setup|create|videos|brands|settings|templates|admin)/, { timeout: 15000 })
}

export async function loginAsAdmin(page: Page) {
  await loginAsTestUser(page)
}
