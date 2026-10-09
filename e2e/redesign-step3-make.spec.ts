import { test, expect, type Page, type Route } from '@playwright/test'
import { FAKE_ID, draftRow, mockDraft, quote, storyDraft } from './helpers/fixtures'
import { collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * STEP 3 — "The look" (/create/theme).
 *
 * "Pick a look.": look cards three across, one settings line ("Sarah · music
 * off · standard  Change"), a "More options" fold, the brand line, and the
 * bottom bar: the price (the server's), "Free preview" and "Make it". The
 * draft and the price are mocked; "Make it" is intercepted and its body
 * checked against every choice made on screen. Nothing is generated or
 * charged.
 */

const url = `/create/theme?id=${FAKE_ID}`
const BRAND = { id: '00000000-e2e0-4000-8000-0000000000b1', name: 'Acme Insurance', logo_url: null, primary_color: '#1c2a44', secondary_color: '#a8842c', accent_color: '#c96442' }

let guard: Guard
let consoleErrors: string[]

type Quotes = { calls: number; next: (() => Record<string, unknown>)[]; base: Record<string, unknown> }

/** Mock /api/price-quote. `next` answers are used once each, then `base`. */
async function mockQuote(page: Page, base = quote(), delayMs = 0): Promise<Quotes> {
  const q: Quotes = { calls: 0, next: [], base }
  await page.route('**/api/price-quote**', async (route: Route) => {
    q.calls++
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    const make = q.next.shift()
    await route.fulfill({ json: make ? make() : q.base })
  })
  return q
}

/** The user's brands, as the page reads them straight from the database. */
async function mockBrands(page: Page, rows: unknown[]) {
  await page.route('**/rest/v1/brands**', (route) => route.fulfill({ json: rows }))
}

async function open(page: Page, draftOver: Record<string, unknown> = {}, q = quote()) {
  const draft = await mockDraft(page, draftRow(storyDraft({ brandId: null, ...draftOver })))
  const quotes = await mockQuote(page, q)
  await page.goto(url)
  await expect(page.getByRole('heading', { name: 'Pick a look.' })).toBeVisible()
  return { draft, quotes }
}

const bar = (page: Page) => page.getByRole('region', { name: 'The price' })
const makeBtn = (page: Page) => bar(page).getByRole('button', { name: /^(Make it|Starting…)$/ })
const look = (page: Page, name: string) => page.getByRole('radiogroup', { name: 'The look' }).getByRole('radio', { name: new RegExp(name) })
const more = async (page: Page) => {
  const fold = page.locator('#more-options')
  if (!(await fold.evaluate((d) => (d as HTMLDetailsElement).open))) await page.getByText('More options', { exact: true }).click()
  return fold
}
const make = (page: Page, name: 'Video' | 'Presentation') => page.getByRole('radiogroup', { name: 'Make' }).getByRole('radio', { name: new RegExp(`^${name}`) })

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  // 406: after "Make it" the waiting screen asks the database about the
  // pretend project at once, and there is no such row.
  // The card page loads Stripe's script; with no Stripe key in a local
  // .env.local (or no network to js.stripe.com) it complains once it is
  // reached. These tests only check that Make it GETS there.
  consoleErrors = collectConsoleErrors(page, [/status of (402|409|500)/, /status of 406/, /publishable key/i, /js\.stripe\.com/, /Failed to load Stripe\.js/])
  await page.addInitScript(() => { try { localStorage.setItem('cookie_consent', 'accepted') } catch { /* fine */ } })
  await page.route('**/api/preview-first-scene**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: { remainingToday: 3 } }) : r.fallback())
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors on the make screen').toEqual([])
})

test.describe('Step 3 — the price is always the server’s', () => {
  test('while the price loads nothing shows a number and Make is off; then the server’s numbers appear', async ({ page }) => {
    await mockDraft(page, draftRow(storyDraft({ brandId: null })))
    await mockQuote(page, quote(), 2500)
    await page.goto(url)
    await expect(bar(page)).toContainText('Working out the price…')
    await expect(makeBtn(page)).toBeDisabled()
    await expect(makeBtn(page)).toHaveText('Make it')
    // No number anywhere in the bar until the server answers.
    expect(await bar(page).textContent(), 'no made-up price while loading').not.toMatch(/\d[\d,]*\s*credits?/)
    const fold = await more(page)
    await expect(page.getByRole('radiogroup', { name: 'Make' })).not.toContainText(/\d+ credits?/)
    await expect(page.getByRole('radiogroup', { name: 'Make' })).toContainText('…')

    await expect(bar(page)).toContainText('240 credits')
    await expect(bar(page)).toContainText('760 left after')
    await expect(makeBtn(page)).toBeEnabled()
    await expect(fold).toContainText('Narrated video, standard length200 credits')
    await expect(fold).toContainText('Extra document40 credits')
    await expect(fold).toContainText('Total240 credits')
    await expect(fold).toContainText('You have 1,000 credits.')
    await expect(make(page, 'Video')).toContainText('240 credits')
    await expect(make(page, 'Presentation')).toContainText('150 credits')
    // Slide decks are no longer made (videos-only, 2026-10-09) — even when the
    // price answer still lists one, the screen doesn't offer it.
    await expect(page.getByRole('radio', { name: /Slide deck/ })).toHaveCount(0)
    await expect(page.getByRole('radiogroup', { name: 'Make' }).getByRole('radio')).toHaveCount(2)
  })

  test('a price that cannot be worked out is said plainly and Make stays off', async ({ page }) => {
    await mockDraft(page, draftRow(storyDraft({ brandId: null })))
    await page.route('**/api/price-quote**', (route) => route.fulfill({ status: 500, json: { error: 'Pricing is unavailable right now.' } }))
    await page.goto(url)
    await expect(bar(page)).toContainText('Pricing is unavailable right now.')
    await expect(makeBtn(page)).toBeDisabled()
    await expect(bar(page)).not.toContainText(/\d+ credits?/)
  })

  test('free accounts are told nothing is charged', async ({ page }) => {
    const q = quote()
    ;(q.options.video as { free: boolean }).free = true
    await open(page, {}, q)
    await expect(bar(page)).toContainText('Free')
    await expect(bar(page)).toContainText('Your account isn’t charged for this.')
  })

  test('short on credits: says how many more and Top up opens the credit packs', async ({ page }) => {
    await open(page, {}, quote({ balance: 100 }))
    await expect(bar(page)).toContainText('You need 140 credits more.')
    await expect(bar(page)).toContainText('You have 100 credits')
    await bar(page).getByRole('button', { name: 'Top up credits' }).click()
    await expect(page.getByRole('heading', { name: 'Buy credits' })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('heading', { name: 'Buy credits' })).toHaveCount(0)
  })

  test('a card is needed first: the warning shows and Make goes to the card page and back', async ({ page }) => {
    const { quotes } = await open(page, {}, quote({ blockedReason: 'card_required' }))
    await expect(bar(page)).toContainText('Add a card to start your free trial.')
    let intents = 0
    await page.route('**/api/create-setup-intent', (route) => { intents++; return route.fulfill({ json: { clientSecret: 'seti_e2e_secret_x' } }) })
    await page.route('**/api/generate-video', (route) => route.fulfill({ status: 402, json: { code: 'card_required', error: 'Add a card first.' } }))
    await makeBtn(page).click()
    await expect(page).toHaveURL(new RegExp(`/setup-payment\\?next=${encodeURIComponent(`/create/theme?id=${FAKE_ID}`).replace(/[?]/g, '\\?')}`))
    await expect(page.getByRole('heading', { name: 'Add your payment method' })).toBeVisible()
    // The card page knows where to send them back to.
    await expect(page.getByRole('button', { name: 'Save card & continue →' })).toBeVisible()
    // (the card page may ask twice in development, where React runs effects twice)
    expect(intents).toBeGreaterThanOrEqual(1)
    expect(quotes.calls).toBeGreaterThanOrEqual(2)
  })

  test('an already-started project says so and links to its progress', async ({ page }) => {
    await open(page, {}, quote({ startable: false, status: 'processing' }))
    await expect(bar(page)).toContainText('This one has already been started. Open it to see how it’s going.')
    await expect(makeBtn(page)).toBeDisabled()
    await bar(page).getByRole('button', { name: 'See its progress' }).click()
    await expect(page).toHaveURL(new RegExp(`/create/generating\\?id=${FAKE_ID}`))
  })
})

test.describe('Step 3 — choices', () => {
  test('one settings line; Change opens More options', async ({ page }) => {
    await open(page)
    await expect(page.getByTestId('settings-line')).toHaveText('Sarah · music off · standard')
    await expect(page.locator('#more-options')).not.toHaveAttribute('open', '')
    await page.getByRole('button', { name: 'Change', exact: true }).first().click()
    await expect(page.locator('#more-options')).toHaveAttribute('open', '')
    await page.getByRole('radiogroup', { name: 'Background music' }).getByRole('radio', { name: /^On/ }).click()
    await page.getByRole('radiogroup', { name: 'The voice' }).getByRole('radio', { name: /James/ }).click()
    await expect(page.getByTestId('settings-line')).toHaveText('James · music on · standard')
  })

  test('Video or Presentation switches the looks, the voice options and the price', async ({ page }) => {
    await open(page)
    const fold = await more(page)
    await expect(make(page, 'Video')).toHaveAttribute('aria-checked', 'true')
    await expect(look(page, 'Slide Deck')).toBeVisible()
    await expect(fold.getByText('Voice', { exact: true })).toBeVisible()
    await expect(fold.getByText('Music', { exact: true })).toBeVisible()
    await expect(fold.getByText('Length', { exact: true })).toBeVisible()

    await make(page, 'Presentation').click()
    await expect(make(page, 'Presentation')).toHaveAttribute('aria-checked', 'true')
    await expect(look(page, 'Heritage')).toHaveAttribute('aria-checked', 'true')
    await expect(look(page, 'Slide Deck')).toHaveCount(0)
    await expect(fold.getByText('Voice', { exact: true })).toBeVisible()
    await expect(fold.getByText('Music', { exact: true })).toHaveCount(0)
    await expect(fold.getByText('Length', { exact: true })).toHaveCount(0)
    await expect(bar(page)).toContainText('150 credits')
    await expect(page.getByTestId('settings-line')).toHaveText('Sarah · presentation')
    // A presentation has a share page too, so the client note is offered.
    await expect(fold.getByText('A note to your client')).toBeVisible()
  })

  test('an old draft saved as a slide deck opens as a video (decks are no longer made)', async ({ page }) => {
    await open(page, { outputType: 'deck' })
    await more(page)
    await expect(make(page, 'Video')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: /Slide deck/ })).toHaveCount(0)
    await expect(bar(page)).toContainText('240 credits')
  })

  test('look cards: pictures load, BEST on the recommended one, pick a look, examples open larger', async ({ page }) => {
    await open(page)
    const looks = page.getByRole('radiogroup', { name: 'The look' }).getByRole('radio')
    await expect(looks).toHaveCount(6)
    // Every thumbnail is a real picture (none broken).
    await page.waitForFunction(() => [...document.querySelectorAll('[role=radiogroup][aria-label="The look"] img')].every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0), null, { timeout: 15000 })
    await expect(look(page, 'Slide Deck')).toHaveAttribute('aria-checked', 'true')
    await expect(look(page, 'Slide Deck')).toContainText('BEST')
    await expect(page.getByRole('radiogroup', { name: 'The look' }).getByText('BEST')).toHaveCount(1)
    const fold = await more(page)
    await expect(fold.getByText('Add photo backgrounds')).toBeVisible()

    await look(page, 'Aurora').click()
    await expect(look(page, 'Aurora')).toHaveAttribute('aria-checked', 'true')
    await expect(look(page, 'Slide Deck')).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByText(/Aurora\. Modern motion graphics/)).toBeVisible()
    await expect(fold.getByText('Add photo backgrounds')).toHaveCount(0)
    await expect(page.getByText('Usually about 3–5 minutes.', { exact: false })).toBeVisible()

    await page.getByText('See examples of Aurora').click()
    await page.getByRole('button', { name: 'Enlarge Aurora data sample' }).click()
    const big = page.locator('img[alt="Sample"]')
    await expect(big).toHaveAttribute('src', '/style-samples/aurora-data.png')
    await big.click()
    await expect(big).toHaveCount(0)
  })

  test('Sarah is the default voice; ▶ plays the real sample and ■ stops it', async ({ page }) => {
    await open(page)
    await more(page)
    const voices = page.getByRole('radiogroup', { name: 'The voice' })
    await expect(voices.getByRole('radio', { name: /Sarah/ })).toHaveAttribute('aria-checked', 'true')
    const sample = page.waitForResponse((r) => r.url().endsWith('/samples/solo-nova.mp3'))
    await page.getByRole('button', { name: 'Play Sarah sample' }).click()
    expect((await sample).status()).toBeLessThan(400)
    await expect(page.getByRole('button', { name: 'Stop Sarah sample' })).toBeVisible()
    await page.getByRole('button', { name: 'Stop Sarah sample' }).click()
    await expect(page.getByRole('button', { name: 'Play Sarah sample' })).toBeVisible()

    // Playing another voice's sample does not choose it; clicking its name does.
    const james = page.waitForResponse((r) => r.url().endsWith('/samples/solo-onyx.mp3'))
    await page.getByRole('button', { name: 'Play James sample' }).click()
    expect((await james).status()).toBeLessThan(400)
    await expect(voices.getByRole('radio', { name: /Sarah/ })).toHaveAttribute('aria-checked', 'true')
    await voices.getByRole('radio', { name: /James/ }).click()
    await expect(voices.getByRole('radio', { name: /James/ })).toHaveAttribute('aria-checked', 'true')
    await expect(voices.getByRole('radio', { name: /Sarah/ })).toHaveAttribute('aria-checked', 'false')
  })

  test('the note to the client stops at 400 characters', async ({ page }) => {
    await open(page)
    await more(page)
    const note = page.getByPlaceholder('A short personal message shown above it on the share page…')
    await note.fill('x'.repeat(450))
    await expect(note).toHaveValue('x'.repeat(400))
    await expect(page.getByText('400/400')).toBeVisible()
  })

  test('the length is shown and "Change the length" and step 2 in the header go to the story', async ({ page }) => {
    await open(page, { detailLevel: 'detailed' }, quote({ detailLevel: 'detailed' }))
    await expect(page.getByTestId('settings-line')).toHaveText('Sarah · music off · detailed')
    await more(page)
    await page.getByRole('button', { name: 'Change the length' }).click()
    // Lands ON the length choice of the story step, not just the top of it.
    await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}#length$`))
    await expect(page.getByRole('radiogroup', { name: 'Length' })).toBeInViewport()
    await expect(page.getByRole('radio', { name: /Detailed/ })).toHaveAttribute('aria-checked', 'true')
    await page.goto(url)
    await page.getByRole('link', { name: 'Back to step 2: The story' }).click()
    await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}$`))
  })

  test('the brand line names the profile brand; Change opens the brand page for this project', async ({ page }) => {
    await mockBrands(page, [BRAND])
    await open(page, { brandId: undefined })
    await expect(page.getByText('Using Acme Insurance’s logo and colors.')).toBeVisible()
    await page.locator('.cf-brand').getByRole('button', { name: 'Change', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/create/brand\\?id=${FAKE_ID}$`))
  })

  test('no brand: says plain colors and offers "Add your brand"', async ({ page }) => {
    await open(page, { brandId: null })
    await expect(page.getByText('No brand on this one yet — it will use plain colors.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add your brand' })).toBeVisible()
  })

  test('Free preview in the bar shows the first scene on the page, free', async ({ page }) => {
    const asked: any[] = []
    await page.route('**/api/preview-first-scene', (r) => {
      if (r.request().method() !== 'POST') return r.fallback()
      asked.push(jsonBody(r.request()))
      return r.fulfill({ json: { imageUrl: '/style-samples/slides-data.png', audioUrl: null, remainingToday: 2, voiceNote: null, lookNote: null } })
    })
    await open(page)
    await look(page, 'Aurora').click()
    await bar(page).getByRole('button', { name: 'Free preview' }).click()
    const shown = page.getByRole('region', { name: 'Free preview' })
    await expect(shown.getByRole('img', { name: /Preview of your first scene/ })).toBeVisible()
    expect(asked).toEqual([{ videoId: FAKE_ID, output: 'video', look: 'aurora', voiceId: 'nova' }])
    // A different look afterwards offers "Preview again".
    await look(page, 'Cinematic').click()
    await expect(bar(page).getByRole('button', { name: 'Preview again' })).toBeVisible()
  })
})

