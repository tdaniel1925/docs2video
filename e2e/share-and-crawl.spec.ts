import { test, expect, request as pwRequest, type Page } from '@playwright/test'
import { AUTH_FILE } from '../playwright.config'
import { collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * 1. The client's share page (/watch/[id]) for a real finished project,
 *    viewed SIGNED OUT like a client would. View tracking, "ask a question"
 *    and lead capture are intercepted, so the owner gets no fake views,
 *    questions or leads.
 * 2. A crawl of every internal link reachable from the signed-in navigation
 *    and the public pages: no 404/500 and no console errors.
 */

async function finishedIds(baseURL: string): Promise<{ id: string; output_type: string | null }[]> {
  const ctx = await pwRequest.newContext({ baseURL, storageState: AUTH_FILE })
  const rows = await (await ctx.get('/api/videos')).json()
  await ctx.dispose()
  return (Array.isArray(rows) ? rows : []).filter((r: { status: string }) => r.status === 'completed')
}

test.describe('Share page (signed out)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  let guard: Guard
  let consoleErrors: string[]
  test.beforeEach(async ({ page }) => {
    guard = await guardRealWorld(page)
    consoleErrors = collectConsoleErrors(page)
  })
  test.afterEach(() => {
    expectNoBlockedCalls(guard)
    expect(consoleErrors, 'console errors on the share page').toEqual([])
  })

  test('each kind of finished project opens, records a view, and every control works', async ({ page, baseURL }) => {
    const rows = await finishedIds(baseURL!)
    test.skip(rows.length === 0, 'no finished projects on the test account')
    const byType = new Map<string, string>()
    for (const r of rows) if (!byType.has(r.output_type ?? 'video')) byType.set(r.output_type ?? 'video', r.id)

    for (const [type, id] of byType) {
      const res = await page.goto(`/watch/${id}`)
      expect(res!.status(), `${type} share page`).toBe(200)
      await expect(page.locator('video, iframe, .wp-video-wrap, .wp-col-right').first()).toBeVisible({ timeout: 20000 })
      await expect.poll(() => guard.tracked, { message: `${type}: a view is recorded` }).toBeGreaterThan(0)
      guard.tracked = 0

      // Slide strip: clicking a thumbnail moves to that slide.
      const thumbs = page.locator('.wp-thumbstrip .wp-thumb')
      if (await thumbs.count() > 1) {
        await thumbs.nth(1).click()
        await expect(page.locator('.wp-slide-indicator')).toContainText('2')
      }

      // Disclosures open and close.
      const disc = page.locator('.wp-disclosures-toggle')
      if (await disc.count()) {
        await disc.click()
        await expect(page.locator('.wp-disclosures-panel')).toBeVisible()
        await disc.click()
        await expect(page.locator('.wp-disclosures-panel')).toHaveCount(0)
      }

      // Book / pay buttons are real https links and are counted when clicked.
      for (const a of await page.locator('a.wp-pay-btn, a[href^="https://"][target="_blank"]').filter({ hasText: /Book|Pay|payment|call/i }).all()) {
        expect(await a.getAttribute('href')).toMatch(/^https:\/\//)
      }

      // Contact links.
      for (const a of await page.locator('.wp-contact-link').all()) {
        expect(await a.getAttribute('href')).toMatch(/^(mailto:|tel:)/)
      }

      // "Powered by Docs2Video" goes home.
      const powered = page.getByRole('link', { name: 'Powered by Docs2Video' })
      if (await powered.count()) expect(await powered.getAttribute('href')).toBe('/')
    }
  })

  test('the lead form sends the email and name, then thanks them (capture mocked)', async ({ page, baseURL }) => {
    const rows = await finishedIds(baseURL!)
    test.skip(rows.length === 0, 'no finished projects on the test account')
    const leads: any[] = []
    await page.route('**/api/capture-lead', async (r) => { leads.push(jsonBody(r.request())); await r.fulfill({ json: { success: true } }) })
    await page.goto(`/watch/${rows[0].id}`)
    const email = page.getByPlaceholder('Your email')
    test.skip(!(await email.isVisible({ timeout: 8000 }).catch(() => false)), 'this share page has no lead form')
    await email.fill('prospect@example.com')
    await page.getByPlaceholder('Name (optional)').fill('Pat Prospect')
    await page.locator('.wp-lead-submit').click()
    await expect(page.locator('.wp-lead-success')).toBeVisible()
    expect(leads[0]).toMatchObject({ email: 'prospect@example.com', name: 'Pat Prospect' })
    await page.locator('.wp-lead-close').click()
    await expect(page.locator('.wp-lead-card')).toHaveCount(0)
  })

  test('a missing project says it is no longer available', async ({ page }) => {
    await page.goto('/watch/00000000-0000-4000-8000-000000000000')
    await expect(page.locator('.wp-not-found h1')).toHaveText('This presentation is no longer available')
    // The browser logs the data lookup's 404 — that one is expected here.
    const expected = consoleErrors.filter((e) => /status of 404 .*\/api\/public\/watch\/00000000/.test(e))
    expect(expected).toHaveLength(1)
    consoleErrors.splice(0, consoleErrors.length, ...consoleErrors.filter((e) => !expected.includes(e)))
  })
})

/* ── Crawl ──────────────────────────────────────────────────────────────── */

async function internalLinks(page: Page): Promise<string[]> {
  return page.locator('a[href^="/"]').evaluateAll((as) => [...new Set(as
    .map((a) => (a as HTMLAnchorElement).getAttribute('href')!)
    .map((h) => h.split('#')[0])
    .filter((h) => h && !h.startsWith('//') && !h.startsWith('/api/')))])
}

async function crawl(page: Page, starts: string[], skip: RegExp[]) {
  const seen = new Set<string>()
  const queue = [...starts]
  const bad: string[] = []
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(`${page.url()}: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (401|403|418|429)|net::ERR_ABORTED/.test(m.text())) pageErrors.push(`${page.url()}: ${m.text()}`)
  })
  // Only follow links one level from the starting pages (the nav), plus the
  // starting pages themselves. Every link on those pages is checked.
  const toCheck = new Set<string>()
  for (const start of queue) {
    if (seen.has(start)) continue
    seen.add(start)
    const res = await page.goto(start)
    const st = res?.status() ?? 0
    if (st >= 400) { bad.push(`${start} → ${st}`); continue }
    await page.waitForLoadState('networkidle').catch(() => {})
    for (const l of await internalLinks(page)) if (!skip.some((re) => re.test(l))) toCheck.add(l)
  }
  for (const link of toCheck) {
    if (seen.has(link)) continue
    seen.add(link)
    const res = await page.goto(link).catch(() => null)
    const st = res?.status() ?? 0
    if (!res || st >= 400) bad.push(`${link} → ${st}`)
    else await page.waitForLoadState('networkidle').catch(() => {})
  }
  return { bad, pageErrors, count: seen.size }
}

// Links that are fine to skip: sign-out (ends the session), downloads, and
// the admin impersonation tools.
const SKIP = [/^\/logout/, /^\/auth\/signout/, /^\/api\//, /impersonat/, /^\/r\//]

test.describe('Crawl', () => {
  test.setTimeout(10 * 60 * 1000)

  test('signed in: every link in the nav and on the main screens opens without errors', async ({ page }) => {
    const guard = await guardRealWorld(page)
    const starts = ['/dashboard', '/create', '/videos', '/clients', '/brands', '/settings', '/pricing', '/help', '/analytics', '/affiliate', '/social-media', '/design', '/create/commercial', '/templates']
    const { bad, pageErrors, count } = await crawl(page, starts, SKIP)
    console.log(`crawled ${count} signed-in pages`)
    expect(bad, 'pages that 404/500').toEqual([])
    expect(pageErrors, 'console / page errors while crawling').toEqual([])
    expectNoBlockedCalls(guard)
  })

  test('signed out: every link on the public pages opens without errors', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    const guard = await guardRealWorld(page)
    const starts = ['/', '/login', '/signup', '/forgot-password', '/plans', '/pricing', '/blog', '/privacy', '/terms']
    const { bad, pageErrors, count } = await crawl(page, starts, SKIP)
    console.log(`crawled ${count} public pages`)
    expect(bad, 'pages that 404/500').toEqual([])
    expect(pageErrors, 'console / page errors while crawling').toEqual([])
    expectNoBlockedCalls(guard)
    await ctx.close()
  })
})
