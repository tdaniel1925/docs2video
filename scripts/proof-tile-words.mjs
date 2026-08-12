// =============================================================================
// Read the words back off all 105 proof tiles.
//
// The first one I looked at by eye said "LOCCAL AND TRUSTED". These tiles are
// the shop window — they are the argument that the app gets lettering right —
// and a misspelling in the shop window costs more than one in a customer's
// flyer, because it is seen by everybody who visits and it is seen first.
//
// This is the same check the app runs on a customer's design, pointed at our
// own work. If it cannot find our mistakes it will not find theirs.
//
//   node scripts/proof-tile-words.mjs            (check them all)
//   node scripts/proof-tile-words.mjs --selftest (prove it catches one)
// =============================================================================

import { readFileSync, existsSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const { VISIBLE_STYLES } = await import('../app/_lib/flyer-engine/index.ts')
const { checkWords } = await import('../app/_lib/image-engine.ts')

/** Exactly the words the generator was told to put on every tile. */
const MUST_SAY = [
  'LOCAL AND TRUSTED',
  '24/7 HEAT REPAIR',
  'Same-day service, seven days a week',
  '$89 TUNE-UP',
  'BOOK A VISIT',
  '555-0142',
  'northsideheating.com',
]

const selftest = process.argv.includes('--selftest')
const path = (id) => `public/flyer-templates/${id}-alt.webp`

if (selftest) {
  // BOTH DIRECTIONS, and the second one is the one that matters.
  //
  // Asking for a word that is not there proves the checker can say no. But a
  // checker that cannot open the file AT ALL — wrong format, unreadable buffer,
  // throttled — also says no to everything, and would sail through a one-sided
  // test while reporting all 105 tiles as broken. Or worse, the reverse: the
  // whole point of checkWords is that it fails SOFT, treating an unreadable
  // image as "fine". So it must also be shown finding a word that IS there.
  const first = VISIBLE_STYLES.find((t) => existsSync(path(t.id)))
  const img = readFileSync(path(first.id))

  const absent = await checkWords(img, ['PINEAPPLE UPSIDE DOWN CAKE'])
  const present = await checkWords(img, ['BOOK A VISIT'])

  const ok = !absent.ok && present.ok
  console.log(ok
    ? `SELF-TEST PASSED — ${first.id}: found "BOOK A VISIT", did not find a word that is not there.`
    : !absent.ok && !present.ok
      ? 'SELF-TEST FAILED — it rejects everything, so it is not reading the file at all (wrong format?).'
      : 'SELF-TEST FAILED — it approved a word that is not on the tile, so it is agreeing rather than reading.')
  process.exit(ok ? 0 : 1)
}

const bad = []
let checked = 0

// Six at a time. The reader is cheap and fast, but 105 at once gets throttled
// and a throttled check returns "fine" — which is the worst possible answer.
for (let i = 0; i < VISIBLE_STYLES.length; i += 6) {
  await Promise.all(VISIBLE_STYLES.slice(i, i + 6).map(async (t) => {
    if (!existsSync(path(t.id))) return
    const r = await checkWords(readFileSync(path(t.id)), MUST_SAY)
    checked++
    if (!r.ok) bad.push({ id: t.id, name: t.name, missing: r.missing })
  }))
  process.stdout.write(`\r  read ${checked} of ${VISIBLE_STYLES.length}`)
}

console.log(`\n\n${checked} tiles read, ${bad.length} with wording that does not match.\n`)
for (const b of bad) {
  console.log(`  ${b.id.padEnd(30)} ${b.name}`)
  for (const w of b.missing) console.log(`      missing or misspelled: "${w}"`)
}

if (bad.length) {
  console.log('\nRedo them:\n  node scripts/flyer-proof-thumbs.mjs --all ' + bad.map((b) => b.id).join(' '))
  process.exit(1)
}
console.log('Every tile carries every word exactly as written.')
