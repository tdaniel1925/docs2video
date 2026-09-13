/**
 * THE ILLUSTRATION EXPLAINER — a policy in, a paper-craft film out.
 *
 * An agent hands a client a thirty-page carrier illustration and the client
 * reads none of it. This turns the same figures into a forty-second explainer
 * in cut-paper animation: what they pay, what it builds, what it leaves.
 *
 * IT IS A REGULATED DOCUMENT, AND THAT DECIDES THE DESIGN.
 *
 * A client-facing summary of an illustration is the AGENT'S representation,
 * not the carrier's. So, enforced here and mirrored from app/_lib/compliance:
 *
 *   · never name the carrier, never name the branded product
 *   · never state the product TYPE as a branded claim — "your policy", "your
 *     plan", nothing more specific
 *   · non-guaranteed values are flagged as illustrated, never promised
 *   · the client is pointed at the actual illustration for the detail
 *   · the disclaimer is attributed to the agent
 *
 * THE NUMBERS ARE THE POINT, AND GENERATED IMAGERY CANNOT SPELL THEM.
 *
 * Which is the same split that made the commercial work, applied harder: the
 * paper scenes carry the FEELING and never a digit, and every figure on
 * screen is real type rendered from the extracted data. A generated "$847,000"
 * would come back as "$8A7,OOO" and it would be on a document a client makes
 * a financial decision from.
 *
 *   node scripts/make-illustration-explainer.mjs --sample
 *   node scripts/make-illustration-explainer.mjs path/to/illustration.pdf
 */

import fs from 'fs'
import path from 'path'

const ENV = 'C:/dev/1 - PrismGraphs/.env.local'
const envVal = (k) => {
  const m = fs.readFileSync(ENV, 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'))
  if (!m) throw new Error(`${k} not found`)
  return m[1].trim()
}
const FAL = envVal('FAL_KEY')
const GEMINI = envVal('GEMINI_API_KEY')
const ANTHROPIC = envVal('ANTHROPIC_API_KEY')

const SAMPLE = process.argv.includes('--sample')
const PDF = process.argv.find((a) => a.endsWith('.pdf'))
const OUT = path.resolve('public/commercials/illustration')
const log = (...a) => console.log(...a)

/* ── COMPLIANCE ──────────────────────────────────────────────────────────── */
/**
 * Mirrored from app/_lib/compliance.ts. Duplicated deliberately — this script
 * runs outside the Next app and cannot import from it — so if that list grows,
 * this one must too. The scrub is a safety net, not the primary defence: the
 * prompts below are told never to produce these in the first place.
 */
const BANNED = [
  'american general', 'aig', 'corebridge', 'national western', 'nlg',
  'mutual of omaha', 'north american', 'columbus', 'f&g', 'meridian',
  'qol', 'max accumulator', 'select choice', 'accumulator+', 'select choice ii',
  'prudential', 'pacific life', 'lincoln', 'transamerica', 'john hancock',
  'nationwide', 'allianz', 'symetra', 'penn mutual', 'guardian', 'massmutual',
]

const scrub = (text) => {
  let out = String(text)
  const hits = []
  for (const term of BANNED) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    if (re.test(out)) { hits.push(term); out = out.replace(re, 'your carrier') }
  }
  return { clean: out, hits }
}

/* ── 1. THE POLICY ───────────────────────────────────────────────────────── */
/**
 * A clearly-labelled sample. Invented on purpose for this build: nothing real
 * passes through, and the format can be judged without a client's data being
 * anywhere near it.
 */
const SAMPLE_POLICY = {
  clientName: 'Sample Client',
  age: 42,
  premium: '$500',
  premiumPer: 'a month',
  years: 20,
  valueAge: 65,
  cashValue: '$284,000',
  deathBenefit: '$750,000',
  taxNote: 'accessed tax-free',
}

const readPdf = async (file) => {
  /* The Next app has a full extractor (app/_lib/insurance-extractor.ts) that
     uses Claude on the document. Reaching it from here would mean running the
     app, so this path is deliberately left for the app to own — the script
     proves the FILM, and the extractor already proves the READING. */
  throw new Error(
    'PDF extraction lives in app/_lib/insurance-extractor.ts and runs inside the app.\n' +
    'Use --sample here to build and judge the film format.'
  )
}

