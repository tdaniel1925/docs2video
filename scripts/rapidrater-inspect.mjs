// Rapid Rater — STEP 1: inspect the form (does NOT submit anything).
//
// Opens the Corebridge QoL Rapid Rater in a REAL visible browser, waits for it
// to settle, then prints every input / select / button / label it can find —
// with the selector you'd use to fill each one. It PAUSES at the end so you can
// look at the page yourself; nothing is entered or submitted.
//
// Run:  node scripts/rapidrater-inspect.mjs
// If it complains about a missing browser:  npx playwright install chromium
//
// Paste the printed list back to me and I'll write the fill-and-submit script
// with your real quote values wired to the correct fields.

import { chromium } from 'playwright'

const URL = 'https://rapid-rater.live.web.corebridgefinancial.com/QoLRapidRater'

const browser = await chromium.launch({ headless: false, slowMo: 120 })
const page = await browser.newPage()

console.log(`\nOpening ${URL} …`)
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })

// Give client-side JS time to render the form (SPAs load fields after DOMContentLoaded).
await page.waitForTimeout(4000)
try { await page.waitForLoadState('networkidle', { timeout: 15000 }) } catch {}

// Some raters render the form inside an iframe — inspect every frame, not just the top.
const frames = page.frames()
console.log(`\nFound ${frames.length} frame(s) on the page.\n`)

// Pull a readable label for a field: its <label>, aria-label, placeholder, name, or id.
const DESCRIBE = `(el) => {
  const val = (s) => (s || '').toString().trim().replace(/\\s+/g, ' ').slice(0, 60)
  let label = ''
  if (el.id) {
    const l = document.querySelector('label[for="' + el.id + '"]')
    if (l) label = l.textContent
  }
  if (!label && el.closest('label')) label = el.closest('label').textContent
  return {
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    name: el.getAttribute('name') || '',
    id: el.id || '',
    placeholder: el.getAttribute('placeholder') || '',
    aria: el.getAttribute('aria-label') || '',
    label: val(label),
    text: val(el.tagName.toLowerCase() === 'button' ? el.textContent : ''),
    options: el.tagName.toLowerCase() === 'select'
      ? Array.from(el.options).map(o => val(o.textContent)).slice(0, 12)
      : undefined,
  }
}`

for (const [fi, frame] of frames.entries()) {
  let fields = []
  try {
    fields = await frame.$$eval('input, select, textarea, button', (els, describe) => {
      const fn = eval('(' + describe + ')')
      return els.map(fn)
    }, DESCRIBE)
  } catch (e) {
    console.log(`  frame ${fi}: could not read (${e.message.slice(0, 60)})`)
    continue
  }
  if (!fields.length) continue
  console.log(`==== FRAME ${fi}  (${frame.url().slice(0, 80)}) ====`)
  fields.forEach((f, i) => {
    const bestSel =
      f.id ? `#${f.id}` :
      f.name ? `[name="${f.name}"]` :
      f.aria ? `[aria-label="${f.aria}"]` :
      f.placeholder ? `[placeholder="${f.placeholder}"]` : '(needs manual selector)'
    const parts = [
      `${String(i).padStart(2, '0')}`,
      `${f.tag}${f.type ? `[${f.type}]` : ''}`,
      f.label ? `label="${f.label}"` : '',
      f.text ? `text="${f.text}"` : '',
      f.placeholder ? `ph="${f.placeholder}"` : '',
      `→ ${bestSel}`,
    ].filter(Boolean)
    console.log('  ' + parts.join('  '))
    if (f.options) console.log('       options:', f.options.join(' | '))
  })
  console.log('')
}

console.log('\n--- Inspection done. Nothing was submitted. ---')
console.log('The browser will stay open. Look at the form, then press ENTER here to close.')

// Keep the browser open until you press Enter in the terminal.
await new Promise((resolve) => {
  process.stdin.resume()
  process.stdin.once('data', () => resolve())
})
await browser.close()
process.exit(0)
