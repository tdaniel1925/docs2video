import { test, expect, type Page, type Route } from '@playwright/test'
import { FAKE_ID, draftRow, mockDraft, quote, storyDraft } from './helpers/fixtures'
import { collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * THE LOOK SCREEN (/create/look, /brands/[id]/look) — look wizard v2.
 *
 * The look data (/api/look) and the reference reader (/api/look/reference)
 * are mocked; the live preview is the REAL scene kit playing in the browser
 * (@remotion/player). "Use this look" is intercepted and its body checked.
 * Nothing is generated, read by AI, or saved.
 */

const BRAND = { id: '00000000-e2e0-4000-8000-0000000000b1', name: 'Reed Insurance', primary_color: '#1d3358', secondary_color: '#a8842c', accent_color: '#d8b25a', fonts: [], logo_chip: false, hasLogo: false, hasLogoKit: false }
const LOOK = { id: 'custom', name: 'Reed', colors: { bg: '#0e1626', glow: '#1b2a44', accent: '#d8b25a', text: '#f4f1ec' }, headFont: 'montserrat', bodyFont: 'source-sans', background: 'glow', corners: 'soft', feel: 'premium', logoMode: 'auto', headWeight: 800 }
const PLAN = {
  version: 1, title: 'Your plan', look: LOOK, brand: { name: 'Reed Insurance' }, recipient: 'The Rivera Family', regulated: false,
  scenes: [
    { id: 1, type: 'title', narration: 'Hi.', headline: 'Your coverage, made simple.' },
    { id: 2, type: 'bignumber', narration: 'Five hundred thousand.', label: 'Paid to your family', figure: { value: 500000, prefix: '$' } },
    { id: 3, type: 'cta', narration: 'Call me.', headline: 'Questions? Let’s talk.', action: 'Book a 15-minute call' },
  ],
}
const lookData = (over: Record<string, unknown> = {}) => ({ plan: PLAN, sample: false, brand: BRAND, looks: { current: null, saved: [] }, draftLook: null, editable: true, ...over })

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

let guard: Guard
let consoleErrors: string[]

async function mockLook(page: Page, data = lookData()) {
  const saves: unknown[] = []
  await page.route('**/api/look?**', (route: Route) => route.fulfill({ json: data }))
  await page.route('**/api/look', async (route: Route) => {
    const body = jsonBody(route.request())
    saves.push({ method: route.request().method(), body })
    await route.fulfill({ json: { ok: true, look: body?.look, looks: { current: body?.look, saved: [body?.look] }, brandName: BRAND.name } })
  })
  return saves
}

async function open(page: Page, data = lookData()) {
  const saves = await mockLook(page, data)
  await page.goto(`/create/look?id=${FAKE_ID}`)
  await expect(page.getByRole('heading', { name: /Make it look/ })).toBeVisible()
  // the real kit is playing the person's own scene
  await expect(page.getByTestId('look-preview')).toContainText('Your coverage, made simple.', { timeout: 30000 })
  return saves
}

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page)
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors').toEqual([])
})

