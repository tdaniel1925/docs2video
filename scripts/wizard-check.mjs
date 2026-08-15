// =============================================================================
// Does the 4-page /design wizard actually hold together?
//
// The one genuinely new risk in a multi-page wizard is that the choices don't
// survive a route change — you pick a style, click Next, and it's gone. So this
// walks the four pages and, crucially, proves state (kind, style, words, sizes)
// is still there after navigating away and back. A typecheck sees none of that.
//
//   TEST_EMAIL=... TEST_PASSWORD=... node scripts/wizard-check.mjs
//
// Credentials come from the environment, never written anywhere.
// =============================================================================

import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
if (!EMAIL || !PASSWORD) { console.log('Set TEST_EMAIL and TEST_PASSWORD.'); process.exit(1) }

const results = []
const check = (name, pass, detail = '') => {
  results.push(pass)
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } })

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 })

  const bar = () => page.evaluate(() => (document.body.innerText.match(/STEP \d OF 4/) || [''])[0])
  // The wizard's Next, not Next.js's dev-tools button (which also says "Next").
  const clickNext = async () => {
    await page.locator('button', { hasText: /^Next/ }).filter({ hasNotText: 'Dev Tools' }).first().click()
    await page.waitForTimeout(900)
  }

  // Start clean so a stale localStorage from a prior run can't mask a break.
  await page.goto(`${BASE}/design`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.removeItem('text2art:wizard'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  // STEP 1
  check('step 1 loads', (await bar()) === 'STEP 1 OF 4')
  await page.getByRole('button', { name: /Something to print/ }).click()
  await page.waitForTimeout(200)
  await page.locator('button img[src*="flyer-templates"]').first().click()
  await page.waitForTimeout(300)
  await clickNext()

  // STEP 2
  check('step 2 loads after Next', (await bar()) === 'STEP 2 OF 4')
  await page.locator('input').first().fill('Grand Opening BBQ')
  await page.locator('textarea').first().fill('Saturday Sept 12')
  await page.locator('textarea').first().blur().catch(() => {})
  await clickNext()

  // STEP 3
  check('step 3 loads after Next', (await bar()) === 'STEP 3 OF 4')
  const sizeCount = await page.locator('input[type=checkbox]').count()
  check('step 3 shows the sizes', sizeCount >= 20, `${sizeCount} sizes`)
  await page.locator('input[type=checkbox]').first().check()
  await page.waitForTimeout(300)
  const costShown = await page.evaluate(() => /\d+ credits/.test(document.body.innerText))
  check('step 3 shows the cost', costShown)

  // BACK TO STEP 1 — the real test: did the choices survive?
  await page.goto(`${BASE}/design`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const styleSurvived = await page.evaluate(() =>
    !!document.querySelector('button[style*="3px solid"] img[src*="flyer-templates"]'))
  const kindSurvived = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) =>
      /Something to print/.test(b.textContent || '') && /inset 0 0 0 1px/.test(b.getAttribute('style') || '')))
  check('style choice survived navigation', styleSurvived)
  check('kind choice survived navigation', kindSurvived)

  // The saved state actually holds words + sizes too (checked in storage).
  const stored = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('text2art:wizard') || '{}') } catch { return {} }
  })
  check('words survived', stored?.fields?.headline === 'Grand Opening BBQ',
    stored?.fields?.headline || '(none)')
  check('a size survived', Array.isArray(stored?.sizes) && stored.sizes.length >= 1,
    `${stored?.sizes?.length ?? 0} sizes`)

  // The edit page loads (even with no round it must render, not crash).
  await page.goto(`${BASE}/design/edit`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  check('step 4 (edit) loads without a round', (await bar()) === 'STEP 4 OF 4')
} catch (e) {
  check('ran at all', false, String(e).slice(0, 160))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
