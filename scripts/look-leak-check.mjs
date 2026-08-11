// =============================================================================
// Did the subject really come OUT of the look?
//
// The whole promise is that you can pick a look and put your own subject in it.
// That promise is broken the moment a look text still says "autumn leaves" or
// "gym equipment", because those words go straight into the prompt and drag the
// old picture back — which is the exact bug we are here to kill.
//
// Fifteen agents wrote these in parallel and none of them could see the others.
// Some will have left something in. This finds it.
//
// Run:  node scripts/look-leak-check.mjs
// Prove it can fail:  node scripts/look-leak-check.mjs --selftest
// =============================================================================

import fs from 'node:fs'

const looks = JSON.parse(fs.readFileSync('.styles/split.json', 'utf8'))

/**
 * Words that name a THING, a TIME or a TRADE. None of them belong in a
 * description of how something is drawn.
 *
 * Colours are deliberately absent — "pumpkin orange" is a colour and is fine.
 * That is why the check is on the word plus a boundary, and why "orange" alone
 * is not on the list.
 */
const BANNED = {
  seasons: ['autumn', 'fall foliage', 'winter', 'summer', 'spring', 'seasonal', 'harvest'],
  holidays: ['halloween', 'christmas', 'thanksgiving', 'easter', 'valentine', 'hanukkah',
    'new year', 'fourth of july', 'st patrick'],
  trades: ['restaurant', 'cafe', 'bakery', 'gym', 'nightclub', 'salon', 'dental', 'clinic',
    'real estate', 'law firm', 'barber', 'plumber', 'hvac', 'realtor', 'church'],
  // "champagne" is NOT here, and that is deliberate: it caught three looks that
  // were using it as a colour — "champagne gold", "champagne and blush palette"
  // — which is exactly the sort of word a look description SHOULD contain. The
  // bottle is banned; the colour is the point. A checker that flags the right
  // answer trains people to ignore it.
  objects: ['pumpkin', 'ice cream', 'burger', 'pizza', 'coffee cup', 'disco ball',
    'champagne flute', 'champagne bottle', 'champagne glass',
    'supercar', 'dumbbell', 'barbell', 'guitar', 'turkey', 'snowflake', 'wreath', 'balloon',
    'cocktail', 'wine glass', 'skull', 'pet', 'puppy', 'flower bouquet'],
  events: ['wedding', 'birthday', 'graduation', 'baby shower', 'funeral', 'concert',
    'festival', 'conference', 'webinar', 'open house', 'grand opening'],
}

const selftest = process.argv.includes('--selftest')
const rows = selftest
  // Plant the bug: a look that still drags its motif along. If this does not
  // get caught, a clean run means nothing.
  ? [...looks, {
      id: '__planted', lookName: 'Planted Bug', family: 'warm-rustic',
      look: 'Burnt orange and charcoal with scattered autumn leaves and a pumpkin, rough paper texture.',
      subject: '', lettering: 'x',
    }]
  : looks

const found = []
for (const s of rows) {
  const text = String(s.look ?? '').toLowerCase()
  for (const [group, words] of Object.entries(BANNED)) {
    for (const w of words) {
      if (new RegExp(`\\b${w.replace(/ /g, '\\s+')}\\b`).test(text)) {
        found.push({ id: s.id, name: s.lookName, group, word: w })
      }
    }
  }
}

if (selftest) {
  const caught = found.some((f) => f.id === '__planted')
  console.log(caught
    ? 'SELF-TEST PASSED — a look that kept its pumpkins does get caught.'
    : 'SELF-TEST FAILED — the planted bug slipped through, so a clean run proves nothing.')
  process.exit(caught ? 0 : 1)
}

// A NAMED LIST, not a count. "12 leaks" is not actionable; the id and the word
// are, because fixing one is a two-second edit once you can see it.
if (found.length) {
  console.log(`${found.length} look description(s) still name something they should not:\n`)
  for (const f of found) console.log(`  ${f.id.padEnd(28)} ${f.word.padEnd(16)} (${f.group})  — ${f.name}`)
  console.log('\nMove that word into the style\'s subject, or replace it with the colour or texture it was standing in for.')
  process.exit(1)
}

console.log(`Clean — none of the ${looks.length} look descriptions name a season, holiday, trade, object or event.`)
