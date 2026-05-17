import { test, expect } from '@playwright/test'

test.describe('Public Share Page', () => {
  test('nonexistent video shows not-found state', async ({ page }) => {
    await page.goto('/watch/nonexistent-id-000')
    // The component sets notFound=true which renders the wp-not-found block
    await expect(page.locator('.wp-not-found h1')).toHaveText(
      'This presentation is no longer available',
      { timeout: 10000 }
    )
  })

  test('share page does not crash on invalid id', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const response = await page.goto('/watch/invalid-test-id')
    // Page should load without a server error (not 500)
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(500)

    // Wait for page to settle
    await page.waitForTimeout(3000)

    // No unhandled JS exceptions should have fired
    expect(errors.length).toBe(0)
  })
})
