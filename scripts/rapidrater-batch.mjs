// Rapid Rater — STEP 2: fill + submit + read the rate, for every combo.
//
// Runs 4 products × 2 sexes = 8 quotes, all: Texas, age 55, $1,000,000 face,
// Monthly mode, Table None, flat 0. Fills the real form, clicks SUBMIT, waits
// for the result, and captures it. Saves everything to scripts/rapidrater-out/.
//
// Run:  node scripts/rapidrater-batch.mjs
// (Uses a fresh browser — you can close the inspector window.)
//
// AUTHORIZED USE ONLY: this drives a live Corebridge production rater. Run it
// as the authorized agent (you). It paces itself (a pause between quotes) so it
// isn't hammering their server.

import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'rapidrater-out')
mkdirSync(OUT, { recursive: true })

const URL = 'https://rapid-rater.live.web.corebridgefinancial.com/QoLRapidRater'

// ── the fixed inputs for every quote ──────────────────────────────────────
const STATE = 'Texas'
const AGE = '55'
const FACE = '1000000'
const MODE = 'Monthly'
const TABLE = 'None'
const FLAT = '0'

// Per-product AMOUNT field. Term uses #FACE_AMOUNT. The permanent products swap
// it for a different input (that's why they timed out). Once inspect2 tells us
// the real ids, put them here — key by a substring of the product name. If a
// product isn't listed, we try #FACE_AMOUNT, then fall back to the first VISIBLE
// enabled text input on the form (so it still works even if we don't know the id).
const AMOUNT_FIELD = {
  'Flex Term': '#FACE_AMOUNT',
  // 'Max Accumulator': '#SPECIFIED_AMOUNT',   // <- fill in from inspect2 output
  // 'Value+ Protector': '#SPECIFIED_AMOUNT',
  // 'Guaranteed Plus':  '#SPECIFIED_AMOUNT',
}

// Fill the amount for this product: use the mapped id if present + fillable,
// else #FACE_AMOUNT, else the first visible enabled text input. Never hangs 30s.
async function fillAmount(product, value) {
  const tryFill = async (sel) => {
    const el = await page.$(sel)
    if (!el) return false
    const usable = await el.evaluate((n) => {
      const s = getComputedStyle(n)
      return n.offsetParent !== null && s.visibility !== 'hidden' && !n.disabled && !n.readOnly
    }).catch(() => false)
    if (!usable) return false
    await el.fill(value, { timeout: 5000 }).catch(() => {})
    return true
  }
  const mapped = Object.entries(AMOUNT_FIELD).find(([k]) => product.includes(k))?.[1]
  if (mapped && await tryFill(mapped)) return
  if (await tryFill('#FACE_AMOUNT')) return
  // last resort: first visible enabled text box
  const first = await page.$$eval('input[type="text"]', (els) => {
    const one = els.find((n) => {
      const s = getComputedStyle(n)
      return n.offsetParent !== null && s.visibility !== 'hidden' && !n.disabled && !n.readOnly
    })
    return one ? (one.id || one.name || '') : ''
  })
  if (first) await tryFill(first.startsWith('#') ? first : `#${first}`) || await tryFill(`[name="${first}"]`)
}

// ── the matrix: every product × every sex ─────────────────────────────────
// Product labels are matched by substring so a date suffix (e.g. "(June 2026)")
// doesn't have to be typed exactly.
const PRODUCTS = [
  'QoL Flex Term',
  'QoL Max Accumulator+ IUL III',
  'QoL Value+ Protector III',
  'QoL Guaranteed Plus II',
]
const SEXES = ['Male', 'Female']

const browser = await chromium.launch({ headless: false, slowMo: 60 })
const page = await browser.newPage()

// Pick a <select> option by visible-text SUBSTRING (handles date suffixes).
async function selectByText(sel, wanted) {
  const value = await page.$eval(sel, (el, wanted) => {
    const opt = Array.from(el.options).find(o =>
      o.textContent.trim().toLowerCase().includes(wanted.toLowerCase()))
    return opt ? opt.value : null
  }, wanted)
  if (value == null) throw new Error(`no option matching "${wanted}" in ${sel}`)
  await page.selectOption(sel, value)
}

