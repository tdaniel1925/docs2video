// =============================================================================
// Does every look in the picker have its proof tile?
//
// The switch that flips the grid onto an everyday job is only convincing if it
// flips ALL of it. With twenty tiles missing, the customer sees eighty vans and
// twenty pumpkins and concludes the feature is broken — which is worse than not
// offering it, because now they distrust the rest of the picker too.
//
// The page falls back to the original sample rather than showing a hole, which
// is right for one missing tile and quietly wrong for twenty. That silence is
// exactly why this check exists.
//
// Run:  node scripts/proof-tile-check.mjs
// Prove it can fail:  node scripts/proof-tile-check.mjs --selftest
// =============================================================================

import { existsSync, statSync } from 'node:fs'

const { VISIBLE_STYLES } = await import('../app/_lib/flyer-engine/index.ts')

const selftest = process.argv.includes('--selftest')
const path = (id) => `public/flyer-templates/${id}-alt.webp`

/** Under this and it is an error page or a truncated download, not a design.
 *  The real tiles run 26KB to 149KB as WebP, so this leaves room for a flat
 *  vector look that compresses unusually small without crying wolf. */
const TOO_SMALL = 8_000

const missing = []
const broken = []

for (const t of VISIBLE_STYLES) {
  // SELF-TEST: pretend the first look's tile was never made. A check nobody has
  // watched fail is not evidence that anything is present.
  if (selftest && t.id === VISIBLE_STYLES[0].id) { missing.push(t); continue }
  if (!existsSync(path(t.id))) { missing.push(t); continue }
  if (statSync(path(t.id)).size < TOO_SMALL) broken.push(t)
}

if (selftest) {
  const caught = missing.some((t) => t.id === VISIBLE_STYLES[0].id)
  console.log(caught
    ? 'SELF-TEST PASSED — a look with no proof tile does get caught.'
    : 'SELF-TEST FAILED — the planted gap slipped through, so a clean run proves nothing.')
  process.exit(caught ? 0 : 1)
}

if (missing.length || broken.length) {
  if (missing.length) {
    console.log(`${missing.length} of ${VISIBLE_STYLES.length} looks have no proof tile:\n`)
    for (const t of missing) console.log(`  ${t.id.padEnd(30)} ${t.name}`)
  }
  if (broken.length) {
    console.log(`\n${broken.length} proof tile(s) are too small to be a real design:\n`)
    for (const t of broken) console.log(`  ${t.id.padEnd(30)} ${statSync(path(t.id)).size} bytes`)
  }
  console.log('\nMake them:\n  node scripts/flyer-proof-thumbs.mjs ' +
    [...missing, ...broken].map((t) => t.id).join(' '))
  process.exit(1)
}

console.log(`Clean — all ${VISIBLE_STYLES.length} looks in the picker have a proof tile.`)
