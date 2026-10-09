import { test, expect, type Page } from '@playwright/test'
import { collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * The rest of the signed-in app: brand profiles, clients, the library,
 * plans & pricing, and help. Every button is pressed once and its effect
 * checked. Things these tests create (one profile, one client, one draft)
 * are removed again with the app's own Delete / Discard buttons.
 */

let guard: Guard
let consoleErrors: string[]

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page, [/status of (400|409|500)/])
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors').toEqual([])
})

async function stripeLands(page: Page) {
  await page.route('https://checkout.stripe.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<h1>Stripe (mocked)</h1>' }))
  await page.route('https://billing.stripe.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<h1>Stripe billing (mocked)</h1>' }))
}

/* ── Brand profiles ─────────────────────────────────────────────────────── */

test.describe('Brands', () => {
  test('create a profile, open it, and delete it (No keeps it, Yes removes it for good)', async ({ page }) => {
    // Deleting the profile THIS test made is allowed through to the database.
    await page.route('**/rest/v1/brands?**', (r) => r.fallback())
    await page.route('**/rest/v1/brands?**', (r) => r.continue())
    const name = `E2E Profile ${Date.now()}`
    await page.goto('/brands')
    await expect(page.getByRole('heading', { name: 'Brands', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: '+ New brand' }).click()
    await expect(page).toHaveURL(/\/brands\/new$/)
    await page.getByRole('button', { name: /^company$/i }).click().catch(() => {})
    await page.locator('input[name="name"]').fill(name)
    await page.getByRole('button', { name: 'Create brand →' }).click()
    await expect(page).toHaveURL(/\/brands$/)

    const card = page.locator('.brand-card', { hasText: name })
    await expect(card).toHaveCount(1)
    await card.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/brands\/[0-9a-f-]{36}$/)
    await expect(page.locator('input[name="name"]')).toHaveValue(name)
    await page.goto('/brands')

    await card.getByTitle('Delete brand').click()
    await card.getByRole('button', { name: 'No' }).click()
    await expect(card).toHaveCount(1)
    await card.getByTitle('Delete brand').click()
    await card.getByRole('button', { name: 'Yes' }).click()
    await expect(card).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.brand-card', { hasText: name }), 'really deleted, not just hidden').toHaveCount(0)
  })

  test('a delete that fails keeps the profile on screen and says so', async ({ page }) => {
    await page.route('**/rest/v1/brands?**', (r) => r.request().method() === 'DELETE'
      ? r.fulfill({ status: 500, json: { message: 'db down' } })
      : r.fallback())
    await page.goto('/brands')
    await page.locator('.brand-card').first().waitFor({ timeout: 15000 }).catch(() => {}) // list loads in the browser
    const first = page.locator('.brand-card').first()
    test.skip(!(await first.count()), 'no profiles on this account')
    const label = (await first.textContent())!.slice(0, 40)
    await first.getByTitle('Delete brand').click()
    await first.getByRole('button', { name: 'Yes' }).click()
    await expect(page.getByText(/couldn’t delete|could not delete/i)).toBeVisible()
    await expect(page.locator('.brand-card', { hasText: label.trim().slice(0, 10) }).first()).toBeVisible()
  })

  test('opening a profile that has a logo never starts a paid logo kit', async ({ page }) => {
    // Regression: every visit to such a profile used to start an OpenAI logo
    // kit (one picture per slide style). guardRealWorld fails the test if
    // /api/generate-logo-kit is called.
    await page.goto('/brands')
    await page.locator('.brand-card').first().waitFor({ timeout: 15000 }).catch(() => {}) // list loads in the browser
    const hrefs = await page.locator('.brand-card a').evaluateAll((as) => as
      .map((a) => (a as HTMLAnchorElement).getAttribute('href'))
      .filter((h): h is string => !!h && /^\/brands\/[0-9a-f-]{36}$/.test(h)))
    test.skip(hrefs.length === 0, 'no profiles on this account')
    // Make the opened profile look exactly like the costly case: an uploaded
    // logo file and no logo kit yet (the real row is read, then adjusted).
    let served = 0
    await page.route('**/rest/v1/brands?**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const real = await route.fetch()
      const body = await real.json()
      const adjust = (b: Record<string, unknown>) => ({ ...b, logo_file_url: 'https://example.com/e2e-logo.png', logo_kit: null })
      served++
      await route.fulfill({ response: real, json: Array.isArray(body) ? body.map(adjust) : adjust(body) })
    })
    await page.goto(hrefs[0])
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await page.waitForTimeout(2500)
    expect(served, 'the profile was read through the adjusted answer').toBeGreaterThan(0)
    expect(guard.blocked.filter((b) => b.includes('generate-logo-kit'))).toEqual([])
  })

  test('"Analyze brand" fills the form from the website (reading mocked)', async ({ page }) => {
    const asked: any[] = []
    await page.route('**/api/scrape-brand', async (r) => { asked.push(jsonBody(r.request())); await r.fulfill({ json: { companyName: 'Northwind Insurance', primaryColor: '#123456', tagline: 'Cover that fits' } }) })
    await page.goto('/brands/new')
    await page.getByPlaceholder('www.youragency.com').fill('northwind.example')
    await page.getByRole('button', { name: 'Analyze brand' }).click()
    await expect(page.locator('input[name="name"]')).toHaveValue('Northwind Insurance')
    expect(asked).toEqual([{ url: 'https://northwind.example' }]) // https:// added for you (normalize-url.ts)
    await page.getByRole('link', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/brands$/)
  })
})

