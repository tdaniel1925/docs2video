import { defineConfig, defaultExclude } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    testTimeout: 120_000, // LLM calls can take time
    hookTimeout: 30_000,
    exclude: [...defaultExclude, 'e2e/**'], // e2e/ is Playwright-owned (npm run test:e2e)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
