// Rapid Rater — STEP 1b: inspect the form AFTER each permanent product is
// picked. Term uses #FACE_AMOUNT, but the IUL/UL products swap that field for
// something else (that's why the batch timed out on them). This prints the
// VISIBLE, ENABLED inputs for each product so we learn the real field names.
// Submits nothing.
//
// Run:  node scripts/rapidrater-inspect2.mjs

import { chromium } from 'playwright'

const URL = 'https://rapid-rater.live.web.corebridgefinancial.com/QoLRapidRater'
const PRODUCTS = [
  'QoL Max Accumulator+ IUL III',
  'QoL Value+ Protector III',
  'QoL Guaranteed Plus II',
]

const browser = await chromium.launch({ headless: false, slowMo: 60 })
const page = await browser.newPage()

async function selectByText(sel, wanted) {
  const value = await page.$eval(sel, (el, wanted) => {
    const opt = Array.from(el.options).find(o =>
      o.textContent.trim().toLowerCase().includes(wanted.toLowerCase()))
    return opt ? opt.value : null
  }, wanted)
  if (value == null) throw new Error(`no option "${wanted}"`)
  await page.selectOption(sel, value)
}

for (const product of PRODUCTS) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('#DISPLAY_PRODUCT', { timeout: 20000 })
  await page.waitForTimeout(700)
  await selectByText('#DISPLAY_PRODUCT', product)
  await page.waitForTimeout(1200)  // let the form reflow for this product

  // Only VISIBLE + ENABLED fields — the ones you can actually fill for this product.
  const fields = await page.$$eval('input, select, textarea', (els) => {
    const val = (s) => (s || '').toString().trim().replace(/\s+/g, ' ').slice(0, 50)
    return els
      .filter(el => {
        const style = window.getComputedStyle(el)
        const visible = el.offsetParent !== null && style.display !== 'none' && style.visibility !== 'hidden'
        const enabled = !el.disabled && !el.readOnly
        return visible && enabled && el.type !== 'hidden'
      })
      .map(el => {
        let label = ''
        if (el.id) { const l = document.querySelector('label[for="' + el.id + '"]'); if (l) label = l.textContent }
        if (!label && el.closest('label')) label = el.closest('label').textContent
        return {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || '',
          id: el.id || '', name: el.getAttribute('name') || '',
          label: val(label), placeholder: val(el.getAttribute('placeholder')),
          options: el.tagName.toLowerCase() === 'select'
            ? Array.from(el.options).map(o => val(o.textContent)).slice(0, 10) : undefined,
        }
      })
  })

  console.log(`\n==== ${product} — fillable fields ====`)
  fields.forEach((f, i) => {
    const sel = f.id ? `#${f.id}` : f.name ? `[name="${f.name}"]` : '(?)'
    console.log(`  ${String(i).padStart(2, '0')}  ${f.tag}${f.type ? `[${f.type}]` : ''}  ${f.label ? `"${f.label}"` : ''}  → ${sel}`)
    if (f.options) console.log('       options:', f.options.join(' | '))
  })
}

console.log('\n--- done, nothing submitted. Press ENTER to close. ---')
await new Promise((r) => { process.stdin.resume(); process.stdin.once('data', () => r()) })
await browser.close()
process.exit(0)
