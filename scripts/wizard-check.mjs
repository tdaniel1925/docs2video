// Does the 5-page /design wizard hold together?
//
// Walks What → Style → Content → Sizes → Review, using the TOP Next button each
// time (never scrolling), and asserts: the left sidebar renders with all 5
// steps, each Next advances to the right URL, and the choices survive
// navigation (the headline typed on Content is still there after going forward
// and back). Proven to FAIL: point any STEPS[] entry at a wrong path and it red-
// flags; break the sidebar and the "sidebar lists" checks red-flag.
//
// Run:  set -a && . ./.env.local && node scripts/wizard-check.mjs
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3000'
const EMAIL = process.env.TEST_EMAIL
const PASS = process.env.TEST_PASSWORD

let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures++
}

const STEPS = ['/design', '/design/style', '/design/content', '/design/sizes', '/design/summary']

const browser = await chromium.launch()
const page = await browser.newPage()
page.setDefaultTimeout(15000)

try {
  await page.goto(`${BASE}/design`, { waitUntil: 'domcontentloaded' })
  if (page.url().includes('/login') || page.url().includes('/auth')) {
    if (!EMAIL || !PASS) { console.log('need TEST_EMAIL / TEST_PASSWORD'); process.exit(2) }
    await page.fill('input[type=email]', EMAIL)
    await page.fill('input[type=password]', PASS)
    await page.click('button[type=submit]')
    await page.waitForLoadState('networkidle')
    await page.goto(`${BASE}/design`, { waitUntil: 'domcontentloaded' })
  }

  // STEP 1 — What: sidebar shows all 5 steps
  const railText = await page.locator('nav.design-rail, .design-rail-mini').first().innerText().catch(() => '')
  check('sidebar renders', railText.length > 0)
  for (const label of ['What', 'Style', 'Content', 'Sizes', 'Review']) {
    check(`sidebar lists "${label}"`, railText.includes(label))
  }

  const nextBtn = () => page.locator('button:has-text("Next")').first()

  // pick the first kind, Next (top button)
  await page.locator('button:has(img)').first().click()
  await nextBtn().click()
  await page.waitForURL(`**${STEPS[1]}`)
  check('What → Style advances', page.url().endsWith(STEPS[1]))

  // STEP 2 — Style: open the styles accordion, pick the first style, Next
  await page.locator('button:has-text("choose one of our styles")').first().click()
  await page.locator('button:has(img)').first().click()
  await nextBtn().click()
  await page.waitForURL(`**${STEPS[2]}`)
  check('Style → Content advances', page.url().endsWith(STEPS[2]))

  // STEP 3 — Content: type a headline, Next
  const HEAD = 'Check Headline 7714'
  await page.locator('input').first().fill(HEAD)
  await page.locator('input').first().blur()
  await nextBtn().click()
  await page.waitForURL(`**${STEPS[3]}`)
  check('Content → Sizes advances', page.url().endsWith(STEPS[3]))

  // STEP 4 — Sizes: tick first size, Next
  await page.locator('input[type=checkbox]').first().check()
  await nextBtn().click()
  await page.waitForURL(`**${STEPS[4]}`)
  check('Sizes → Review advances', page.url().endsWith(STEPS[4]))

  // Review shows the red Start button and our headline survived. Small settle:
  // the summary reads state from localStorage on mount, a beat after navigation.
  await page.waitForTimeout(400)
  const summaryText = await page.locator('body').innerText()
  check('Review shows the typed headline (state survived)', summaryText.includes(HEAD), 'headline persisted across 3 navigations')
  check('Review has a "Start designing" button', /Start designing/i.test(summaryText))

  // Back twice: Review → Sizes → Content, then confirm the headline is still there.
  await page.locator('button:has-text("Back")').first().click()
  await page.waitForURL(`**${STEPS[3]}`)
  await page.locator('button:has-text("Back")').first().click()
  await page.waitForURL(`**${STEPS[2]}`)
  const val = await page.locator('input').first().inputValue()
  check('headline still in the box after Back', val === HEAD, `got "${val}"`)

} catch (e) {
  check('walk completed without error', false, e.message)
} finally {
  await browser.close()
}

console.log(failures ? `\n${failures} FAILED` : '\nALL GREEN')
process.exit(failures ? 1 : 0)
