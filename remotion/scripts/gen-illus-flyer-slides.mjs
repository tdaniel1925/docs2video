// INSURANCE ILLUSTRATION DECK — 6 full-screen 16:9 pages, bold flyer style.
//
// The poster/collage aesthetic (layered cut-outs with white stroke outlines,
// heavy condensed display type, angled sticker badges, halftone grunge,
// saturated palette) applied to a client-facing illustration walkthrough.
// Gemini renders each entire 1920x1080-proportioned page — type, layout,
// people, texture, badges. Nothing composited in code.
//
// COMPLIANCE: no carrier name, no product name, no company mark anywhere.
// Figures and the client's name are kept; the deck is agent-attributed and
// points back to the full illustration.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', '.illus-flyer'); mkdirSync(OUT, { recursive: true })
const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
const MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const RATIO = '16:9'
const SIZE = process.env.SIZE || '4K'

const SYSTEM = `You are rendering ONE COMPLETE FULL-SCREEN PRESENTATION SLIDE as a finished image.
LANDSCAPE 16:9, widescreen, 1920x1080 proportions. This is a real slide, not a picture of one.
It must fill the entire wide frame edge to edge — never compose it as a tall portrait poster
sitting inside the frame, and never leave empty bars at the left or right.

STYLE SYSTEM — follow exactly and identically on every page:
• Genre: bold promotional poster / flyer design language applied to a financial presentation.
  Layered photo-collage, high energy, confident and premium — but grown-up and trustworthy,
  never nightclub and never garish.
• Composition: cut-out photographic subjects layered at different depths, each cut out cleanly
  with a crisp thin WHITE STROKE OUTLINE and a soft drop shadow, overlapping each other and the
  background. Because the frame is WIDE, spread the composition horizontally: subjects to one
  side, the large type block to the other, supporting elements filling the remaining width.
• Background: warm bright gradient sky or clean studio field with soft light, subtle halftone
  dot texture and light paper grain over everything, a slightly sun-warmed print feel.
• Palette, use ONLY these: deep navy #123049, hot coral #E8443A, sunshine yellow #FFC629,
  warm cream #F5EFE2, soft sky #7FC8E8, and deep charcoal #1E1E1E. Warm, saturated, confident.
• Typography: heavy CONDENSED SANS display faces for the big headlines and figures, set very
  large and tight, with a thin white or dark outline so they pop off the photography. One key
  word per page may be a rough hand-painted brush script in yellow or coral, angled slightly.
  Small copy is bold uppercase sans with wide tracking.
• Figures: currency and percentage figures are the heroes — set them enormous, in coral or
  yellow, with the outline treatment.
• Badges: small angled rounded-rectangle sticker badges in yellow or coral with short uppercase
  text, rotated a few degrees, with drop shadows, tucked into the corners.
• Bottom of page: a solid navy information bar running the full width holding the small print
  in clean bold uppercase.
• People: fictional, non-identifiable, warm and relatable — couples and families in their 40s
  to 60s, and a professional advisor figure. Natural clothing, genuine expressions, studio-lit,
  cleanly cut out. Do NOT depict any real or recognisable person.

TEXT RENDERING — the most important requirement:
• Every word of the copy below must be spelled EXACTLY as written, correctly and legibly, with
  no duplicated, garbled, warped or invented characters.
• Do NOT add any text that is not specified below — no filler, no invented figures, no extra
  taglines, no lorem ipsum.
• Do NOT render any logo, brand mark, company name, insurance carrier name, product name or
  watermark anywhere on the page.
• Render every currency amount, percentage and number exactly as given.

Render the finished widescreen slide now.`