/* ── 2. THE SCRIPT ───────────────────────────────────────────────────────── */
const writeScript = async (p) => {
  const sys = `You write short client-facing explainers about a life insurance policy
illustration. You return JSON only.

Return: { "beats": [ { "vo": string, "line": string, "accent": string, "figure": string|null, "shot": string } ] }

SEVEN beats.

"vo"     — one sentence, spoken aloud. Warm, plain, no jargon. You are
           explaining to someone who has not read the document.
"line"   — 3-7 words shown on screen. A headline, not a subtitle.
"accent" — 1-3 words inside "line", copied EXACTLY including capitals.
"figure" — the single number this beat is about, or null. Copy it EXACTLY as
           given. Never invent a figure, never round one, never compute one.
"shot"   — what the paper scene shows.

COMPLIANCE, and these are absolute:

1. NEVER name an insurance carrier or a branded product. Not one.
2. NEVER call it a specific product type. It is "your policy" or "your plan".
3. NEVER say guaranteed, promised, locked in, or risk-free. Projected values
   are "illustrated" or "projected" — always.
4. One beat must tell them the illustration itself has the full detail.
5. The final beat is the agent's disclaimer, not the carrier's.

THE PAPER SCENES:

- Cut-paper craft. Describe things MADE OF PAPER.
- NEVER describe text, letters, numbers, charts with labels, or documents you
  can read. The image model cannot spell and this is a financial document —
  an invented figure on screen is the worst possible error. Paper shapes only.
- A growing stack, a rising paper hill, a sheltering paper roof, a family of
  paper figures — metaphors, not diagrams.
- One clear idea per scene, composed flat and centred.

STRUCTURE: 1 what they pay. 2 what it does while they sleep. 3 what it builds
by the age given. 4 how they can use it. 5 what it leaves behind. 6 where the
real detail lives. 7 the disclaimer.`

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5', max_tokens: 8000, system: sys,
      messages: [{ role: 'user', content: `The policy:\n${JSON.stringify(p, null, 2)}` }],
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('script: ' + JSON.stringify(j).slice(0, 200))
  const raw = (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('no JSON — stop_reason=' + j.stop_reason)
  return JSON.parse(m[0]).beats
}

/* ── the paper look, fixed here so it cannot drift ───────────────────────── */
const PAPER_STYLE = 'Cut-paper craft illustration, handmade layered construction-paper collage, flat 2D shapes with simple friendly forms, visible torn and cut paper edges, soft realistic drop shadows between paper layers, subtle paper grain and fiber texture, warm trustworthy palette (cream #faf9f5 background, deep teal #2f5d62, warm sand #e8d5b7, soft gold #e5c07b, sage #8fa98b), gentle even lighting, calm and reassuring, editorial paper-craft style, 16:9. NO text, NO letters, NO numbers, NO charts, NO logos, NO words anywhere.'

const PAPER_FAMILY = 'Recurring paper figures: a simple flat cut-paper couple in their forties and one child, round friendly heads, minimal dot eyes, warm sand and teal clothing, the same figures in every scene.'

const paperScene = async (i, what) => {
  const file = path.join(OUT, `scene-${i + 1}.png`)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI}`
  const prompt = `${PAPER_STYLE} ${PAPER_FAMILY} Scene: ${what}`
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
        }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      const j = await r.json()
      const img = (j.candidates?.[0]?.content?.parts || []).find((q) => q.inlineData?.data)
      if (!img) throw new Error('no image')
      fs.writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'))
      return file
    } catch (e) {
      if (a === 2) { log(`  FAIL scene ${i + 1} — ${e.message}`); return null }
      await new Promise((res) => setTimeout(res, 2500))
    }
  }
}

/* ── fal ─────────────────────────────────────────────────────────────────── */
const falQueue = async (model, body) => {
  const r = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${FAL}` },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 160))
  return j.request_id
}
const falWait = async (model, id) => {
  const base = model.split('/').slice(0, 2).join('/')
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 4000))
    const s = await fetch(`https://queue.fal.run/${base}/requests/${id}/status`, { headers: { authorization: `Key ${FAL}` } })
    const sj = await s.json()
    if (sj.status === 'COMPLETED') {
      const res = await fetch(`https://queue.fal.run/${base}/requests/${id}`, { headers: { authorization: `Key ${FAL}` } })
      return res.json()
    }
    if (sj.status === 'FAILED') throw new Error('failed')
  }
  throw new Error('timed out')
}

