// Generate a labelled batch for one experiment.
//
//   node -r dotenv/config logo-lab/run.mjs steer      dotenv_config_path=.env.local
//   node -r dotenv/config logo-lab/run.mjs ablation   dotenv_config_path=.env.local
//   node -r dotenv/config logo-lab/run.mjs symbol     dotenv_config_path=.env.local
//
// Each image is stored with EXACTLY what produced it — engine, steer, mark
// type, rule set, brand — so the contact sheet can hide all of that during
// rating and the report can put it back afterwards.
//
// Gemini by default: ~5s and ~4c an image against GPT Image's ~95s and ~18c.
// An ablation across a dozen rules is 200+ images. On GPT Image that is most
// of a day and $40; on Gemini it is fifteen minutes and $8. That difference is
// what makes measuring anything realistic.
import { STYLE_STEERS, ALL_RULE_IDS, MONOGRAM_STYLES, buildLogoPrompt } from '../app/_lib/logo-engine/index.ts'
import { BRANDS, MONOGRAM_BRANDS } from './brands.mjs'
import { RUNS, save, loadResults, saveResults, upsert, imageId, ENGINES, pool } from './lib.mjs'

const experiment = process.argv[2]
const engineName = process.argv.find((a) => a.startsWith('--engine='))?.split('=')[1] ?? 'gemini'
const perCell = Number(process.argv.find((a) => a.startsWith('--n='))?.split('=')[1] ?? 3)
const engine = ENGINES[engineName]
if (!experiment || !engine) {
  console.error('usage: run.mjs <steer|ablation|symbol|marktype|monogram|colour> [--engine=gemini|gptImage] [--n=3]')
  process.exit(2)
}

/** Build the list of cells to generate: each is one prompt configuration. */
function plan() {
  const cells = []
  const add = (variant, opts, brands = BRANDS) => {
    for (const b of brands) for (let i = 0; i < perCell; i++) cells.push({ variant, opts, brand: b, i })
  }

  if (experiment === 'steer') {
    // Does the reference vocabulary matter, and does naming studios beat the
    // adjectives every competitor uses? If `plain` wins, the premise is wrong.
    for (const s of Object.keys(STYLE_STEERS)) add(`steer:${s}`, { steer: s })
  } else if (experiment === 'ablation') {
    // Full set, then the full set minus exactly one rule. Whatever collapses
    // when removed is load-bearing; the rest is ceremony.
    add('rules:all', {})
    for (const id of ALL_RULE_IDS) {
      add(`rules:minus-${id}`, { rules: ALL_RULE_IDS.filter((r) => r !== id) })
    }
  } else if (experiment === 'symbol') {
    // The assumption behind letting code set the type: does the model draw a
    // better SYMBOL when it is not also handling letterforms?
    add('symbol:only', { symbolOnly: true })
    add('symbol:whole', {})
  } else if (experiment === 'marktype') {
    // Do different mark types actually produce different-looking work, or does
    // everything drift back to icon-above-name?
    for (const m of ['wordmark', 'monogram', 'pictorial', 'abstract', 'combination', 'emblem']) {
      add(`marktype:${m}`, { markType: m })
    }
  } else if (experiment === 'monogram') {
    // The premium end, and the one place colour genuinely belongs — overlapping
    // letters give you a third colour for free, from flat shapes, with no
    // gradient to break the vector conversion.
    //
    // Every construction style against two colour treatments, so the sheet
    // shows both what the letters can DO and how much colour changes the feel.
    for (const style of MONOGRAM_STYLES) {
      for (const colourWay of ['two-tone', 'overlap-blend']) {
        add(`mono:${style.id}:${colourWay}`, { markType: 'monogram', monogramStyle: style.id, colourWay }, MONOGRAM_BRANDS)
      }
    }
  } else if (experiment === 'colour') {
    // Every colour strategy against one construction, to isolate colour alone.
    for (const c of ['mono', 'two-tone', 'overlap-blend', 'block', 'accent', 'duo-split']) {
      add(`colour:${c}`, { markType: 'monogram', monogramStyle: 'interlock', colourWay: c }, MONOGRAM_BRANDS)
    }
  } else {
    console.error(`unknown experiment "${experiment}"`)
    process.exit(2)
  }
  return cells
}

const cells = plan()
console.log(`${experiment}: ${cells.length} images on ${engineName}\n`)

let done = 0
const results = loadResults()

await pool(cells, 6, async (cell) => {
  const { variant, opts, brand, i } = cell
  const id = imageId([experiment, variant, brand.id, String(i)])
  const file = `${RUNS}/${experiment}/${id}.png`
  // The palette lives on the brand, not the variant, so colours look chosen
  // rather than random. Merged here so every cell inherits it.
  const prompt = buildLogoPrompt(brand, { ...opts, palette: brand.palette })

  try {
    const buf = await engine(prompt)
    save(file, buf)
    upsert(results, {
      id, experiment, variant, engine: engineName,
      brand: brand.id, replicate: i, file, promptChars: prompt.length,
      // Ratings and gate scores are added later, by the other scripts.
    })
  } catch (e) {
    upsert(results, { id, experiment, variant, engine: engineName, brand: brand.id, replicate: i, error: e.message })
  }
  done++
  if (done % 10 === 0) console.log(`  ${done}/${cells.length}`)
})

saveResults(results)
const failed = results.images.filter((x) => x.experiment === experiment && x.error).length
console.log(`\ndone — ${cells.length - failed} images, ${failed} failed`)
console.log(`next:  node logo-lab/sheet.mjs ${experiment}`)
