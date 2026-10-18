import { test, expect, type Page } from '@playwright/test'
import { FAKE_ID, draftRow, mockDraft, quote, storyDraft } from './helpers/fixtures'
import { SHOTS, collectConsoleErrors, expectNoBlockedCalls, expectNoSidewaysScroll, guardRealWorld, type Guard } from './helpers/guard'

/*
 * The create flow's frame (the owner-approved sketch, 2026-10-09): three
 * steps in the focus header, ONE centred column (no step list, no "so far"
 * panel), and one bar fixed to the bottom of every step with the price and
 * the one main button. Checked at 1440 and 375 wide: no sideways scroll,
 * nothing hidden behind the bar, and on a phone the step words hide (dots
 * only) and the bar's buttons fill the width. Saves a screenshot of each.
 */

type Screen = { key: string; path: string; step: number | null; main?: string; ready: (p: Page) => Promise<void> }

async function finishedVideoId(page: Page): Promise<string | null> {
  const res = await page.request.get('/api/videos')
  if (!res.ok()) return null
  const rows = (await res.json()) as { id: string; status: string; output_type?: string | null; video_url?: string | null }[]
  const done = rows.filter((r) => r.status === 'completed')
  return (done.find((r) => (r.output_type ?? 'video') === 'video' && r.video_url) ?? done[0])?.id ?? null
}

const SCREENS: Screen[] = [
  { key: '0-home', path: '/dashboard', step: null, ready: async (p) => { await expect(p.getByRole('heading', { level: 1 })).toBeVisible() } },
  { key: '1-your-content', path: '/create', step: 1, main: 'Read it →', ready: async (p) => { await expect(p.getByRole('heading', { name: 'Add your document.' })).toBeVisible() } },
  { key: '2-the-story', path: `/create/script?id=${FAKE_ID}`, step: 2, main: 'Pick a look →', ready: async (p) => { await expect(p.getByRole('button', { name: 'Edit scene 2' })).toBeVisible() } },
  { key: '3-the-look', path: `/create/theme?id=${FAKE_ID}`, step: 3, main: 'Make it', ready: async (p) => { await expect(p.getByRole('button', { name: 'Make it', exact: true })).toBeEnabled() } },
  { key: '3b-brand', path: `/create/brand?id=${FAKE_ID}`, step: 3, ready: async (p) => { await expect(p.getByRole('heading', { name: 'Your brand', exact: true })).toBeVisible() } },
]

const STEP_WORDS = ['Your content', 'The story', 'The look']

let guard: Guard
let consoleErrors: string[]

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page)
  await page.addInitScript(() => { try { localStorage.setItem('cookie_consent', 'accepted') } catch { /* fine */ } })
  await mockDraft(page, draftRow(storyDraft({ brandId: null })))
  await page.route('**/api/price-quote**', (r) => r.fulfill({ json: quote() }))
  await page.route('**/api/preview-first-scene**', (r) => r.request().method() === 'GET' ? r.fulfill({ json: { remainingToday: 3 } }) : r.fallback())
  await page.route('**/api/clients**', (r) => r.fulfill({ json: { clients: [{ id: 'c1', name: 'Jordan Lee', email: 'jordan@example.com' }, { id: 'c2', name: 'Priya Shah', email: null }] } }))
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors').toEqual([])
})

