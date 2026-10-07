import { test, expect } from '@playwright/test'
import path from 'node:path'
import { collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody } from './helpers/guard'

/*
 * ONE REAL RUN through the four steps, against the live services:
 *   step 1: real upload of a small PDF, real reading of it, real draft
 *   step 2: real "one point" + story writing (free AI), one real rewrite + undo
 *   step 3: the price shown must be exactly /api/price-quote's; the brand
 *           "Change" round trip is real; "Make it" is INTERCEPTED (nothing is
 *           made or charged) and its body checked against the saved draft
 *   Home:   the draft is found and removed with the Discard button.
 *
 * Skip with E2E_SKIP_REAL_AI=1.
 */

test.skip(process.env.E2E_SKIP_REAL_AI === '1', 'real AI run switched off')
test.setTimeout(8 * 60 * 1000)

test('a document becomes a story, gets its look and price, and is discarded from Home', async ({ page }) => {
  const guard = await guardRealWorld(page)
  const consoleErrors = collectConsoleErrors(page)
  const purpose = `E2E journey ${Date.now()} — explain the family plan`
  let videoId = ''

  try {
    // ── Step 1 ──
    await page.goto('/create')
    await page.getByRole('button', { name: 'No client — general' }).click()
    await page.getByPlaceholder(/Explain our services/).fill(purpose)
    await page.getByRole('button', { name: /^Upload file/ }).click()
    await page.locator('input[type=file]').first().setInputFiles(path.join(__dirname, 'fixtures', 'sample-plan.pdf'))
    await page.getByRole('button', { name: 'Read it and plan the story →' }).click()
    await expect(page.getByRole('button', { name: 'Reading…' })).toBeVisible()
    await page.waitForURL(/\/create\/script\?id=/, { timeout: 180000 })
    videoId = new URL(page.url()).searchParams.get('id')!
    expect(videoId).toMatch(/^[0-9a-f-]{36}$/)

    // ── Step 2 (real brief + story) ──
    const skip = page.getByRole('button', { name: 'Skip — just write it' })
    const firstTitle = page.getByLabel('Scene 2 title')
    await expect(skip.or(firstTitle)).toBeVisible({ timeout: 240000 })
    if (await skip.isVisible()) await skip.click()
    await expect(firstTitle).toBeVisible({ timeout: 240000 })
    await expect(page.getByText('The one point')).toBeVisible()
    const before = await firstTitle.inputValue()
    const count = await page.getByLabel(/^Scene \d+ title$/).count()
    expect(count).toBeGreaterThanOrEqual(3)

    // One real "change it by asking", then Undo.
    await page.getByRole('button', { name: 'Make it shorter' }).click()
    await expect(page.getByText(/Done — I rewrote the story|That change didn’t work/)).toBeVisible({ timeout: 180000 })
    await expect(page.getByText('Done — I rewrote the story.', { exact: false }), 'the real rewrite worked').toBeVisible()
    await page.getByRole('button', { name: 'Undo that change' }).click()
    await expect(firstTitle).toHaveValue(before)

    await page.getByRole('button', { name: 'Looks right — pick the look →' }).click()
    await page.waitForURL(new RegExp(`/create/theme\\?id=${videoId}$`))

    // ── Step 3: the price is the server's, to the credit ──
    const makeBtn = page.getByRole('button', { name: /^Make it — / })
    await expect(makeBtn).toBeVisible({ timeout: 30000 })
    const q = await (await page.request.get(`/api/price-quote?videoId=${videoId}`)).json()
    const fmt = (n: number) => `${n.toLocaleString('en-US')} credit${n === 1 ? '' : 's'}`
    await expect(makeBtn).toHaveText(`Make it — ${fmt(q.options.video.total)}`)
    const panel = page.getByRole('complementary', { name: 'The price' })
    await expect(panel).toContainText(`Total${fmt(q.options.video.total)}`)
    for (const l of q.options.video.lines) await expect(panel).toContainText(`${l.label}${fmt(l.credits)}`)
    if (!q.options.video.free) await expect(panel).toContainText(`You have ${fmt(q.balance)}.`)
    for (const o of q.offered) {
      await expect(page.getByRole('radiogroup', { name: 'What do you want to send?' })).toContainText(fmt(q.options[o].total))
    }

    // ── Brand "Change" round trip (real) ──
    await page.getByRole('button', { name: /^(Change|Add your brand)$/ }).click()
    await page.waitForURL(new RegExp(`/create/brand\\?id=${videoId}$`))
    await expect(page.getByRole('heading', { name: 'Your brand', exact: true })).toBeVisible()
    const using = page.getByText('Using your brand')
    let brandName: string | null = null
    if (await using.isVisible().catch(() => false)) {
      brandName = (await using.locator('xpath=following-sibling::div[1]').textContent())?.trim() ?? null
      await page.getByRole('button', { name: 'Next →' }).click()
    } else {
      await page.getByRole('button', { name: 'Skip — no brand on this one' }).click()
    }
    await page.waitForURL(new RegExp(`/create/theme\\?id=${videoId}$`))
    await expect(makeBtn).toBeVisible({ timeout: 30000 })
    if (brandName) await expect(page.getByText(`Using ${brandName}’s logo and colors.`)).toBeVisible()
    else await expect(page.getByText('No brand on this one yet — it will use plain colors.')).toBeVisible()

    // ── Make it: intercepted, body must match the saved draft ──
    const sent: any[] = []
    await page.route('**/api/generate-video', async (route) => { sent.push(jsonBody(route.request())); await route.fulfill({ json: { success: true } }) })
    await page.getByRole('radiogroup', { name: 'The voice' }).getByRole('radio', { name: /James/ }).click()
    await makeBtn.click()
    await page.waitForURL(new RegExp(`/create/generating\\?id=${videoId}&style=slides$`))
    expect(sent).toHaveLength(1)
    const draft = await (await page.request.get(`/api/videos/draft?videoId=${videoId}`)).json()
    expect(draft.status, 'nothing was started for real').toBe('draft')
    expect(draft.draft_data.voiceId).toBe('onyx')
    expect(sent[0]).toMatchObject({ videoId, voiceId: 'onyx', videoStyle: 'slides', outputType: 'video', purpose })
    expect(sent[0].preGeneratedScenes).toHaveLength(draft.draft_data.scenes.length)
    expect(sent[0].brandId ?? null).toBe(draft.draft_data.brandId ?? null)

    // ── Home: the draft is listed and Discard removes it ──
    await page.goto('/dashboard')
    const row = page.getByRole('table', { name: 'Your projects' }).getByRole('row').filter({ has: page.locator(`a[href*="${videoId}"]`) })
    await expect(row).toHaveCount(1)
    await expect(row.getByRole('cell').nth(3)).toHaveText(/^Draft · step [1-4] of 4$/)
    page.once('dialog', (d) => d.accept())
    await row.getByRole('button', { name: 'Discard' }).click()
    await expect(row).toHaveCount(0)
    expect((await page.request.get(`/api/videos/draft?videoId=${videoId}`)).status()).toBe(404)
    videoId = ''
  } finally {
    if (videoId) await page.request.delete(`/api/videos/draft?videoId=${videoId}`).catch(() => {})
  }
  expectNoBlockedCalls(guard)
  expect(consoleErrors).toEqual([])
})
