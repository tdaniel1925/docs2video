// =============================================================================
// Run the REAL kit planner (Claude) on the made-up sample stories, print what
// it chose, and keep a running ledger of what tuning has spent.
//
//   npx jiti scripts/look-samples/kit-plan-try.ts [insurance|bakery|all]
//
// Writes .shots/kit/plans/<story>.json (used by make-kit-samples.ts) and adds
// every call's cost to .shots/kit/planner-spend.json. Refuses to run once the
// ledger passes $1.50 (the tuning budget).
// =============================================================================
import fs from 'fs'
import path from 'path'
import { planKitScenes, type PlannerInput } from '../../app/_lib/kit-planner'
import { KIT_STORIES, type KitSampleStory } from './kit-stories'

const ROOT = path.resolve(__dirname, '..', '..')
const OUT = path.join(ROOT, '.shots', 'kit', 'plans')
const LEDGER = path.join(ROOT, '.shots', 'kit', 'planner-spend.json')
const BUDGET = 1.5

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && m[1] === 'ANTHROPIC_API_KEY' && !process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = m[2].replace(/^["']|["']$/g, '')
}

export function inputFor(story: KitSampleStory): PlannerInput {
  return {
    beats: story.beats.map((b) => ({ role: b.role, title: b.title, narration: b.narration, slideData: b.slideData })),
    keyMetrics: story.keyMetrics, regulated: story.regulated, recipient: story.recipient,
    brandName: story.brandName, hasPresenter: !!story.presenter, contact: story.contact, videoId: `sample-${story.id}`,
  }
}

async function main() {
  const which = process.argv[2] || 'all'
  const ledger: { at: string; story: string; source: string; calls: number; costUsd: number }[] = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : []
  const spent = () => ledger.reduce((a, r) => a + r.costUsd, 0)
  fs.mkdirSync(OUT, { recursive: true })
  for (const story of KIT_STORIES.filter((s) => which === 'all' || s.id === which)) {
    if (spent() + 0.25 > BUDGET) { console.log(`STOP: tuning ledger at $${spent().toFixed(4)} — another run could pass $${BUDGET}`); break }
    const r = await planKitScenes(inputFor(story))
    ledger.push({ at: new Date().toISOString(), story: story.id, source: r.source, calls: r.calls, costUsd: r.costUsd })
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1))
    fs.writeFileSync(path.join(OUT, `${story.id}.json`), JSON.stringify(r, null, 1))
    console.log(`\n== ${story.id}: ${r.source}, ${r.calls} call(s), $${r.costUsd.toFixed(4)}${r.note ? ` (${r.note})` : ''}`)
    if (r.issues.length) console.log('  first-answer issues:\n   - ' + r.issues.join('\n   - '))
    for (const s of r.scenes) console.log(`  ${s.id}. ${s.type.padEnd(10)} ${JSON.stringify({ ...s, id: undefined, narration: undefined, type: undefined }).slice(0, 220)}`)
  }
  console.log(`\nTuning spend so far: $${spent().toFixed(4)} of $${BUDGET}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