const PAGES = {
  '1-cover': `PAGE ROLE: Cover.
LAYOUT: Wide composition. Right half holds a cut-out of a warm couple in their fifties standing
close together, white stroke outline, layered over a soft sunrise gradient with halftone texture.
Left half holds the type block: a small uppercase eyebrow, then an enormous two-line display
headline, with a brush-script word angled over the corner of it, then a short line beneath.
One angled sticker badge in the top-left corner. Full-width navy information bar at the bottom.

COPY — render exactly:
Eyebrow: "PREPARED FOR"
Client name, set large under the eyebrow: "BILL PROPPER"
Brush script word angled over the headline: "YOUR"
Enormous headline, two lines: "PERSONAL ILLUSTRATION"
Line beneath: "A PLAN BUILT AROUND YOUR FAMILY"
Sticker badge: "PREPARED JULY 2026"
Bottom information bar: "PRESENTED BY TRENT DANIEL . FIGURES SHOWN ARE ILLUSTRATED AND ARE NOT GUARANTEES"`,

  '2-premium': `PAGE ROLE: What you put in.
LAYOUT: Wide three-part composition. Left third: small section number, then a big two-line
headline. Middle third: one ENORMOUS coral currency figure filling the vertical space with a
label under it. Right third: two stacked yellow-outlined boxes each holding a smaller figure
and label, and behind them a cut-out of a man at a kitchen table with paperwork, white stroke
outline. Halftone texture throughout. Angled sticker badge top right. Full-width navy bar at
the bottom.

COPY — render exactly:
Section number: "01"
Headline, two lines: "WHAT YOU PUT IN"
Enormous figure: "$15,000" with label under it "EVERY YEAR"
Box 1: "20 YEARS" / "PAY PERIOD"
Box 2: "$300,000" / "TOTAL OUTLAY"
Sticker badge: "LEVEL PREMIUM"
Bottom bar: "YOUR PREMIUM NEVER INCREASES . FLEXIBLE AFTER YEAR TEN"`,

  '3-growth': `PAGE ROLE: What it becomes.
LAYOUT: Wide composition built around one hero number. Left 60%: section number, a two-line
headline, then a colossal coral currency figure with a heavy white outline, set as the single
dominant element, with a small label beneath it. A rising stepped bar chart in yellow runs
along the bottom of this area behind the figure. Right 40%: a cut-out of a smiling couple
looking at each other, white stroke outline, with two angled sticker badges overlapping them.
Full-width navy bar at the bottom.

COPY — render exactly:
Section number: "02"
Headline, two lines: "WHAT IT BECOMES"
Colossal figure: "$176,204"
Label beneath: "PROJECTED CASH VALUE"
Badge 1: "98% PARTICIPATION"
Badge 2: "FLOOR OF 0%"
Bottom bar: "PROJECTED VALUES ARE NOT GUARANTEED . SEE YOUR FULL ILLUSTRATION FOR COMPLETE TERMS"`,

  '4-benefits': `PAGE ROLE: What it protects.
LAYOUT: Wide three-column composition. A bold headline band across the top on cream. Below it,
three equal full-height panels running edge to edge with NO gaps between them: panel one deep
navy, panel two hot coral, panel three warm cream. Each panel holds a simple bold icon shape at
the top, a large condensed title, and two short lines beneath. A cut-out family figure overlaps
the seam between panels one and two, white stroke outline, breaking the grid. Angled sticker
badge over the top-right corner.

COPY — render exactly:
Section number: "03"
Headline: "WHAT IT PROTECTS"
Panel 1: "YOUR FAMILY" / "A tax-free benefit paid directly to the people you name."
Panel 2: "YOUR INCOME" / "Access to value while living, if you need it."
Panel 3: "YOUR PLAN" / "A floor under the account in a down year."
Sticker badge: "LIVING BENEFITS"
Bottom bar: "ACCESS TO VALUES MAY REDUCE THE BENEFIT PAID . REFER TO YOUR ILLUSTRATION"`,

  '5-timeline': `PAGE ROLE: The timeline.
LAYOUT: Wide horizontal timeline running the full width of the frame. A heavy yellow band
crosses the middle of the page with four large navy circular markers evenly spaced along it,
each containing a bold age number. Above each marker sits a short bold caption, below each a
small line of copy. Cut-out figures of the same couple at different life stages stand behind
the band at the far left and far right, white stroke outlines, overlapping it. Section number
and headline sit in the upper left. Full-width navy bar at the bottom.

COPY — render exactly:
Section number: "04"
Headline: "THE ROAD AHEAD"
Marker 1, age "45": "START" / "First premium paid"
Marker 2, age "55": "BUILDING" / "Value accumulating"
Marker 3, age "65": "OPTIONS" / "Access begins"
Marker 4, age "85": "LEGACY" / "Benefit to your family"
Bottom bar: "AGES SHOWN ARE ILLUSTRATIVE . YOUR VALUES DEPEND ON ACTUAL PERFORMANCE"`,

  '6-next': `PAGE ROLE: Next step and contact.
LAYOUT: Wide composition. Left 55%: an enormous two-line display headline with a brush-script
word angled across it, then a cream information panel rotated a degree or two holding three
contact rows, each a tiny uppercase label above a bold value. Right 45%: a cut-out of a warm,
approachable advisor in a shirt, arms folded, white stroke outline, standing against a coral
field with halftone texture. Two angled sticker badges in the corners. Full-width navy bar at
the bottom.

COPY — render exactly:
Brush script word: "LET'S"
Enormous headline, two lines: "TALK IT THROUGH"
Panel row 1: label "CALL" value "1-555-014-2200"
Panel row 2: label "EMAIL" value "trent@example.com"
Panel row 3: label "ONLINE" value "example.com"
Badge 1: "NO OBLIGATION"
Badge 2: "QUESTIONS WELCOME"
Bottom bar: "PREPARED BY TRENT DANIEL FOR EDUCATION ONLY . NOT A CONTRACT . SEE YOUR FULL ILLUSTRATION"`,
}

async function gem(prompt, outPath) {
  for (let a = 0; a < 3; a++) {
    try {
      const r = await genai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseFormat: { image: { aspectRatio: RATIO, imageSize: SIZE } } },
      })
      for (const p of (r.candidates?.[0]?.content?.parts ?? [])) {
        if (p.inlineData) { writeFileSync(outPath, Buffer.from(p.inlineData.data, 'base64')); return true }
      }
      throw new Error('no image in response')
    } catch (e) {
      console.log('  retry', a, String(e.message || e).slice(0, 110))
      if (a < 2) await new Promise((s) => setTimeout(s, 3000))
    }
  }
  return false
}

/** JPEG SOF parse — the API returns JPEG bytes regardless of filename. */
function jpegSize(b) {
  let i = 2
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue }
    const m = b[i + 1]
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]
    }
    i += 2 + b.readUInt16BE(i + 2)
  }
  return [0, 0]
}

const entries = Object.entries(PAGES)
let next = 0
async function worker() {
  for (;;) {
    const i = next++; if (i >= entries.length) return
    const [key, layout] = entries[i]
    const out = join(OUT, `${key}.png`)
    if (existsSync(out) && process.env.FORCE !== '1') { console.log('[illus] cached', key); continue }
    // Aspect ratio comes back non-deterministically — a portrait result in a
    // landscape deck is unusable, so verify and retry rather than ship it.
    for (let attempt = 0; attempt < 3; attempt++) {
      const ok = await gem(`${SYSTEM}\n\n${layout}`, out)
      if (!ok) { console.log('[illus]', key, 'FAILED'); break }
      const [w, h] = jpegSize(readFileSync(out))
      if (w / h > 1.6) { console.log('[illus]', key, `done ${w}x${h}`); break }
      console.log('[illus]', key, `WRONG RATIO ${w}x${h} — regenerating`)
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker))
console.log('\nwrote', OUT)
