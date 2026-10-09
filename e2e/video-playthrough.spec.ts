import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

/**
 * REAL end-to-end video creation — spends actual AI credits (Gemini + TTS +
 * Creatomate/VPS). GATED: only runs when RUN_VIDEO_E2E=1, so credits are never
 * spent by accident on a normal `npm run test:e2e`.
 *
 *   RUN_VIDEO_E2E=1 npx playwright test video-playthrough
 *
 * Drives the 4-step flow the way a user does: what it's about → check the
 * story → make it yours → Make it, then waits for the video row to reach 'completed' with a
 * video_url. On local runs where Creatomate's webhook can't reach localhost,
 * finish it with: node scripts/finalize-creatomate-local.mjs <renderId>
 */
const RUN = process.env.RUN_VIDEO_E2E === '1'

test.describe('Full video playthrough (gated, real AI spend)', () => {
  test.skip(!RUN, 'Set RUN_VIDEO_E2E=1 to run the real video generation test')
  test.setTimeout(15 * 60 * 1000) // generation can take several minutes

  test('signup-state user creates a video end to end', async ({ page }) => {
    await loginAsTestUser(page)

    // Step 1 — Your content: a general video from an idea (no upload).
    await page.goto('/create?source=ai')
    await page.getByLabel('Your idea').fill('A short explainer about the benefits of whole life insurance for a young family.')
    await page.getByRole('button', { name: 'Read it →' }).click()

    // Step 2 — The story: wait for it to be written, then accept it.
    await page.waitForURL(/\/create\/script\?id=/, { timeout: 180000 })
    const videoId = new URL(page.url()).searchParams.get('id')
    expect(videoId).toBeTruthy()
    const skip = page.getByRole('button', { name: 'Skip — just write it' })
    const scene = page.getByRole('button', { name: 'Edit scene 2' })
    await expect(skip.or(scene)).toBeVisible({ timeout: 240000 })
    if (await skip.isVisible()) await skip.click()
    await expect(scene).toBeVisible({ timeout: 240000 })
    await page.getByRole('button', { name: 'Pick a look →' }).click()

    // Step 3 — The look: defaults (Slide Deck, Sarah), then Make it (REAL spend).
    await page.waitForURL(/\/create\/theme\?id=/)
    await page.getByRole('button', { name: 'Make it', exact: true }).click()
    await page.waitForURL(/\/create\/generating\?id=/, { timeout: 60000 })

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
