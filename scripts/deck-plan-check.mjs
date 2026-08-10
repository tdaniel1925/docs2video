// Does the deck planner invent facts?
//
//   node scripts/deck-plan-check.mjs
//
// The brief below deliberately contains NO numbers, durations or names. Every
// figure that comes back is therefore invented, and a made-up claim on a slide
// someone presents to a room is the worst thing this feature can do.
//
// The first version of this only looked for percentages, dollars and multiples,
// and passed a deck promising "set up in under an hour" and "a 30-minute call".
// Time promises read as modest detail rather than claims, which is exactly why
// they slip through.
import fs from 'node:fs'
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { planDeck } = await import('../app/_lib/deck-plan.ts')

// A brief with NO numbers in it at all. The failure that matters is a deck that
// invents "40% faster" and gets presented to a room.
const brief = 'A short deck for a small accounting firm introducing our new bookkeeping service to local restaurant owners. We want to explain what it covers, why restaurants specifically, and ask them to book a free chat.'

const plan = await planDeck(brief, 6)
console.log(`title: ${plan.title}`)
console.log(`slides: ${plan.slides.length}\n`)
for (const [i, s] of plan.slides.entries()) {
  console.log(`${i + 1}. [${s.role}] ${s.fields.headline}`)
  if (s.fields.subhead) console.log(`     ${s.fields.subhead}`)
  for (const d of s.fields.details ?? []) console.log(`     - ${d}`)
  if (s.fields.cta) console.log(`     CTA: ${s.fields.cta}`)
}

const all = JSON.stringify(plan)
const invented = all.match(/\b\d+ ?%|\$[\d,]+|\b\d+x\b/gi)
console.log()
console.log(plan.slides.length === 6 ? '  PASS  exactly 6 slides' : `  FAIL  got ${plan.slides.length}`)
console.log(plan.slides[0].role === 'cover' ? '  PASS  opens with a cover' : `  FAIL  opens with ${plan.slides[0].role}`)
console.log(plan.slides.at(-1).role === 'closing' ? '  PASS  ends with a closing' : `  FAIL  ends with ${plan.slides.at(-1).role}`)
console.log(!invented ? '  PASS  invented no figures (brief had none)' : `  FAIL  invented: ${invented.join(', ')}`)
const longest = Math.max(...plan.slides.map((s) => s.fields.headline.length))
console.log(longest <= 60 ? `  PASS  longest headline ${longest} chars` : `  FAIL  headline ${longest} chars is a sentence, not a slide`)
