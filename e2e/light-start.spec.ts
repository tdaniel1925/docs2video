import { test, expect, type Page } from '@playwright/test'
import { FAKE_ID, draftRow, mockDraft, quote, storyDraft } from './helpers/fixtures'
import { SHOTS, collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * OVERHAUL PHASE 5 — the light start.
 *  - Step 3 for an account with no card: the free preview is there, the
 *    price panel says a card comes at Make it, and "Add your brand" opens in
 *    place for a first project (website fill + logo, both mocked — nothing is
 *    saved).
 *  - The help assistant knows the screen: its suggestions and the page it
 *    sends change with the screen (the answer is mocked — no paid AI call).
 *  - Phones: help lives in the ☰ menu; the pinned button sits above the
 *    cookie notice.
 * The signup itself is NOT run here: it would create a real account.
 */

let guard: Guard
let consoleErrors: string[]

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page)
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors').toEqual([])
})

/** Step 3 for a pretend first project of an account with no card. */
async function openCardlessStep3(page: Page, draftOver: Record<string, unknown> = {}) {
  await mockDraft(page, draftRow(storyDraft({ brandId: undefined, ...draftOver })))
  await page.route('**/api/price-quote**', (r) => r.fulfill({ json: quote({ blockedReason: 'card_required', balance: 2000 }) }))
  await page.route('**/rest/v1/brands**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: [] }) : r.fallback())
  await page.route('**/api/preview-first-scene**', (r) => r.request().method() === 'GET'
    ? r.fulfill({ json: { remainingToday: 3, limit: 3 } })
    : r.fulfill({ json: { imageUrl: '/style-samples/slides-data.png', audioUrl: null, remainingToday: 2, voiceNote: null, lookNote: null } }))
  await page.goto(`/create/theme?id=${FAKE_ID}`)
  await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible()
}

test.describe('step 3 without a card', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the free preview works and the card is only asked for at Make it', async ({ page }) => {
    await openCardlessStep3(page)
    const panel = page.getByRole('complementary', { name: 'The price' })
    await expect(panel).toContainText('Add a card to start your free trial.')
    await expect(panel).toContainText('The free preview doesn’t need one.')
    await page.getByRole('button', { name: /See a free preview/ }).click()
    await expect(page.locator('img[src="/style-samples/slides-data.png"]').first()).toBeVisible()
  })

  test('a first project opens "Add your brand" in place; the website fills colours and the real logo', async ({ page }) => {
    await openCardlessStep3(page, { autoBrandInfo: { website: 'rivera.example' } })
    const piece = page.getByRole('region', { name: 'Add your brand' })
    await expect(piece).toBeVisible()
    await expect(piece.getByRole('textbox', { name: 'Your website' })).toHaveValue('rivera.example')
    await expect(piece).toContainText('Only your real logo — we never draw one.')

    // A 1×1 PNG stands in for the logo found on the website.
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    let read: unknown = null
    await page.route('**/api/brand-from-url', async (r) => { read = jsonBody(r.request()); await r.fulfill({ json: { colors: ['#123456', '#abcdef'], fonts: [], logoDataUrl: PNG, foundSomething: true } }) })
    let logoPosts = 0
    await page.route('**/api/brands/logo', (r) => { logoPosts++; return r.fulfill({ json: { logo_url: '/favicon.png', logo_light_url: '/favicon.png', logo_dark_url: '/favicon.png', logo_chip: false } }) })
    await page.route('**/api/extract-logo-colors', (r) => r.fulfill({ json: {} }))

    await piece.getByRole('button', { name: 'Fill in from it' }).click()
    await expect(piece).toContainText('Filled in from your website.')
    expect(read).toEqual({ url: 'https://rivera.example' }) // https:// added for you (normalize-url.ts)
    expect(logoPosts).toBe(1)
    await expect(piece.getByRole('img', { name: 'Your logo' })).toBeVisible()
    await expect(piece.getByLabel('Main colour')).toHaveValue('#123456')
    await page.screenshot({ path: `${SHOTS}/light-start-brand-piece-1440.png` })

    // Not now closes it; the line still offers it.
    await piece.getByRole('button', { name: 'Not now' }).click()
    await expect(piece).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add your brand' })).toBeVisible()
  })
})

test.describe('help knows the screen', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Home and step 3 open with their own questions, and the screen is sent with the question', async ({ page }) => {
    const sent: any[] = []
    await page.route('**/api/help-chat', async (r) => { sent.push(jsonBody(r.request())); await r.fulfill({ json: { reply: '<p>Here is how.</p>' } }) })

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Help', exact: true }).click()
    const help = page.getByRole('dialog', { name: 'Help Assistant' })
    await expect(help).toContainText('On this screen: Home')
    await expect(help.getByRole('button', { name: 'Do I need a card to try it?' })).toBeVisible()
    await help.getByRole('button', { name: 'Do I need a card to try it?' }).click()
    await expect(help).toContainText('Here is how.')
    expect(sent[0]).toMatchObject({ page: '/dashboard', messages: [{ role: 'user', content: 'Do I need a card to try it?' }] })

    await openCardlessStep3(page)
    await page.getByRole('button', { name: 'Help', exact: true }).click()
    await expect(help).toContainText('On this screen: Step 3 — Make it yours')
    await expect(help.getByRole('button', { name: 'How do I add my logo?' })).toBeVisible()
    await help.getByRole('textbox').fill('Which look is best?')
    await help.getByRole('button', { name: 'Send' }).click()
    await expect.poll(() => sent.length).toBe(2)
    expect(sent[1].page).toBe('/create/theme')
    await help.getByRole('button', { name: 'Close help' }).click()
    await expect(help).toHaveCount(0)
  })
})

test.describe('375 wide (phone)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('help is in the ☰ menu, not floating over a start tile', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Create', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeHidden()
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await page.getByRole('navigation', { name: 'Phone menu' }).getByRole('button', { name: 'Ask the help assistant' }).click()
    const help = page.getByRole('dialog', { name: 'Help Assistant' })
    await expect(help).toBeVisible()
    const box = (await help.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
    await help.getByRole('button', { name: 'Close help' }).click()
    await expect(help).toHaveCount(0)
  })

  test('the pinned Make button sits above the cookie notice', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.removeItem('cookie_consent') } catch { /* fine */ } })
    await openCardlessStep3(page)
    const notice = page.getByText('We use essential cookies to keep you logged in.')
    await expect(notice).toBeVisible()
    const make = page.getByRole('button', { name: /^Make it/ })
    await expect(make).toBeVisible()
    const n = (await notice.locator('xpath=..').boundingBox())!
    const m = (await make.boundingBox())!
    expect(m.y + m.height, 'the Make button is covered by the cookie notice').toBeLessThanOrEqual(n.y + 1)
    await page.screenshot({ path: `${SHOTS}/light-start-cookie-375.png` })
  })
})
