// FULL-PAGE GEMINI SLIDES — nightclub / event-flyer style, 6 portrait pages.
//
// Same test as gen-gemini-slides.mjs but a far harder style to hold: layered
// photo collage, cut-out subjects with white stroke outlines, graffiti display
// type, angled sticker badges, halftone grunge texture. Every page is rendered
// entirely by Gemini — type, layout, texture, people, badges.
//
// The SYSTEM block is repeated verbatim on all 6 prompts; only LAYOUT and COPY
// change. Consistency across the set is the thing being measured.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', '.flyer-slides'); mkdirSync(OUT, { recursive: true })
const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
const MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const RATIO = process.env.RATIO || '2:3'
const SIZE = process.env.SIZE || '2K'

const SYSTEM = `You are rendering ONE COMPLETE EVENT FLYER PAGE as a finished portrait image,
print-flyer proportions. This is a real promotional flyer, not a picture of a flyer.

STYLE SYSTEM — follow exactly and identically on every page:
• Genre: high-energy summer nightclub / beach-party promo flyer. Layered photo-collage
  poster design, the look of a professional club flyer PSD template.
• Composition: multiple cut-out photographic subjects layered at different depths, each
  cut out cleanly with a crisp thin WHITE STROKE OUTLINE and a soft drop shadow, overlapping
  each other and the background. Busy, maximal, energetic — but every element still legible.
• Background: bright sunlit sky with soft clouds, a hazy tropical city skyline or palm
  fronds low in the frame, subtle halftone dot texture and light paper grain over everything,
  slightly sun-faded print feel.
• Palette, use ONLY these: hot coral red #E8443A, turquoise sky #7FC8E8, sunshine yellow
  #FFC629, cream paper #F5EFE2, deep charcoal #1E1E1E, and a lime green #A4D233 used
  sparingly as a single accent. Warm saturated summer feel.
• Typography: heavy CONDENSED SANS display faces for the big names, set very large and
  tight. One key word may be a rough graffiti brush-script in lime green or yellow with a
  hand-painted edge, angled slightly. Small copy is bold uppercase sans with wide tracking.
  Names get a thin white or dark outline so they pop off the photography.
• Badges: small angled rounded-rectangle sticker badges in yellow, coral or lime with short
  uppercase text, rotated a few degrees, with drop shadows — scattered into the corners of
  the composition.
• Bottom of page: a solid dark or coral information bar holding the practical details in
  clean bold uppercase, clearly readable against the busy artwork above it.
• People: fictional, non-identifiable, diverse, stylish young adults in summer party dress —
  sunglasses, gold jewellery, bucket hats, bandanas, drinks. Confident poses, studio-lit,
  cleanly cut out. Do NOT depict any real, famous or recognisable person.

TEXT RENDERING — the most important requirement:
• Every word of the copy below must be spelled EXACTLY as written, correctly and legibly,
  with no duplicated, garbled, warped or invented characters.
• Do NOT add any text that is not specified below — no filler, no invented sponsor names,
  no extra taglines, no lorem ipsum.
• Do NOT render any real company logo, brand mark, sponsor logo or watermark. Where the
  layout calls for a mark, set the name as plain TYPE only.
• Render dates, times, prices and web addresses exactly as given.

Render the finished flyer page now.`

