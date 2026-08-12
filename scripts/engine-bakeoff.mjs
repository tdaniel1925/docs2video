// =============================================================================
// Head to head: does Gemini keep up now that the prompts changed?
//
// The last measurement was taken on the OLD prompts, where one paragraph mixed
// the palette, the lettering AND the pumpkins together. Gemini misspelled small
// type and the designs were judged worse. Both of those were fair findings
// about a prompt that no longer exists — the subject is stated first now, the
// look is a separate instruction, and nothing has to be inferred.
//
// So the honest answer to "can Gemini do this now?" is: measure it again. A
// remembered benchmark against a rewritten prompt is not evidence.
//
// SAME LOOKS, SAME WORDS, SAME SUBJECT. The only thing that changes is which
// service draws it. Six looks chosen to stress different things: a photograph,
// flat vector, a print texture, dark metallics, hand lettering, and pure type
// (which is where spelling failures show up worst).
//
//   node scripts/engine-bakeoff.mjs
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { VISIBLE_STYLES, FLYER_SIZES, flyerPrompt } = await import('../app/_lib/flyer-engine/index.ts')
// geminiAspect lives with the engines, not the layout maths — it is about what
// Gemini will accept, not about paper.
const { drawWithGemini, checkWords, geminiAspect } = await import('../app/_lib/image-engine.ts')
const OpenAI = (await import('openai')).default

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const OUT = '.bakeoff'
mkdirSync(OUT, { recursive: true })

/** One from each corner of the list, picked to stress different weaknesses. */
const PICKS = ['vip', 'holiday-sale', 'sale-swiss-grid', 'services-comic-garage',
  'rustic-kitchen', 'launch']

const SUBJECT =
  'A working heating and air-conditioning service van parked on a suburban driveway, ' +
  'and a technician in work clothes carrying a toolbag. Ordinary, real, everyday work.'

const FIELDS = {
  eyebrow: 'LOCAL AND TRUSTED',
  headline: '24/7 HEAT REPAIR',
  subhead: 'Same-day service, seven days a week',
  price: '$89 TUNE-UP',
  cta: 'BOOK A VISIT',
  contact: '555-0142 · northsideheating.com',
}
const MUST_SAY = [FIELDS.eyebrow, FIELDS.headline, FIELDS.subhead, FIELDS.price, FIELDS.cta,
  '555-0142', 'northsideheating.com']

const size = FLYER_SIZES.find((s) => s.id === 'letter')
const aspect = geminiAspect(size.w, size.h)
console.log(`letter is ${(size.w / size.h).toFixed(2)}:1 — Gemini draws it as ${aspect}\n`)

const rows = []

for (const id of PICKS) {
  const t = VISIBLE_STYLES.find((x) => x.id === id)
  if (!t) { console.log(`  skip ${id} — not in the picker`); continue }
  const prompt = flyerPrompt(t, FIELDS, size, [], false, false, SUBJECT, false)

  for (const engine of ['openai', 'gemini']) {
    const started = Date.now()
    try {
      let img
      if (engine === 'openai') {
        const r = await ai.images.generate({
          model: 'gpt-image-2', prompt, size: '1024x1536', quality: 'high', n: 1,
        })
        img = Buffer.from(r.data[0].b64_json, 'base64')
      } else {
        img = await drawWithGemini(prompt, aspect)
      }
      const secs = Math.round((Date.now() - started) / 1000)
      const words = await checkWords(img, MUST_SAY)
      writeFileSync(`${OUT}/${id}-${engine}.png`, img)
      rows.push({ id, name: t.name, engine, secs, ok: words.ok, missing: words.missing })
      console.log(`  ${engine.padEnd(7)} ${id.padEnd(22)} ${String(secs).padStart(3)}s  ` +
        (words.ok ? 'words ok' : `MISSING: ${words.missing.join(' | ').slice(0, 70)}`))
    } catch (e) {
      rows.push({ id, name: t.name, engine, secs: null, ok: null, error: String(e).slice(0, 100) })
      console.log(`  ${engine.padEnd(7)} ${id.padEnd(22)} FAILED  ${String(e).slice(0, 80)}`)
    }
  }
}

// COST PER IMAGE, measured against the invoice rather than remembered.
// Quoted from what these calls actually bill at the settings used above.
const COST = { openai: 0.18, gemini: 0.04 }

console.log('\n' + '='.repeat(64))
for (const engine of ['openai', 'gemini']) {
  const mine = rows.filter((r) => r.engine === engine)
  const done = mine.filter((r) => r.secs !== null)
  const clean = mine.filter((r) => r.ok === true).length
  const avg = done.length ? Math.round(done.reduce((n, r) => n + r.secs, 0) / done.length) : 0
  console.log(`${engine.padEnd(8)} ${done.length}/${mine.length} drew, ${clean}/${mine.length} spelled everything right, ` +
    `${avg}s each, about $${(COST[engine] * mine.length).toFixed(2)} for ${mine.length}`)
}
writeFileSync(`${OUT}/result.json`, JSON.stringify(rows, null, 1))
console.log(`\nImages in ${OUT}/ — look at them before believing any of the above.`)
