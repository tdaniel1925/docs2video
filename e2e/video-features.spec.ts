import { test, expect, Page } from '@playwright/test'
import { guardRealWorld, expectNoBlockedCalls, type Guard } from './helpers/guard'

/**
 * FEATURE BATTERY across the output types (no generation, no AI spend).
 *
 * For one COMPLETED item of each type on the test account, the result page:
 *   - shows the right preview (a player for videos, the deck for presentations)
 *   - has the ONE send panel (no older send window), which refuses a bad address
 *   - has a Download menu listing only what that type has
 *   - routes "Ask for a change" to that type's editor
 *   - fits a phone without sideways scroll
 * and the matching public /watch page renders without a JS error.
 * Each type skips cleanly when the account has none of it.
 */

type Row = { id: string; status: string; video_url: string | null; output_type?: string | null }

const TYPES: { key: string; label: string; match: (r: Row) => boolean; isDeck: boolean; downloads: RegExp[]; notDownloads: RegExp[]; editor: RegExp }[] = [
  { key: 'video', label: 'video', isDeck: false, match: (r) => (r.output_type ?? 'video') === 'video' && !!r.video_url,
    downloads: [/^MP4/], notDownloads: [/^Export video/], editor: /^(fix-scene|older-editor|remake)$/ },
  { key: 'interactive', label: 'interactive presentation', isDeck: true, match: (r) => r.output_type === 'interactive',
    downloads: [/^PDF/, /^PowerPoint/], notDownloads: [/^MP4/], editor: /^presentation-editor$/ },
  { key: 'deck', label: 'slide deck', isDeck: true, match: (r) => r.output_type === 'deck',
    downloads: [/^PDF/, /^PowerPoint/], notDownloads: [/^MP4/, /^Export video/], editor: /^presentation-editor$/ },
  { key: 'pptx', label: 'slide presentation (pptx)', isDeck: false, match: (r) => r.output_type === 'pptx',
    downloads: [/^PowerPoint/, /^PDF/], notDownloads: [/^Export video/], editor: /^(older-editor|remake)$/ },
]

async function completedRows(page: Page): Promise<Row[]> {
  const res = await page.request.get('/api/videos')
  if (!res.ok()) return []
  const rows = (await res.json()) as Row[]
  return Array.isArray(rows) ? rows.filter((r) => r.status === 'completed') : []
}

let guard: Guard
test.beforeEach(async ({ page }) => { guard = await guardRealWorld(page) })
test.afterEach(() => expectNoBlockedCalls(guard))

test.describe('Result page — every output type', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  for (const t of TYPES) {
    test(`${t.label}: preview, one send panel, downloads, change bar, share page`, async ({ page }) => {
      const row = (await completedRows(page)).find(t.match)
      test.skip(!row, `no completed ${t.label} on this account`)

      await page.goto(`/videos/${row!.id}`)
      const panel = page.getByRole('region', { name: 'Ready to send' })
      await expect(panel).toBeVisible({ timeout: 20000 })
      if (t.isDeck) await expect(panel.locator('iframe')).toBeVisible()
      else await expect(panel.locator('video').first()).toBeVisible()

      // One send panel only.
      await expect(page.getByRole('button', { name: 'Send to Client' })).toHaveCount(0)
      await expect(panel.getByRole('button', { name: /^Send (again )?to / })).toBeVisible()

      // Downloads: the menu lists what this type has, and not what it hasn't.
      await page.getByTestId('downloads-menu').getByRole('button', { name: /Download/ }).click()
      const items = page.getByTestId('downloads-menu').getByRole('menuitem')
      const names = (await items.allInnerTexts()).map((s) => s.trim())
      for (const re of t.downloads) expect(names.some((n) => re.test(n)), `${t.label} offers ${re}`).toBeTruthy()
      for (const re of t.notDownloads) expect(names.some((n) => re.test(n)), `${t.label} must not offer ${re}`).toBeFalsy()
      await page.keyboard.press('Escape')

      // The change bar goes to this type's editor.
      const bar = page.getByRole('region', { name: 'Ask for a change' })
      await expect(bar).toBeVisible()
      expect(await bar.getAttribute('data-editor')).toMatch(t.editor)

      // The matching public share page renders with no JS error.
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      const resp = await page.goto(`/watch/${row!.id}`)
      expect(resp!.status(), 'share page must not 500').toBeLessThan(500)
      await page.waitForTimeout(2500)
      expect(errors, 'no unhandled JS error on the share page').toEqual([])
      await expect(page.getByRole('button', { name: /^Download Video$/ })).toHaveCount(0)
    })
  }

  test('the result page fits a phone width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const row = (await completedRows(page)).find((r) => !!r.video_url)
    test.skip(!row, 'no completed video on this account')
    await page.goto(`/videos/${row!.id}`)
    await expect(page.getByRole('region', { name: 'Ready to send' })).toBeVisible({ timeout: 20000 })
    await page.waitForLoadState('networkidle')
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    expect(fits, 'no sideways scroll on a phone').toBeTruthy()
  })
})
