// =============================================================================
// FILM ENGINE SAMPLE STILLS — every film look on real kit plans.
//
//   npx tsx scripts/look-samples/make-film-samples.ts [--looks=slides,editorial] [--stories=insurance,bakery] [--scale=0.5]
//
// The plan comes from the production path with no AI and no cost: the sample stories (kit-stories.ts) →
// kit-planner fallbackPlan → kit-engine assembleKitPlan → engine 'film' + filmTheme. Rendered through the real
// KitVideo composition; the presenter photo is served from a local web server as `assetBase` (the Lambda path).
// No voice here (scene lengths are the kit's defaults), so words land spread through each line.
//
// Out: .shots/film/<story>-<look>.jpg — one settled frame per scene, in a row.
// =============================================================================
import fs from 'fs'
import path from 'path'
import http from 'http'
import { execFileSync } from 'child_process'
import { createRequire } from 'module'
import { KIT_LOOKS, kitTimeline, type KitPlan } from '../../remotion/src/kit/spec'
import { assembleKitPlan } from '../../app/_lib/kit-engine'
import { fallbackPlan, type PlannerInput } from '../../app/_lib/kit-planner'
import { KIT_STORIES } from './kit-stories'
import type { KitScene } from '../../remotion/src/kit/spec'

/* Every scene type once (the fallback planner never writes comparison, timeline, line or donut). Made up. */
const ALL_TYPES: KitScene[] = [
  { id: 1, type: 'title', headline: 'Your 2026 Coverage Review', sub: 'Everything in your plan, in two minutes', narration: 'Here is your 2026 coverage review.' },
  { id: 2, type: 'bignumber', label: 'Death benefit', figure: { value: 500000, prefix: '$' }, context: 'Paid to your family, tax-free', landOn: 'five hundred thousand', narration: 'Your family receives five hundred thousand dollars.' },
  { id: 3, type: 'comparison', heading: 'Your premium, last year and now', left: { label: 'Last year', figure: { value: 91.3, prefix: '$', decimals: 2 }, points: ['Same cover', 'No rider'] }, right: { label: 'This year', figure: { value: 84.5, prefix: '$', decimals: 2 }, points: ['Same cover', 'Critical illness rider'] }, verdict: 'Less a month, and more included', narration: 'Last year you paid ninety-one thirty. This year it is eighty-four fifty.' },
  { id: 4, type: 'timeline', heading: 'How it works over time', steps: [{ when: '2026', label: 'Cover starts' }, { when: '2036', label: 'Ava finishes school' }, { when: '2039', label: 'Leo finishes school' }, { when: '2046', label: 'Term ends' }], narration: 'Cover starts now and runs to twenty forty-six.' },
  { id: 5, type: 'chart', heading: 'Where the money would go', kind: 'donut', points: [{ label: 'Mortgage', value: 310000 }, { label: 'College', value: 120000 }, { label: 'Income', value: 70000 }], prefix: '$', takeaway: 'Sized to your real needs', narration: 'The mortgage, college and a year of income.' },
  { id: 6, type: 'chart', heading: 'Your cash value over time', kind: 'line', points: [{ label: 'Year 5', value: 8200 }, { label: 'Year 10', value: 21500 }, { label: 'Year 15', value: 39800 }, { label: 'Year 20', value: 64100 }], prefix: '$', highlight: 3, narration: 'Your cash value grows every year.' },
  { id: 7, type: 'checklist', heading: 'Why it fits your family', items: ['The price never goes up', 'Switch to permanent cover later', 'No new medical exam to switch'], narration: 'Three things make this a good fit.' },
  { id: 8, type: 'quote', quote: 'The best time to protect your family is while everything is going well.', attribution: 'Jordan Avery', narration: 'The best time to protect your family is while everything is going well.' },
  { id: 9, type: 'cta', headline: 'A 20-minute review call', action: 'Book a call', contact: { booking: 'example.com/book-jordan', phone: '(555) 014-2290', email: 'jordan@example.com', website: 'averyandco.example.com' }, narration: 'Book a twenty-minute call with me.' },
]

const ROOT = path.resolve(__dirname, '..', '..')
const REMOTION_DIR = path.join(ROOT, 'remotion')
const OUT = path.join(ROOT, '.shots', 'film')
const ASSETS = path.join(OUT, 'assets')
const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1]
const LOOKS = (arg('looks') || 'slides,editorial,bright,infographic,midnight,heritage,warm,bold,mint,swiss,luxury,night').split(',')
const STORIES = (arg('stories') || 'insurance').split(',')
const SCALE = +(arg('scale') || 0.5)
const reqRemotion = createRequire(path.join(REMOTION_DIR, 'package.json'))

