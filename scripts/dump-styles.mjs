// Pull the style list out of the engine as plain data, so agents can work on it
// without reading — or accidentally rewriting — a two-thousand-line file.
//
// Reads the real source rather than a hand-kept copy, because a hand-kept copy
// of 225 things goes stale within a day and nobody notices until the picker and
// the generator disagree about what a style actually is.
import fs from 'node:fs'

const src = fs.readFileSync('app/_lib/flyer-engine/index.ts', 'utf8')
const body = src.slice(src.indexOf('export const FLYER_TEMPLATES'))

const FIELD = "'((?:[^'\\\\]|\\\\.)*)'"
const re = new RegExp(
  `id:\\s*${FIELD},\\s*name:\\s*${FIELD},\\s*category:\\s*${FIELD},\\s*` +
  `scene:\\s*${FIELD},\\s*lettering:\\s*${FIELD},`,
  'g',
)

const unesc = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\')
const out = []
let m
while ((m = re.exec(body))) {
  out.push({
    id: m[1], name: unesc(m[2]), category: m[3],
    scene: unesc(m[4]), lettering: unesc(m[5]),
  })
}

fs.mkdirSync('.styles', { recursive: true })
fs.writeFileSync('.styles/current.json', JSON.stringify(out, null, 2))
console.log(`${out.length} styles dumped to .styles/current.json`)
