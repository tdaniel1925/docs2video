/**
 * DOC-TO-COMMERCIAL. Reads a source PDF (an insurance illustration / policy
 * review), extracts the REAL numbers, writes a narrative, and directs a video
 * that mixes kinetic type, Gemini imagery, AND animated charts built from the
 * document's actual figures. No invented data — charts use only extracted values.
 *
 * Pipeline:
 *   1. EXTRACT (Gemini 2.5): PDF → structured JSON of verified facts/figures
 *   2. WRITER (Opus): facts → scene script (narration + on-screen + which scenes
 *      are 'chart' vs 'image' vs 'kinetic', and which figures each chart shows)
 *   3. BUILD CHARTS (code): turn the writer's chart intents into ChartSpecs using
 *      ONLY the extracted numbers (line/bars/figure geometry computed here)
 *   4. ASSETS: VO (ElevenLabs) + any Gemini images
 *   5. WRITE dir-plan.json for the DirectedVideo composition
 *
 * Run: npx tsx scripts/director/make-from-pdf.ts "<path-to-pdf>"
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const PUB = join(__dirname, '..', '..', 'remotion', 'public')
const pdfPath = process.argv[2]
if (!pdfPath) { console.error('usage: make-from-pdf.ts <pdf>'); process.exit(1) }

function extractJson(t: string): any { const s = t.indexOf('{'); const e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)) }

// 1. EXTRACT — Gemini reads the PDF and returns verified facts. We instruct it to
// mark anything it can't read as null, and NEVER to fabricate missing figures.
async function extract(): Promise<any> {
  const b64 = readFileSync(pdfPath).toString('base64')
  const prompt = `You are reading an insurance policy illustration / review document. Extract ONLY facts that literally appear in the document. Return JSON:
{
  "carrier": "...", "policy_type": "...", "insured": "...", "age": number|null,
  "death_benefit": number|null, "annual_premium": number|null, "premium_years": number|null,
  "loan_rate_pct": number|null,
  "cash_value_points": [ { "year": number, "value": number } ],   // ONLY years whose cash/illustrated value is actually printed; omit [DATA PLACEHOLDER] cells
  "sp500_note": "any statement comparing to S&P 500 index, or null",
  "floor_pct": number|null,                                       // the downside floor (e.g. 0)
  "living_benefits": ["..."],                                     // e.g. critical/chronic/terminal illness
  "other_riders": ["..."],
  "summary_pillars": ["..."]                                      // the headline benefit pillars
}
CRITICAL: if a value is shown as a placeholder or is not present, use null / omit it. Do not infer or calculate values that aren't printed.`
  const res = await genai.models.generateContent({
    model: process.env.DOC_MODEL || 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: b64 } }, { text: prompt }] }],
  })
  const txt = res.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
  return extractJson(txt)
}

// 2. WRITER — narrative + scene plan. It decides which scenes are charts and
// which extracted figures each references (by key), but does NOT author chart
// geometry — that's built in code from the verified numbers.
async function writer(facts: any): Promise<any> {
  const sys = `You are a financial video SCRIPTWRITER + DIRECTOR for a ~45-60s policy-review explainer. You are given VERIFIED facts extracted from the client's illustration. Return ONLY JSON:
{
  "title": "...",
  "palette": { "bg": "#0b1a2e deep navy", "accent": "#c9a227 gold", "accent2": "#2a4a74", "text": "#f3f0e6" },
  "scenes": [
    {
      "id": 1, "beat": "hook|context|figure|chart|benefit|cta",
      "narration": "one natural spoken sentence",
      "on_screen": "SHORT headline (2-6 words)",
      "visual": "kinetic | image | chart",
      "image_prompt": "(only if visual=image) dark cinematic photoreal prompt, a real human/scene relevant to the beat, NO text",
      "chart": "(only if visual=chart) one of: 'growth_line' (cash value climbing vs floor over years), 'premium_vs_value' (total premiums paid vs illustrated value bars), 'death_benefit' (big count-up figure), 'cash_value_figure' (big count-up of a specific year's value)",
      "chart_year": "(for cash_value_figure) which year's value to show"
    }
  ]
}
Rules: 8-10 scenes. Open with a hook, close with a 'contact your advisor' CTA. Use the REAL numbers naturally in narration (death benefit, premium, the year-10 value, loan rate). Include AT LEAST: one 'death_benefit' figure scene, one 'growth_line' chart scene, one 'premium_vs_value' bars scene, and one image scene showing a real family/advisor moment. Mention living benefits and tax-advantaged access. Be accurate and compliant in tone — this illustrates potential, not guarantees; do NOT promise returns. Do not state any number that isn't in the facts.`
  const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 4000, system: sys, messages: [{ role: 'user', content: 'VERIFIED FACTS:\n' + JSON.stringify(facts, null, 2) }] })
  return extractJson((r.content[0] as any).text)
}

// 3. BUILD CHARTS — deterministic geometry from verified numbers only.
function buildChart(kind: string, facts: any, year?: number): any {
  const P = { accent: '#c9a227', accent2: '#2a4a74', text: '#f3f0e6' }
  const pts: [number, number][] = (facts.cash_value_points || []).map((p: any) => [p.year, p.value]).sort((a: any, b: any) => a[0] - b[0])
  if (kind === 'death_benefit') return facts.death_benefit ? { kind: 'figure', value: facts.death_benefit, prefix: '$', label: 'Death Benefit' } : null
  if (kind === 'cash_value_figure') { const yr = year ?? pts[pts.length - 1]?.[0]; const hit = pts.find((p) => p[0] === yr); return hit ? { kind: 'figure', value: hit[1], prefix: '$', label: `Year ${yr} Value` } : null }
  if (kind === 'premium_vs_value') {
    if (!facts.annual_premium || !pts.length) return null
    const yr = pts[pts.length - 1][0]; const paid = facts.annual_premium * Math.min(yr, facts.premium_years || yr)
    const val = pts[pts.length - 1][1]
    return { kind: 'bars', unit: '$', yMax: Math.max(paid, val) * 1.15, bars: [ { label: `Premiums Paid (Yr ${yr})`, value: paid, color: P.accent2 }, { label: `Illustrated Value`, value: val, color: P.accent } ] }
  }
  if (kind === 'growth_line') {
    if (pts.length < 1) return null
    const xMax = Math.max(...pts.map((p) => p[0]), 20)
    const yMax = Math.max(...pts.map((p) => p[1])) * 1.25
    const floor = facts.annual_premium ? pts.map((p) => [p[0], 0] as [number, number]) : [[0, 0], [xMax, 0]] as [number, number][]
    const series: any[] = [
      { name: 'Cash Value', color: P.accent, points: [[0, 0] as [number, number], ...pts], width: 8, area: true },
      { name: `${facts.floor_pct ?? 0}% Floor`, color: '#8fa3bd', points: [[0, 0] as [number, number], [xMax, 0] as [number, number]], dashed: true, width: 5 },
    ]
    const ann = pts.find((p) => p[0] === 10) || pts[pts.length - 1]
    return { kind: 'line', series, xMax, yMax, xTicks: [1, 5, 10, xMax].filter((v, i, a) => a.indexOf(v) === i && v <= xMax), xLabel: 'YEARS', annotate: ann ? { x: ann[0], y: ann[1], label: `Year ${ann[0]} Illustrated`, value: '$' + ann[1].toLocaleString('en-US') } : undefined }
  }
  return null
}

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.52, similarity_boost: 0.8, style: 0.28 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 120)}`)
  writeFileSync(join(PUB, file), Buffer.from(await res.arrayBuffer()))
}

async function gemini(prompt: string, file: string, attempt = 1): Promise<void> {
  try {
    const res = await genai.models.generateContent({ model: process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview', contents: [{ role: 'user', parts: [{ text: prompt + ' Cinematic, photorealistic, dark and moody, 16:9. No text, no words, no logos.' }] }], config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '2K' } } as any })
    const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
    if (!part) throw new Error('no image')
    writeFileSync(join(PUB, file), Buffer.from(part.inlineData!.data!, 'base64'))
  } catch (e) { if (attempt < 3) { await new Promise(r => setTimeout(r, 4000)); return gemini(prompt, file, attempt + 1) } throw e }
}

async function main() {
  console.log(`\n▶ DOC: ${pdfPath}\n`)
  console.log('[1/5] EXTRACT (Gemini) → verified facts...')
  const facts = await extract()
  console.log('      DB:', facts.death_benefit, '| premium:', facts.annual_premium, '| points:', JSON.stringify(facts.cash_value_points), '| loan%:', facts.loan_rate_pct)

  console.log('\n[2/5] WRITER+DIRECTOR (Opus) → scene plan...')
  const w = await writer(facts)
  console.log(`      "${w.title}" — ${w.scenes.length} scenes`)

  console.log('\n[3/5] Building charts from real numbers...')
  const scenes = w.scenes.map((s: any, i: number) => {
    let visual: any
    if (s.visual === 'chart') {
      const chart = buildChart(s.chart, facts, s.chart_year)
      if (chart) { visual = { type: 'chart', chart }; console.log(`      scene ${s.id}: chart[${s.chart}] ✓`) }
      else { visual = { type: 'kinetic' }; console.log(`      scene ${s.id}: chart[${s.chart}] → no data, fell back to kinetic`) }
    } else if (s.visual === 'image') visual = { type: 'gemini', prompt: s.image_prompt, file: `dir-img-${s.id}.png` }
    else visual = { type: 'kinetic' }
    return { id: s.id, beat: s.beat, narration: s.narration, on_screen: s.on_screen, entrance: s.entrance, visual }
  })

  console.log('\n[4/5] Assets (VO + images)...')
  for (const s of scenes) {
    await tts(s.narration, `dir-vo-${s.id}.mp3`)
    if (s.visual.type === 'gemini' && s.visual.prompt) await gemini(s.visual.prompt, s.visual.file)
    process.stdout.write(`      ${s.id} ✓  `)
  }
  console.log('')

  // Sanitize palette: the LLM sometimes returns "#0b1a2e deep navy" (copying the
  // prompt annotation). Keep only the hex; guarantee legible dark-bg/light-text.
  const hexOnly = (v: string, fallback: string) => { const m = String(v || '').match(/#[0-9a-fA-F]{6}/); return m ? m[0] : fallback }
  const palette = {
    bg: hexOnly(w.palette?.bg, '#0b1a2e'),
    accent: hexOnly(w.palette?.accent, '#c9a227'),
    accent2: hexOnly(w.palette?.accent2, '#2a4a74'),
    text: hexOnly(w.palette?.text, '#f3f0e6'),
  }
  const doc = { title: w.title, palette, scenes }
  writeFileSync(join(PUB, 'dir-plan.json'), JSON.stringify(doc, null, 2))
  console.log('\n[5/5] Wrote dir-plan.json — render: npx remotion render DirectedVideo out/iul.mp4')
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
