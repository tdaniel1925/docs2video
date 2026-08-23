import { Page } from '@playwright/test'

// CREDENTIALS COME FROM ENV ONLY — never hardcoded in this repo. (A previous
// version had a real password baked in as the fallback because the env names
// didn't match .env.local's TEST_EMAIL/TEST_PASSWORD; both names are accepted
// now, and a missing value fails loudly instead of quietly using a secret.)
const EMAIL = process.env.E2E_TEST_EMAIL || process.env.TEST_EMAIL
const PASSWORD = process.env.E2E_TEST_PASSWORD || process.env.TEST_PASSWORD

export async function loginAsTestUser(page: Page) {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set E2E_TEST_EMAIL/E2E_TEST_PASSWORD (or TEST_EMAIL/TEST_PASSWORD) in the environment to run e2e tests.')
  }
  await page.goto('/login')
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|setup|create|videos|brands|settings|templates|admin)/, { timeout: 15000 })
}

export async function loginAsAdmin(page: Page) {
  await loginAsTestUser(page)
}