test.describe('Step 3 — Make it', () => {
  test('saves every choice, re-checks the price, then starts the video with exactly those choices', async ({ page }) => {
    await mockBrands(page, [BRAND])
    const { draft, quotes } = await open(page, { brandId: undefined, sourcePdfPath: 'u/doc.pdf', sourcePdfName: 'plan.pdf' })
    await look(page, 'Explainer').click()
    await more(page)
    await page.getByRole('radiogroup', { name: 'The voice' }).getByRole('radio', { name: /Emily/ }).click()
    await page.getByRole('radiogroup', { name: 'Background music' }).getByRole('radio', { name: /^On/ }).click()
    await page.getByText('Let them download the original PDF').click()
    await page.getByPlaceholder('A short personal message shown above it on the share page…').fill('  Hi Jordan — here is your plan.  ')

    const gen: any[] = []
    await page.route('**/api/generate-video', async (route) => { gen.push(jsonBody(route.request())); await route.fulfill({ json: { success: true, videoId: FAKE_ID } }) })
    const before = quotes.calls
    await makeBtn(page).click()
    await expect(page).toHaveURL(new RegExp(`/create/generating\\?id=${FAKE_ID}&style=explainer$`))

    expect(draft.patches).toHaveLength(1)
    expect(draft.patches[0]).toEqual({
      videoId: FAKE_ID,
      updates: {
        outputType: 'video', voiceId: 'shimmer', aiMusic: true, videoStyle: 'explainer',
        presentationTemplate: 'heritage', slidePhotos: false, brandId: BRAND.id,
        allowSourceDownload: true, agentNote: 'Hi Jordan — here is your plan.',
      },
    })
    expect(quotes.calls - before, 'the price is read again before charging').toBe(1)
    expect(gen).toHaveLength(1)
    expect(gen[0]).toMatchObject({
      videoId: FAKE_ID, outputType: 'video', videoStyle: 'explainer', voiceId: 'shimmer', aiMusic: true,
      brandId: BRAND.id, slidePhotos: false, allowSourceDownload: true, agentNote: 'Hi Jordan — here is your plan.',
      recipientName: 'Jordan', detailLevel: 'standard', sourcePdfPath: 'u/doc.pdf', sourcePdfName: 'plan.pdf',
      purpose: 'Explain the family plan', narrationStyle: 'solo',
    })
    expect(gen[0].preGeneratedScenes).toHaveLength(5)
    expect(typeof gen[0].musicPrompt).toBe('string')
  })

  test('the defaults go out as the defaults (Slide Deck, Sarah, no music, no note)', async ({ page }) => {
    const { draft } = await open(page)
    const gen: any[] = []
    await page.route('**/api/generate-video', async (route) => { gen.push(jsonBody(route.request())); await route.fulfill({ json: { success: true } }) })
    await more(page)
    await page.getByText('Add photo backgrounds').click()
    await makeBtn(page).click()
    await expect(page).toHaveURL(/style=slides$/)
    expect(draft.patches[0].updates).toEqual({
      outputType: 'video', voiceId: 'nova', aiMusic: false, videoStyle: 'slides',
      presentationTemplate: 'heritage', slidePhotos: true, allowSourceDownload: false,
    })
    expect(gen[0]).toMatchObject({ voiceId: 'nova', aiMusic: false, videoStyle: 'slides', slidePhotos: true })
    expect(gen[0].brandId).toBeUndefined()
    expect(gen[0].agentNote).toBeUndefined()
    expect(gen[0].musicPrompt).toBeUndefined()
  })

  test('a double-click starts only one job', async ({ page }) => {
    await open(page)
    let n = 0
    await page.route('**/api/generate-video', async (route) => { n++; await new Promise((r) => setTimeout(r, 800)); await route.fulfill({ json: { success: true } }) })
    await makeBtn(page).dblclick()
    await expect(page).toHaveURL(/\/create\/generating/)
    expect(n).toBe(1)
  })

  test('the server’s error is shown word for word and Make can be pressed again', async ({ page }) => {
    await open(page)
    await page.route('**/api/generate-video', (route) => route.fulfill({ status: 409, json: { error: 'You already have a video being made. Wait for it to finish, then try again.' } }))
    await makeBtn(page).click()
    await expect(bar(page).getByRole('alert')).toHaveText('You already have a video being made. Wait for it to finish, then try again.')
    await expect(makeBtn(page)).toBeEnabled()
    await expect(page).toHaveURL(new RegExp('/create/theme'))
  })

  test('not enough credits opens the top-up with the numbers, and Buy goes to Stripe checkout', async ({ page }) => {
    await open(page)
    await page.route('**/api/generate-video', (route) => route.fulfill({ status: 402, json: { code: 'insufficient_credits', error: 'You need 240 credits but only have 100.', needed: 240, balance: 100 } }))
    await makeBtn(page).click()
    await expect(page.getByRole('heading', { name: 'You need more credits' })).toBeVisible()
    await expect(page.getByText('This needs 240 credits, and you have 100.', { exact: false })).toBeVisible()
    await expect(bar(page).getByRole('alert')).toContainText('You need 240 credits but only have 100.')

    const buys: any[] = []
    await page.route('**/api/credits/buy', async (route) => { buys.push(jsonBody(route.request())); await route.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/cs_test_e2e' } }) })
    await page.route('https://checkout.stripe.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Stripe checkout (mocked)</h1>' }))
    await page.getByRole('button', { name: /^Buy / }).first().click()
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
    expect(buys).toHaveLength(1)
    expect(typeof buys[0].pack).toBe('string')
  })

  test('if the price changed since it was shown, nothing starts and the new price is shown', async ({ page }) => {
    const { quotes } = await open(page)
    const changed = quote()
    ;(changed.options.video as { total: number }).total = 300
    quotes.next.push(() => changed)
    let n = 0
    await page.route('**/api/generate-video', (route) => { n++; return route.fulfill({ json: {} }) })
    await makeBtn(page).click()
    await expect(bar(page).getByRole('alert')).toHaveText('The price changed to 300 credits. Check it, then press Make it again.')
    await expect(bar(page)).toContainText('300 credits')
    expect(n).toBe(0)
  })

  test('saving the choices fails: nothing starts and the reason is shown', async ({ page }) => {
    const { draft } = await open(page)
    draft.patchStatus = 500
    let n = 0
    await page.route('**/api/generate-video', (route) => { n++; return route.fulfill({ json: {} }) })
    await makeBtn(page).click()
    await expect(bar(page).getByRole('alert')).toHaveText('Draft save failed')
    expect(n).toBe(0)
  })

  test('an interactive presentation starts the presentation builder with the chosen look', async ({ page }) => {
    const { draft } = await open(page)
    await more(page)
    await make(page, 'Presentation').click()
    await look(page, 'Midnight').click()
    await page.getByRole('radiogroup', { name: 'The voice' }).getByRole('radio', { name: /Oliver/ }).click()
    const pres: any[] = []
    await page.route('**/api/generate-presentation', async (route) => { pres.push(jsonBody(route.request())); await route.fulfill({ json: { success: true } }) })
    await makeBtn(page).click()
    await expect(page).toHaveURL(new RegExp(`/create/generating\\?id=${FAKE_ID}&style=midnight$`))
    expect(pres).toEqual([{ videoId: FAKE_ID, templateId: 'midnight', outputType: 'interactive' }])
    expect(draft.patches[0].updates).toMatchObject({ outputType: 'interactive', presentationTemplate: 'midnight', voiceId: 'fable' })
  })

  test('a presentation with a card needed goes to the card page without starting anything', async ({ page }) => {
    await open(page, {}, quote({ blockedReason: 'card_required' }))
    await page.route('**/api/create-setup-intent', (route) => route.fulfill({ json: { clientSecret: 'seti_e2e_secret_x' } }))
    await more(page)
    await make(page, 'Presentation').click()
    await makeBtn(page).click()
    await expect(page).toHaveURL(/\/setup-payment\?next=/)
    // guardRealWorld would have caught a call to generate-presentation.
  })

  test('presentation: not enough credits shows the top-up', async ({ page }) => {
    await open(page)
    await more(page)
    await make(page, 'Presentation').click()
    await page.route('**/api/generate-presentation', (route) => route.fulfill({ status: 402, json: { code: 'insufficient_credits', error: 'Not enough credits for a presentation.', needed: 150, balance: 10 } }))
    await makeBtn(page).click()
    await expect(page.getByRole('heading', { name: 'You need more credits' })).toBeVisible()
    await page.getByRole('button', { name: 'Not now' }).click()
    await expect(bar(page).getByRole('alert')).toContainText('Not enough credits for a presentation.')
  })
})

test('a missing project says so and offers a new one', async ({ page }) => {
  guard = await guardRealWorld(page)
  await page.goto('/create/theme')
  await expect(page.getByRole('heading', { name: 'We couldn’t find this project.' })).toBeVisible()
  await page.getByRole('button', { name: 'Start a project' }).click()
  await expect(page).toHaveURL(/\/create$/)
})
