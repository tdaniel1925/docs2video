// Builds the 12-page "AI in Medicine" infographic deck through the real
// presentation engine (so it inherits the brand-accent system, the byline,
// the one-window layout and the narrated player).
//
//   node remotion/scripts/gen-aimed-illos.mjs     # art
//   node remotion/scripts/gen-aimed-vo.mjs        # narration (optional)
//   node remotion/scripts/build-aimed-deck.mjs    # this
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { build } from 'esbuild'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const ILLOS = join(HERE, '..', '.aimed-illos')
const VO = join(HERE, '..', '.aimed-vo')
const OUT = join(HERE, '..', 'out')
mkdirSync(OUT, { recursive: true })

const ACCENT = process.env.ACCENT || '#0E7C7B'

// Inline the art so the deck is one portable file — it opens from disk, an
// email attachment or a share link with no asset hosting at all.
const dataUri = (f) => {
  const p = join(ILLOS, f)
  if (!existsSync(p)) { console.warn('[deck] missing art:', f); return null }
  return 'data:image/png;base64,' + readFileSync(p).toString('base64')
}

/** 12 pages. `illo` names the generated art; slideData drives what's on screen,
 *  narration drives what's in the ear — deliberately not the same words. */
const PAGES = [
  {
    illo: 'cover', _role: 'cover',
    title: 'AI in Medicine',
    narration: "Artificial intelligence has arrived in medicine — not as a replacement for clinicians, but as an instrument in their hands. Here's an honest look at where it's working, where it isn't, and what it takes to adopt it safely.",
    slideData: { headline: 'AI in Medicine' },
  },
  {
    illo: 'adoption',
    title: 'The moment',
    narration: "This isn't a forecast anymore. Regulators have cleared over a thousand AI-enabled medical devices, and roughly two thirds of physicians now report using some form of AI in their practice — up sharply in a single year.",
    slideData: {
      headline: 'It already left the lab',
      stats: [
        { value: '1,000+', label: 'FDA-cleared AI devices' },
        { value: '66%', label: 'Physicians using AI' },
        { value: '3x', label: 'Growth in one year' },
      ],
      bullets: [
        'Adoption is broad but shallow — most use is documentation, not diagnosis',
        'The gap between what is cleared and what is deployed is still wide',
      ],
    },
  },
  {
    illo: 'pipeline',
    title: 'How it works',
    narration: "Underneath the branding, every clinical model does the same three things. It learns patterns from historical data, scores a new case against those patterns, and hands a clinician something to act on. The arrow always points back to a person.",
    slideData: {
      headline: 'Three steps, every time',
      bullets: [
        'Learn — patterns extracted from millions of prior records and images',
        'Score — a new patient measured against those patterns',
        'Surface — a ranked suggestion handed to a clinician, never an order',
      ],
      cta: 'The model proposes. The clinician disposes.',
    },
  },
  {
    illo: 'imaging',
    title: 'Imaging',
    narration: "Imaging is where the evidence is strongest. In screening mammography, AI-supported reading has matched or beaten double reading by two radiologists, while cutting the reading workload substantially.",
    slideData: {
      headline: 'Where the evidence is strongest',
      stats: [
        { value: '20%', label: 'More cancers detected' },
        { value: '44%', label: 'Less reading workload' },
        { value: '80k', label: 'Women in the trial' },
      ],
      bullets: [
        'Strongest results are in screening, where volume is high and signal is subtle',
        'It flags attention — the radiologist still makes the call',
      ],
    },
  },
  {
    illo: 'risk',
    title: 'Early detection',
    narration: "The second real win is time. Risk models running quietly against the chart can surface deterioration, sepsis, or a rising readmission risk hours before it would otherwise be noticed — and hours are the whole game.",
    slideData: {
      headline: 'Buying back hours',
      stats: [
        { value: '6 hrs', label: 'Typical early warning' },
        { value: '18%', label: 'Lower sepsis mortality' },
      ],
      bullets: [
        'Value comes from earlier action, not from a more accurate label',
        'A warning nobody routes to a human is a warning that did nothing',
      ],
    },
  },
  {
    illo: 'discovery',
    title: 'Discovery',
    narration: "In drug discovery, the contribution is narrowing the search. Structure prediction collapsed a problem that once took years per protein into an afternoon — and the resulting candidates are now entering human trials.",
    slideData: {
      headline: 'Narrowing the search',
      stats: [
        { value: '200M+', label: 'Protein structures predicted' },
        { value: '~30 mo', label: 'Discovery to trial' },
      ],
      bullets: [
        'It shrinks the candidate space; it does not shorten the trial',
        'Clinical validation remains the long, expensive, unavoidable part',
      ],
    },
  },
  {
    illo: 'scribe',
    title: 'Documentation',
    narration: "The quietest success is also the biggest. Ambient documentation listens to the visit and drafts the note, giving clinicians back around an hour a day and measurably reducing burnout — without touching a single clinical decision.",
    slideData: {
      headline: 'The quiet win',
      stats: [
        { value: '1 hr/day', label: 'Time returned' },
        { value: '−30%', label: 'Burnout scores' },
        { value: '0', label: 'Clinical decisions touched' },
      ],
      bullets: [
        'Lowest risk and highest adoption of anything on this list',
        'It fixes the keyboard, not the medicine — which is the point',
      ],
    },
  },
  {
    illo: 'triage',
    title: 'Flow',
    narration: "Triage and scheduling are where AI touches the largest number of patients, and where it draws the least attention. Sorting a queue well is unglamorous, and it moves outcomes.",
    slideData: {
      headline: 'Sorting the queue',
      bullets: [
        'Imaging worklists reordered so the critical scan is read first',
        'No-show prediction that fills slots instead of wasting them',
        'Capacity forecasting that staffs the surge before it lands',
      ],
      cta: 'Unglamorous, high-volume, and consistently profitable.',
    },
  },
  {
    illo: 'evidence',
    title: 'Proven vs. promised',
    narration: "Now the honest part. Most published models never reach a patient. The failure is rarely the math — it's that a model trained in one health system quietly degrades in the next.",
    slideData: {
      headline: 'Most models never reach a patient',
      stats: [
        { value: '<5%', label: 'Reach clinical use' },
        { value: '2%', label: 'Externally validated' },
      ],
      bullets: [
        'Performance drops when the model meets a different population',
        'Ask for external validation, not the internal test set',
      ],
    },
  },
  {
    illo: 'risks',
    title: 'Risks',
    narration: "Three failure modes deserve real weight. Models inherit the bias in their training data. They state wrong answers with complete confidence. And when one causes harm, accountability is genuinely unsettled.",
    slideData: {
      headline: 'Three ways it fails',
      bullets: [
        'Bias — a model trained on one population underserves another',
        'Confident error — fluent, well-formatted, and wrong',
        'Accountability — the liability question has no settled answer yet',
      ],
      cta: 'Confidence is not a measure of accuracy.',
    },
  },
  {
    illo: 'governance',
    title: 'Adopting safely',
    narration: "Which is why the organizations doing this well are boring about it. Start where an error is recoverable, keep a clinician in the loop, monitor for drift after go-live, and be able to explain any decision to the patient it affected.",
    slideData: {
      headline: 'What good adoption looks like',
      bullets: [
        'Start where a mistake is recoverable — documentation before diagnosis',
        'A clinician signs off on anything that touches care',
        'Monitor after go-live; models drift as your population changes',
        'Be able to explain any decision to the patient it affected',
      ],
    },
  },
  {
    illo: 'close', _role: 'closing',
    title: 'Thank you',
    narration: "The technology is ready enough. The deciding factor is how carefully it gets adopted. I'd welcome the chance to talk it through with you.",
    slideData: { headline: "Let's talk it through", cta: 'Questions welcome' },
  },
]

