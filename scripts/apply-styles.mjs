// =============================================================================
// Write the split-and-merged style list back into the engine.
//
// NOTHING IS DELETED. Every one of the 225 keeps its entry, its id and its
// sample image. A folded style gains a `mergedInto` pointing at the look that
// swallowed it, and the picker skips it — so a merge is one field, and pulling
// one back apart is deleting that field. If I have merged two things you think
// are different, that is a one-word fix rather than an archaeology exercise.
//
// The subjects that came off the folded styles are NOT thrown away either. They
// become the motif library: the pumpkins and the disco ball you can put back on
// purpose, on any look you like.
//
// Run: node scripts/apply-styles.mjs
// =============================================================================

import fs from 'node:fs'

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const split = read('.styles/split.json')
const merge = read('.styles/merge.json')
// The agents were given only the fields they needed to rewrite, so the original
// category and the old mixed paragraph come from the untouched dump. The
// paragraph is kept as the fallback for anything that ever fails to split.
const original = Object.fromEntries(read('.styles/current.json').map((s) => [s.id, s]))

/**
 * The three pairs the first pass could not see, judged by hand afterwards.
 *
 * They gave themselves away by landing on identical names — one agent per
 * family meant nobody could look across. The cross-family hunt that followed
 * was TOLD about these three so it would not waste skeptics re-finding them,
 * which means they never got the two-skeptic treatment the other eighteen got.
 * So they are decided here, in the open, with the reason written down.
 */
const HAND_MERGES = [
  {
    id: 'business-blueprint-consult', into: 'sale-blueprint',
    why: 'Both are Prussian blue with white thin-line drafting, a faint measuring grid, dimension arrows, uniform strokes and a flat matte finish, lettered in white drafting-stencil capitals. The differences are objects — a coffee ring, compass arcs — which is precisely the half we just separated out.',
  },
  {
    id: 'food-clay-3d', into: 'services-clay-3d',
    why: 'Matte putty forms, warm sand against warm peach, long soft studio shadows, extruded rounded clay letters with a contact shadow. Sand versus peach is not a choice anybody makes.',
  },
]

/**
 * Kept apart despite sharing a name. Both are glassmorphism, but one is airy
 * violet-and-teal at low contrast and the other is dark moody indigo and plum.
 * Light versus dark is exactly the axis a customer picks on — the same reason
 * the skeptics kept warm bone and cool bone apart. Renamed, not merged.
 */
const RENAMES = { 'fitness-training-glass': 'Midnight Glass' }

const folded = new Map()
const finalName = new Map()

for (const fam of merge.families) {
  for (const k of fam.keep) finalName.set(k.id, k.lookName)
  for (const m of fam.merges) folded.set(m.id, { into: m.into, why: m.why })
}
for (const h of HAND_MERGES) folded.set(h.id, { into: h.into, why: h.why })
for (const [id, name] of Object.entries(RENAMES)) finalName.set(id, name)

// A style folded into a style that was itself folded would vanish from the
// picker with nothing to click. Follow the chain to something real, and shout
// if it does not terminate rather than writing a dangling pointer.
const resolve = (id, seen = new Set()) => {
  const f = folded.get(id)
  if (!f) return id
  if (seen.has(id)) throw new Error(`merge loop at ${id}`)
  seen.add(id)
  return resolve(f.into, seen)
}
for (const id of folded.keys()) {
  const end = resolve(id)
  if (!finalName.has(end)) throw new Error(`${id} folds into ${end}, which is not a kept look`)
  folded.get(id).into = end
}

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const entries = split.map((s) => {
  const was = original[s.id]
  if (!was) throw new Error(`${s.id} is not in the original list — an id was invented or changed`)
  const f = folded.get(s.id)
  return [
    '  {',
    `    id: '${esc(s.id)}', name: '${esc(finalName.get(s.id) ?? s.lookName)}', category: '${esc(was.category)}',`,
    f ? `    mergedInto: '${esc(f.into)}', mergedWhy: '${esc(f.why)}',` : `    family: '${esc(s.family)}',`,
    `    look: '${esc(s.look)}',`,
    s.subject ? `    subject: '${esc(s.subject)}',` : '',
    `    lettering: '${esc(s.lettering)}',`,
    // The old mixed paragraph, kept verbatim. It is the fallback if a look ever
    // turns out to be unusable, and it is the only record of what this style
    // was before — worth more in the file than in the git history.
    `    scene: '${esc(was.scene)}',`,
    '  },',
  ].filter(Boolean).join('\n')
})

const src = fs.readFileSync('app/_lib/flyer-engine/index.ts', 'utf8')
const start = src.indexOf('export const FLYER_TEMPLATES: FlyerTemplate[] = [')
const end = src.indexOf('\n]\n', start)
if (start < 0 || end < 0) throw new Error('could not find the template list')

const next =
  src.slice(0, start) +
  'export const FLYER_TEMPLATES: FlyerTemplate[] = [\n' +
  entries.join('\n') +
  src.slice(end)

fs.writeFileSync('app/_lib/flyer-engine/index.ts', next)

const kept = split.length - folded.size
console.log(`${split.length} styles written — ${kept} shown in the picker, ${folded.size} folded but kept in the file.`)
