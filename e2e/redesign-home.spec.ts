import { test, expect, type Page } from '@playwright/test'
import { collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, type Guard } from './helpers/guard'

/*
 * HOME (/dashboard) — greeting, start cards (each opens step 1 with its
 * source chosen), today's clients, the projects table and "This month".
 * The top bar's "+ New" is checked in top-bar.spec. The page is drawn on the server from the test
 * account's real data, so these tests read what is there and check that
 * every button does what it says. One draft is made through the app's own
 * API for the Continue/Discard checks, and removed by pressing Discard.
 */

let guard: Guard
let consoleErrors: string[]

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page)
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors on Home').toEqual([])
})

const table = (page: Page) => page.getByRole('table', { name: 'Your projects' })

test('greeting follows the viewer’s own clock', async ({ page }) => {
  for (const [hour, word] of [[9, 'Good morning'], [14, 'Good afternoon'], [20, 'Good evening']] as const) {
    await page.clock.setFixedTime(new Date(2026, 8, 27, hour, 0, 0))
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(word)
  }
  // The line under it is one of the three honest summaries.
  await expect(page.getByText(/^(Let’s make your first project\.|\d+ clients? needs? you today\.|Nobody is waiting on you right now\.)$/)).toBeVisible()
})

test('the Create tiles come first, and each opens step 1 with its source already chosen', async ({ page }) => {
  await page.goto('/dashboard')
  const start = page.getByRole('region', { name: 'Create' })
  // Six compact tiles (round B): document, website, idea, paste, commercial, brand.
  await expect(start.getByRole('listitem')).toHaveCount(6)
  // Order on the page: start cards, then today's clients (when any), then projects.
  const y = async (name: string) => {
    const h = page.getByRole('heading', { name, exact: true })
    return (await h.count()) ? (await h.boundingBox())?.y ?? null : null
  }
  const [startY, todayY, projectsY] = [await y('Create'), await y('Today’s clients'), await y('Recent')]
  if (todayY != null) expect(todayY).toBeGreaterThan(startY!)
  if (projectsY != null) expect(projectsY).toBeGreaterThan(todayY ?? startY!)
  // The old right-hand box is gone (the cards replace it).
  await expect(page.getByText('Start from a document')).toHaveCount(0)

  // What each source shows on step 1 once it is picked.
  const cases: [RegExp, string, string, (p: Page) => ReturnType<Page['getByText']>][] = [
    [/^From a document/, 'upload', 'Add your document.', (p) => p.getByText('Drop your file here')],
    [/^From a website/, 'url', 'Add your website.', (p) => p.getByPlaceholder('yourcompany.com')],
    [/^From an idea/, 'ai', 'Describe your idea.', (p) => p.getByLabel('Your idea')],
  ]
  for (const [name, source, heading, shown] of cases) {
    await page.goto('/dashboard')
    await start.getByRole('link', { name }).click()
    await expect(page).toHaveURL(new RegExp(`/create\\?source=${source}$`))
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(shown(page)).toBeVisible()
  }
  await page.goto('/dashboard')
  await start.getByRole('link', { name: 'Paste your text' }).click()
  await expect(page).toHaveURL(/\/create\?source=paste$/)
  await expect(page.getByPlaceholder('Paste your content here (at least 50 characters)')).toBeVisible()

  await page.goto('/dashboard')
  await start.getByRole('link', { name: /^A commercial/ }).click()
  await expect(page).toHaveURL(/\/create\/commercial$/)
  await expect(page.getByRole('heading', { name: 'Make a commercial' })).toBeVisible()

  await page.goto('/dashboard')
  await start.getByRole('link', { name: /^Your brand/ }).click()
  await expect(page).toHaveURL(/\/brands$/)
})

test('step 1 without ?source opens on a document', async ({ page }) => {
  await page.goto('/create')
  await expect(page.getByRole('heading', { name: 'Add your document.' })).toBeVisible()
  await expect(page.getByText('Drop your file here')).toBeVisible()
  await expect(page.getByPlaceholder('yourcompany.com')).toHaveCount(0)
})

test('This month shows the real credit balance and links to plans', async ({ page }) => {
  await page.goto('/dashboard')
  const bal = await (await page.request.get('/api/credits/balance')).json()
  const box = page.locator('div', { has: page.getByRole('heading', { name: 'This month' }) }).last()
  await expect(box.getByText('Credits left').locator('..')).toContainText(Number(bal.balance).toLocaleString('en-US'))
  await box.getByRole('link', { name: 'Billing & credits' }).click()
  await expect(page).toHaveURL(/\/settings\?tab=billing$/)
  await expect(page.getByRole('heading', { name: 'Billing & credits', level: 1 })).toBeVisible()
})

