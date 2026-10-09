import { test, expect, type Page } from '@playwright/test'
import { guardRealWorld, expectNoBlockedCalls, type Guard } from './helpers/guard'

/*
 * The customer-facing fixes from the 2026-10-09 UX audit, in the real app.
 * Nothing here spends credits or writes anything (the guard blocks the
 * real-world calls).
 */
const MISSING = '00000000-0000-4000-8000-000000000000'
let guard: Guard
test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
})
test.afterEach(() => expectNoBlockedCalls(guard))

async function readyVideoId(page: Page): Promise<string | null> {
  await page.goto('/videos?type=video')
  const send = page.locator('a[href*="#send"]').first()
  if (!(await send.isVisible({ timeout: 15000 }).catch(() => false))) return null
  const href = (await send.getAttribute('href')) ?? ''
  return href.replace(/^\/videos\//, '').replace(/#send$/, '') || null
}

test('a wrong video link says we can’t find it, with the way back', async ({ page }) => {
  await page.goto(`/videos/${MISSING}`)
  await expect(page.getByText("We can't find this video")).toBeVisible({ timeout: 12000 })
  await page.getByRole('link', { name: 'Back to Library' }).click()
  await expect(page).toHaveURL(/\/videos$/)
})

test('Library All shows videos and presentations only; Home counts the same', async ({ page }) => {
  await page.goto('/videos')
  const cards = page.getByRole('list', { name: 'Your work' })
  await expect(cards).toBeVisible({ timeout: 20000 })
  // No retired graphics / decks under All.
  await expect(cards.getByText(/^(Graphic|Slide deck)$/)).toHaveCount(0)
  const count = Number(((await page.getByText(/^\d+ items?$/).first().textContent()) ?? '').replace(/\D/g, ''))
  expect(count).toBeGreaterThan(0)

  await page.goto('/dashboard')
  const seeAll = page.getByRole('link', { name: /^See all \d+/ })
  if (await seeAll.count()) {
    const n = Number(((await seeAll.textContent()) ?? '').replace(/\D/g, ''))
    expect(n, 'Home "See all N" = Library All count').toBe(count)
  }
})

test('the bell and the account button have clear names', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: /^Notifications(, \d+ new)?/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Notifications/ }).click()
  // Every failed-project note says "Didn't finish" and opens its page.
  for (const item of await page.locator('[data-testid="bell-item"][data-failed]').all()) {
    await expect(item).toContainText('Didn’t finish')
    expect(await item.locator('a').first().getAttribute('href')).toMatch(/^\/videos\/[0-9a-f-]{36}$/)
  }
  await expect(page.getByText('Video generation failed')).toHaveCount(0)
})

test('Clients: Add a client first, no revenue tile', async ({ page }) => {
  await page.goto('/clients')
  const buttons = page.locator('.cl-actions button')
  await expect(buttons.first()).toHaveText('Add a client')
  await expect(page.getByText('Total revenue')).toHaveCount(0)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('the create header names the step you are on', async ({ page }) => {
    await page.goto('/create')
    const now = page.locator('.kit-focusbar-step.is-now .kit-focusbar-word')
    await expect(now).toBeVisible()
    await expect(now).toHaveText('Your content')
  })

  test('Clients are cards, not a sideways table', async ({ page }) => {
    await page.goto('/clients')
    await expect(page.locator('.cl-table')).toBeHidden()
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(376)
  })
})

test.describe('the client share page', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a wrong share link is friendly', async ({ page }) => {
    await page.goto(`/watch/${MISSING}`)
    await expect(page.locator('.wp-not-found h1')).toHaveText("We can't find this video", { timeout: 15000 })
  })
})

test('signed in: the share page of a finished video has one clear next step', async ({ page }) => {
  const id = await readyVideoId(page)
  test.skip(!id, 'no finished video on the test account')
  // Clear the "seen it" mark so the notice WOULD show anywhere else.
  await page.addInitScript(() => { try { localStorage.removeItem('cookie_consent') } catch { /* fine */ } })
  await page.goto(`/watch/${id}`)
  await expect(page.getByTestId('watch-next-step')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1500) // the notice would appear right after load
  await expect(page.getByText('We use essential cookies')).toHaveCount(0)
  await expect(page.getByText('Powered by Docs2Video')).toHaveCount(1)
  await expect(page.getByTestId('watch-next-step').locator('a, button').first()).toHaveText(/^\s*(Book a call with|Reply to) /)
})
