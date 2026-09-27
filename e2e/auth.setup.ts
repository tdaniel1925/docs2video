import { test as setup, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { AUTH_FILE } from '../playwright.config'

/** Sign the test account in once and save the session for every other test. */
setup('sign in the test account', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL || process.env.TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD || process.env.TEST_PASSWORD
  if (!email || !password) {
    throw new Error('Set E2E_TEST_EMAIL/E2E_TEST_PASSWORD (or TEST_EMAIL/TEST_PASSWORD) in .env.local to run e2e tests.')
  }
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|setup)/, { timeout: 30000 })
  await expect(page).toHaveURL(/\/dashboard/)
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  await page.context().storageState({ path: AUTH_FILE })
})