test('one screen: three starts, what we picked, the real preview with scene tabs', async ({ page }) => {
  await open(page)
  for (const name of ['My brand', 'Something I like', 'A ready style']) await expect(page.getByRole('radio', { name: new RegExp(name) })).toBeVisible()
  await expect(page.getByRole('radio', { name: /My brand/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('heading', { name: 'We picked this from your brand' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(3)
  await page.getByRole('tab', { name: '$500,000' }).click()
  await expect(page.getByTestId('look-preview')).toContainText('$500,000')
  await expect(page.getByRole('button', { name: /Play 10 seconds/ })).toBeVisible()
  // fine controls fold away
  await expect(page.getByRole('radiogroup', { name: 'Background' })).toBeHidden()
  await page.getByText('Fine-tune (optional)').click()
  await expect(page.getByRole('radiogroup', { name: 'Music' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your look' })).toContainText('Saves to Reed Insurance')
})

test('a ready style sets everything; nudges change it and Undo puts it back', async ({ page }) => {
  await open(page)
  await page.getByTestId('start-style').click()
  await page.getByRole('radio', { name: 'Calm paper', exact: true }).click()
  const bg = page.getByLabel('Background colour')
  await expect(bg).toHaveValue('#f4efe6')
  await page.getByRole('button', { name: 'Warmer' }).click()
  await expect(bg).not.toHaveValue('#f4efe6')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(bg).toHaveValue('#f4efe6')
})

test('unreadable words are fixed, and the screen says so (Why?)', async ({ page }) => {
  await open(page)
  await expect(page.getByTestId('contrast-note')).toHaveCount(0)
  await page.getByLabel('Words colour').fill('#0f1828')
  await expect(page.getByTestId('contrast-note')).toContainText('readable')
  await page.getByRole('button', { name: 'Why?' }).click()
  await expect(page.getByTestId('contrast-note')).toContainText('4.5 times')
})

test('something I like: a picture is read (closest-match font), never its words or logos', async ({ page }) => {
  await open(page)
  await page.route('**/api/look/reference', (route) => route.fulfill({ json: {
    ok: true, cached: false, costUsd: 0.0002, source: 'image', fontLabel: 'Fraunces · closest match',
    read: { mood: 'calm', density: 'airy', energy: 'low', font: 'fraunces', fontExact: false },
    palette: { bg: '#f9f6f0', glow: '#e5e2dd', accent: '#d36a37', text: '#07294c', alternatives: [{ bg: '#f9f6f0', glow: '#e5e2dd', accent: '#3d546e', text: '#07294c' }], swatches: [], light: true, skippedDefaults: [] },
    look: { ...LOOK, name: 'From your picture', colors: { bg: '#f9f6f0', glow: '#e5e2dd', accent: '#d36a37', text: '#07294c' }, headFont: 'fraunces', bodyFont: 'dm-sans', headWeight: 600, feel: 'calm', background: 'paper' },
  } }))
  await page.getByTestId('start-reference').click()
  await expect(page.getByText('Never logos, words or photos.')).toBeVisible()
  await page.getByTestId('reference-file').setInputFiles({ name: 'brochure.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64') })
  await expect(page.getByText(/Read in \d+ second/)).toBeVisible()
  // Fraunces is the "Warm" chip: that one is picked, and the screen says it is the closest free match
  await expect(page.getByRole('radio', { name: 'Warm', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('closest-font')).toHaveText('Fraunces · closest match')
  await expect(page.getByLabel('Accent colour')).toHaveValue('#d36a37')
  await page.getByRole('button', { name: 'Try other colours from it' }).click()
  await expect(page.getByLabel('Accent colour')).toHaveValue('#3d546e')
})

test('a failed read falls back to the brand with a plain message; video links ask for a screenshot', async ({ page }) => {
  await open(page)
  let n = 0
  await page.route('**/api/look/reference', (route) => {
    n++
    return route.fulfill({ json: n === 1
      ? { ok: false, fallback: 'brand', code: 'unreadable', message: 'We couldn’t read that one, so we started from your brand instead. Try another picture, or a screenshot of what you like.' }
      : { ok: false, fallback: 'brand', code: 'video_link', message: 'We can’t read videos. Pause it on a frame you like, take a screenshot, and upload that picture instead.' } })
  })
  await page.getByTestId('start-reference').click()
  await page.getByTestId('reference-file').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64') })
  await expect(page.getByRole('alert').filter({ hasText: 'started from your brand' })).toBeVisible()
  await expect(page.getByLabel('Accent colour')).toHaveValue(LOOK.colors.accent)
  await page.getByLabel('A website you like').fill('https://youtube.com/watch?v=1')
  await page.getByRole('button', { name: 'Read it' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'take a screenshot' })).toBeVisible()
})

test('Use this look saves a copy for this video (and the brand), then returns to the looks', async ({ page }) => {
  const saves = await open(page)
  const shownBg = await page.getByLabel('Background colour').inputValue()
  await mockDraft(page, draftRow(storyDraft({ brandId: BRAND.id, videoStyle: 'kit', kitLook: 'custom', kitLookCustom: LOOK })))
  await page.route('**/api/price-quote**', (route) => route.fulfill({ json: quote() }))
  await page.route('**/api/kit-engine', (route) => route.fulfill({ json: { on: true } }))
  await page.getByRole('button', { name: 'Use this look' }).click()
  await page.waitForURL(/\/create\/theme/)
  type Save = { method: string; body: { videoId: string; brandId: string; look: { colors: { bg: string } } } }
  const post = (saves as Save[]).find((s) => s.method === 'POST')!
  expect(post.body.videoId).toBe(FAKE_ID)
  expect(post.body.brandId).toBe(BRAND.id)
  expect(post.body.look.colors.bg).toBe(shownBg)
})

test('step 3: "Your look" comes first and "Create your own look" opens the look screen', async ({ page }) => {
  await mockDraft(page, draftRow(storyDraft({ brandId: null, videoStyle: 'kit', kitLook: 'custom', kitLookCustom: LOOK })))
  await page.route('**/api/price-quote**', (route) => route.fulfill({ json: quote() }))
  await page.route('**/api/kit-engine', (route) => route.fulfill({ json: { on: true } }))
  await mockLook(page)
  await page.goto(`/create/theme?id=${FAKE_ID}`)
  const cards = page.getByRole('radiogroup', { name: 'The look' }).getByRole('radio')
  await expect(cards.first()).toContainText('Your look')
  await expect(cards.first()).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: /Change your look/ }).click()
  await page.waitForURL(/\/create\/look\?id=/)
  await expect(page.getByRole('heading', { name: /Make it look/ })).toBeVisible()
})

test('brands: every brand has a Video look entry', async ({ page }) => {
  await page.goto('/brands')
  const link = page.getByTestId('brand-look-link').first()
  await expect(link).toBeVisible({ timeout: 20000 })
  await expect(link).toHaveAttribute('href', /\/brands\/[^/]+\/look$/)
})
