// Generate a real sample flyer for every template, once, into public/.
//
//   node scripts/flyer-thumbs.mjs            (only the missing ones)
//   node scripts/flyer-thumbs.mjs --all      (redo everything)
//   node scripts/flyer-thumbs.mjs rnb vip    (just these)
//
// The gallery shipped with empty black squares because thumbnails were being
// rendered live from an art-less template. A picker whose tiles are blank tells
// a user nothing about what they are choosing — these are real generations, so
// what you click is what you get.
//
// Committed to the repo on purpose: images that never change are worth
// far more as static files than as an API call on every page load.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import OpenAI from 'openai'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { FLYER_TEMPLATES, FLYER_SIZES, flyerPrompt } = await import('../app/_lib/flyer-engine/index.ts')
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL = process.env.FLYER_IMAGE_MODEL || 'gpt-image-2'
const OUT = 'public/flyer-templates'
mkdirSync(OUT, { recursive: true })

const args = process.argv.slice(2)
const all = args.includes('--all')
const only = args.filter((a) => !a.startsWith('--'))

// Sample copy per category — a nightlife tile showing "Quarterly Review" would
// misrepresent the template as badly as a blank one.
const SAMPLE = {
  nightlife: { eyebrow: 'SATURDAY NIGHT', headline: 'MIDNIGHT SOCIETY', date: 'SAT 23 AUGUST', time: 'DOORS 9PM', venue: 'THE FOUNDRY', price: '$20 DOOR', cta: 'TICKETS AT THE DOOR' },
  business: { eyebrow: 'YOU ARE INVITED', headline: 'GROWTH SUMMIT', date: 'THURSDAY 12 SEPT', time: '6PM', venue: 'THE EXCHANGE', cta: 'RESERVE YOUR SEAT' },
  community: { eyebrow: 'EVERYONE WELCOME', headline: 'COMMUNITY DAY', date: 'SUNDAY 14 JULY', time: '11AM - 4PM', venue: 'RIVERSIDE PARK', cta: 'FREE ENTRY' },
  realestate: { eyebrow: 'OPEN HOUSE', headline: '42 MAPLE DRIVE', date: 'SUNDAY 1 - 3PM', price: '$685,000', cta: 'COME AND SEE IT' },
  fitness: { eyebrow: 'SIX WEEK PROGRAM', headline: 'STRONGER', date: 'STARTS 6 JANUARY', time: '6AM DAILY', venue: 'IRONWORKS GYM', cta: 'JOIN THE CHALLENGE' },
  food: { eyebrow: 'NOW SERVING', headline: 'SUPPER CLUB', date: 'EVERY FRIDAY', time: 'FROM 5PM', venue: 'THE CORNER TABLE', price: '$28 PER HEAD', cta: 'BOOK A TABLE' },
  services: { eyebrow: 'LOCAL AND TRUSTED', headline: 'BOOK IT TODAY', time: 'MON - SAT', venue: 'SERVING THE WHOLE COUNTY', price: 'FREE QUOTES', cta: 'CALL FOR A QUOTE' },
  sale: { eyebrow: 'THIS WEEKEND ONLY', headline: '40% OFF', date: 'FRI - SUN', time: '9AM - 6PM', venue: 'IN STORE AND ONLINE', cta: 'SHOP THE SALE' },
  music: { eyebrow: 'LIVE ON STAGE', headline: 'THE LONG WAY HOME', date: 'SAT 14 JUNE', time: 'DOORS 7PM', venue: 'THE OLD HALL', price: '$15 ADVANCE', cta: 'GET YOUR TICKETS' },
}

const portrait = FLYER_SIZES.find((s) => s.id === 'letter')
const todo = FLYER_TEMPLATES.filter((t) => {
  if (only.length) return only.includes(t.id)
  if (all) return true
  return !existsSync(`${OUT}/${t.id}.png`)
})

if (!todo.length) { console.log('nothing to generate — pass --all to redo'); process.exit(0) }
console.log(`generating ${todo.length} template sample(s) with ${MODEL}\n`)

let ok = 0
const failed = []
// Small batches: the image API rate-limits hard, and a wall of 429s wastes the
// whole run rather than just the tail of it.
for (let i = 0; i < todo.length; i += 3) {
  const batch = todo.slice(i, i + 3)
  await Promise.all(batch.map(async (t) => {
    try {
      // One retry. A rate-limit or a dropped socket is not a reason to leave a
      // black square in the picker forever, and the last batch job that lacked
      // this quietly shipped three missing images.
      let res, lastErr
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await ai.images.generate({
            model: MODEL,
            prompt: flyerPrompt(t, SAMPLE[t.category], portrait),
            size: '1024x1536', quality: 'high', n: 1,
          })
          break
        } catch (e) {
          lastErr = e
          if (attempt === 0) await new Promise((r) => setTimeout(r, 20_000))
        }
      }
      if (!res) throw lastErr
      const b64 = res.data?.[0]?.b64_json
      if (!b64) throw new Error('no image returned')
      // Thumbnails only need to be legible in a 110px tile.
      const sharp = (await import('sharp')).default
      const buf = await sharp(Buffer.from(b64, 'base64')).resize(512, 768, { fit: 'cover' }).png({ quality: 90 }).toBuffer()
      writeFileSync(`${OUT}/${t.id}.png`, buf)
      console.log(`  ok      ${t.name}`)
      ok++
    } catch (e) {
      const msg = String(e.message ?? e).slice(0, 90)
      console.log(`  FAILED  ${t.name}: ${msg}`)
      failed.push(t.id)
    }
  }))
}

console.log(`\n${ok}/${todo.length} generated into ${OUT}/`)
if (failed.length) console.log(`re-run for the misses: node scripts/flyer-thumbs.mjs ${failed.join(' ')}`)
