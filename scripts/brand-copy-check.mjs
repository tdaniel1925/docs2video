// =============================================================================
// Does a Text2Art customer ever see Docs2Video's product?
//
// Both storefronts render the SAME account pages. So a sentence like "these
// photos appear on your presentation slides" shows up for a customer who has no
// slides — which reads as "I am on the wrong website", and that is the moment
// somebody closes the tab.
//
// HOW IT DECIDES. A line that mentions video is fine if the storefront switch
// decides whether it renders. That is usually not on the same line — the guard
// opens a JSX block, or a ternary two lines up — so this tracks brace depth to
// know when it is INSIDE a guarded block, and looks back a few lines for a
// ternary condition. Crude, and it says so; what it catches reliably is the
// thing that keeps happening: a new sentence about videos added to a shared
// page with nobody thinking about the other front door.
//
// Run:  node scripts/brand-copy-check.mjs
// Prove it can fail:  node scripts/brand-copy-check.mjs --selftest
// =============================================================================

import fs from 'node:fs'

const FILES = [
  'app/(dashboard)/settings/page.tsx',
  'app/(dashboard)/brands/page.tsx',
  'app/(dashboard)/brands/new/page.tsx',
  'app/(dashboard)/brands/[id]/page.tsx',
]

/** Words that only mean something on Docs2Video. */
const VIDEO_WORDS = /\b(video|videos|presentation|presentations|share page|share pages|presenter|slide deck)\b/i

/** Anything that makes the storefront, not the code, decide what renders. */
const GUARD = /showVideoFeatures|storefront\.id|profileType === 'person'|profile_type === 'person'/

/** A comment is talking to the next developer, not to the customer. */
const COMMENT = /^\s*(\/\/|\*|\/\*|\{\/\*)/

/**
 * Lines that name a stored value or a route rather than saying anything to a
 * person. Listed one at a time on purpose — a blanket rule would quietly
 * swallow the next real mistake.
 */
const ALLOW = ['generate-video', 'photo_url', 'logo_light_url', 'logo_dark_url']

const selftest = process.argv.includes('--selftest')
const problems = []

for (const file of FILES) {
  let src = fs.readFileSync(file, 'utf8')

  // SELF-TEST: put the bug back, in memory only, and confirm the check screams.
  // A checker nobody has ever watched fail is not evidence of anything.
  if (selftest && file.endsWith('brands/page.tsx')) {
    src += '\n          <p>Your default profile is applied automatically to every video.</p>\n'
  }

  // A JSX comment can run over several lines, and the middle lines look like
  // ordinary text. Blanked out here, in place, so the line numbers still match.
  const lines = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, (m) => m.replace(/[^\n]/g, ' ')).split('\n')
  let depth = 0
  /** Depths at which a guard opened; we are guarded while any is still open. */
  const openGuards = []

  lines.forEach((line, i) => {
    const guardsHere = GUARD.test(line) && !COMMENT.test(line)
    const before = depth
    depth += (line.match(/[{(]/g) ?? []).length - (line.match(/[})]/g) ?? []).length

    // A guard that opens a block protects everything until the block closes.
    if (guardsHere && depth > before) openGuards.push(before)
    while (openGuards.length && depth <= openGuards[openGuards.length - 1]) openGuards.pop()

    // Comments talk to the next developer, not to the customer — including
    // the ones tacked onto the end of a line of real code.
    const said = line.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/, ' ')
    if (!VIDEO_WORDS.test(said)) return
    if (COMMENT.test(line)) return
    if (guardsHere || openGuards.length) return
    if (ALLOW.some((a) => line.includes(a))) return
    // A ternary condition often sits a line or two above its branches.
    if (lines.slice(Math.max(0, i - 3), i).some((l) => GUARD.test(l))) return

    problems.push(`${file}:${i + 1}  ${line.trim().slice(0, 100)}`)
  })
}

if (selftest) {
  const caught = problems.some((p) => p.includes('applied automatically to every video'))
  console.log(caught
    ? 'SELF-TEST PASSED — the check does catch an unguarded video sentence.'
    : 'SELF-TEST FAILED — the check missed a planted bug, so a pass means nothing.')
  process.exit(caught ? 0 : 1)
}

if (problems.length) {
  console.log(`${problems.length} line(s) talk about video where Text2Art can see them:\n`)
  problems.forEach((p) => console.log('  ' + p))
  console.log('\nWrap each one in storefront.showVideoFeatures, or say it in words that fit both.')
  process.exit(1)
}

console.log(`Clean — ${FILES.length} shared account pages say nothing about video that Text2Art can see.`)