/* ── main ────────────────────────────────────────────────────────────────── */
const run = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const policy = SAMPLE ? SAMPLE_POLICY : await readPdf(PDF)
  log(`\n— policy: ${policy.premium} ${policy.premiumPer}, ${policy.cashValue} illustrated at ${policy.valueAge}`)

  log('— writing the script')
  let beats = await writeScript(policy)

  /*
   * THE SCRUB IS A SAFETY NET, NOT THE DEFENCE.
   *
   * The prompt forbids carrier and product names; this catches the case where
   * it produced one anyway. A hit is logged loudly — a silent scrub would hide
   * a prompt that has started drifting.
   */
  let hits = 0
  beats = beats.map((b) => {
    const v = scrub(b.vo), l = scrub(b.line)
    hits += v.hits.length + l.hits.length
    if (v.hits.length || l.hits.length) log(`  SCRUBBED: ${[...v.hits, ...l.hits].join(', ')}`)
    return { ...b, vo: v.clean, line: l.clean }
  })
  log(`  ${beats.length} beats, ${hits} compliance scrubs`)
  beats.forEach((b, i) => log(`  ${i + 1}. "${b.line}"${b.figure ? `  [${b.figure}]` : ''}`))

  log('\n— drawing paper scenes')
  const scenes = await Promise.all(beats.map((b, i) => paperScene(i, b.shot)))
  log(`  ${scenes.filter(Boolean).length}/${beats.length} drawn`)

  log('— voice and music')
  const voJobs = []
  for (const [i, b] of beats.entries()) {
    voJobs.push({ i, id: await falQueue('fal-ai/elevenlabs/tts/eleven-v3', { text: b.vo, voice: 'Rachel', stability: 0.6 }) })
  }
  const musicId = await falQueue('fal-ai/elevenlabs/music', {
    prompt: 'Calm reassuring corporate underscore, warm and steady, gentle piano and soft strings, trustworthy, no vocals. 45 seconds.',
    music_length_ms: 45000,
  })

  const vo = []
  for (const job of voJobs) {
    try {
      const out = await falWait('fal-ai/elevenlabs/tts/eleven-v3', job.id)
      const u = out.audio?.url ?? out.audio_url?.url
      const f = path.join(OUT, `vo-${job.i + 1}.mp3`)
      fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()))
      vo[job.i] = path.basename(f)
      log(`  ok vo ${job.i + 1}`)
    } catch (e) { log(`  FAIL vo ${job.i + 1} — ${e.message}`) }
  }

  let music = null
  try {
    const out = await falWait('fal-ai/elevenlabs/music', musicId)
    const u = out.audio?.url ?? out.audio_url?.url
    fs.writeFileSync(path.join(OUT, 'music.mp3'), Buffer.from(await (await fetch(u)).arrayBuffer()))
    music = 'music.mp3'
    log('  ok music')
  } catch (e) { log('  FAIL music — ' + e.message) }

  const { execSync } = await import('child_process')
  const plan = {
    name: 'illustration',
    style: 'paper',
    sample: SAMPLE,
    policy,
    music,
    beats: beats.map((b, i) => ({
      line: b.line, accent: b.accent, vo: b.vo,
      figure: b.figure ?? null,
      scene: scenes[i] ? path.basename(scenes[i]) : null,
      voFile: vo[i] ?? null,
      clip: null,
    })),
    voDurations: beats.map((_, i) => {
      if (!vo[i]) return 5.2
      try {
        return +execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${path.join(OUT, vo[i])}"`).toString().trim()
      } catch { return 5.2 }
    }),
  }
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan, null, 2))
  log(`\n— plan written. ${plan.voDurations.reduce((a, b) => a + b, 0).toFixed(0)}s of narration.`)
}

run().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