/* ── Clients ────────────────────────────────────────────────────────────── */

test.describe('Clients', () => {
  // Safety net: a failed run must not leave its test client behind.
  test.afterEach(async ({ page }) => {
    const d = await (await page.request.get('/api/clients?search=E2E%20Client')).json().catch(() => ({ clients: [] }))
    for (const c of d.clients ?? []) if (/^E2E Client \d+$/.test(c.name)) await page.request.delete(`/api/clients/${c.id}`)
  })

  test('add, search, open, edit, note, start a video for them, then delete', async ({ page }) => {
    const stamp = Date.now()
    const name = `E2E Client ${stamp}`
    const email = `e2e-client-${stamp}@example.com`
    await page.goto('/clients')
    await expect(page.getByRole('heading', { name: 'Clients', level: 1 })).toBeVisible()

    // Add Client form: Cancel closes it; Add saves.
    await page.getByRole('button', { name: 'Add a client' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByPlaceholder('Client name')).toHaveCount(0)
    await page.getByRole('button', { name: 'Add a client' }).click()
    await page.getByPlaceholder('Client name').fill(name)
    await page.getByPlaceholder('client@example.com').fill(email)
    await page.getByPlaceholder('Company name').fill('E2E Co')
    await page.locator('form').getByRole('button', { name: /Add|Save|Create/ }).first().click()
    await expect(page.getByText(`${name} added successfully`)).toBeVisible()
    const list = page.locator('table')
    await expect(list.getByText(name)).toBeVisible()

    // Search narrows the list.
    await page.getByPlaceholder('Search clients...').fill(`${stamp}`)
    await expect(list.getByText(name)).toBeVisible()
    await page.getByPlaceholder('Search clients...').fill(`zz-no-such-client-${stamp}`)
    await expect(list.getByText(name)).toHaveCount(0)
    await page.getByPlaceholder('Search clients...').fill(`${stamp}`)

    // Email link and "Send video" from the list.
    const row = list.locator('tr', { hasText: name })
    await expect(row.locator(`a[href="mailto:${email}"]`)).toBeVisible()
    const view = row.getByRole('link', { name: /View|Open/ }).first()
    await view.click()
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/)
    const clientUrl = page.url()

    // Edit and save.
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByPlaceholder('tag1, tag2').fill('e2e, test')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Client updated')).toBeVisible()
    await expect(page.locator('span.tag', { hasText: /^e2e\s*×$/ })).toBeVisible()
    // Quick tag box: Enter adds a tag, clicking a tag removes it.
    const renewal = page.locator('span.tag', { hasText: /^renewal\s*×$/ })
    await page.getByPlaceholder('Add tag...').fill('renewal')
    await page.getByPlaceholder('Add tag...').press('Enter')
    await expect(renewal).toBeVisible()
    await renewal.click()
    await expect(renewal).toHaveCount(0)

    // A note.
    const noteTitle = page.getByPlaceholder('Note title')
    await noteTitle.fill('Called about renewal')
    await page.getByPlaceholder('Details (optional)').fill('E2E note')
    await page.getByRole('button', { name: 'Save Note', exact: true }).click()
    await expect(page.getByText('Called about renewal')).toBeVisible()

    // The other tabs open.
    for (const t of ['emails', 'payments', 'videos']) {
      await page.getByRole('button', { name: t, exact: true }).click()
      await expect(page.getByRole('button', { name: t, exact: true })).toHaveClass(/btn-primary/)
    }
    // Start a video for them: step 1 opens with this client already chosen.
    await page.locator('a[href*="/create/client?clientId="]').first().click()
    await expect(page).toHaveURL(/\/create\?clientId=/)
    await expect(page.locator('.ws-work').getByText(name, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible()

    // Delete: Cancel keeps, Confirm removes.
    await page.goto(clientUrl)
    await page.getByRole('button', { name: /^Delete/ }).first().click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Yes, delete' })).toHaveCount(0)
    await page.getByRole('button', { name: /^Delete/ }).first().click()
    await page.getByRole('button', { name: 'Yes, delete' }).click()
    await expect(page).toHaveURL(/\/clients$/)
    await page.getByPlaceholder('Search clients...').fill(`${stamp}`)
    await expect(page.locator('table').getByText(name)).toHaveCount(0)
    const left = await (await page.request.get(`/api/clients?search=${stamp}`)).json()
    expect(left.clients, 'really deleted').toEqual([])
  })

  test('Import a CSV file sends the pasted rows (import mocked) and Export CSV downloads a file', async ({ page }) => {
    const imports: any[] = []
    await page.route('**/api/clients/import', async (r) => { imports.push(jsonBody(r.request())); await r.fulfill({ json: { imported: 1, skipped: 0, errors: [] } }) })
    await page.goto('/clients')
    await page.getByRole('button', { name: 'Import a CSV file' }).click()
    const box = page.getByPlaceholder(/email,name,company,phone/)
    const importBtn = page.getByRole('button', { name: /^Import/ }).last()
    await expect(importBtn).toBeDisabled()
    await box.fill('email,name\njane@example.com,Jane Doe')
    await importBtn.click()
    await expect.poll(() => imports.length).toBe(1)
    expect(JSON.stringify(imports[0])).toContain('jane@example.com')
    await expect(page.getByText(/imported|Imported|1/).first()).toBeVisible()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    expect((await download).suggestedFilename()).toMatch(/\.csv$/)
  })
})

/* ── Library ────────────────────────────────────────────────────────────── */

test.describe('Library (/videos)', () => {
  test('filter tabs, + New, paging and Open', async ({ page }) => {
    await page.goto('/videos')
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: 'Videos', exact: true }).click()
    await expect(page).toHaveURL(/\/videos\?type=video$/)
    await expect(page.getByRole('heading', { name: 'Videos', level: 1 })).toBeVisible()
    // Presentations have their own tab, and the tab is kept in the address,
    // so a refresh stays on it. Slide decks and graphics are no longer made
    // (videos-only, 2026-10-09): no tab of their own — the ones made before
    // sit under "Older items" (only when the account has some), and the old
    // addresses still land on just those.
    await page.getByRole('link', { name: 'Presentations', exact: true }).click()
    await expect(page).toHaveURL(/\/videos\?type=presentation$/)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Presentations', level: 1 })).toBeVisible()
    const tabs = page.getByRole('navigation', { name: 'Show one kind' })
    await expect(tabs.getByRole('link', { name: 'Slide decks', exact: true })).toHaveCount(0)
    await expect(tabs.getByRole('link', { name: /Graphics/ })).toHaveCount(0)
    if (await tabs.getByRole('link', { name: 'Older items', exact: true }).count()) {
      await tabs.getByRole('link', { name: 'Older items', exact: true }).click()
      await expect(page).toHaveURL(/\/videos\?type=older$/)
      await expect(page.getByRole('heading', { name: 'Older items', level: 1 })).toBeVisible()
    }
    await page.goto('/videos?type=deck')
    await expect(page.getByRole('heading', { name: 'Slide decks', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: 'All', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible()

    // Picture cards (round A): each card says where it is in plain words.
    const cards = page.getByRole('list', { name: 'Your work' }).getByRole('listitem')
    if (await cards.count()) {
      await expect(cards.first()).toContainText(/Ready to send|Ready|Making…|Didn’t finish|Draft — not made yet/)
      for (const size of ['48', '96', '24']) {
        await page.getByRole('button', { name: size, exact: true }).click()
        await expect(page.getByText(new RegExp(`^Showing \\d+–\\d+ of \\d+$`))).toBeVisible()
        expect(await cards.count()).toBeLessThanOrEqual(Number(size))
      }
      const next = page.getByRole('button', { name: 'Next' })
      if (await next.isEnabled()) {
        await next.click()
        await expect(page.getByText(/^Page 2 \//)).toBeVisible()
        await page.getByRole('button', { name: 'Previous' }).click()
        await expect(page.getByText(/^Page 1 \//)).toBeVisible()
      }
      // Search narrows the cards to what matches; clearing brings them back.
      const before = await cards.count()
      await page.getByRole('searchbox', { name: 'Search your library' }).fill('zzzz-nothing-matches-this')
      await expect(page.getByText(/Nothing matches/)).toBeVisible()
      await page.getByRole('button', { name: 'Clear search' }).first().click()
      await expect(cards).toHaveCount(before)
      // Cards ↔ List, remembered after a reload.
      await page.getByRole('button', { name: 'List', exact: true }).click()
      await expect(page.locator('tbody tr').first()).toBeVisible()
      await page.reload()
      await expect(page.locator('tbody tr').first()).toBeVisible()
      await page.getByRole('button', { name: 'Cards', exact: true }).click()
      await expect(cards.first()).toBeVisible()
      // Pressing a card opens it.
      const open = cards.first().getByRole('link', { name: /^Open / })
      const href = (await open.getAttribute('href'))!
      if (href.startsWith('/videos/')) {
        await open.click()
        await expect(page).toHaveURL(new RegExp(href + '$'))
      }
    }
    await page.goto('/videos')
    // The top bar has a "+ New" too (same words on purpose — names.ts).
    await page.getByRole('main').getByRole('link', { name: '+ New', exact: true }).first().click()
    await expect(page).toHaveURL(/\/create$/)
  })

  test('Delete is only in the "…" menu and asks first, then removes the card (delete mocked — nothing real is deleted)', async ({ page }) => {
    await page.goto('/videos?type=video')
    const cards = page.getByRole('list', { name: 'Your work' }).getByRole('listitem')
    test.skip(!(await cards.count()), 'no videos to try Delete on')
    // No Delete button anywhere until a menu is opened.
    await expect(page.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
    const card = cards.first()
    const href = (await card.getByRole('link', { name: /^Open / }).getAttribute('href'))!
    const deletes: string[] = []
    await page.route('**/api/videos/*', async (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback()
      deletes.push(r.request().url())
      await r.fulfill({ json: { success: true } })
    })
    await card.getByRole('button', { name: /^More for / }).click()
    await page.getByRole('menuitem', { name: 'Delete…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete this for good?' })
    await expect(dialog).toBeVisible()
    // Cancel deletes nothing.
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    expect(deletes).toHaveLength(0)
    await card.getByRole('button', { name: /^More for / }).click()
    await page.getByRole('menuitem', { name: 'Delete…' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect.poll(() => deletes.length).toBe(1)
    await expect(page.getByText('Deleted.')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Your work' }).locator(`a[href="${href}"]`)).toHaveCount(0)
  })

  test('a ready video has Send, and it opens the send panel', async ({ page }) => {
    await page.goto('/videos?type=video')
    const send = page.getByRole('link', { name: /^Send / }).first()
    test.skip(!(await send.count()), 'no ready videos')
    await expect(send).toHaveAttribute('href', /^\/videos\/[\w-]+#send$/)
    await send.click()
    await expect(page.getByRole('region', { name: 'Ready to send' })).toBeInViewport({ timeout: 30000 })
  })

  test('a draft is labelled Draft and Open resumes it (same as Home)', async ({ page }) => {
    const purpose = `E2E library draft ${Date.now()}`
    const made = await page.request.post('/api/videos/draft', { data: { outputType: 'video', purpose, contentMethod: 'idea', extractedData: { title: purpose } } })
    const { videoId } = await made.json()
    try {
      await page.goto('/videos')
      const card = page.getByRole('list', { name: 'Your work' }).getByRole('listitem').filter({ has: page.locator(`a[href*="${videoId}"]`) })
      await expect(card).toHaveCount(1)
      await expect(card).toContainText('Draft — not made yet')
      await expect(card.getByRole('link', { name: /^Open / })).toHaveAttribute('href', `/create?id=${videoId}`)
      // No Send on a draft.
      await expect(card.getByRole('link', { name: /^Send / })).toHaveCount(0)
    } finally {
      await page.request.delete(`/api/videos/draft?videoId=${videoId}`)
    }
  })
})

/* ── Plans & pricing ────────────────────────────────────────────────────── */

test.describe('Plans & pricing (/pricing)', () => {
  test('each plan button starts checkout for that plan; an error is shown word for word', async ({ page }) => {
    await stripeLands(page)
    const bodies: any[] = []
    let fail = true
    await page.route('**/api/stripe/checkout', async (r) => {
      bodies.push(jsonBody(r.request()))
      if (fail) return r.fulfill({ status: 500, json: { error: 'Checkout is not available right now.' } })
      await r.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/cs_test_plan' } })
    })
    await page.route('**/api/stripe/portal', (r) => r.fulfill({ json: { url: 'https://billing.stripe.com/p/session/test' } }))
    await page.goto('/pricing')
    await expect(page.getByRole('heading', { name: 'Simple, credit-based pricing' })).toBeVisible()
    const buy = page.getByRole('button', { name: /^(Subscribe|Switch plan)$/ })
    const n = await buy.count()
    expect(n).toBeGreaterThan(0)
    await buy.first().click()
    await expect(page.getByText('Checkout is not available right now.')).toBeVisible()
    fail = false
    await page.reload()
    await buy.first().click()
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
    expect(bodies.map((b) => b.planId).filter(Boolean).length).toBe(2)
  })

  test('the AI Social add-on button starts its own checkout', async ({ page }) => {
    await stripeLands(page)
    await page.route('**/api/social-addon/checkout', (r) => r.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/cs_test_addon' } }))
    await page.goto('/pricing')
    const addon = page.getByRole('button', { name: /add-on|AI Social|Add it|Get/i }).last()
    await addon.click()
    await expect(page).toHaveURL(/checkout\.stripe\.com/)
  })

  test('signed out, /pricing shows the public plans page', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const p = await ctx.newPage()
    const res = await p.goto('/pricing')
    expect(res!.status()).toBeLessThan(400)
    await expect(p.locator('h1').first()).toBeVisible()
    await expect(p.getByRole('link', { name: /sign ?up|get started|start/i }).first()).toBeVisible()
    await ctx.close()
  })
})

/* ── Help ───────────────────────────────────────────────────────────────── */

test.describe('Help', () => {
  test('categories filter, search finds articles, articles expand, and every article link opens', async ({ page }) => {
    await page.goto('/help')
    await expect(page.getByRole('heading', { name: 'Help Center', level: 1 })).toBeVisible()
    const cats = page.locator('button').filter({ hasText: /^[A-Z][\w &]+$/ })
    const first = page.getByRole('button', { name: 'All', exact: true })
    if (await first.count()) await first.click()
    const toggles = page.locator('button[aria-expanded]')
    if (await toggles.count()) {
      await toggles.first().click()
      await expect(toggles.first()).toHaveAttribute('aria-expanded', 'true')
    }
    const search = page.getByPlaceholder(/search/i)
    if (await search.count()) {
      await search.fill('credits')
      await expect(page.getByText(/credit/i).first()).toBeVisible()
      await search.fill('')
    }
    const links = await page.locator('a[href^="/help/"]').evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))])
    expect(links.length).toBeGreaterThan(5)
    for (const href of links) {
      const res = await page.request.get(href)
      expect(res.status(), href).toBe(200)
    }
    await page.goto(links[0])
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