async function main() {
  fs.mkdirSync(ASSETS, { recursive: true })
  // The made-up advisor's photo (the share demo's Jordan Avery).
  fs.copyFileSync(path.join(ROOT, 'public', 'share-demo', 'presenter.jpg'), path.join(ASSETS, 'presenter.jpg'))
  const server = http.createServer((req, res) => {
    const f = path.join(ASSETS, decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, ''))
    if (!f.startsWith(ASSETS) || !fs.existsSync(f)) { res.statusCode = 404; res.end(); return }
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(fs.readFileSync(f))
  })
  await new Promise<void>((r) => server.listen(0, r))
  const assetBase = `http://localhost:${(server.address() as { port: number }).port}`
  const { bundle } = reqRemotion('@remotion/bundler')
  const { renderStill, selectComposition } = reqRemotion('@remotion/renderer')
  const serveUrl = await bundle({ entryPoint: path.join(REMOTION_DIR, 'src', 'kit-entry.tsx') })
  try {
    const stories = [...KIT_STORIES, { id: 'alltypes', brandName: 'Avery & Co.', recipient: 'the Morales family', regulated: true, presenter: { name: 'Jordan Avery', role: 'Senior Advisor' }, contact: {}, keyMetrics: [], beats: [{ role: 'cover' as const, title: 'Your 2026 Coverage Review', narration: '' }] }]
    for (const story of stories.filter((s) => STORIES.includes(s.id))) {
      const input: PlannerInput = { beats: story.beats, keyMetrics: story.keyMetrics, regulated: story.regulated, recipient: story.recipient, brandName: story.brandName, hasPresenter: !!story.presenter, contact: story.contact }
      const scenes = story.id === 'alltypes' ? ALL_TYPES : fallbackPlan(input)
      for (const look of LOOKS) {
        const plan: KitPlan = { ...assembleKitPlan({ title: story.beats[0].title || '', scenes, look: KIT_LOOKS['animated-slides'], brandName: story.brandName, presenter: story.presenter, recipient: story.recipient, regulated: story.regulated }), engine: 'film', filmTheme: look }
        if (plan.brand.presenter) plan.brand.presenter.photo = 'presenter.jpg'
        const tl = kitTimeline(plan.scenes, plan.look.feel, { preview: true })
        const inputProps = { plan, assetBase, still: true }
        const composition = await selectComposition({ serveUrl, id: 'KitVideo', inputProps })
        const files: string[] = []
        for (let i = 0; i < plan.scenes.length; i++) {
          const frame = Math.min(composition.durationInFrames - 1, tl.starts[i] + Math.round(tl.durations[i] * 0.72))
          const file = path.join(OUT, 'frames', `${story.id}-${look}-${String(i).padStart(2, '0')}.jpg`)
          fs.mkdirSync(path.dirname(file), { recursive: true })
          await renderStill({ composition, serveUrl, inputProps, frame, output: file, imageFormat: 'jpeg', jpegQuality: 82, scale: SCALE, timeoutInMilliseconds: 120000 })
          files.push(file)
        }
        // --cards: the step-3 card pictures (960×540 PNG, like the kit's): cover, the first number, the closing.
        if (process.argv.includes('--cards') && story.id === 'insurance') {
          const pick = { cover: 0, data: plan.scenes.findIndex((s) => s.type === 'bignumber'), closing: plan.scenes.length - 1 }
          for (const [kind, i] of Object.entries(pick)) {
            const frame = Math.min(composition.durationInFrames - 1, tl.starts[i] + Math.round(tl.durations[i] * 0.72))
            await renderStill({ composition, serveUrl, inputProps, frame, output: path.join(ROOT, 'public', 'style-samples', `film-${look}-${kind}.png`), imageFormat: 'png', scale: 0.5, timeoutInMilliseconds: 120000 })
          }
          console.log('cards', `public/style-samples/film-${look}-{cover,data,closing}.png`)
        }
        const row = path.join(OUT, `${story.id}-${look}.jpg`)
        const cols = Math.min(5, files.length), rows = Math.ceil(files.length / cols)
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(OUT, 'frames', `${story.id}-${look}-%02d.jpg`), '-vf', `tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', '-q:v', '3', row])
        console.log('sheet', path.relative(ROOT, row), plan.scenes.map((s) => s.type).join(' '))
      }
    }
  } finally { server.close() }
}
main().catch((e) => { console.error(e); process.exit(1) })
