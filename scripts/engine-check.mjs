// Does the Gemini path work, and can the spelling check actually FAIL?
//
//   node scripts/engine-check.mjs
//
// The second question is the important one. A checker that cannot fail turns
// "unknown" into "verified", and this codebase has shipped that mistake several
// times. So this runs the real check against a design that is known to be
// wrong — the one where Gemini rendered "REPETIVE" for "REPETITIVE" — as well
// as a real generation.
import fs from 'node:fs'
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { geminiAspect, pickEngine, drawWithGemini, checkWords, drawChecked } =
  await import('../app/_lib/image-engine.ts')
const { FLYER_SIZES, FLYER_TEMPLATES, flyerPrompt, printPixels } =
  await import('../app/_lib/flyer-engine/index.ts')
const sharp = (await import('sharp')).default

let bad = 0
const ok = (cond, label, extra = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) bad++
}

// ---- 1. Which sizes can Gemini hold? ---------------------------------------
console.log('\n1. shape matching\n')
for (const id of ['slide-16x9', 'letter', 'ig-post', 'rack-card', 'li-banner']) {
  const s = FLYER_SIZES.find((x) => x.id === id)
  const p = printPixels(s, false)
  const a = geminiAspect(p.w, p.h)
  console.log(`  ${id.padEnd(12)} ${(p.w / p.h).toFixed(2).padStart(5)}  ->  ${a ?? 'gpt-image-2 (no close shape)'}`)
}
ok(geminiAspect(1920, 1080) === '16:9', 'a slide is 16:9')
ok(geminiAspect(1125, 2625) === null, 'a rack card has no near shape and stays on gpt-image-2')
ok(geminiAspect(1584, 396) === null, 'a 4:1 banner has no near shape either')

// ---- 2. The checker must be able to fail ------------------------------------
console.log('\n2. can the spelling check fail?\n')
const t = FLYER_TEMPLATES.find((x) => x.id === 'business-early-start') ?? FLYER_TEMPLATES[0]
const slide = FLYER_SIZES.find((x) => x.id === 'slide-16x9')
const FIELDS = {
  headline: 'Where AI creates value',
  details: ['Automating repetitive work', 'Surfacing insights from data', 'Personalising customer experience'],
}

const t0 = Date.now()
const img = await drawWithGemini(flyerPrompt(t, FIELDS, slide), '16:9')
const meta = await sharp(img).metadata()
console.log(`  drew ${meta.width}x${meta.height} in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
fs.writeFileSync('.engine-check.png', img)

// A word that is definitely NOT on it. If this passes, the check is blind.
const control = await checkWords(img, ['Aardvark Quarterly Bulletin'])
ok(!control.ok, 'a word that is not there is reported missing',
  control.ok ? `it read: ${control.saw.slice(0, 90)}` : '')

// And the real words, which should be found.
const real = await checkWords(img, [FIELDS.headline])
ok(real.ok, 'the headline that IS there is found', real.ok ? '' : `missing: ${real.missing.join(', ')}`)
console.log(`  transcribed: ${real.saw.replace(/\s+/g, ' ').slice(0, 160)}`)

// ---- 3. Draw-check-redo, end to end -----------------------------------------
console.log('\n3. draw, check, redo\n')
const t1 = Date.now()
const out = await drawChecked(
  flyerPrompt(t, FIELDS, slide), '16:9',
  [FIELDS.headline, ...FIELDS.details],
)
fs.writeFileSync('.engine-checked.png', out.image)
console.log(`  ${out.attempts} attempt(s) in ${((Date.now() - t1) / 1000).toFixed(0)}s`)
ok(out.image.length > 50_000, 'came back with an image')
console.log(out.spelling.ok
  ? '  every word came out right'
  : `  best attempt still missing: ${out.spelling.missing.join(', ')}`)

console.log(bad ? `\n${bad} problem(s)\n` : '\nengine works and the check can fail\n')
process.exit(bad ? 1 : 0)
