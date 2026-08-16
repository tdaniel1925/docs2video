// Does the deck-restyle flow read a real deck correctly, in order?
//
// Builds a REAL .pptx in memory (3 slides: 2 with text, 1 empty), drives the
// /design deck-upload UI, and asserts: N slides found IN ORDER, the empty slide
// flagged as a picture-slide (skipped), Next enables, the deck flow SKIPS the
// content chat (Style → Sizes), and Sizes shows the fixed 16:9 panel counting
// only the drawable slides. It never generates images (no credit spend).
//
// Proven to FAIL: point the "found" assertion at the wrong count, or expect the
// image-only slide to be drawable, and it red-flags.
//
// Run:  set -a && . ./.env.local && node scripts/deck-check.mjs
import { chromium } from 'playwright'
import JSZip from 'jszip'
import fs from 'fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const EMAIL = process.env.TEST_EMAIL
const PASS = process.env.TEST_PASSWORD

let failures = 0
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures++
}

// A real, minimal .pptx: 2 text slides + 1 empty (image-only) slide.
async function makeDeck() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types/>')
  const texts = ['Welcome\nOur mission\nWhat we do', 'The Numbers\nRevenue up 18%\n2.4M users', '']
  texts.forEach((t, i) => {
    const paras = t ? t.split('\n').map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join('') : ''
    zip.file(`ppt/slides/slide${i + 1}.xml`, `<?xml version="1.0"?><p:sld xmlns:p="x" xmlns:a="y"><p:cSld><p:spTree>${paras}</p:spTree></p:cSld></p:sld>`)
  })
  const path = '.deck-check.pptx'
  fs.writeFileSync(path, await zip.generateAsync({ type: 'nodebuffer' }))
  return path
}

const deckPath = await makeDeck()
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
  await page.locator('button:has-text("Got it")').first().click({ timeout: 3000 }).catch(() => {})

  // Pick the deck kind, upload the deck.
  await page.locator('button:has-text("A slide deck")').first().click()
  await page.locator('input[type=file]').first().setInputFiles(deckPath)
  await page.waitForSelector('text=We found', { timeout: 20000 })

  const body = await page.locator('body').innerText()
  check('found 3 slides', /We found 3 slide/i.test(body), 'in order')
  check('headings read in order', /Welcome/.test(body) && /The Numbers/.test(body))
  check('image-only slide flagged as a picture', /Picture slide|look like pictures/i.test(body))
  check('2 slides will be restyled (the empty one skipped)', /2 slides will be restyled/i.test(body))

  const nextBtn = () => page.locator('button:has-text("Next")').first()
  check('Next enabled after parse', !(await nextBtn().isDisabled()))

  // Advance: Style → should SKIP Content and land on Sizes.
  await nextBtn().click()
  await page.waitForURL('**/design/style')
  await page.locator('button:has-text("choose one of our styles")').first().click()
  await page.locator('button:has(img)').first().click()
  await nextBtn().click()
  await page.waitForTimeout(600)
  check('deck skips the content chat (Style → Sizes)', page.url().endsWith('/design/sizes'), page.url().replace(/^https?:\/\/[^/]+/, ''))

  const sizesText = await page.locator('body').innerText()
  check('Sizes fixed to 16:9 slides', /Slide · 1920 × 1080|set to slides/i.test(sizesText))
  check('Sizes counts only the 2 drawable slides', /2 slides will be restyled/i.test(sizesText))

} catch (e) {
  check('deck walk completed without error', false, e.message)
} finally {
  await browser.close()
  fs.unlinkSync(deckPath)
}

console.log(failures ? `\n${failures} FAILED` : '\nALL GREEN')
process.exit(failures ? 1 : 0)
