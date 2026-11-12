// The Walk-through card pictures (public/style-samples/walkthrough-{cover,data,closing}.png),
// from a MADE-UP quote (no real client, insurer or product), through the real
// page reader (render-service/walkthrough.js) and the real composition.
//   node scripts/look-samples/make-walkthrough-samples.mjs      (needs poppler on PATH)
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync, mkdirSync } from 'fs'
import { createRequire } from 'module'
import { execFileSync } from 'child_process'
import { join, resolve } from 'path'
const require = createRequire(import.meta.url)
const walk = require('../../render-service/walkthrough.js')
const sharp = require('sharp')

const work = resolve('remotion/out/walk-sample'); mkdirSync(work, { recursive: true })
const doc = await PDFDocument.create()
const page = doc.addPage([612, 792])
const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold)
const navy = rgb(0.11, 0.2, 0.36), ink = rgb(0.15, 0.15, 0.17), soft = rgb(0.45, 0.45, 0.5)
const t = (s, x, y, size = 9, f = font, c = ink) => page.drawText(s, { x, y, size, font: f, color: c })
page.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: navy })
t('Term Life Quotation', 40, 760, 18, bold, rgb(1, 1, 1))
t('Sample document for illustration only', 400, 762, 8, font, rgb(0.85, 0.88, 0.95))
t('YOUR POLICY HIGHLIGHTS', 40, 712, 12, bold, navy)
const rows = [['Insured age', '42'], ['Underwriting class', 'Preferred Non-Tobacco'], ['Death Benefit:', '$500,000.00'], ['Level Term Period:', '20 years'], ['Monthly Premium:', '$38.50']]
rows.forEach(([a, b], i) => { t(a, 40, 688 - i * 16, 10, bold); t(b, 190, 688 - i * 16, 10) })
t('Policy Year', 60, 590, 9, bold, navy); t('Guaranteed Annual Premium', 200, 590, 9, bold, navy); t('Guaranteed Death Benefit', 400, 590, 9, bold, navy)
page.drawLine({ start: { x: 40, y: 584 }, end: { x: 572, y: 584 }, thickness: 0.8, color: navy })
for (let y = 1; y <= 24; y++) {
  const prem = y <= 20 ? '$462.00' : `$${(3100 + (y - 21) * 410).toLocaleString('en-US')}.00`
  const db = y <= 20 ? '$500,000.00' : '$38,500.00'
  const yy = 570 - (y - 1) * 14
  t(String(y), 72, yy); t(prem, 230, yy); t(db, 430, yy)
}
t('Premiums are guaranteed for the level term period. After year 20 the death benefit decreases and premiums increase.', 40, 214, 8, font, soft)
t('This sample was made up to show how a walk-through video looks. It describes no real person, company or product.', 40, 200, 8, font, soft)
writeFileSync(join(work, 'sample.pdf'), await doc.save())

const pages = await walk.readPdf(join(work, 'sample.pdf'), join(work, 'pages'))
await walk.hideOnPages(pages, { terms: [], clientName: '' })
const p = pages[0]
const line = (txt) => p.lines.find((l) => l.text.includes(txt))
const pub = resolve('remotion/public/walk-sample'); mkdirSync(pub, { recursive: true })
await sharp(p.file).jpeg({ quality: 88 }).toFile(join(pub, 'page-1.jpg'))
const ring = walk.ringBox(p, walk.withRowMates(p, [line('Death Benefit:').id]))
const r20 = p.lines.filter((l) => /^(20|21) /.test(l.text)).map((l) => l.id)
const props = {
  pages: [{ n: 1, src: 'walk-sample/page-1.jpg', w: p.w, h: p.h }],
  scenes: [
    { kind: 'cover', voSec: 4 },
    { kind: 'page', voSec: 6, page: 1, ring, card: { type: 'figure', eyebrow: 'Your coverage', value: '$500,000', unit: 'for 20 years' } },
    { kind: 'page', voSec: 6, page: 1, ring: walk.ringBox(p, r20), card: { type: 'compare', eyebrow: 'One date to remember', a: { label: 'Years 1–20', value: '$500,000', sub: '$462.00 a year' }, b: { label: 'Year 21', value: '$38,500', sub: '$3,100.00 a year' } } },
    { kind: 'close', voSec: 4 },
  ],
  cover: { eyebrow: 'Your policy, explained', title: 'Your 20-year term life quote', prepared: 'Jordan', from: 'your agent' },
  closing: { eyebrow: 'Every number came from your document', title: 'Thank you', line: 'Your full document is below this video.' },
  // A made-up blue brand (walkthroughTheme(brandLook({ primary_color: '#0f4c81', secondary_color: '#38bdf8' }))): real videos wear the user's own look or brand.
  theme: {"bg":"#071321","glow":"#0a2641","text":"#f4f1ec","muted":"#a8aaab","accentInk":"#5c85a9","accentBig":"#356995","onAccent":"#ffffff","surface":"#182431","surfaceLine":"rgba(255,255,255,0.12)","headFont":"montserrat","bodyFont":"source-sans"},
}
writeFileSync(join(work, 'props.json'), JSON.stringify(props))
// cover settled · the coverage card counted up · the closing card
const secs = [2.6, 0.35 + 4 + 0.7 + 5.6, (0.35 + 4 + 0.7) + (0.35 + 6 + 0.7) * 2 + 3]
execFileSync('node', ['scripts/walk-stills.mjs', join(work, 'props.json'), join(work, 'stills'), ...secs.map(String)], { cwd: resolve('remotion'), stdio: 'inherit' })
for (const [i, kind] of ['cover', 'data', 'closing'].entries()) {
  await sharp(join(work, 'stills', `st-0${i}.jpg`)).resize(960, 540).png().toFile(resolve(`public/style-samples/walkthrough-${kind}.png`))
}
console.log('wrote public/style-samples/walkthrough-{cover,data,closing}.png')
