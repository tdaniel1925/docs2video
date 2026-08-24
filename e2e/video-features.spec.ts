import { test, expect, Page } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

/**
 * COMPLETE FEATURE BATTERY across all four Docs2Video output types.
 *
 * Types (as the product calls them): video explainer, interactive presentation,
 * slide deck, slide presentation (pptx). This spec does NOT generate anything
 * (no AI spend). Instead it asks the app's own /api/videos for one COMPLETED
 * item of each type and exercises the features that type exposes:
 *   - the video page loads and shows the right main surface (player vs slides)
 *   - the Send-to-Client modal opens, is WIDE, fits the viewport, and has NO
 *     double scrollbar (the fix this batch shipped)
 *   - the email field / Send button / copy-link / honest copy label are present
 *   - a bad address is refused out loud
 *   - decks/pptx offer a download (PDF / PowerPoint); slide videos can navigate
 *   - the matching public /watch share page renders without a JS error
 *
 * Every type SKIPS cleanly when the account has no completed video of it, so the
 * suite is safe to run on any account and only asserts what actually exists.
 */

type Row = { id: string; status: string; video_url: string | null; output_type?: string | null }

const TYPES: { key: string; label: string; match: (r: Row) => boolean; isSlides: boolean; download?: RegExp }[] = [
  { key: 'video',       label: 'video explainer',        isSlides: false, match: (r) => (r.output_type ?? 'video') === 'video' && !!r.video_url },
  { key: 'interactive', label: 'interactive presentation', isSlides: true, match: (r) => r.output_type === 'interactive', download: /Download (PDF|PowerPoint)/i },
  { key: 'deck',        label: 'slide deck',             isSlides: true,  match: (r) => r.output_type === 'deck', download: /Download (PDF|PowerPoint)/i },
  // The plain slide-presentation (pptx) page uses terse download buttons on the
  // right rail: MP4 / PDF / PPTX (not the deck-viewer's "Download …" labels).
  { key: 'pptx',        label: 'slide presentation',     isSlides: true,  match: (r) => r.output_type === 'pptx', download: /^PPTX$/ },
]

async function completedRows(page: Page): Promise<Row[]> {
  const res = await page.request.get('/api/videos')
  if (!res.ok()) return []
  const rows = (await res.json()) as Row[]
  return Array.isArray(rows) ? rows.filter((r) => r.status === 'completed') : []
}

// The one shared assertion the send-modal fix is about: the dialog must fit the
// viewport with NO horizontal page scroll and NO card-level vertical scrollbar
// (the double-scrollbar bug). We check the card is not its own scroll container
// and the page isn't wider than the window.
async function assertModalFits(page: Page) {
  const card = page.getByTestId('share-modal-card')
  await expect(page.getByRole('heading', { name: 'Send to Your Client' })).toBeVisible()

  // No horizontal overflow on the document (a too-wide modal is the classic cause).
  const horiz = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  expect(horiz, 'the page must not scroll sideways when the modal is open').toBeTruthy()

  // The modal card itself must not be an inner scroll container (that was the
  // second scrollbar). We look for any ancestor of the heading whose content
  // overflows its own box vertically AND has overflow-y auto/scroll.
  const doubleScroll = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((n) => n.textContent?.trim() === 'Send to Your Client')
    if (!h) return false
    let el: HTMLElement | null = h.parentElement
    let innerScrollers = 0
    while (el && el !== document.body) {
      const cs = getComputedStyle(el)
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) innerScrollers++
      el = el.parentElement
    }
    // The overlay itself may scroll (that's the single, intended scrollbar).
    // More than one nested scroller is the double-scrollbar bug.
    return innerScrollers > 1
  })
  expect(doubleScroll, 'the modal must not have a second (card-level) scrollbar').toBeFalsy()

  // Wide, not the old cramped 480 — the card should use a good chunk of a
  // desktop viewport (we open at 1280 wide below).
  const box = await card.boundingBox()
  expect(box, 'the modal card should be measurable').not.toBeNull()
  if (box) expect(box.width, 'the send modal should be wide (> 560px on desktop)').toBeGreaterThan(560)
}

test.describe('All four output types — feature battery', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  for (const t of TYPES) {
    test(`${t.label}: page, send modal (wide, fits, no double scroll), share page`, async ({ page }) => {
      await loginAsTestUser(page)
      const rows = await completedRows(page)
      const row = rows.find(t.match)
      test.skip(!row, `no completed ${t.label} on this account`)

      // ── The video page loads and shows the right main surface. ──
      await page.goto(`/videos/${row!.id}`)
      await expect(page).toHaveURL(new RegExp(`/videos/${row!.id}`))
      if (t.isSlides) {
        // Slide-based types render slide thumbnails or a deck viewer, not an <video>.
        await expect(page.locator('.slide-thumb, iframe, .wp-col-right').first()).toBeVisible({ timeout: 20000 })
      } else {
        await expect(page.locator('video').first()).toBeVisible({ timeout: 20000 })
      }

      // ── Send-to-Client modal: open it. ──
      const sendBtn = page.getByRole('button', { name: 'Send to Client' })
      await expect(sendBtn, 'a completed video must offer Send to Client').toBeVisible({ timeout: 15000 })
      await sendBtn.click()

      // The modal fix: wide, fits the viewport, single scrollbar.
      await assertModalFits(page)

      // The send controls the complaint was about.
      const emailInput = page.getByPlaceholder('e.g. sarah@example.com')
      await expect(emailInput, 'the client-email field').toBeVisible()
      await expect(page.getByRole('button', { name: 'Send Email Now' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible()
      await expect(page.getByText(/Copying does not send anything/i)).toBeVisible()

      // A bad address is refused OUT LOUD, before anything sends.
      await emailInput.fill('not-an-email')
      await page.getByRole('button', { name: 'Send Email Now' }).click()
      await expect(page.getByText(/Enter your client.?s email address first/i)).toBeVisible()

      // Close the modal.
      await page.getByRole('button', { name: 'Close' }).click().catch(async () => {
        await page.getByRole('button', { name: '×' }).first().click()
      })

      // ── Download affordance for the slide types. ──
      if (t.download) {
        await expect(page.getByRole('button', { name: t.download }).first(),
          `${t.label} should offer a document download`).toBeVisible({ timeout: 10000 })
      }

      // ── The matching public share page renders with no JS error. ──
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      const resp = await page.goto(`/watch/${row!.id}`)
      expect(resp!.status(), 'share page must not 500').toBeLessThan(500)
      await page.waitForTimeout(2500)
      expect(errors, 'no unhandled JS error on the share page').toEqual([])

      // The client share page must NOT offer a video download (removed per product).
      await expect(page.getByRole('button', { name: /^Download Video$/ })).toHaveCount(0)
    })
  }

  // A narrow-screen check for the same modal: it collapses to one column and
  // still fits without sideways scroll (the responsive half of the fix).
  test('send modal fits a phone width too', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginAsTestUser(page)
    const rows = await completedRows(page)
    const row = rows.find((r) => !!r.video_url) // any completed video with a send button
    test.skip(!row, 'no completed video with a share button on this account')

    await page.goto(`/videos/${row!.id}`)
    const sendBtn = page.getByRole('button', { name: 'Send to Client' })
    await expect(sendBtn).toBeVisible({ timeout: 15000 })
    await sendBtn.click()
    await expect(page.getByRole('heading', { name: 'Send to Your Client' })).toBeVisible()
    const horiz = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    expect(horiz, 'no sideways scroll on a phone-width modal').toBeTruthy()
  })
})