// After submit, capture whatever result the page shows. We don't yet know the
// exact results element, so grab the fullbody text and also any obvious premium
// figures ($ amounts) — we can tighten this once we see one real result.
async function readResult() {
  // give the rater a moment to compute + render
  await page.waitForTimeout(2500)
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }) } catch {}
  const bodyText = await page.evaluate(() => document.body.innerText || '')
  // Pull dollar figures as candidate premiums (e.g. $12,345.67).
  const dollars = Array.from(bodyText.matchAll(/\$\s?[\d,]+(?:\.\d{2})?/g)).map(m => m[0])
  // Grab any element that looks like a results/premium container, for context.
  const resultBlock = await page.evaluate(() => {
    const cand = document.querySelector('#results, .results, [id*="result" i], [class*="result" i], #PremiumResult, [id*="premium" i]')
    return cand ? (cand.innerText || '').trim().slice(0, 600) : ''
  })
  return { dollars: [...new Set(dollars)], resultBlock, bodyLen: bodyText.length }
}

const results = []

for (const product of PRODUCTS) {
  for (const sex of SEXES) {
    const tag = `${product} · ${sex}`
    const row = { product, sex, state: STATE, age: AGE, face: FACE, mode: MODE }
    try {
      console.log(`\n▶ ${tag}`)
      // fresh load each quote so no stale result carries over
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForSelector('#DISPLAY_PRODUCT', { timeout: 20000 })
      await page.waitForTimeout(800)

      await selectByText('#DISPLAY_PRODUCT', product)
      await page.waitForTimeout(600)          // product change may reveal/hide fields
      await selectByText('#STATE', STATE)
      await selectByText('#SEX1', sex)
      await page.fill('#AGE1', AGE)
      await fillAmount(product, FACE)   // product-aware: Term uses FACE_AMOUNT, others differ
      await selectByText('#PREM_MODE', MODE)
      // these two may not exist on every product — fill only if present
      if (await page.$('#FLAT_AMOUNT1')) await page.fill('#FLAT_AMOUNT1', FLAT)
      if (await page.$('#TABLE_RATING1')) await selectByText('#TABLE_RATING1', TABLE)

      // screenshot the filled form BEFORE submit (proof of what we entered)
      const safe = tag.replace(/[^a-z0-9]+/gi, '_')
      await page.screenshot({ path: join(OUT, `${safe}_filled.png`), fullPage: true })

      await page.click('#btnSubmit')
      const res = await readResult()
      await page.screenshot({ path: join(OUT, `${safe}_result.png`), fullPage: true })

      row.ok = true
      row.dollars = res.dollars
      row.resultBlock = res.resultBlock
      console.log(`   rates seen: ${res.dollars.slice(0, 6).join(', ') || '(none parsed — see screenshot)'}`)
    } catch (e) {
      row.ok = false
      row.error = e.message.slice(0, 140)
      console.log(`   ✗ ${row.error}`)
    }
    results.push(row)
    await page.waitForTimeout(1500)          // be polite to their server
  }
}

writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2))

// readable summary
const lines = results.map(r =>
  `${r.ok ? '✓' : '✗'}  ${r.product} · ${r.sex}` +
  (r.ok ? `  →  ${(r.dollars || []).slice(0, 4).join('  ') || '(check screenshot)'}` : `  →  ERROR: ${r.error}`))
writeFileSync(join(OUT, 'summary.txt'), lines.join('\n') + '\n')

console.log('\n================ DONE ================')
console.log(lines.join('\n'))
console.log(`\nSaved: scripts/rapidrater-out/results.json + summary.txt + screenshots`)
console.log('Browser stays open so you can eyeball the last result. Press ENTER to close.')

await new Promise((resolve) => { process.stdin.resume(); process.stdin.once('data', () => resolve()) })
await browser.close()
process.exit(0)
