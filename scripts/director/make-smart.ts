/**
 * SMART doc-to-commercial. The intelligent successor to make-from-pdf.ts.
 * Adds real DIRECTOR intelligence:
 *   1. EXTRACT (Gemini) — verified facts, no fabrication
 *   2. DERIVE (code) — legitimate metrics computed from real numbers (total
 *      premiums, break-even, cost per $1k coverage, DB:premium ratio, growth-over-
 *      premiums). Labeled as derived. This makes a financial doc FIGURES-HEAVY.
 *   3. CLASSIFY + WRITE (Opus) — the writer is told the source is a personal-
 *      financial illustration → go figures-heavy (6-8 data moments), pick ONE
 *      curated LOOK, and write a personalized INTRO from the preparer identity.
 *   4. BUILD CHARTS (code) — geometry from real+derived numbers only.
 *   5. ASSETS — VO + images; plan.json for DirectedVideo.
 *
 * Run: npx tsx scripts/director/make-smart.ts "<pdf>" --by "BotMakers" --for "Mr. Client" --music warm
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { join } from 'path'
import { gatherSource, comprehend } from './comprehend'
import { ttsTimed, cueSec } from './tts-timed'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const PUB = join(__dirname, '..', '..', 'remotion', 'public')

const argv = process.argv.slice(2)
const flag = (name: string, def = '') => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def }
const url = flag('url', '')                 // NEW: comprehend a whole website
const pdfPath = !url ? argv.find((a) => !a.startsWith('--') && a === argv[0]) : ''
const preparer = flag('by', 'BotMakers')
const recipient = flag('for', '')
const music = flag('music', 'warm')
const logoPath = flag('logo', '')          // optional logo file → copied to public/brand-logo.png
const glass = flag('glass', 'vivid')        // vivid | subtle
const footer = flag('footer', '')           // optional footer/disclaimer line
if (!pdfPath && !url) { console.error('usage: make-smart.ts <pdf> [--url site] --by "Company" --music warm'); process.exit(1) }

function extractJson(t: string): any { const s = t.indexOf('{'); const e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)) }
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

// ---- BRAND PALETTE: build a dark cinematic palette from the real site colors so
// the video MATCHES the brand (PubcoZone green, not a preset cyan). We take the
// extracted brand accent, then derive a near-black brand-tinted bg, a deeper
// accent2, and legible text/muted. Falls back to null if no usable color found. ----
function hexToRgb(h: string) { const n = h.replace('#', ''); return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)] }
function rgbToHex(r: number, g: number, b: number) { const c = (n: number) => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2); return '#' + c(r) + c(g) + c(b) }
function relLum(h: string) { const [r, g, b] = hexToRgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.4361 * b }
function buildBrandPalette(brand: any): { bg: string; accent: string; accent2: string; text: string; muted: string } | null {
  const cands: string[] = [brand?.themeColor, ...(brand?.colors || [])].filter(Boolean)
  // Score candidates by SATURATION × rank — the true brand accent is the most
  // vivid color near the top of the list, not just the first (which is often a
  // muted link grey that appears on many elements). This is what makes us pick
  // PubcoZone's emerald #059669 over the #3f4b5e link grey.
  const sat = (hex: string) => { const [r, g, b] = hexToRgb(hex); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx }
  let accent: string | null = null, bestScore = -1
  cands.forEach((c, i) => {
    const clean = (c || '').replace('#', '')
    if (!/^[0-9a-f]{6}$/i.test(clean)) return
    const hex = '#' + clean.toLowerCase()
    const [r, g, b] = hexToRgb(hex); const mx = Math.max(r, g, b)
    const s = sat(hex)
    if (s < 0.35 || mx < 50) return                 // must be genuinely saturated
    const score = s * 100 - i * 6                    // vivid, but earlier = better
    if (score > bestScore) { bestScore = score; accent = hex }
  })
  if (!accent) return null
  // brighten the accent a touch so it pops on near-black
  let [ar, ag, ab] = hexToRgb(accent)
  if (relLum(accent) < 0.18) { ar = Math.min(255, ar * 1.5); ag = Math.min(255, ag * 1.5); ab = Math.min(255, ab * 1.5) }
  const acc = rgbToHex(ar, ag, ab)
  const bg = rgbToHex(ar * 0.10 + 8, ag * 0.10 + 9, ab * 0.10 + 12)     // near-black, faintly brand-tinted
  const accent2 = rgbToHex(ar * 0.22 + 8, ag * 0.22 + 10, ab * 0.22 + 14) // deeper brand tone for gradients
  const text = '#f2f4f1', muted = rgbToHex(ar * 0.35 + 110, ag * 0.35 + 118, ab * 0.35 + 112)
  return { bg, accent: acc, accent2, text, muted }
}

// ---- 1. EXTRACT ----
async function extract(): Promise<any> {
  const b64 = readFileSync(pdfPath!).toString('base64')
  // GENERIC extractor — works for ANY financial document (IUL, annuity, loan,
  // investment proposal…). Pulls a flat list of every labeled figure, plus a
  // classification, plus any time-series it finds. No fabrication.
  const prompt = `Read this financial document. Extract ONLY facts that literally appear. Return JSON:
{
  "doc_type": "short classification, e.g. 'indexed universal life illustration', 'fixed indexed annuity proposal', 'mortgage refinance', 'investment portfolio review'",
  "provider": "carrier/firm name or null",
  "recipient": "the person it's prepared for (name + age if shown) or null",
  "figures": [
    { "key": "snake_case_key", "label": "Human Label", "value": number, "unit": "$|%|yrs|x|none", "important": true|false }
  ],
  "series": [ { "name": "what it measures (e.g. Accumulation Value)", "unit": "$", "points": [ {"year": number, "value": number} ] } ],
  "features": ["key benefit bullets, verbatim-ish"],
  "compliance_note": "any disclaimer about hypothetical/non-guaranteed, or null"
}
Rules:
- Put EVERY printed dollar amount, rate, age, and term into "figures" — be thorough; a financial doc's value IS its numbers.
- Mark the 4-6 most headline-worthy figures "important": true.
- "series" only for values printed across multiple years/points; omit placeholders.
- NEVER infer, average, or calculate. Absent/placeholder => omit.`
  const res = await genai.models.generateContent({ model: process.env.DOC_MODEL || 'gemini-flash-latest', contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: b64 } }, { text: prompt }] }] })
  return extractJson(res.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '')
}

const unitToFix = (u: string) => u === '$' ? { prefix: '$', suffix: '' } : u === '%' ? { prefix: '', suffix: '%' } : u === 'yrs' ? { prefix: '', suffix: ' yrs' } : u === 'x' ? { prefix: '', suffix: '×' } : { prefix: '', suffix: '' }

// ---- 2. DERIVE metrics generically from the extracted figures + series ----
// Uses only real values; every derived figure carries a "note" explaining the
// honest arithmetic. Works for any doc type because it keys off units/labels.
function derive(f: any): any[] {
  const out: any[] = []
  const figs: any[] = f.figures || []
  const byWord = (re: RegExp) => figs.find((x) => re.test(x.label || ''))
  const num = (x: any) => (x && typeof x.value === 'number') ? x.value : null

  // a "premium/initial/rollover/contribution" $ amount × a "years/term" count → total in
  const principal = byWord(/premium|rollover|initial|contribution|deposit/i)
  const years = byWord(/year|term|deferral|period/i)
  const income = byWord(/income|payout|withdrawal/i) && (byWord(/income|payout|withdrawal/i).unit === '$') ? byWord(/annual.*income|lifetime income|payout/i) : null

  // total contributions if a recurring premium × years is evident
  if (principal && /annual|monthly|\/ ?yr|per year/i.test(principal.label) && num(years)) {
    out.push({ key: 'total_contributions', label: 'Total Contributions', value: num(principal) * num(years), unit: '$', note: `${money(num(principal))} × ${num(years)}` })
  }

  // series-based: growth of the last point over the first, and gain amount
  const series = (f.series || [])[0]
  if (series && series.points && series.points.length >= 2) {
    const pts = series.points.slice().sort((a: any, b: any) => a.year - b.year)
    const first = pts[0], last = pts[pts.length - 1]
    if (last.value > first.value) {
      out.push({ key: 'series_gain', label: `${series.name} Growth`, value: last.value - first.value, unit: '$', note: `${money(last.value)} − ${money(first.value)} (Yr ${first.year}→${last.year})` })
      const pct = Math.round(((last.value / (first.value || 1)) - 1) * 1000) / 10
      out.push({ key: 'series_growth_pct', label: `Total Growth`, value: pct, unit: '%', note: `over ${last.year - first.year} years, illustrated` })
    }
  }

  // income-to-principal payout leverage (annual income ÷ initial principal)
  if (income && principal && num(income) && num(principal) && principal.unit === '$') {
    const pct = Math.round((num(income) / num(principal)) * 1000) / 10
    out.push({ key: 'income_yield', label: 'Income vs. Initial Premium', value: pct, unit: '%', note: `${money(num(income))} ÷ ${money(num(principal))}` })
  }
  return out
}

// ---- 3. CLASSIFY + WRITE ----
async function writer(f: any, derived: any[]): Promise<any> {
  // PHOTOGRAPHIC + CINEMATIC only. All dark looks; every data scene sits on a
  // real, darkened photographic backdrop so the whole video feels like one film.
  const looks = 'noir (near-black + warm gold, dramatic — default for premium/financial), ledger (deep green + brass, understated), datamesh (deep teal, modern/tech). All are DARK and cinematic. No light/paper looks.'
  const sys = `You are an intelligent creative DIRECTOR + SCRIPTWRITER for a ~60-75s personalized financial policy-review video. This is a PERSONAL-FINANCIAL document about someone's financial future — so it MUST be FIGURES-HEAVY: lead with numbers, make the data the star. Return ONLY JSON:
{
  "title": "...",
  "look": "one of: noir|ledger|datamesh — all DARK & CINEMATIC. noir (near-black, warm gold — premium, default for most financial/retirement/life docs), ledger (deep green — understated financial), datamesh (deep teal — modern/tech/growth). Pick by mood; noir suits most.",
  "scene_backdrops": "for EVERY scene that is a figure/chart/kinetic/context/hook/benefit (i.e. NOT an image scene and NOT the logo intro/cta), provide a UNIQUE cinematic, dark, photorealistic backdrop prompt in that scene's object as \"backdrop_prompt\". Each MUST be different — never reuse a scene or subject.",
  "intro": { "line1": "warm personal greeting naming the preparer", "line2": "who it's for / what this is" },
  "scenes": [
    { "id": 1, "beat": "intro|hook|figure|chart|benefit|context|cta",
      "narration": "one natural spoken sentence",
      "on_screen": "SHORT headline (2-6 words)",
      "visual": "kinetic | image | chart | figure",
      "figure_key": "(if visual=figure) the key of the number to feature — one of available_figure_keys",
      "image_prompt": "(if visual=image) see IMAGERY RULE below",
      "backdrop_prompt": "(for non-image, non-intro, non-cta scenes) a UNIQUE dark cinematic backdrop — see IMAGERY RULE",
      "chart": "(if visual=chart, and only if a series exists) 'growth_line'" }
  ]
}
LOOKS available: ${looks}
Rules:
- 10-12 scenes. Scene 1 MUST be beat="intro" using the preparer greeting (personalized).
- FIGURES-HEAVY: at least 6 scenes must be visual="figure" or "chart", each featuring a DISTINCT figure_key. Every important number deserves its own moment. This doc is about money; show the money.
- Choose the LOOK to fit THIS document's tone (a retirement/annuity plan, a life policy, a loan — pick what suits it; don't default to the same look every time).
- Vary entrances/beats; end with a warm CTA to contact the preparer.
- Compliance: reflect the document's own disclaimer — illustrates POTENTIAL, not guarantees. Never promise returns. Only reference numbers in available_figure_keys.
- The intro must thank the viewer for their time and name the preparer.
IMAGERY RULE (critical): NEVER depict identifiable people — no faces, no figures whose race/gender/age is legible. Use IDENTITY-NEUTRAL subjects only: architecture, homes, buildings, city skylines, interiors, offices, nature, landscapes, light through windows, textures, materials, abstract data/geometric forms, motion. Grounded PLACES for context/story beats; pure ABSTRACTION (light, texture, geometry, data-forms) for figure/chart beats — mix per scene. Every prompt: dark, moody, cinematic, defocused, so light text reads on top. NO text, NO logos, NO people.
- If a series exists, you MUST include at least one visual="chart" scene (the growth line). Charts render inside premium glass.
- Give EVERY figure/chart/kinetic/context/hook/benefit scene a unique "backdrop_prompt" following the IMAGERY RULE (each different).`
  // the exact figure_keys the writer may reference: real (important-first) + derived.
  const realKeys = (f.figures || []).map((x: any) => ({ key: x.key, label: x.label, value: x.value, unit: x.unit, important: x.important }))
  const availableKeys = [...realKeys, ...derived.map((d) => ({ key: d.key, label: d.label, value: d.value, unit: d.unit, derived: true }))]
  const context = { preparer, recipient: recipient || f.recipient || 'you', doc_type: f.doc_type, provider: f.provider, has_series: !!(f.series && f.series[0]?.points?.length >= 2), available_figure_keys: availableKeys, features: f.features, compliance_note: f.compliance_note, note: 'When visual=figure, figure_key MUST be one of available_figure_keys.key exactly. Match on_screen to that figure. Prefer important:true figures and derived insights.' }
  const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 5000, system: sys, messages: [{ role: 'user', content: JSON.stringify(context, null, 2) }] })
  return extractJson((r.content[0] as any).text)
}

// ---- WRITER (comprehension-driven, SLIDE-BASED) — builds an animated explainer
// DECK from a full UNDERSTANDING of the source. Each scene is now a SLIDE: a
// topic heading + supporting content blocks (bullets, comparison/data cards,
// charts, figures, real website screenshots) that reveal in sync with the voice.
// This replaces "headline + 30s of talking" with a PowerPoint-that-talks. ----
async function writerFromUnderstanding(u: any, shotPaths: string[]): Promise<any> {
  const sys = `You are an intelligent creative DIRECTOR + SCRIPTWRITER building an ANIMATED EXPLAINER DECK (a ~90-120s cinematic commercial that works like a talking PowerPoint). You get a COMPLETE researched UNDERSTANDING of the source. Tell the WHOLE story faithfully across every audience/offering.

CRITICAL MINDSET: These are NOT "one big headline + 30 seconds of talking." Each content scene is a SLIDE: a TOPIC HEADING plus SUPPORTING CONTENT (2-4 bullet points, or data/comparison cards, or a chart, or a real screenshot) that back up what the voice says. The on-screen content must carry the substance — a viewer with the sound off should still understand the point. Bullets and cards reveal one-by-one AS the narrator speaks them, so write the narration to walk through the bullets in order.

VOICE / TONE (important): Write the narration like a sharp, friendly human talking to one person — conversational, warm, and confident. USE CONTRACTIONS (you're, it's, they'll, here's). Vary sentence length; let some be short and punchy. It's fine to open a sentence with "And" or "So." Speak TO the viewer ("you"). Avoid corporate stiffness, jargon dumps, and robotic list-reading — it should sound like a smart friend explaining it, not a press release. Never sacrifice accuracy for style, but the substance should feel spoken, not written.

NUMBERS IN NARRATION (spoken naturally): write numbers the way a person SAYS them. NEVER write a pointless trailing ".0" — write "7 percent" not "7.0%", "6 percent" not "6.0%" (but keep real decimals like "9.5%"). For a percent, you may write "7 percent" or "7%" — both are fine. Dollar amounts can stay as "$824,500" (the system will speak them correctly). Don't spell out huge numbers awkwardly in the narration text — just write them normally. (The heading/card/figure ON-SCREEN text should still show the clean numeric form like "7%" or "$824,500".)

Return ONLY JSON:
{
  "title": "...",
  "look": "noir|ledger|datamesh — dark & cinematic. datamesh for tech/fintech/data, noir for premium, ledger for financial.",
  "intro": { "line1": "hook line naming the brand", "line2": "the core promise in a phrase" },
  "cta": { "line": "the closing call-to-action (short, action-oriented — e.g. 'Start free', 'Book a demo', 'Claim your page')", "contact": "ONLY a contact detail (URL, email, or phone) that appears VERBATIM in the source — else null" },
  "scenes": [
    {
      "id": 1,
      "beat": "intro|hook|audience|benefit|proof|compare|context|cta",
      "narration": "2-3 natural spoken sentences that walk through this slide's supporting points IN ORDER. Denser than a single line — it must cover every bullet/card on the slide.",
      "kind": "slide | figure | intro | cta",
      "layout": { "heading": "the slide TOPIC (3-6 words)", "kicker": "optional small label above heading (e.g. audience name 'FOR INVESTORS')", "align": "left|center", "media": "right|below|full" },
      "blocks": [
        { "type": "bullets", "items": [
            { "text": "a full supporting point (6-12 words)", "highlight": "the 1-3 word key phrase inside text to light up", "cue": "the exact words from THIS scene's narration that are spoken when this bullet should appear" }
        ] },
        { "type": "cards", "vs": true, "cards": [
            { "label": "SHORT LABEL", "value": "$399/mo or 15s or Free", "sub": "optional one-line context", "accent": true, "cue": "narration words when this card appears" }
        ] },
        { "type": "figure", "figure": { "value": 0, "prefix": "$", "suffix": "/mo", "label": "WHAT THIS NUMBER IS" } },
        { "type": "screenshot", "page": "/pricing", "pins": [ { "x": 50, "y": 40, "label": "callout text", "cue": "narration words when this pin appears" } ] }
      ],
      "backdrop_prompt": "unique dark cinematic IDENTITY-NEUTRAL backdrop for this slide — architecture, city, abstract data/light. NO people."
    }
  ]
}

STRUCTURE RULES (prevent cherry-picking + thin slides):
- 10-14 scenes total. Scene 1 = intro (kind:"intro", uses the brand hook). Last = cta (kind:"cta").
- MULTIPLE audiences → give EACH its own mini-section: an audience header slide (kicker = audience name) then 2-3 slides of that audience's benefits. Both sides proportional.
- EVERY content slide (kind:"slide") MUST have real supporting blocks — never a bare heading. Prefer 3-4 bullets, OR a cards block, OR a screenshot with pins.
- Use "cards" for pricing tiers, comparisons, before/after, "us vs the old way" (set vs:true for 2-card comparisons; mark the winning card accent:true).
- Feature the REAL numbers via figure blocks or cards. For a product with pricing: show the pricing structure ($0, $9/mo, from $399/mo, etc). For a FINANCIAL ILLUSTRATION (annuity/IUL/investment/loan): make it FIGURES-HEAVY — the doc's value IS its numbers. Turn key_numbers into figure blocks (one big number) and cards (compare values, e.g. Year 5 vs Year 10 accumulation, premium vs income base). Personalize to the named recipient if there is one.
${shotPaths.length
  ? `- SCREENSHOTS (REQUIRED): you MUST use "screenshot" blocks on AT LEAST 2-3 slides to show the ACTUAL product. Available page paths (use the "page" field EXACTLY, verbatim from this list): ${shotPaths.join(', ')}. Only reference a page path from this list. Add 1-2 pins pointing at the relevant UI area (x,y are % of the image, 0-100), each with a short label + cue. A screenshot slide can ALSO have 1-2 bullets beside it.`
  : `- NO screenshots available for this source (it's a document, not a website) — do NOT emit any "screenshot" blocks. Carry every slide with bullets, cards, or figure blocks instead.`}
- CUES: for every bullet/card/pin, set "cue" to a short verbatim substring of THAT scene's narration — the words spoken exactly when the item should appear. This drives in-sync reveals. Bullets' cues must appear in the same order they're spoken.
- Weave top differentiators/features into "proof" or "benefit" slides. Identity-neutral imagery only (NO people). Compliance: NEVER promise returns — for illustrations, say the numbers are illustrated/hypothetical, not guaranteed.
- Be faithful and complete: sound-off, a viewer understands what it is, who it's for, and every important number/benefit.`
  const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 12000, system: sys, messages: [{ role: 'user', content: 'UNDERSTANDING:\n' + JSON.stringify(u, null, 2) }] })
  return extractJson((r.content[0] as any).text)
}

// ---- 4. BUILD CHARTS from the extracted series (any doc) ----
function buildChart(kind: string, f: any): any {
  const s0 = (f.series || [])[0]
  const pts: [number, number][] = (s0?.points || []).map((p: any) => [p.year, p.value]).sort((a: any, b: any) => a[0] - b[0])
  if (pts.length < 1) return null
  const seriesName = s0?.name || 'Value'
  // detect a stated downside floor from any % figure labeled "floor"
  const floorFig = (f.figures || []).find((x: any) => /floor/i.test(x.label || ''))
  const floorPct = floorFig ? floorFig.value : 0
  const xMax = Math.max(...pts.map((p) => p[0]), 10)
  const yMax = Math.max(...pts.map((p) => p[1])) * 1.25
  const ann = pts[pts.length - 1]
  const ticks = [pts[0][0], ...(xMax >= 10 ? [Math.round(xMax / 2)] : []), xMax].filter((v, i, a) => a.indexOf(v) === i)
  return {
    kind: 'line', xMax, yMax, xTicks: ticks, xLabel: 'YEARS',
    series: [
      { name: seriesName, color: '__ACCENT__', points: [[pts[0][0] === 0 ? 0 : 0, 0], ...pts], width: 8, area: true },
      { name: `${floorPct}% Floor`, color: '__MUTED__', points: [[0, 0], [xMax, 0]], dashed: true, width: 5 },
    ],
    annotate: ann ? { x: ann[0], y: ann[1], label: `Year ${ann[0]}`, value: money(ann[1]) } : undefined,
  }
}

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.25 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}`)
  writeFileSync(join(PUB, file), Buffer.from(await res.arrayBuffer()))
}
async function gemini(prompt: string, file: string, attempt = 1): Promise<void> {
  try {
    const res = await genai.models.generateContent({ model: process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview', contents: [{ role: 'user', parts: [{ text: prompt + ' Cinematic, photorealistic, dark, moody, 16:9. No text, no logos.' }] }], config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '2K' } } as any })
    const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
    if (!part) throw new Error('no image'); writeFileSync(join(PUB, file), Buffer.from(part.inlineData!.data!, 'base64'))
  } catch (e) { if (attempt < 3) { await new Promise(r => setTimeout(r, 4000)); return gemini(prompt, file, attempt + 1) } throw e }
}

// parse a comprehension key_number value string ("$399/mo", "$0", "$9/mo",
// "~15 seconds", "Minutes") into a figure spec the Odometer can show. Returns
// null for non-numeric values (those become kinetic text scenes instead).
function figFromKeyNumber(kn: any): any {
  if (!kn) return null
  const raw = String(kn.value)
  const m = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const value = parseFloat(m[0])
  const prefix = /\$/.test(raw) ? '$' : ''
  const suffix = /%/.test(raw) ? '%' : /\/mo|per month/i.test(raw) ? '/mo' : /sec/i.test(raw) ? 's' : ''
  return { value, prefix, suffix, label: kn.label }
}

// ===== COMPREHENSION PATH (websites / rich sources) → SLIDE DECK =====
async function mainFromUrl() {
  console.log(`\n▶ SMART (comprehend→slides): ${url}\n  brand "${preparer}", music=${music}\n`)
  console.log('[1/6] GATHER + COMPREHEND (crawl all key pages + screenshots)...')
  const g = await gatherSource({ url })
  const u = await comprehend(g.text, g.kind)
  console.log(`   ${g.pages?.length} pages | ${(g.shots || []).length} screenshots | what: ${u.what_it_is?.slice(0, 80)}...`)
  console.log(`   audiences: ${(u.audiences || []).map((a: any) => `${a.name} [${a.pricing || '—'}]`).join('  |  ')}`)
  writeFileSync(join(PUB, 'comprehension.json'), JSON.stringify(u, null, 2))

  // map same-origin path → captured hero screenshot file for the writer + builder
  const shots = g.shots || []
  const shotByPath = new Map<string, any>()
  shots.forEach((sh: any) => shotByPath.set(sh.path.replace(/\/$/, '') || '/', sh))
  const shotPaths = shots.map((sh: any) => sh.path.replace(/\/$/, '') || '/')

  console.log('\n[2/6] WRITE slide deck from understanding (whole story, all audiences)...')
  const w = await writerFromUnderstanding(u, shotPaths)
  console.log(`   "${w.title}" | look=${w.look} | ${w.scenes.length} slides`)

  console.log('\n[3/6] Build slides (resolve screenshots + figures)...')
  const scenes = w.scenes.map((s: any) => {
    const kind = s.kind || (s.beat === 'intro' ? 'intro' : s.beat === 'cta' ? 'cta' : 'slide')
    const blocks = (s.blocks || []).map((b: any) => {
      if (b.type === 'screenshot') {
        const sh = shotByPath.get(String(b.page || '').replace(/\/$/, '') || '/')
        if (!sh) { console.log(`   ! slide ${s.id}: no screenshot for page "${b.page}" → dropped`); return null }
        return { type: 'screenshot', file: sh.hero, pins: b.pins || [] }
      }
      return b
    }).filter(Boolean)
    // a scene with a screenshot but nothing else still needs media; keep as-is
    const visual = kind === 'slide' ? { type: 'slide' } : kind === 'figure' ? { type: 'slide' } : { type: 'kinetic' }
    return {
      id: s.id, beat: s.beat, narration: s.narration,
      on_screen: s.layout?.heading || s.on_screen || '',
      layout: s.layout, blocks, visual,
      backdrop: undefined as string | undefined, _backdrop_prompt: s.backdrop_prompt,
    }
  })
  await finishAndWrite(w, scenes, u, g.brand)
}

// ===== PDF PATH → SLIDE DECK (same slide system as the URL path). Reads the
// whole document, COMPREHENDS it (generic), then writes an animated explainer
// deck of bullets/cards/figures/charts. No screenshots (not a website); uses a
// curated dark look. This brings the insurance/annuity/IUL docs up to the same
// slide system as the brand videos. Toggle off with --legacy for the old flow. ==
async function mainFromPdfSlides() {
  console.log(`\n▶ SMART (pdf→slides): ${pdfPath}\n  prepared by "${preparer}"${recipient ? ` for "${recipient}"` : ''}, music=${music}\n`)
  console.log('[1/5] GATHER + COMPREHEND the document...')
  const g = await gatherSource({ pdf: pdfPath })
  const u = await comprehend(g.text, 'pdf')
  console.log(`   what: ${u.what_it_is?.slice(0, 90)}...`)
  console.log(`   key numbers: ${(u.key_numbers || []).map((k: any) => `${k.label}=${k.value}`).slice(0, 8).join('  |  ')}`)
  writeFileSync(join(PUB, 'comprehension.json'), JSON.stringify(u, null, 2))

  console.log('\n[2/5] WRITE slide deck from understanding (figures-heavy)...')
  const w = await writerFromUnderstanding(u, [])   // no screenshots for a PDF
  console.log(`   "${w.title}" | look=${w.look} | ${w.scenes.length} slides`)

  console.log('\n[3/5] Build slides...')
  const scenes = w.scenes.map((s: any) => {
    const kind = s.kind || (s.beat === 'intro' ? 'intro' : s.beat === 'cta' ? 'cta' : 'slide')
    // drop screenshot blocks (no site) — the writer shouldn't emit them (empty
    // shotPaths), but guard anyway; everything else (bullets/cards/figure) stays.
    const blocks = (s.blocks || []).filter((b: any) => b.type !== 'screenshot')
    const visual = kind === 'slide' || kind === 'figure' ? { type: 'slide' } : { type: 'kinetic' }
    return {
      id: s.id, beat: s.beat, narration: s.narration,
      on_screen: s.layout?.heading || s.on_screen || '',
      layout: s.layout, blocks, visual,
      backdrop: undefined as string | undefined, _backdrop_prompt: s.backdrop_prompt,
    }
  })
  // carry the document's compliance note into the footer via the understanding.
  await finishAndWrite(w, scenes, { ...u, compliance_note: u.coverage_notes || 'Hypothetical illustration — not a guarantee' })
}

async function main() {
  if (url) return mainFromUrl()
  // PDFs now default to the SLIDE system; pass --legacy for the old figure flow.
  if (!argv.includes('--legacy')) return mainFromPdfSlides()
  console.log(`\n▶ SMART (legacy): ${pdfPath}\n  prepared by "${preparer}"${recipient ? ` for "${recipient}"` : ''}, music=${music}\n`)
  console.log('[1/6] EXTRACT...')
  const f = await extract()
  console.log(`   doc_type: ${f.doc_type} | provider: ${f.provider} | for: ${f.recipient}`)
  console.log(`   figures (${(f.figures || []).length}):`, (f.figures || []).map((x: any) => `${x.key}=${x.value}${x.unit === '$' ? '' : x.unit}`).join(', '))
  console.log(`   series:`, (f.series || []).map((s: any) => `${s.name}[${s.points?.length}pts]`).join(', ') || 'none')

  console.log('\n[2/6] DERIVE metrics from real numbers...')
  const derived = derive(f)
  derived.forEach((d) => console.log(`   ${d.key}: ${d.value.toLocaleString('en-US')}${d.unit === '$' ? '' : d.unit} — ${d.label} (${d.note})`))

  console.log('\n[3/6] CLASSIFY + WRITE (figures-heavy)...')
  const w = await writer(f, derived)
  console.log(`   "${w.title}" | look=${w.look} | ${w.scenes.length} scenes`)
  console.log(`   intro: "${w.intro?.line1}" / "${w.intro?.line2}"`)
  const figCount = w.scenes.filter((s: any) => s.visual === 'figure' || s.visual === 'chart').length
  console.log(`   data moments: ${figCount}/${w.scenes.length}`)

  console.log('\n[4/6] Build scenes + charts...')
  // build the figure-key map from ALL real figures + derived, each with its unit
  // turned into prefix/suffix. Every key the writer might reference resolves here.
  const figByKey = new Map<string, any>()
  ;(f.figures || []).forEach((x: any) => figByKey.set(x.key, { label: x.label, value: x.value, ...unitToFix(x.unit || 'none') }))
  ;[...derived].forEach((d) => figByKey.set(d.key, { label: d.label, value: d.value, ...unitToFix(d.unit || 'none') }))
  const scenes = w.scenes.map((s: any) => {
    let visual: any
    if (s.visual === 'chart') { const c = buildChart(s.chart, f); visual = c ? { type: 'chart', chart: c } : { type: 'kinetic' } }
    else if (s.visual === 'figure') { const fig = figByKey.get(s.figure_key); if (fig) visual = { type: 'figure', figure: { value: fig.value, prefix: fig.prefix || '', suffix: fig.suffix || '', label: fig.label || s.on_screen } }; else { console.log(`   ! scene ${s.id}: unknown figure_key "${s.figure_key}" → kinetic`); visual = { type: 'kinetic' } } }
    else if (s.visual === 'image') visual = { type: 'gemini', prompt: (s.image_prompt || '') + ' NO people, NO faces — identity-neutral: architecture, homes, nature, city, interiors, light, textures.', file: `dir-img-${s.id}.png` }
    else visual = { type: 'kinetic' }
    return { id: s.id, beat: s.beat, narration: s.narration, on_screen: s.on_screen, visual, backdrop: undefined as string | undefined, _backdrop_prompt: s.backdrop_prompt }
  })
  await finishAndWrite(w, scenes, f)
}

// ===== SHARED tail: backdrops + VO + music + chrome + write plan =====
async function finishAndWrite(w: any, scenes: any[], f: any, brand?: any) {
  console.log('\n[assets] unique backdrops + VO + images...')
  const NEUTRAL = ' Identity-neutral: NO people, NO faces. Dark, moody, cinematic, defocused, heavily shadowed. No text, no logos.'
  for (const sc of scenes) {
    if (sc.visual.type === 'gemini') continue
    if (sc.beat === 'intro' || (sc.beat === 'cta' && logoPath)) continue
    const bp = sc._backdrop_prompt || `abstract cinematic ${f?.doc_type || 'brand'} atmosphere, architecture and light, no people`
    try { await gemini(bp + NEUTRAL, `dir-bd-${sc.id}.png`); sc.backdrop = `dir-bd-${sc.id}.png`; process.stdout.write(`   bd${sc.id}✓ `) } catch { console.log(`   ! bd${sc.id} failed`) }
  }
  console.log('')
  // VO with WORD TIMESTAMPS → resolve each block's cue phrase to a scene-relative
  // frame so bullets/cards/pins reveal exactly when the narrator speaks them.
  const FPS = 30
  for (const s of scenes) {
    const timed = await ttsTimed(s.narration, `dir-vo-${s.id}.mp3`)
    const toFrame = (cue?: string) => { if (!cue) return undefined; const sec = cueSec(timed.words, cue); return sec == null ? undefined : Math.round(sec * FPS) }
    const durF = Math.round(timed.durationSec * FPS)
    // resolve cues; ENFORCE monotonic order within a list (bullets/cards reveal in
    // speaking order) — if a cue lands earlier than the previous item, or fails to
    // resolve, fall back to an even stagger across the VO so nothing pops early.
    const resolveOrdered = (arr: any[]) => {
      let prev = 12
      arr.forEach((it: any, i: number) => {
        let f = toFrame(it.cue)
        const evenly = Math.round(12 + (durF - 24) * (i / Math.max(1, arr.length)))
        if (f == null || f < prev + 4) f = Math.max(prev + 8, evenly)
        it.cueFrame = f; prev = f; delete it.cue
      })
    }
    for (const b of (s.blocks || [])) {
      if (b.type === 'bullets') resolveOrdered(b.items)
      if (b.type === 'cards') resolveOrdered(b.cards)
      if (b.type === 'screenshot') (b.pins || []).forEach((p: any) => { p.cueFrame = toFrame(p.cue) ?? undefined; delete p.cue })
    }
    if (s.visual?.type === 'gemini' && s.visual.prompt) await gemini(s.visual.prompt, s.visual.file)
    process.stdout.write(`   ${s.id}✓ `); delete s._backdrop_prompt
  }
  console.log('')

  const bed = join(PUB, 'music', `bed-${music}-128.wav`)
  if (existsSync(bed)) { copyFileSync(bed, join(PUB, 'dir-music.mp3')); console.log(`   music: bed-${music}-128`) }
  else console.log(`   ! music bed missing — run: npx tsx scripts/director/gen-music.ts ${music} 100 128`)

  const validLooks = ['noir', 'ledger', 'datamesh']
  const look = validLooks.includes(w.look) ? w.look : 'noir'
  // BRAND PALETTE: if we extracted real site colors (or --accent was passed),
  // build the look from THAT so the video matches the brand. Otherwise the
  // curated look's palette is used (websites match brand; PDFs use looks).
  const forcedAccent = flag('accent', '')
  const brandForColor = forcedAccent ? { colors: [forcedAccent] } : brand
  const palette = buildBrandPalette(brandForColor)
  if (palette) console.log(`   brand palette: accent ${palette.accent} on ${palette.bg}${forcedAccent ? ' (forced)' : ' (extracted from site)'}`)
  else console.log(`   brand palette: none found → using look "${look}"`)
  let logo: string | undefined
  if (logoPath && existsSync(logoPath)) { copyFileSync(logoPath, join(PUB, 'brand-logo.png')); logo = 'brand-logo.png' }
  else if (existsSync(join(PUB, 'brand-logo.png'))) logo = 'brand-logo.png'
  const chrome = { company: preparer, logo, recipient: recipient || f?.recipient, footer: footer || (f?.compliance_note ? 'Illustration — not a guarantee' : `${preparer} · docs2video.com`), glass }
  const doc: any = { title: w.title, look, chrome, intro: { ...w.intro, preparer, recipient: recipient || f?.recipient }, scenes }
  // CTA/back-slide: line + contact. Contact only if verbatim in source (writer
  // enforces) OR provided via --footer; never fabricated. Falls back to website.
  const ctaContact = w.cta?.contact || (footer && /@|\.com|\d{3}/.test(footer) ? footer.split('·').filter((p: string) => /@|\.com|\d{3}/.test(p))[0]?.trim() : null) || (url ? new URL(url).hostname.replace(/^www\./, '') : null)
  doc.cta = { line: w.cta?.line || 'Get started today', contact: ctaContact }
  if (palette) doc.palette = palette   // overrides the look's palette in the renderer
  writeFileSync(join(PUB, 'dir-plan.json'), JSON.stringify(doc, null, 2))
  console.log('\n[done] Wrote dir-plan.json — render: npx remotion render DirectedVideo out/smart.mp4')
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
