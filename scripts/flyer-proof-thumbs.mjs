// Generate the SECOND thumbnail for every look: the same ordinary subject,
// rendered in each one.
//
//   node scripts/flyer-proof-thumbs.mjs            (only the missing ones)
//   node scripts/flyer-proof-thumbs.mjs --all      (redo everything)
//   node scripts/flyer-proof-thumbs.mjs rnb vip    (just these)
//
// WHY THIS EXISTS. A tile showing pumpkins says "this is the Halloween one",
// and no amount of small print underneath undoes that. Somebody who runs an
// HVAC business scrolls straight past it — even though the burnt orange and
// the hand-lettering are exactly what they wanted, and the pumpkins were never
// part of the deal.
//
// A sentence claiming "you can use this for anything" is a claim. A picture of
// an HVAC van in that same warm hand-lettered style is proof.
//
// THE SUBJECT IS THE SAME FOR ALL OF THEM, on purpose. Scroll the picker and
// the van never changes while the look changes underneath it — which turns a
// pile of themed posters into an actual style catalogue. Rotating the subject
// per shelf would look more natural and prove nothing, because you could no
// longer tell a style difference from a subject difference.
//
// It is deliberately unglamorous. If a look can carry a service van and a phone
// number and still look good, a customer believes it can carry anything. A
// coffee shop would flatter every one of them and convince nobody.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import OpenAI from 'openai'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { VISIBLE_STYLES, FLYER_SIZES, flyerPrompt } = await import('../app/_lib/flyer-engine/index.ts')
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL = process.env.FLYER_IMAGE_MODEL || 'gpt-image-2'
const OUT = 'public/flyer-templates'
mkdirSync(OUT, { recursive: true })

const args = process.argv.slice(2)
const all = args.includes('--all')
const only = args.filter((a) => !a.startsWith('--'))

/** The one subject every look has to carry. */
const SUBJECT =
  'A working heating and air-conditioning service van parked on a suburban driveway, ' +
  'and a technician in work clothes carrying a toolbag. Ordinary, real, everyday work.'

/** The same words on every tile, so only the look changes. */
const FIELDS = {
  eyebrow: 'LOCAL AND TRUSTED',
  headline: '24/7 HEAT REPAIR',
  subhead: 'Same-day service, seven days a week',
  price: '$89 TUNE-UP',
  cta: 'BOOK A VISIT',
  contact: '555-0142 · northsideheating.com',
}

const portrait = FLYER_SIZES.find((s) => s.id === 'letter')
// WEBP, AND SMALL. These are shown at about 118 pixels wide in a grid of a
// hundred. The first version of this saved them exactly as the API returned
// them — 1024x1536 PNG, two megabytes each — which is 215MB of photographs to
// draw a wall of thumbnails. Same picture, a thirtieth of the weight.
const THUMB = { w: 512, h: 768, quality: 82 }
const alt = (id) => `${OUT}/${id}-alt.webp`

const todo = VISIBLE_STYLES.filter((t) => {
  if (only.length) return only.includes(t.id)
  if (all) return true
  return !existsSync(alt(t.id))
})

if (!todo.length) {
  // NAME THE REASON. Asking for a folded style used to print "nothing to
  // generate", which reads as "already done" — when the truth is that style is
  // not in the picker any more and never gets a tile.
  const notShown = only.filter((id) => !VISIBLE_STYLES.some((t) => t.id === id))
  if (notShown.length) console.log(`not in the picker (folded into another look): ${notShown.join(', ')}`)
  else console.log('nothing to generate — every look already has its proof tile. Pass --all to redo.')
  process.exit(0)
}
console.log(`generating ${todo.length} proof tile(s) with ${MODEL}\n`)

let ok = 0
const failed = []
// Small batches: the image API rate-limits hard, and a wall of 429s wastes the
// whole run rather than just the tail of it.
for (let i = 0; i < todo.length; i += 4) {
  const batch = todo.slice(i, i + 4)
  await Promise.all(batch.map(async (t) => {
    try {
      let res, lastErr
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await ai.images.generate({
            model: MODEL,
            // keepMotif stays FALSE. The whole point of the tile is the look
            // without its props; a pumpkin sneaking into the van picture would
            // prove the opposite of what it is here to prove.
            prompt: flyerPrompt(t, FIELDS, portrait, [], false, false, SUBJECT, false),
            size: '1024x1536', quality: 'high', n: 1,
          })
          break
        } catch (e) {
          lastErr = e
          // One retry. A rate-limit or a dropped socket is not a reason to
          // leave a look with no proof tile forever.
          if (attempt === 0) await new Promise((r) => setTimeout(r, 20_000))
        }
      }
      if (!res) throw lastErr
      const b64 = res.data?.[0]?.b64_json
      if (!b64) throw new Error('no image came back')
      const sharp = (await import('sharp')).default
      writeFileSync(alt(t.id), await sharp(Buffer.from(b64, 'base64'))
        .resize(THUMB.w, THUMB.h, { fit: 'cover' })
        .webp({ quality: THUMB.quality })
        .toBuffer())
      ok++
      console.log(`  ok   ${t.id}  (${t.name})`)
    } catch (e) {
      failed.push({ id: t.id, why: e instanceof Error ? e.message.slice(0, 90) : String(e) })
      console.log(`  FAIL ${t.id}  ${e instanceof Error ? e.message.slice(0, 90) : e}`)
    }
  }))
}

console.log(`\n${ok} generated, ${failed.length} failed.`)
// NAMED, not counted. A run that says "6 failed" and stops leaves somebody
// diffing directories to find out which; the ids are what you feed back in.
if (failed.length) {
  console.log('\nRe-run just these:\n  node scripts/flyer-proof-thumbs.mjs ' + failed.map((f) => f.id).join(' '))
  for (const f of failed) console.log(`  ${f.id.padEnd(30)} ${f.why}`)
  process.exit(1)
}
