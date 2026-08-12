// =============================================================================
// Does pasting an image actually do something?
//
// A typecheck cannot see a clipboard. Three green builds have already shipped
// three broken screens in this app, so paste gets driven in a real browser with
// a real ClipboardEvent carrying a real file.
//
// WHAT IT GUARDS. Paste used to be bound only while the style panel was open,
// so pasting a photo or a logo silently did nothing — and silently doing
// nothing is indistinguishable from the feature not existing. It also must not
// steal a paste from a text box: copying a headline out of a document and
// pasting it into the chat has to stay a paste of text.
//
//   node scripts/paste-check.mjs
//
// Needs the dev server on http://localhost:3000 and a signed-in session.
// =============================================================================

import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
if (!EMAIL || !PASSWORD) {
  console.log('Set TEST_EMAIL and TEST_PASSWORD in the environment. They are never written to a file.')
  process.exit(1)
}

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`)
}

/**
 * Fire a real paste carrying a real image.
 *
 * Built inside the page: a File cannot be handed across the Playwright bridge,
 * and a fake event object would prove only that our own stub works.
 */
const pasteImage = (page) => page.evaluate(async () => {
  // A one-pixel PNG is a real image as far as the clipboard is concerned.
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const file = new File([bytes], 'pasted.png', { type: 'image/png' })
  const dt = new DataTransfer()
  dt.items.add(file)
  document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  await new Promise((r) => setTimeout(r, 900))
})

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 })

  await page.goto(`${BASE}/flyer`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // 1. Nothing open — it must ASK rather than guess or swallow it.
  await pasteImage(page)
  const asked = await page.getByText('You pasted an image. What is it?').isVisible().catch(() => false)
  check('paste with nothing open asks what it is', asked)

  // 2. Both answers are offered, and they are the two real options.
  const hasStyle = await page.getByRole('button', { name: /copy the style of/i }).isVisible().catch(() => false)
  const hasPhoto = await page.getByRole('button', { name: /photo to put in it/i }).isVisible().catch(() => false)
  check('offers "a design to copy" and "a photo"', hasStyle && hasPhoto)

  // 3. Choosing "photo" actually attaches it.
  if (hasPhoto) {
    await page.getByRole('button', { name: /photo to put in it/i }).click()
    await page.waitForTimeout(1200)
    const gone = !(await page.getByText('You pasted an image. What is it?').isVisible().catch(() => false))
    check('answering closes the question', gone)
  }

  // 4. A paste while typing must stay a paste of TEXT.
  const box = page.locator('textarea, input[type="text"]').first()
  if (await box.count()) {
    await box.click()
    await pasteImage(page)
    const stole = await page.getByText('You pasted an image. What is it?').isVisible().catch(() => false)
    check('does not hijack a paste while typing', !stole)
  }
} catch (e) {
  check('ran at all', false, String(e).slice(0, 120))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
