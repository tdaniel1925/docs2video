import { test, expect, type Page } from '@playwright/test'
import { NO_AUTH } from './helpers/auth'
import { PLANS, SELLABLE_PLAN_TIERS } from '../app/_lib/pricing'

// The marketing home page. Public: start signed out.
test.use({ storageState: NO_AUTH })

// Collect console errors and failed same-origin requests for a page.
function watch(page: Page, base: string) {
  const problems: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('response', (r) => {
    if (r.url().startsWith(base) && r.status() >= 400) problems.push(`${r.status()} ${new URL(r.url()).pathname}`)
  })
  return problems
}

test.describe('Marketing home page', () => {
  test('hero says what it does and has the two calls to action', async ({ page, baseURL }) => {
    const problems = watch(page, baseURL!)
    await page.goto('/')
    const h1 = page.locator('h1')
    await expect(h1).toHaveCount(1)
    await expect(h1).toContainText('Long document in')
    await expect(h1).toContainText('Short video out')
    await expect(page.locator('.mk-hero a[href="/signup"]')).toBeVisible()
    await expect(page.locator('.mk-hero a[href="#share"]')).toBeVisible()
    expect(problems).toEqual([])
  })

  test('header links point at real sections and pages', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const nav = page.locator('.mk-nav')
    for (const id of ['how', 'share', 'industries', 'pricing', 'compare']) {
      await expect(nav.locator(`a[href="/#${id}"]`)).toBeVisible()
      await expect(page.locator(`#${id}`)).toHaveCount(1)
    }
    await expect(page.locator('.mk-header a[href="/login"]')).toBeVisible()
    await expect(page.locator('.mk-header a[href="/signup"]')).toBeVisible()
    await nav.locator('a[href="/#pricing"]').click()
    await expect(page).toHaveURL(/#pricing$/)
  })

  test('phone menu opens and lists the sections', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    const btn = page.locator('.mk-menu-btn')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#mk-menu-panel a[href="/#how"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#mk-menu-panel')).toHaveCount(0)
  })

  test('three steps and three outputs', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#how .mk-step')).toHaveCount(3)
    await expect(page.locator('.mk-output')).toHaveCount(3)
  })

  test('industry switcher changes the example', async ({ page }) => {
    await page.goto('/')
    const tabs = page.locator('.mk-ind-tab')
    await expect(tabs).toHaveCount(6)
    await expect(tabs.first()).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.mk-ind-copy h3')).toHaveText('Insurance')
    await tabs.filter({ hasText: 'Mortgage' }).click()
    await expect(tabs.filter({ hasText: 'Mortgage' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.mk-ind-copy h3')).toHaveText('Mortgage')
    await expect(page.locator('.mk-ind-copy a[href="/for/mortgage"]')).toBeVisible()
  })

  test('pricing shows the plans on sale at the prices in pricing.ts', async ({ page }) => {
    await page.goto('/')
    const cards = page.locator('#pricing .mk-tier')
    const onSale = PLANS.filter((p) => (SELLABLE_PLAN_TIERS as readonly string[]).includes(p.tier))
    await expect(cards).toHaveCount(1 + onSale.length)
    await expect(cards.nth(0)).toContainText('$0')
    for (const [i, p] of onSale.entries()) {
      await expect(cards.nth(i + 1)).toContainText(p.label)
      await expect(cards.nth(i + 1)).toContainText(`$${p.monthlyPrice / 100}`)
      await expect(cards.nth(i + 1)).toContainText(p.monthlyCredits.toLocaleString('en-US'))
    }
    // Starter ($29) is retired and must not be offered.
    await expect(page.locator('#pricing')).not.toContainText('$29')
    await expect(page.locator('#pricing .mk-tier-pop')).toContainText('Pro')
  })

  test('claims removed in the audit stay removed', async ({ page }) => {
    await page.goto('/')
    const text = (await page.locator('main').textContent())?.toLowerCase() ?? ''
    for (const banned of ['chatbot', 'password-protected', 'print-ready', 'soc 2', '$5 each', 'extra videos']) {
      expect(text, banned).not.toContain(banned)
    }
  })

  test('compare table and FAQ are there', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#compare tbody tr')).toHaveCount(5)
    await expect(page.locator('#faq .mk-faq-item')).toHaveCount(4)
  })

  test('JSON-LD is valid JSON', async ({ page }) => {
    await page.goto('/')
    const blobs = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(blobs.length).toBeGreaterThan(0)
    for (const b of blobs) expect(() => JSON.parse(b)).not.toThrow()
  })

  test('no horizontal scroll at 1440, 1024, 768 and 375', async ({ page }) => {
    for (const width of [1440, 1024, 768, 375]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
      expect(sw, `width ${width}`).toBeLessThanOrEqual(iw)
    }
  })

  test('every link on the page opens without a 404 or 500', async ({ page, request }) => {
    await page.goto('/')
    const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
    const paths = [...new Set(hrefs.filter((h) => h.startsWith('/')).map((h) => h.split('#')[0] || '/'))]
    expect(paths.length).toBeGreaterThan(10)
    for (const p of paths) {
      // No redirect following: a signed-out visitor bounced to /login would
      // otherwise look like a 200 and hide a link to a private page.
      const res = await request.get(p, { maxRedirects: 0 })
      expect(res.status(), p).toBeLessThan(400)
      if (res.status() >= 300) expect(res.headers()['location'] ?? '', `${p} redirects to login`).not.toContain('/login')
    }
    // In-page anchors land on real sections.
    const anchors = [...new Set(hrefs.filter((h) => h.startsWith('#') || h.startsWith('/#')).map((h) => h.split('#')[1]))]
    for (const id of anchors) await expect(page.locator(`[id="${id}"]`), `#${id}`).toHaveCount(1)
  })

  test('industry pages use the same header and link back home', async ({ page, baseURL }) => {
    const problems = watch(page, baseURL!)
    await page.goto('/for/insurance')
    await expect(page.locator('.mk-header a[href="/"]').first()).toBeVisible()
    await expect(page.locator('.mk-footer')).toBeVisible()
    expect(problems).toEqual([])
  })
})