const PAGES = {
  '1-main': `PAGE ROLE: The main announcement flyer — the busiest, most maximal page of the set.
LAYOUT: Small centred presenter line at the very top. Four cut-out party people layered
across the middle third at different depths, overlapping, each with the white stroke outline —
two upper left and right with their names set beside them, one central figure slightly lower
and larger, one lower right behind a DJ setup with a boombox and turntable in the foreground.
Two angled sticker badges tucked into the left and right edges. A huge two-line display title
across the lower third with one word in graffiti brush script sitting on top of it at an angle.
A solid dark information bar at the bottom with a yellow date block on its left.

COPY — render exactly:
Top line: "CLUB STUDIO RGB PRESENTS"
Name upper left: "DJ JASSICA" with smaller line under it "( MIAMI TRAP )" and a tiny label above it "HOSTED BY"
Name upper right: "DJ BIG NATION" with smaller line "( RNB & JAZZ )" and tiny label "MUSIC BY"
Name lower left: "MARIA TAILOR" with smaller line "( DANCE GROUP )" and tiny label "GUEST ARTIST"
Name lower right: "DJ TAVIS CORT" with smaller line "( SUMMER REMIX )" and tiny label "REMIX BY"
Left sticker badge: "LADIES FREE RSVP"
Right sticker badge: "LIVE @ MIAMI BEACH"
Graffiti script word above the title: "SUMMER"
Huge title, two words on one line: "FUSION FRIDAYS"
Yellow date block: "SUN" above "AUG 01" with tiny vertical text "8PM-1OAM"
Information bar: "FREE ENTRY . FREE PARKING . FREE DRINKS" and below it "23RD AVENUE, PARK STREET, USA 24740" and below that "FOR MORE INFO VISIT AT : WWW.CLUBHWEB.COM"
Very bottom centred line: "FOOD . DRINKS . HOOKAH"`,

  '2-lineup': `PAGE ROLE: The lineup page.
LAYOUT: A bold display header across the top with a graffiti brush word beside it. Below it,
four cut-out DJ and performer figures arranged in a loose two-by-two collage, each overlapping
a coloured shape behind them — coral, turquoise, yellow and lime respectively — each with the
white stroke outline. A name plate under each figure: heavy condensed name with a small
genre line beneath. Two angled sticker badges in opposite corners. A slim coral bar at the
bottom with a single line of copy.

COPY — render exactly:
Header: "THE LINEUP"
Graffiti script word beside the header: "2026"
Figure 1 plate: "DJ JASSICA" / "MIAMI TRAP"
Figure 2 plate: "DJ BIG NATION" / "RNB & JAZZ"
Figure 3 plate: "MARIA TAILOR" / "DANCE GROUP"
Figure 4 plate: "DJ TAVIS CORT" / "SUMMER REMIX"
Corner badge 1: "4 STAGES"
Corner badge 2: "ALL NIGHT"
Bottom bar: "DOORS 8PM . FIRST SET 9PM . LAST CALL 1AM"`,

  '3-dates': `PAGE ROLE: The dates page — a schedule that still reads as a party flyer.
LAYOUT: Display header at the top. Below it, four wide horizontal ticket-stub strips stacked
down the page, each slightly rotated a degree or two, each with a bold yellow date block on
its left end and the venue text on the right, and each overlapping a small cut-out party
photo at its right edge. Halftone texture and palm fronds behind the stack. One angled
sticker badge over the top-right corner of the stack.

COPY — render exactly:
Header, two lines: "SUMMER SERIES DATES"
Strip 1: date "AUG 01" / "MIAMI BEACH . 23RD AVENUE"
Strip 2: date "AUG 15" / "SOUTH PIER . PARK STREET"
Strip 3: date "AUG 29" / "ROOFTOP 24 . DOWNTOWN"
Strip 4: date "SEP 12" / "CLOSING PARTY . MIAMI BEACH"
Sticker badge: "SOLD OUT TWICE"
Bottom bar: "EVERY FRIDAY . 8PM TILL 1AM"`,

  '4-venue': `PAGE ROLE: The venue and experience page.
LAYOUT: Display header at the top with a graffiti brush word. A large hero collage in the
middle: a cut-out crowd with hands raised in front of a sunlit beach-club setting with palm
fronds, string lights and a bar, all with the layered cut-out treatment. Below the hero, a row
of three square photo tiles with a bold caption bar under each. Angled sticker badge over the
hero's top-left corner. Dark information bar at the bottom.

COPY — render exactly:
Header: "THE VENUE"
Graffiti script word: "VIBES"
Tile 1 caption: "OPEN AIR FLOOR"
Tile 2 caption: "BEACH BAR"
Tile 3 caption: "HOOKAH LOUNGE"
Sticker badge: "ON THE SAND"
Information bar: "23RD AVENUE, PARK STREET, USA 24740" and below it "FREE PARKING . 21 AND OVER"`,

  '5-tickets': `PAGE ROLE: The tickets page.
LAYOUT: Display header at the top. Three tall ticket cards side by side filling the middle of
the page, each slightly rotated, with a perforated edge and a punched hole at the top. Card
one cream, card two coral and raised slightly higher than the others as the featured tier,
card three charcoal. Each card holds a tier name at the top, a very large price, and three
short lines of what is included. A cut-out party figure peeks out from behind the middle card.
Angled sticker badge over the middle card's corner. Slim yellow bar at the bottom.

COPY — render exactly:
Header: "GET IN"
Card 1: "EARLY BIRD" / "$25" / "ENTRY BEFORE 10PM" / "ONE FREE DRINK" / "GENERAL FLOOR"
Card 2: "VIP TABLE" / "$120" / "RESERVED TABLE" / "BOTTLE SERVICE" / "SKIP THE LINE"
Card 3: "GENERAL" / "$40" / "ENTRY ALL NIGHT" / "GENERAL FLOOR" / "HOOKAH LOUNGE"
Sticker badge over the middle card: "BEST VALUE"
Bottom bar: "LADIES FREE BEFORE 10PM WITH RSVP"`,

  '6-rsvp': `PAGE ROLE: The closing RSVP page — calmer than the others but unmistakably the same set.
LAYOUT: A large coral field fills most of the page with halftone texture over it. A huge
two-line display headline sits in the upper half with a graffiti brush word angled across it.
Below, a cream information panel rotated a degree or two holds the contact details as three
stacked rows, each with a tiny uppercase label above a bold value. A single cut-out party
figure with the white stroke outline stands at the lower right, overlapping the panel edge.
Two angled sticker badges in the upper corners. Palm fronds silhouetted in the bottom corners.

COPY — render exactly:
Graffiti script word: "DON'T MISS IT"
Headline, two lines: "RSVP NOW"
Panel row 1: label "PHONE" value "1-555-014-2200"
Panel row 2: label "ONLINE" value "WWW.CLUBHWEB.COM"
Panel row 3: label "WHERE" value "23RD AVENUE, PARK STREET, USA 24740"
Corner badge 1: "LADIES FREE"
Corner badge 2: "LIMITED TABLES"
Bottom line: "FOOD . DRINKS . HOOKAH"`,
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

const entries = Object.entries(PAGES)
let next = 0
async function worker() {
  for (;;) {
    const i = next++; if (i >= entries.length) return
    const [key, layout] = entries[i]
    const out = join(OUT, `${key}.png`)
    if (existsSync(out) && process.env.FORCE !== '1') { console.log('[flyer] cached', key); continue }
    const ok = await gem(`${SYSTEM}\n\n${layout}`, out)
    console.log('[flyer]', key, ok ? 'done' : 'FAILED')
  }
}
await Promise.all(Array.from({ length: 3 }, worker))
console.log('\nwrote', OUT)
