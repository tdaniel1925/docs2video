import { test, expect, type Page } from '@playwright/test'
import { NO_AUTH } from './helpers/auth'
import { PLANS, SELLABLE_PLAN_TIERS } from '../app/_lib/pricing'

// The marketing front page (approved design "Home-after", 2026-10-14).
// Public: start signed out.
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
    await expect(h1).toContainText('Illustration in')
    await expect(h1).toContainText('Short video out')
    await expect(page.locator('.hp-hero a[href="/signup"]')).toBeVisible()
    await expect(page.locator('.hp-hero a[href="#share"]')).toBeVisible()
    // The finished-video cover is the one picture loaded eagerly.
    await expect(page.locator('.hp-cover img')).toHaveAttribute('src', /kit-animated-slides-cover/)
    await expect(page.locator('.hp-hero')).toContainText('Watched 92%')
    await expect(page.locator('.hp-hero')).toContainText('The Riveras opened your video.')
    expect(problems).toEqual([])
  })

  test('header links point at real sections and pages', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const nav = page.locator('.hp-nav')
    for (const id of ['how', 'share', 'industries', 'pricing']) {
      await expect(nav.locator(`a[href="#${id}"]`)).toBeVisible()
      await expect(page.locator(`#${id}`)).toHaveCount(1)
    }
    await expect(page.locator('.hp-header a[href="/login"]')).toBeVisible()
    await expect(page.locator('.hp-header a[href="/signup"]')).toBeVisible()
    await nav.locator('a[href="#pricing"]').click()
    await expect(page).toHaveURL(/#pricing$/)
  })

  test('phone menu opens and lists the sections', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/')
    const btn = page.locator('.hp-menu-btn')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#hp-menu-panel a[href="#how"]')).toBeVisible()
    await expect(page.locator('#hp-menu-panel a[href="/blog"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#hp-menu-panel')).toHaveCount(0)
  })

  test('three steps, two ways to share, and the four current looks', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#how .hp-step')).toHaveCount(3)
    await expect(page.locator('.hp-two-item')).toHaveCount(2)
    await expect(page.locator('.hp-two-item').nth(1)).toContainText('PDF or PowerPoint')
    await expect(page.locator('#looks figcaption')).toHaveText(['Animated slides', 'Editorial', 'Bright', 'Drawn slides'])
    // Retired looks never come back on the front page.
    const text = (await page.locator('main').textContent()) ?? ''
    for (const old of ['Aurora', 'Cinematic', 'Infographic']) expect(text, old).not.toContain(old)
  })

  test('industry block links to the industry pages and shows real fine print', async ({ page }) => {
    await page.goto('/')
    for (const href of ['/for/insurance', '/for/financial-services', '/for/mortgage', '/for/real-estate', '/for/legal']) {
      await expect(page.locator(`#industries .hp-chip[href="${href}"]`)).toBeVisible()
    }
    await expect(page.locator('#industries')).toContainText('Non-guaranteed values are subject to change')
    await expect(page.locator('#industries')).toContainText('Schedule a review of your coverage today.')
  })

  test('pricing shows the plans on sale at the prices in pricing.ts', async ({ page }) => {
    await page.goto('/')
    const cards = page.locator('#pricing .hp-tier')
    const onSale = PLANS.filter((p) => (SELLABLE_PLAN_TIERS as readonly string[]).includes(p.tier))
    await expect(cards).toHaveCount(1 + onSale.length)
    await expect(cards.nth(0)).toContainText('$0')
    for (const [i, p] of onSale.entries()) {
      await expect(cards.nth(i + 1)).toContainText(p.label)
      await expect(cards.nth(i + 1)).toContainText(`$${p.monthlyPrice / 100}`)
      await expect(cards.nth(i + 1)).toContainText(`About ${p.approxStandardVideos} videos a month`)
    }
    // Starter ($29) is retired and must not be offered.
    await expect(page.locator('#pricing')).not.toContainText('$29')
    await expect(page.locator('#pricing .hp-tier-pop')).toContainText('Pro')
    await expect(page.locator('#pricing a[href="/pricing"]')).toBeVisible()
  })

  test('claims removed in the audit stay removed', async ({ page }) => {
    await page.goto('/')
    const text = (await page.locator('main').textContent())?.toLowerCase() ?? ''
    for (const banned of ['chatbot', 'password-protected', 'print-ready', 'soc 2', '$5 each', 'extra videos', 'most popular']) {
      expect(text, banned).not.toContain(banned)
    }
  })

  test('four questions, no comparison table', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#faq .hp-faq-item')).toHaveCount(4)
    await expect(page.locator('#compare')).toHaveCount(0)
    await expect(page.locator('main table')).toHaveCount(0)
  })

  test('cookie notice does not cover the hero buttons on first view', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.removeItem('cookie_consent') } catch { /* fine */ } })
    for (const [width, height] of [[1440, 900], [375, 812], [375, 667]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      const notice = page.locator('.hp-cookie')
      await expect(notice).toBeVisible()
      const n = (await notice.boundingBox())!
      for (const a of await page.locator('.hp-hero a').all()) {
        const b = (await a.boundingBox())!
        const overlaps = b.x < n.x + n.width && n.x < b.x + b.width && b.y < n.y + n.height && n.y < b.y + b.height
        expect(overlaps, `${width}x${height}: ${await a.textContent()}`).toBe(false)
      }
    }
  })

  test('footer keeps the links to every public page', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('.hp-footer')
    for (const href of ['/pricing', '/signup', '/login', '/blog', '/contact', '/terms', '/privacy', '/cookies',
      '/for/insurance', '/for/financial-services', '/for/real-estate', '/for/mortgage', '/for/healthcare', '/for/legal',
      '/for/consulting', '/for/education']) {
      await expect(footer.locator(`a[href="${href}"]`), href).toHaveCount(1)
    }
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
    // The shared header no longer points at the removed comparison table.
    await expect(page.locator('.mk-header a[href="/#compare"]')).toHaveCount(0)
    expect(problems).toEqual([])
  })
})
