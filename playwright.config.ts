import { defineConfig } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// The test account (TEST_EMAIL / TEST_PASSWORD) lives in .env.local. Load it
// here so `npx playwright test` works without exporting anything by hand.
// Values are never printed.
loadEnv({ path: '.env.local', quiet: true })

// Signed in ONCE (e2e/auth.setup.ts) and reused by every test. Logging in per
// test tripped Supabase's sign-in rate limit on a full run. Public-page specs
// opt out with test.use({ storageState: NO_AUTH }) (see e2e/helpers/auth.ts).
export const AUTH_FILE = 'e2e/.auth/user.json'

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  retries: 1,
  // The app talks to live services; two browsers at once is plenty on this
  // machine and keeps the live database traffic modest.
  workers: 2,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { browserName: 'chromium', storageState: AUTH_FILE },
      dependencies: ['setup'],
    },
  ],
  ...(process.env.E2E_BASE_URL ? {} : {
    webServer: {
      command: 'npx next dev --turbopack -p 3001',
      url: 'http://localhost:3001',
      timeout: 120000,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  }),
})
