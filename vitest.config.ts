import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    testTimeout: 120_000, // LLM calls can take time
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