test('every project row opens its project, and "See all" opens the library', async ({ page }) => {
  await page.goto('/dashboard')
  test.skip(!(await table(page).isVisible().catch(() => false)), 'this account has no projects yet')
  const rows = table(page).getByRole('row')
  const n = await rows.count()
  expect(n).toBeGreaterThan(1) // header + at least one project
  for (let i = 1; i < n; i++) {
    const row = rows.nth(i)
    const cells = row.getByRole('cell')
    await expect(cells).toHaveCount(5)
    // "Where it's at" is one of the real states, never blank.
    await expect(cells.nth(3)).toHaveText(/^(Draft · step [1-3] of 3|Making… \d+%|Didn’t finish|Clicked to book a call|Watched( to the end)?|Sent (today|yesterday|\d+ days ago)|Ready)$/)
    const action = cells.nth(4).getByRole('link', { name: /^(Continue|Open)$/ })
    const href = await action.getAttribute('href')
    expect(href, `row ${i} action`).toMatch(/^(\/videos\/[\w-]+|\/create(\/script)?\?id=[\w-]+|https?:\/\/.+)$/)
    // The name links to the same place as the button.
    expect(await cells.nth(0).getByRole('link').getAttribute('href')).toBe(href)
  }
  // Open the first finished project from its row.
  const open = table(page).getByRole('link', { name: 'Open', exact: true }).first()
  if (await open.count()) {
    const href = (await open.getAttribute('href'))!
    if (href.startsWith('/')) {
      await open.click()
      await expect(page).toHaveURL(new RegExp(href.replace(/[?]/g, '\\?') + '$'))
      await page.goto('/dashboard')
    }
  }
  const seeAll = page.getByRole('link', { name: /^See all \d+ →$/ })
  if (await seeAll.count()) {
    await seeAll.click()
    await expect(page).toHaveURL(/\/videos$/)
  }
})

test('action cards: each button goes where it says', async ({ page }) => {
  await page.goto('/dashboard')
  const cards = page.locator('[class*="cardActions"]')
  const n = await cards.count()
  test.skip(n === 0, 'nobody needs the test account right now, so there are no action cards')
  for (let i = 0; i < n; i++) {
    for (const link of await cards.nth(i).getByRole('link').all()) {
      const href = await link.getAttribute('href')
      expect(href).toMatch(/^(\/|tel:)/)
      if (href!.startsWith('/')) {
        const res = await page.request.get(href!)
        expect(res.status(), `${href} opens`).toBeLessThan(400)
      }
    }
  }
  const first = cards.first().getByRole('link').first()
  const href = (await first.getAttribute('href'))!
  if (href.startsWith('/')) {
    await first.click()
    await expect(page).toHaveURL(new RegExp(href.split('?')[0]))
  }
})

test('banners, when shown, lead to the right place', async ({ page }) => {
  await page.goto('/dashboard')
  const card = page.getByRole('link', { name: 'Update card' })
  if (await card.count()) {
    await card.click()
    await expect(page).toHaveURL(/\/settings/)
    await page.goto('/dashboard')
  }
  const plan = page.getByRole('link', { name: /^(Choose a plan|Upgrade)$/ })
  if (await plan.count()) {
    // Round B: a slim line beside the Create label, not a blue bar.
    await expect(page.getByText(/(Out of credits\.|free credits left)/)).toBeVisible()
    await plan.click()
    await expect(page).toHaveURL(/\/pricing/)
  }
})

test('a draft shows as "Draft · step 1 of 3"; Continue reopens it and Discard removes it', async ({ page }) => {
  const purpose = `E2E home draft ${Date.now()}`
  const made = await page.request.post('/api/videos/draft', {
    data: { outputType: 'video', purpose, contentMethod: 'idea', extractedData: { title: purpose, sections: [{ title: 'x', content: 'y' }] } },
  })
  expect(made.ok()).toBeTruthy()
  const { videoId } = await made.json()
  try {
    await page.goto('/dashboard')
    const row = table(page).getByRole('row').filter({ hasText: purpose })
    await expect(row).toHaveCount(1)
    await expect(row.getByRole('cell').nth(3)).toHaveText('Draft · step 1 of 3')
    await expect(row.getByRole('cell').nth(1)).toHaveText('No client')

    await row.getByRole('link', { name: 'Continue' }).click()
    await expect(page).toHaveURL(new RegExp(`/create\\?id=${videoId}$`))
    // Step 1 reopens the SAME draft with what was typed.
    await expect(page.getByLabel('Your idea')).toHaveValue(purpose)

    await page.goto('/dashboard')
    page.once('dialog', (d) => d.accept())
    await table(page).getByRole('row').filter({ hasText: purpose }).getByRole('button', { name: 'Discard' }).click()
    await expect(table(page).getByRole('row').filter({ hasText: purpose })).toHaveCount(0)
    const gone = await page.request.get(`/api/videos/draft?videoId=${videoId}`)
    expect(gone.status(), 'the discarded draft is really deleted').toBe(404)
  } finally {
    // Safety net if an assertion above failed before Discard.
    await page.request.delete(`/api/videos/draft?videoId=${videoId}`).catch(() => {})
  }
})
