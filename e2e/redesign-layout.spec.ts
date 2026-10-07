import { test, expect, type Page } from '@playwright/test'
import { FAKE_ID, draftRow, mockDraft, quote, storyDraft } from './helpers/fixtures'
import { SHOTS, collectConsoleErrors, expectNoBlockedCalls, expectNoSidewaysScroll, guardRealWorld, type Guard } from './helpers/guard'

/*
 * The step rail (desktop) / step bar (phone), and "no sideways scroll" on
 * every redesigned screen at 1440 and 375 wide. Also saves a full-page
 * screenshot of each screen at both widths (E2E_SHOTS_DIR).
 */

type Screen = { key: string; path: string; step: number | null; ready: (p: Page) => Promise<void> }

async function finishedVideoId(page: Page): Promise<string | null> {
  const res = await page.request.get('/api/videos')
  if (!res.ok()) return null
  const rows = (await res.json()) as { id: string; status: string; output_type?: string | null; video_url?: string | null }[]
  const done = rows.filter((r) => r.status === 'completed')
  return (done.find((r) => (r.output_type ?? 'video') === 'video' && r.video_url) ?? done[0])?.id ?? null
}

const SCREENS: Screen[] = [
  { key: '0-home', path: '/dashboard', step: null, ready: async (p) => { await expect(p.getByRole('heading', { level: 1 })).toBeVisible() } },
  { key: '1-what-its-about', path: '/create', step: 1, ready: async (p) => { await expect(p.getByRole('heading', { name: 'What’s this about?' })).toBeVisible() } },
  { key: '2-check-the-story', path: `/create/script?id=${FAKE_ID}`, step: 2, ready: async (p) => { await expect(p.getByLabel('Scene 2 title')).toBeVisible() } },
  { key: '3-make-it-yours', path: `/create/theme?id=${FAKE_ID}`, step: 3, ready: async (p) => { await expect(p.getByRole('button', { name: /Make it — / })).toBeVisible() } },
  { key: '3b-brand', path: `/create/brand?id=${FAKE_ID}`, step: 3, ready: async (p) => { await expect(p.getByRole('heading', { name: 'Your brand', exact: true })).toBeVisible() } },
]

let guard: Guard
let consoleErrors: string[]

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page)
  await mockDraft(page, draftRow(storyDraft({ brandId: null })))
  await page.route('**/api/price-quote**', (r) => r.fulfill({ json: quote() }))
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
      test(`${s.key}: rail, no sideways scroll, screenshot`, async ({ page }) => {
        await page.goto(s.path)
        await s.ready(page)
        await page.waitForLoadState('networkidle')
        await expectNoSidewaysScroll(page, `${s.path} @${width}`)

        const rail = page.getByRole('navigation', { name: 'Steps' })
        if (s.step === null) {
          await expect(rail).toHaveCount(0)
        } else {
          await expect(rail).toBeVisible()
          // (by class: on a phone the list is hidden behind the one-line bar)
          const items = rail.locator('li.steps-rail-item')
          const names = ['What it’s about', 'The story', 'Make it yours', 'Send it']
          if (width < 500) await expect(rail).toContainText(`Step ${s.step} of 4 · ${names[s.step - 1]}`)
          await expect(items).toHaveCount(4)
          await expect(items.nth(0)).toContainText('What it’s about')
          await expect(items.nth(1)).toContainText('Check the story')
          await expect(items.nth(2)).toContainText('Make it yours')
          await expect(items.nth(3)).toContainText('Send it')
          for (let i = 0; i < 4; i++) {
            const item = items.nth(i)
            if (i + 1 === s.step) await expect(item).toHaveAttribute('aria-current', 'step')
            else await expect(item).not.toHaveAttribute('aria-current', 'step')
            // Steps already done show a tick; later ones show their number.
            await expect(item.locator('.steps-rail-dot')).toHaveText(i + 1 < s.step ? '✓' : String(i + 1))
          }
          // The right-hand part of the workspace: every choice so far.
          if (s.key !== '3b-brand') await expect(page.getByRole('region', { name: 'Your video so far' })).toBeVisible()
          const box = await rail.boundingBox()
          expect(box!.width, 'the rail fits on screen').toBeLessThanOrEqual(width)
          if (width < 500) {
            // On a phone the rail is a compact bar above the page, not a column beside it.
            expect(box!.height).toBeLessThan(200)
          } else {
            const main = await page.locator('.steps-main').boundingBox()
            expect(box!.x + box!.width, 'the rail sits beside the page on desktop').toBeLessThanOrEqual(main!.x + 1)
          }
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

    test('the "Send it" waiting screen keeps the rail and "Your video so far"', async ({ page }) => {
      // The project's row, as the render service writes it mid-way.
      await page.route('**/rest/v1/videos?**', (r) => r.fulfill({ json: {
        status: 'generating_slides', progress_pct: 45, progress_detail: 'Drawing scene 3 of 6', error_message: null,
        output_type: 'video', video_url: null, preview_thumbs: [], total_scenes: 6, draft_data: storyDraft(), deducted_cost: 1000,
      } }))
      await page.goto(`/create/generating?id=${FAKE_ID}`)
      const rail = page.getByRole('navigation', { name: 'Steps' })
      await expect(rail).toBeVisible()
      await expect(rail.locator('li.steps-rail-item').nth(3)).toHaveAttribute('aria-current', 'step')
      if (width < 500) await expect(rail).toContainText('Step 4 of 4 · Send it')
      await expect(page.getByRole('region', { name: 'Your video so far' })).toBeVisible()
      // The real stage and the render service's own words — no invented number.
      await expect(page.getByRole('list', { name: 'Making your video' })).toContainText('Drawing scene 3 of 6')
      await expect(page.getByText('About 65% done', { exact: false })).toBeVisible()
      await expect(page.getByText('we’ll email you when it’s ready', { exact: false })).toBeVisible()
      await expectNoSidewaysScroll(page, `/create/generating @${width}`)
      await page.screenshot({ path: `${SHOTS}/4-waiting-${width}.png`, fullPage: true })
    })
  })
}
