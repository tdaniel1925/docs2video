import { test, expect } from '@playwright/test'

/*
 * VIDEOS ONLY + DARK BY DEFAULT (owner decisions 2026-10-09).
 *  - Old addresses of the slide-deck and graphics makers go Home on
 *    Docs2Video (the Text2Art library goes to the Library's older items).
 *  - A browser call that would START a deck or graphic is refused in plain
 *    words (410) before anything runs — nothing is generated or charged.
 *  - Text2Art (same server, other host) still opens its design screens.
 *  - Nothing saved = Dark; a saved Light is respected; the share page stays light.
 */

test.describe('videos only', () => {
  for (const [from, to] of [
    ['/design', /\/dashboard$/],
    ['/design/results', /\/dashboard$/],
    ['/flyers', /\/dashboard$/],
    ['/flyer', /\/dashboard$/],
    ['/deck-builder', /\/dashboard$/],
    ['/library', /\/videos\?type=older$/],
    ['/help/flyers', /\/help$/],
  ] as const) {
    test(`${from} redirects`, async ({ page }) => {
      await page.goto(from)
      await expect(page).toHaveURL(to)
    })
  }

  test('starting a graphic or a deck is refused in plain words', async ({ page }) => {
    for (const api of ['/api/flyer-art', '/api/flyer-deck', '/api/deck-builder', '/api/generate-deck']) {
      const res = await page.request.post(api, { data: {} })
      expect(res.status(), api).toBe(410)
      expect((await res.json()).error, api).toMatch(/can’t be made here any more/)
    }
    // Reading an old graphic's file is still allowed (404 for a made-up id, never 410).
    const file = await page.request.get('/api/flyer-file/00000000-0000-4000-8000-000000000000', { maxRedirects: 0 })
    expect(file.status()).not.toBe(410)
  })

  test('Text2Art still opens its design screen and library', async ({ page, baseURL }) => {
    // Same server, the other storefront: only our own requests say "text2art.app".
    const origin = new URL(baseURL!).origin
    await page.route((url) => url.origin === origin, (route) =>
      route.fallback({ headers: { ...route.request().headers(), 'x-forwarded-host': 'text2art.app' } }))
    await page.goto('/design')
    await expect(page).toHaveURL(/\/design$/)
    await page.goto('/library')
    await expect(page).toHaveURL(/\/library$/)
  })
})

test.describe('dark by default', () => {
  test('a fresh visit with nothing saved is dark', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.removeItem('d2v.theme') } catch { /* blocked */ } })
    await page.emulateMedia({ colorScheme: 'light' }) // even on a light computer
    await page.goto('/dashboard')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(bg).toBe('rgb(15, 22, 32)')
  })

  test('a saved Light is respected', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('d2v.theme', 'light') } catch { /* blocked */ } })
    await page.goto('/dashboard')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('admin follows dark now; the share page stays light', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.removeItem('d2v.theme') } catch { /* blocked */ } })
    await page.goto('/admin')
    if (new URL(page.url()).pathname === '/admin') {
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(15, 22, 32)')
    }
    const res = await page.request.get('/api/videos')
    const rows = res.ok() ? ((await res.json()) as { id: string; status: string }[]) : []
    const done = Array.isArray(rows) ? rows.find((r) => r.status === 'completed') : undefined
    test.skip(!done, 'no finished video on the test account')
    await page.goto(`/watch/${done!.id}`)
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(15, 22, 32)')
  })
})
