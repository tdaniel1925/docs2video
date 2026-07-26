// Proof that a brand color re-tints the deck without breaking legibility.
// Builds the same sample deck under several real brand colors — including a
// deliberately hostile one (bright yellow, which would be invisible on cream
// if it weren't contrast-guarded) — and screenshots slide 1 + a stat slide.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { build } from 'esbuild'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'out', '_accent')
mkdirSync(OUT, { recursive: true })

// Bundle the real engine so we test the shipping code path, not a copy.
const bundle = join(OUT, 'engine.mjs')
await build({
  entryPoints: [join(ROOT, 'app', '_lib', 'presentation.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error',
})
const { buildPresentationHtml } = await import('file://' + bundle.replace(/\\/g, '/'))

const scenes = [
  {
    title: 'Your Personalized Illustration', _role: 'cover',
    narration: 'Hi Bill — here is a short walk through your illustration.',
    slideData: { headline: 'A plan built around your family' },
  },
  {
    title: 'What it costs', narration: 'Your premium is fifteen thousand a year for twenty years.',
    slideData: {
      headline: 'What you put in',
      stats: [
        { value: '$15,000', label: 'Annual premium' },
        { value: '20 Years', label: 'Pay period' },
        { value: '$300,000', label: 'Total outlay' },
      ],
      bullets: ['Level premium — it never increases', 'Flexible after year ten'],
    },
  },
  {
    title: 'What it becomes', narration: 'By age sixty-five the projected value is one hundred seventy-six thousand.',
    slideData: {
      headline: 'What it becomes',
      stats: [
        { value: '$176,204', label: 'Projected cash value' },
        { value: '98%', label: 'Participation rate' },
        { value: 'Preferred Non-Tobacco', label: 'Underwriting class' },
      ],
    },
  },
  {
    title: 'Next step', _role: 'closing',
    narration: 'Call me any time and we will walk through it together.',
    slideData: { headline: "Let's talk it through", cta: 'Call 1-555-201-8890' },
  },
]

const CASES = [
  ['template', undefined],
  ['navy', '#1B365D'],       // the brands-table default
  ['apex-red', '#C0272D'],
  ['forest', '#1F6F4A'],
  ['hostile-yellow', '#FFD700'], // must be darkened to stay readable on cream
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 })

for (const [name, color] of CASES) {
  const html = buildPresentationHtml({
    title: 'Your Personalized Illustration',
    subtitle: 'Prepared for the Propper family',
    scenes, templateId: 'jordyn', primaryColor: color,
    brandName: 'Northbridge Financial',
    recipientName: 'Bill Propper',
    presenter: { name: 'Trent Daniel', contactLine: '1-555-201-8890  ·  trent@northbridge.com' },
    disclaimer: 'Figures shown are illustrated and not guarantees.',
  })
  const file = join(OUT, `${name}.html`)
  writeFileSync(file, html)
  await page.goto('file://' + file.replace(/\\/g, '/'))
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(OUT, `${name}-1-cover.png`) })
  // Advance two slides to the stat card.
  for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(900) }
  await page.screenshot({ path: join(OUT, `${name}-2-stats.png`) })
  // Report the resolved accent so the contrast guard is visible in the log.
  const got = html.match(/--gold:(#[0-9a-f]{6})/i)?.[1] ?? '(template default)'
  console.log(`${name.padEnd(16)} in=${String(color ?? '—').padEnd(9)} → --gold=${got}`)
}

await browser.close()
console.log('\nwrote', OUT)