// ── Build ──
const bundle = join(OUT, '_aimed-engine.mjs')
await build({
  entryPoints: [join(ROOT, 'app', '_lib', 'presentation.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error',
})
const { buildPresentationHtml } = await import('file://' + bundle.replace(/\\/g, '/'))

// Attach the generated art to each scene as an inlined data URI.
const scenes = PAGES.map((p) => {
  const { illo, ...rest } = p
  const src = dataUri(`${illo}.png`)
  return { ...rest, imageUrl: src ?? undefined, slideData: { ...rest.slideData, imageUrl: src ?? undefined } }
})

// Narration clips, if gen-aimed-vo.mjs has been run.
let voClips
if (existsSync(VO)) {
  const files = readdirSync(VO).filter((f) => f.endsWith('.mp3'))
  if (files.length) {
    voClips = PAGES.map((_, i) => {
      const p = join(VO, `${String(i).padStart(2, '0')}.mp3`)
      return existsSync(p) ? readFileSync(p).toString('base64') : ''
    })
    console.log(`[deck] narration attached (${files.length} clips)`)
  }
}

const html = buildPresentationHtml({
  title: 'AI in Medicine',
  subtitle: 'What works, what does not, and what it takes to adopt it safely',
  scenes,
  templateId: 'jordyn',
  primaryColor: ACCENT,
  brandName: 'PrismGraphs',
  presenter: {
    name: 'Trent Daniel',
    photoUrl: process.env.PRESENTER_PHOTO || undefined,
    contactLine: '1-555-014-2200  ·  trent@prismgraphs.com  ·  prismgraphs.com',
  },
  logoUrl: process.env.LOGO_URL || undefined,
  voClips,
})

const outFile = join(OUT, 'ai-in-medicine.html')
writeFileSync(outFile, html)
console.log('[deck] wrote', outFile, `(${(html.length / 1024 / 1024).toFixed(1)} MB, self-contained)`)
