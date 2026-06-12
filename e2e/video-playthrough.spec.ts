import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

/**
 * REAL end-to-end video creation — spends actual AI credits (Gemini + TTS +
 * Creatomate/VPS). GATED: only runs when RUN_VIDEO_E2E=1, so credits are never
 * spent by accident on a normal `npm run test:e2e`.
 *
 *   RUN_VIDEO_E2E=1 npx playwright test video-playthrough
 *
 * Drives the full wizard the way a user does: client → content → brand →
 * voice → generate, then waits for the video row to reach 'completed' with a
 * video_url. On local runs where Creatomate's webhook can't reach localhost,
 * finish it with: node scripts/finalize-creatomate-local.mjs <renderId>
 */
const RUN = process.env.RUN_VIDEO_E2E === '1'

test.describe('Full video playthrough (gated, real AI spend)', () => {
  test.skip(!RUN, 'Set RUN_VIDEO_E2E=1 to run the real video generation test')
  test.setTimeout(15 * 60 * 1000) // generation can take several minutes

  test('signup-state user creates a video end to end', async ({ page }) => {
    await loginAsTestUser(page)

    // Step 0 — Who's this for? Skip (general video) to keep the test self-contained
    await page.goto('/create/client')
    await page.getByText('Skip', { exact: false }).click()
    await page.waitForURL(/\/create(\?|$)/, { timeout: 15000 })

    // Step 1 — Content: use the "AI writes it" path with a purpose so no upload is needed
    await page.getByText(/AI writes it/i).click().catch(() => {})
    const purpose = page.locator('textarea, input[type="text"]').first()
    await purpose.fill('A short explainer about the benefits of whole life insurance for a young family.')
    // Kick off the content step (button label may vary: Next / Continue / Generate)
    await page.getByRole('button', { name: /next|continue|create|generate/i }).first().click()

    // Wait until we land on a later wizard step that carries ?id=
    await page.waitForURL(/\/create\/(brand|voice|script)\?id=/, { timeout: 120000 })
    const url = new URL(page.url())
    const videoId = url.searchParams.get('id')
    expect(videoId).toBeTruthy()

    // Walk brand → voice → script using the primary CTA on each, accepting defaults
    for (let i = 0; i < 4; i++) {
      const next = page.getByRole('button', { name: /next|continue|generate|create video|looks good/i }).first()
      if (await next.isVisible().catch(() => false)) {
        await next.click().catch(() => {})
        await page.waitForTimeout(1500)
      }
      if (/\/create\/generating/.test(page.url())) break
    }

    // Poll the video row until completed (via the authenticated API)
    const deadline = Date.now() + 13 * 60 * 1000
    let status = ''
    let videoUrl: string | null = null
    while (Date.now() < deadline) {
      const res = await page.request.get(`/api/videos/${videoId}`)
      if (res.ok()) {
        const v = await res.json()
        status = v.status
        videoUrl = v.video_url
        if (status === 'completed' && videoUrl) break
        if (status === 'failed') throw new Error(`Video failed: ${v.error_message}`)
      }
      await page.waitForTimeout(5000)
    }

    expect(status, 'video should reach completed (on local runs, run the finalizer script for the render id)').toBe('completed')
    expect(videoUrl).toMatch(/\.mp4$/)
  })
})
