import { test, expect, type Page } from '@playwright/test'
import { SHOTS, collectConsoleErrors, expectNoBlockedCalls, expectNoSidewaysScroll, guardRealWorld, type Guard } from './helpers/guard'

/*
 * THE TOP BAR and the HOW TO USE pop-up (overhaul phase 2, step 4).
 *  - Docs2Video: + New · Library · Clients · Brands, the logo goes Home, a
 *    gold credit chip, and the account menu behind your initial.
 *  - "How to use" opens the steps for the screen you're on; focus starts
 *    inside; Escape closes it and focus goes back to the button.
 *  - Text2Art (same server, other host) keeps its own bar.
 * Nothing here spends credits: the top-up window is opened and closed only.
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

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

test.describe('1440 wide', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the bar is exactly + New, Library, Clients, Brands — and the logo goes Home', async ({ page }) => {
    await page.goto('/videos')
    // + New wears a plus icon beside "New" (round A's one icon set); its
    // name is still "+ New" (names.ts), which is what a screen reader says.
    const names = await mainNav(page).getByRole('link').evaluateAll((ls) => ls.map((l) => l.getAttribute('aria-label') || (l.textContent || '').trim()))
    expect(names).toEqual(['+ New', 'Library', 'Clients', 'Brands'])
    await expect(page.getByRole('banner').getByRole('link', { name: 'Dashboard' })).toHaveCount(0)
    await expect(mainNav(page).getByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page')

    await mainNav(page).getByRole('link', { name: 'Brands' }).click()
    await expect(page).toHaveURL(/\/brands$/)
    await expect(mainNav(page).getByRole('link', { name: 'Brands' })).toHaveAttribute('aria-current', 'page')

    await mainNav(page).getByRole('link', { name: 'Clients' }).click()
    await expect(page).toHaveURL(/\/clients$/)

    await page.getByRole('link', { name: 'Docs2Video — Home' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await mainNav(page).getByRole('link', { name: '+ New' }).click()
    await expect(page).toHaveURL(/\/create$/)
    await expect(page.getByRole('heading', { name: 'What’s this about?' })).toBeVisible()
  })

  test('the credit chip is gold (amber when low) and opens the top-up window', async ({ page }) => {
    await page.goto('/dashboard')
    const chip = page.getByRole('button', { name: /credits(, running low)?\. Top up$/ })
    await expect(chip).toBeVisible()
    await expect(chip).toContainText('+ Top Up')
    const { color, gold, amber, level } = await chip.evaluate((el) => {
      const probe = (v: string) => { const d = document.createElement('i'); d.style.color = `var(${v})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c }
      return { color: getComputedStyle(el).color, gold: probe('--gold'), amber: probe('--warning-text'), level: el.getAttribute('data-level') }
    })
    expect(color).toBe(level === 'low' ? amber : gold)
    await chip.click()
    await expect(page.getByRole('heading', { name: 'Buy credits' })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('heading', { name: 'Buy credits' })).toHaveCount(0)
  })

  test('the account menu keeps plan, the account shortcuts, Help Center and Sign out — not Brands', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Your account', exact: true }).click()
    const menu = page.locator('.kit-menu')
    await expect(menu).toBeVisible()
    await expect(menu.locator('.kit-menu-plan')).not.toBeEmpty()
    for (const label of ['Settings', 'Billing & credits', 'Analytics', 'AI Social', 'Affiliate', 'Help Center']) {
      await expect(menu.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible()
    }
    await expect(menu.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Brands' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)

    // A click elsewhere closes it too.
    await page.getByRole('button', { name: 'Your account', exact: true }).click()
    await expect(menu).toBeVisible()
    await page.getByRole('heading', { level: 1 }).click()
    await expect(menu).toHaveCount(0)

    await page.getByRole('button', { name: 'Your account', exact: true }).click()
    await menu.getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings/)
  })

  for (const [path, title, firstWords] of [
    ['/dashboard', 'Home', /Create/],
    ['/videos', 'Library', /Use the tabs/],
    ['/create', 'Step 1 — What it’s about', /Who is it for\?/],
    ['/brands', 'Brands', /Company/],
    ['/clients', 'Clients', /Add a client/],
    ['/settings', 'Settings', /Profile/],
  ] as const) {
    test(`How to use on ${path} shows that screen's steps`, async ({ page }) => {
      await page.goto(path)
      const button = page.getByRole('button', { name: 'How to use', exact: true })
      await button.click()
      const dialog = page.getByRole('dialog', { name: `How to use: ${title}` })
      await expect(dialog).toBeVisible()
      // Focus starts inside the pop-up.
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
      const steps = dialog.getByRole('listitem')
      expect(await steps.count()).toBeGreaterThanOrEqual(3)
      await expect(steps.first()).toContainText(firstWords)
      await expect(dialog.getByRole('link', { name: 'More in the Help Center →' })).toHaveAttribute('href', /^\/help/)
      // No video is recorded yet — nothing in its place.
      await expect(dialog.locator('video')).toHaveCount(0)
      if (path === '/dashboard') await page.screenshot({ path: `${SHOTS}/how-to-use-home-1440.png` })
      // Escape closes it and focus goes back to the button.
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(button).toBeFocused()
    })
  }

  test('How to use: the × and the Help Center link work', async ({ page }) => {
    await page.goto('/videos')
    await page.getByRole('button', { name: 'How to use', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: 'How to use', exact: true }).click()
    await dialog.getByRole('link', { name: 'More in the Help Center →' }).click()
    await expect(page).toHaveURL(/\/help/)
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('a screen without its own guide shows how to get around', async ({ page }) => {
    await page.goto('/analytics')
    await page.getByRole('button', { name: 'How to use', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'How to use: Getting around' })).toBeVisible()
  })
})

test.describe('375 wide (phone)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('the ☰ menu has the four words and How to use; nothing scrolls sideways', async ({ page }) => {
    await page.goto('/dashboard')
    await expectNoSidewaysScroll(page, '/dashboard @375')
    await expect(page.getByRole('button', { name: /credits(, running low)?\. Top up$/ })).toBeVisible()
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    const menu = page.getByRole('navigation', { name: 'Phone menu' })
    await expect(menu.getByRole('link')).toHaveText(['+ New', 'Library', 'Clients', 'Brands'])
    await page.screenshot({ path: `${SHOTS}/top-bar-phone-menu-375.png` })
    await menu.getByRole('button', { name: 'How to use this screen' }).click()
    const dialog = page.getByRole('dialog', { name: 'How to use: Home' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(375)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})

test.describe('Text2Art keeps its own bar', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Designs · My Library · Brands, and no How to use', async ({ page, baseURL }) => {
    // Same server, the other storefront: only our own requests say "text2art.app".
    const origin = new URL(baseURL!).origin
    await page.route((url) => url.origin === origin, (route) =>
      route.fallback({ headers: { ...route.request().headers(), 'x-forwarded-host': 'text2art.app' } }))
    await page.goto('/library')
    const nav = page.locator('nav.app-nav')
    await expect(nav.getByRole('link')).toHaveText(['Designs', 'My Library', 'Brands'])
    await expect(page.getByRole('button', { name: 'How to use', exact: true })).toHaveCount(0)
    await expect(page.locator('.kit-credit')).toHaveCount(0)
    consoleErrors.length = 0 // Text2Art's own screens are not under test here
  })
})