for (const width of [1440, 375]) {
  test.describe(`${width} wide`, () => {
    test.use({ viewport: { width, height: width > 500 ? 900 : 812 } })

    for (const s of SCREENS) {
      test(`${s.key}: three steps, one column, the bar, no sideways scroll, screenshot`, async ({ page }) => {
        await page.goto(s.path)
        await s.ready(page)
        await page.waitForLoadState('networkidle')
        await expectNoSidewaysScroll(page, `${s.path} @${width}`)

        // No step list on the left and no "so far" panel, anywhere.
        await expect(page.getByRole('navigation', { name: 'Steps' })).toHaveCount(0)
        await expect(page.getByRole('region', { name: /so far/ })).toHaveCount(0)

        const steps = page.getByRole('list', { name: 'Progress' })
        if (s.step === null) {
          await expect(steps).toHaveCount(0)
        } else {
          const items = steps.getByRole('listitem')
          await expect(items).toHaveCount(3)
          for (let i = 0; i < 3; i++) {
            const item = items.nth(i)
            if (i + 1 === s.step) await expect(item).toHaveAttribute('aria-current', 'step')
            else await expect(item).not.toHaveAttribute('aria-current', 'step')
            const word = item.getByText(STEP_WORDS[i], { exact: true })
            // Phone: dots, plus the name of the step you're on (audit 2026-10-09).
            if (width < 500 && i + 1 !== s.step) await expect(word).toBeHidden()
            else await expect(word).toBeVisible()
          }
        }

        if (s.main) {
          // One bar at the bottom, holding the one main button.
          const bars = page.locator('.cf-bar')
          await expect(bars).toHaveCount(1)
          const main = bars.getByRole('button', { name: s.main, exact: true })
          await expect(main).toBeVisible()
          const bar = (await bars.boundingBox())!
          expect(Math.round(bar.y + bar.height), 'the bar sits on the bottom edge').toBeGreaterThanOrEqual((width > 500 ? 900 : 812) - 1)
          // The page is one centred column, no wider than 1080.
          const col = (await page.locator('.cf-page').boundingBox())!
          expect(col.width).toBeLessThanOrEqual(1081)
          if (width > 500) expect(Math.abs(col.x - (width - col.x - col.width)), 'centred').toBeLessThan(40)
          if (width < 500) {
            const b = (await main.boundingBox())!
            expect(b.width, 'the main button fills the bar on a phone').toBeGreaterThan(140)
          }
          // Nothing hides behind the bar: scrolled to the bottom, the last
          // thing on the page ends above it.
          await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
          await page.waitForTimeout(200)
          const lastBottom = await page.evaluate(() => {
            const kids = [...document.querySelectorAll('.cf-page > *')].filter((el) => !el.classList.contains('cf-bar'))
            const last = kids[kids.length - 1] as HTMLElement
            return last.getBoundingClientRect().bottom
          })
          const barTop = await page.evaluate(() => document.querySelector('.cf-bar')!.getBoundingClientRect().top)
          expect(lastBottom, 'the end of the page is hidden behind the bar').toBeLessThanOrEqual(barTop + 1)
        }
        await page.screenshot({ path: `${SHOTS}/${s.key}-${width}.png`, fullPage: true })
      })
    }

    test('4-ready-to-send: no sideways scroll, screenshot', async ({ page }) => {
      const id = await finishedVideoId(page)
      test.skip(!id, 'no finished video on the test account')
      await page.goto(`/videos/${id}`)
      await expect(page.getByRole('region', { name: 'Ready to send' })).toBeVisible({ timeout: 20000 })
      await page.waitForLoadState('networkidle')
      await expectNoSidewaysScroll(page, `/videos/[id] @${width}`)
      await page.screenshot({ path: `${SHOTS}/4-ready-to-send-${width}.png`, fullPage: true })
    })

    test('the making screen: all three steps done, the real stage, no bar', async ({ page }) => {
      // The project's row, as the render service writes it mid-way.
      await page.route('**/rest/v1/videos?**', (r) => r.fulfill({ json: {
        status: 'generating_slides', progress_pct: 45, progress_detail: 'Drawing scene 3 of 6', error_message: null,
        output_type: 'video', video_url: null, preview_thumbs: [], total_scenes: 6, draft_data: storyDraft(), deducted_cost: 1000,
      } }))
      await page.goto(`/create/generating?id=${FAKE_ID}`)
      await expect(page.getByRole('heading', { name: 'Making your video.' })).toBeVisible()
      const items = page.getByRole('list', { name: 'Progress' }).getByRole('listitem')
      await expect(items).toHaveCount(3)
      for (let i = 0; i < 3; i++) await expect(items.nth(i)).not.toHaveAttribute('aria-current', 'step')
      await expect(page.locator('.cf-bar')).toHaveCount(0)
      // The real stage and the render service's own words — no invented number.
      await expect(page.getByRole('list', { name: 'Making your video' })).toContainText('Drawing scene 3 of 6')
      await expect(page.getByText('About 65% done', { exact: false })).toBeVisible()
      await expect(page.getByText('we’ll email you when it’s ready', { exact: false })).toBeVisible()
      await expectNoSidewaysScroll(page, `/create/generating @${width}`)
      await page.screenshot({ path: `${SHOTS}/4-waiting-${width}.png`, fullPage: true })
    })
  })
}
