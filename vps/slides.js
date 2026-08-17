/**
 * SLIDE PIPELINE (VPS) — the production port of scripts/director/make-smart.ts.
 * Runs entirely on the VPS (which has pdftotext, libreoffice, Chrome, Gemini,
 * ElevenLabs): read source → comprehend (Claude) → write slide deck (Claude) →
 * VO with word timestamps → build dir-plan.json + assets in `public/`. The caller
 * (server.js /generate-slides) then renders the DirectedVideo composition.
 *
 * Anthropic is called via raw fetch (no SDK dep added to the VPS image).
 */
const { writeFile, readFile } = require('fs/promises')
const { join } = require('path')

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_TOKEN = process.env.CLOUDFLARE_API_KEY   // Workers AI API token (named _API_KEY in env)
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'
const DOC_MODEL = process.env.DOC_MODEL || 'gemini-flash-latest'
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

const FPS = 30

// ---------- Anthropic (raw HTTP, no SDK) ----------
// Model tiers — route each call to the CHEAPEST model that does the job well.
// Was: everything on Opus 4.8 (~$15/$75 per M). Now:
//  WRITE  = strong model for the creative/structured writing (slide plan, ad beats)
//  REASON = mid model for faithful extraction + QA (comprehend, critique, review)
//  CHEAP  = cheapest for trivial rewrites (name-scrub smoothing, color-naming, edits)
// Override any via env without a code change.
const CLAUDE_MODELS = {
  WRITE: process.env.CLAUDE_MODEL_WRITE || 'claude-sonnet-4-6',
  REASON: process.env.CLAUDE_MODEL_REASON || 'claude-sonnet-4-6',
  CHEAP: process.env.CLAUDE_MODEL_CHEAP || 'claude-haiku-4-5-20251001',
}
// claude(system, user, maxTokens, opts?) — opts: { model, cache }
//  model: one of CLAUDE_MODELS values (default WRITE for back-comfort with old callers)
//  system: EITHER a plain string, OR { staticPrefix, dynamicSuffix } to enable
//    PREFIX caching WITHOUT changing what the model reads. The prefix (large, static,
//    identical every call) becomes a cached system block; the suffix (per-video brief/
//    compliance) is a second plain block right after it. Concatenated they are byte-
//    identical to the old single string → zero behaviour change, but the big prefix
//    now bills at ~10% on repeat. Anthropic only CREATES a breakpoint at ≥~1024 tokens
//    (~4KB chars); below that the header is silently ignored, so we gate on 4KB.
//  cache: true → attempt caching (string form caches the whole thing if ≥4KB).
async function claude(system, user, maxTokens, opts = {}) {
  const model = opts.model || CLAUDE_MODELS.WRITE
  let systemField = system
  let useCache = false
  if (system && typeof system === 'object' && typeof system.staticPrefix === 'string') {
    // split form: cache the static prefix, append the dynamic suffix plain.
    const prefix = system.staticPrefix, suffix = system.dynamicSuffix || ''
    if (opts.cache && prefix.length >= 4096) {
      systemField = [{ type: 'text', text: prefix, cache_control: { type: 'ephemeral' } }]
      if (suffix) systemField.push({ type: 'text', text: suffix })
      useCache = true
    } else {
      systemField = prefix + suffix   // too small to cache → send plain, unchanged content
    }
  } else if (opts.cache && typeof system === 'string' && system.length >= 4096) {
    systemField = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    useCache = true
  }
  const headers = { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
  if (useCache) headers['anthropic-beta'] = 'prompt-caching-2024-07-31'
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, max_tokens: maxTokens, system: systemField, messages: [{ role: 'user', content: user }] }),
  })
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  return j.content[0].text
}
claude.MODELS = CLAUDE_MODELS

// ---------- Cloudflare Workers AI (FLUX) image generation ----------
// The DEFAULT backdrop generator for slides: fast (~2s), free tier, reliable.
// FLUX.1 [schnell] returns a base64 image. Falls back to caller's error handling
// (which skips the backdrop → animated bg) on any failure. `writeFile` provided.
const { writeFile: _wf } = require('fs/promises')
const CF_IMG_MODEL = process.env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
function cloudflareAvailable() { return !!(CF_ACCOUNT && CF_TOKEN) }
async function cloudflareImage(prompt, outPath) {
  if (!cloudflareAvailable()) throw new Error('cloudflare not configured')
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_IMG_MODEL}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 6 }),
    signal: AbortSignal.timeout(60000),
  })
  if (!r.ok) throw new Error(`cloudflare ${r.status}: ${(await r.text()).slice(0, 120)}`)
  const j = await r.json()
  const b64 = j && j.result && j.result.image
  if (!b64) throw new Error('cloudflare: no image in response')
  await _wf(outPath, Buffer.from(b64, 'base64'))
}
function extractJson(t) { const s = t.indexOf('{'); const e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)) }
const money = (n) => '$' + Math.round(n).toLocaleString('en-US')

// ---------- speech normalization (numbers + pronunciation) ----------
const PRON = {
  'Reg FD': 'Regulation F D', 'Reg-FD': 'Regulation F D', 'RegFD': 'Regulation F D',
  'Reg D': 'Regulation D', 'Reg A': 'Regulation A', 'Reg SHO': 'Regulation S H O',
  '13F': 'thirteen F', '10-K': 'ten K', '10-Q': 'ten Q', '8-K': 'eight K',
  'IUL': 'I U L', 'IR': 'I R', 'CRM': 'C R M', 'SEC': 'S E C', 'IPO': 'I P O',
  'CEO': 'C E O', 'CFO': 'C F O', 'ETF': 'E T F', 'API': 'A P I', 'ROI': 'R O I',
  'FAQ': 'F A Q', 'AI': 'A I', 'IR CRM': 'I R, C R M',
}
function spellInteger(n) {
  if (n === 0) return 'zero'
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
  const under1000 = (x) => { let s = ''; if (x >= 100) { s += ones[Math.floor(x / 100)] + ' hundred'; x %= 100; if (x) s += ' ' } if (x >= 20) { s += tens[Math.floor(x / 10)]; x %= 10; if (x) s += '-' + ones[x] } else if (x > 0) s += ones[x]; return s }
  const scales = [['', 1], ['thousand', 1e3], ['million', 1e6], ['billion', 1e9]]
  let words = []
  for (let i = scales.length - 1; i >= 0; i--) { const [name, val] = scales[i]; if (n >= val) { const chunk = Math.floor(n / val); n %= val; words.push(under1000(chunk) + (name ? ' ' + name : '')) } }
  return words.join(' ').replace(/\s+/g, ' ').trim()
}
function speakableNumbers(text) {
  let t = text
  t = t.replace(/\b401\s*\(?k\)?/gi, 'four oh one k').replace(/\b403\s*\(?b\)?/gi, 'four oh three b')
  t = t.replace(/\$\s?(\d{1,3}(?:,\d{3})+|\d{4,})(\.\d{1,2})?/g, (_m, intPart, dec) => { const n = parseInt(intPart.replace(/,/g, ''), 10); let out = spellInteger(n) + ' dollars'; if (dec && parseInt(dec.slice(1), 10) > 0) out += ' and ' + spellInteger(parseInt(dec.slice(1).padEnd(2, '0'), 10)) + ' cents'; return out })
  t = t.replace(/\$\s?(\d{1,3})\b/g, (_m, d) => `${spellInteger(parseInt(d, 10))} dollars`)
  t = t.replace(/(\d+)\.0+(%|\s*percent)/gi, '$1$2')
  t = t.replace(/\b(\d+)\.0+\b/g, '$1')
  return t
}
// NOTE (P4.1): this is DELIBERATELY different from app/_lib/tts.ts `speakable`.
// The slides engine needs FULL spell-out ("four hundred forty-eight thousand")
// + a pronunciation dictionary + acronym spacing so ElevenLabs' word-TIMESTAMPS
// line up for per-bullet cue syncing — the Vercel `speakable` only does
// "$X dollars / N percent" (no word-timing dependency). Not a duplicate to merge;
// the two serve different needs. Vercel's money/percent logic is unified in
// tts.ts (formatForTTS delegates to it).
function speakable(text) {
  let t = text
  for (const k of Object.keys(PRON).sort((a, b) => b.length - a.length)) t = t.replace(new RegExp(`\\b${k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'g'), PRON[k])
  t = t.replace(/\b([A-Z]{2,5})\b/g, (m) => m.split('').join(' '))
  t = speakableNumbers(t)
  return t
}

// ---------- word-timed TTS ----------
function charsToWords(chars, starts, ends) {
  const words = []; let cur = '', s = -1, e = 0
  const flush = () => { if (cur.trim()) words.push({ w: cur.trim(), start: s < 0 ? e : s, end: e }); cur = ''; s = -1 }
  for (let i = 0; i < chars.length; i++) { const c = chars[i]; if (/\s/.test(c)) { flush(); e = ends[i] ?? e; continue } if (s < 0) s = starts[i] ?? e; cur += c; e = ends[i] ?? e }
  flush(); return words
}
async function ttsTimed(text, outPath) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': ELEVEN_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: speakable(text), model_id: ELEVEN_MODEL, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.25 } }),
  })
  if (!r.ok) throw new Error(`TTS ${r.status}: ${(await r.text()).slice(0, 160)}`)
  const j = await r.json()
  await writeFile(outPath, Buffer.from(j.audio_base64, 'base64'))
  const a = j.alignment || j.normalized_alignment || {}
  const words = charsToWords(a.characters || [], a.character_start_times_seconds || [], a.character_end_times_seconds || [])
  return { words, durationSec: words.length ? words[words.length - 1].end : 0 }
}
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9$%]/g, '')
function cueSec(words, phrase) {
  if (!phrase) return null
  const target = speakableNumbers(phrase).split(/\s+/).map(norm).filter(Boolean)
  if (!target.length) return null
  const wn = words.map((w) => norm(w.w))
  for (let i = 0; i < words.length; i++) { let ok = true; for (let k = 0; k < target.length && i + k < words.length; k++) { if (!wn[i + k].includes(target[k]) && !target[k].includes(wn[i + k])) { ok = false; break } } if (ok) return words[i].start }
  const first = target[0]; const hit = words.findIndex((_, i) => wn[i].includes(first) || first.includes(wn[i]))
  return hit >= 0 ? words[hit].start : null
}

// ---------- brand palette (for URL sources) ----------
function hexToRgb(h) { const n = h.replace('#', ''); return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)] }
function rgbToHex(r, g, b) { const c = (n) => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2); return '#' + c(r) + c(g) + c(b) }
function relLum(h) { const [r, g, b] = hexToRgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.4361 * b }
function buildBrandPalette(brand, forcedAccent) {
  const cands = [forcedAccent, brand && brand.themeColor, ...((brand && brand.colors) || [])].filter(Boolean)
  const sat = (hex) => { const [r, g, b] = hexToRgb(hex); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx }
  let accent = null, best = -1
  cands.forEach((c, i) => { const clean = (c || '').replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(clean)) return; const hex = '#' + clean.toLowerCase(); const mx = Math.max(...hexToRgb(hex)); const s = sat(hex); if (s < 0.35 || mx < 50) return; const score = s * 100 - i * 6; if (score > best) { best = score; accent = hex } })
  if (!accent) return null
  let [ar, ag, ab] = hexToRgb(accent); if (relLum(accent) < 0.18) { ar *= 1.5; ag *= 1.5; ab *= 1.5 }
  const acc = rgbToHex(Math.min(255, ar), Math.min(255, ag), Math.min(255, ab))
  return { bg: rgbToHex(ar * .10 + 8, ag * .10 + 9, ab * .10 + 12), accent: acc, accent2: rgbToHex(ar * .22 + 8, ag * .22 + 10, ab * .22 + 14), text: '#f2f4f1', muted: rgbToHex(ar * .35 + 110, ag * .35 + 118, ab * .35 + 112) }
}

// ---------- comprehend + write (prompts mirror make-smart.ts) ----------
async function comprehend(sourceText, kindHint) {
  const sys = `You are a research analyst. You are given the FULL text of a source. READ ALL OF IT and produce a faithful, COMPLETE structured understanding — NOT cherry-picked. Return ONLY JSON:
{"what_it_is":"2-3 sentences","category":"...","audiences":[{"name":"who","what_they_get":["..."],"pricing":"incl free tiers/ranges or null","value":"why they care"}],"differentiators":["..."],"core_promise":"...","key_numbers":[{"label":"...","value":"...","context":"..."}],"notable_features":["..."],"tone":"...","coverage_notes":"..."}
RULES: Cover EVERY distinct audience and offering. Capture pricing ranges and free tiers. Do not invent. Be thorough over concise.`
  // comprehend = faithful extraction → REASON tier (not Opus). Big static system
  // prompt is cached. Source slice trimmed 120K→48K chars (~12K tokens): plenty for
  // faithful understanding of any normal doc, and the input was the biggest cost.
  return extractJson(await claude(sys, `SOURCE TYPE: ${kindHint}\n\nFULL SOURCE TEXT:\n${sourceText.slice(0, 48000)}`, 6000, { model: claude.MODELS.REASON, cache: true }))
}

async function writerFromUnderstanding(u, shotPaths, regulated, brief) {
  // BRIEF PARITY: if the user approved a brief on the Review step, it is the
  // authoritative steering — mirror the block generateScript uses so the slides
  // deck matches the preview (angle / must-cover / avoid / tone).
  let briefBlock = ''
  if (brief && (brief.angle || (brief.keyPoints && brief.keyPoints.length) || (brief.emphasis && brief.emphasis.length) || (brief.avoid && brief.avoid.length))) {
    const parts = ['\n\nAPPROVED BRIEF — the user CONFIRMED what this deck must cover. Treat as HIGHEST priority; it overrides default angle choices:']
    if (brief.angle) parts.push(`- ANGLE / takeaway: ${brief.angle}`)
    if (brief.keyPoints && brief.keyPoints.length) parts.push(`- MUST COVER: ${brief.keyPoints.join(' | ')}`)
    if (brief.figures && brief.figures.length) parts.push(`- FEATURE these figures: ${brief.figures.map((f) => `${f.label} ${f.value}`).join(' | ')}`)
    if (brief.emphasis && brief.emphasis.length) parts.push(`- EMPHASIZE: ${brief.emphasis.join(' | ')}`)
    if (brief.avoid && brief.avoid.length) parts.push(`- AVOID: ${brief.avoid.join(' | ')}`)
    if (brief.tone) parts.push(`- TONE: ${brief.tone}`)
    briefBlock = parts.join('\n')
  }
  // STATIC PREFIX — identical on EVERY slide video → this is what gets prompt-cached.
  // Keep all per-video/conditional text OUT of here (screenshots/brief/compliance go
  // in the dynamic suffix below) so the cached bytes never change.
  const staticPrefix = `You are an intelligent creative DIRECTOR + SCRIPTWRITER building an ANIMATED EXPLAINER DECK (~90-120s, works like a talking PowerPoint). You get a COMPLETE researched UNDERSTANDING. Tell the WHOLE story faithfully.

Each content scene is a SLIDE: a TOPIC HEADING plus SUPPORTING CONTENT (2-4 bullets, or data/comparison cards, or a chart, or a screenshot) that back up the voice. Sound-off, a viewer still gets the point. Bullets/cards reveal one-by-one AS the narrator speaks them.

VOICE/TONE: conversational, warm, contractions, speak to "you", varied sentence length — a smart friend explaining, not a press release.
NUMBERS IN NARRATION: write numbers as a person SAYS them; NEVER a trailing ".0" (write "7 percent" not "7.0%"; keep "9.5%"). Dollar amounts can stay as "$824,500". On-screen text still shows the clean numeric form.

Return ONLY JSON:
{"title":"...","look":"noir|ledger|datamesh","intro":{"line1":"hook naming the brand","line2":"core promise"},"cta":{"line":"short action CTA","contact":"a contact URL/email/phone ONLY if it appears VERBATIM in the source, else null"},
"scenes":[{"id":1,"beat":"intro|hook|audience|benefit|proof|compare|context|cta","narration":"2-3 spoken sentences walking through this slide's points IN ORDER","kind":"slide|figure|intro|cta","layout":{"heading":"topic 3-6 words","kicker":"optional small label","align":"left|center","media":"right|below|full"},"blocks":[{"type":"bullets","items":[{"text":"6-12 words","highlight":"1-3 word key phrase","cue":"exact narration words spoken when this bullet appears"}]},{"type":"cards","vs":true,"cards":[{"label":"SHORT","value":"$399/mo or 15s or Free","sub":"optional","accent":true,"cue":"..."}]},{"type":"figure","figure":{"value":0,"prefix":"$","suffix":"/mo","label":"..."}},{"type":"screenshot","page":"/pricing","pins":[{"x":50,"y":40,"label":"...","cue":"..."}]}],"backdrop_prompt":"unique dark cinematic IDENTITY-NEUTRAL backdrop, NO people"}]}

RULES:
- 10-14 scenes. Scene 1 = intro. Last = cta.
- Multiple audiences → each gets its own mini-section (audience header + 2-3 benefit slides), both proportional.
- EVERY content slide MUST have real blocks — never a bare heading.
- Use cards for pricing tiers/comparisons (vs:true for 2-card, accent:true winner). For a FINANCIAL ILLUSTRATION: figures-heavy — key_numbers → figure blocks + comparison cards; personalize to the recipient.
- CUES: for every bullet/card/pin, "cue" = a short verbatim substring of THAT scene's narration. Bullets' cues in speaking order.
- Identity-neutral imagery (NO people). Compliance: never promise returns; illustrations are illustrated/hypothetical, not guaranteed.
- Faithful + complete for every audience.`
  // DYNAMIC SUFFIX — per-video bits (screenshots present?, approved brief, regulated
  // clause). NOT cached; appended right after the prefix so the model reads the exact
  // same combined prompt as before.
  const dynamicSuffix = '\n' +
    (shotPaths.length ? `- SCREENSHOTS (REQUIRED): use "screenshot" blocks on 2-3 slides. Page paths (use EXACTLY): ${shotPaths.join(', ')}. 1-2 pins each (x,y % 0-100) with label+cue.` : `- NO screenshots available (document/text source) — do NOT emit screenshot blocks.`) +
    briefBlock + (regulated ? SLIDE_COMPLIANCE_CLAUSE : '')
  // writer = creative/structured slide-plan generation → WRITE tier. The big static
  // director/schema prefix is prompt-cached; the small dynamic suffix rides plain.
  return extractJson(await claude({ staticPrefix, dynamicSuffix }, 'UNDERSTANDING:\n' + JSON.stringify(u, null, 2), 12000, { model: claude.MODELS.WRITE, cache: true }))
}

function figFromKeyNumber(kn) {
  if (!kn) return null
  const raw = String(kn.value); const m = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/); if (!m) return null
  return { value: parseFloat(m[0]), prefix: /\$/.test(raw) ? '$' : '', suffix: /%/.test(raw) ? '%' : /\/mo|per month/i.test(raw) ? '/mo' : /sec/i.test(raw) ? 's' : '', label: kn.label }
}

// ---------- COMPLIANCE (regulated financial / insurance content) ----------
// The EXPLAINER pipeline reads a source (e.g. an insurance ILLUSTRATION PDF),
// comprehends it, then a writer LLM turns it into slides. Illustrations repeat
// the carrier + branded product name dozens of times, and the writer prompt used
// to say "name the brand / figures-heavy / personalize to the recipient" — so the
// carrier ("Mutual of Omaha") + product ("Income Advantage IUL") + specific
// dollar figures leaked onto screen AND into the voiceover. These three guards
// mirror the commercial engine: detect → instruct the writer (soft) → scrub in
// code (hard, belt-and-suspenders). Insurance illustrations MUST be generic: no
// carrier, no product name, no specific figures/returns, agent-attributed.
function isRegulated(u) {
  const hay = JSON.stringify(u || {}).toLowerCase()
  return /\b(insuranc|annuit|iul|life policy|indexed universal|premium|underwrit|carrier|policyholder|book of business|licensed agent|financial advisor|retirement|investment|securit|fiduciary|medicare|final expense|death benefit|cash value|surrender)\b/.test(hay)
}
const SLIDE_COMPLIANCE_CLAUSE = `

COMPLIANCE (regulated insurance/financial content detected) — STRICT, OVERRIDES ANY CONFLICTING RULE ABOVE:
- This is a DETAILED explainer of the client's OWN coverage — be FACTUAL and COMPLETE so they understand what's available.
- FIGURES ARE ENCOURAGED: DO show and speak the actual dollar amounts, account/cash values, premiums, and rate/return percentages from the illustration (e.g. "$448,627", "6.35%"). Use figure blocks + cards for the real numbers — the client needs these facts.
- The ONE hard ban: NEVER name the insurance CARRIER (e.g. Mutual of Omaha, United of Omaha) or the branded PRODUCT (e.g. "Income Advantage", any specific "IUL"/"indexed universal life" product NAME) anywhere — intro, headings, bullets, cards, figure labels, or narration. Refer to it generically ("this policy", "your coverage", "an indexed universal life strategy" is OK as a category but not as a branded product name).
- The intro must NOT name the carrier as the brand — use the preparing AGENT/ADVISOR's name or a neutral phrase ("Your plan", "A closer look").
- NEVER promise or imply GUARANTEED returns/results. Numbers are illustrated/hypothetical, not guaranteed — frame them as "illustrated" / "projected".
- Attribute to the AGENT/ADVISOR and point the viewer to the ACTUAL illustration for specifics. CTA is "contact your agent"-style, not a product signup.`

// CANONICAL carrier/product blocklist — the SINGLE SOURCE OF TRUTH for the VPS.
// ⚠ KEEP IN SYNC with app/_lib/compliance.ts (the Vercel copy — same list). This
// is exported and imported by commercial.js so the VPS never has two divergent
// lists (it used to have three across brief/slides/commercial).
const CARRIER_BLOCKLIST = [
  // ---- carriers ----
  'mutual of omaha', 'united of omaha', 'north american', 'nationwide', 'transamerica',
  'prudential', 'metlife', 'new york life', 'northwestern mutual', 'lincoln financial',
  'john hancock', 'pacific life', 'principal', 'allianz', 'american general', 'corebridge',
  'aig', 'securian', 'minnesota life', 'symetra', 'protective', 'foresters', 'mass mutual',
  'massmutual', 'guardian', 'ameritas', 'sammons', 'midland national', 'f&g',
  'fidelity & guaranty', 'athene', 'global atlantic', 'brighthouse', 'penn mutual',
  'ohio national', 'aetna', 'cigna', 'humana', 'blue cross', 'blue shield',
  'unitedhealthcare', 'united healthcare', 'national western', 'nlg', 'columbus', 'meridian',
  // ---- branded products ----
  'income advantage', 'indexed universal life', 'index universal life', 'iul', 'qol',
  'max accumulator', 'select choice', 'accumulator+', 'select choice ii', 'lapse guard',
  'guaranteed refund option',
]
// pull branded product tokens (CamelCase / Capitalized) from the understanding so
// a novel product name (not in the blocklist) is still stripped.
function productTokens(u) {
  const names = new Set()
  const add = (s) => { if (typeof s === 'string') for (const w of s.split(/[\s,.—:;()]+/)) { const t = w.trim(); if (t.length >= 4 && /^[A-Z]/.test(t) && !/^(The|And|For|Your|With|Ask|Get|How|Why|You|Our|This|That|Plan|Life|Death|Cash|From|Into|When|What|Will|More|Less|Best)$/i.test(t)) names.add(t) } }
  const hay = [u && u.what_it_is, u && u.core_promise, ...(u && u.notable_features || []), ...((u && u.key_numbers || []).map(k => k && k.label)), ...((u && u.audiences || []).map(a => a && a.name))].filter(Boolean).join(' ')
  for (const m of String(hay).matchAll(/\b([A-Z][a-z]+[A-Z][A-Za-z]*|[A-Z][a-zA-Z]{3,})\b/g)) add(m[1])
  return [...names].slice(0, 8)
}
// scrub ONLY carrier + branded-product NAMES from every on-screen + spoken string
// in the slide plan. Runs on the WRITER output (w) BEFORE scenes are built and
// BEFORE any VO is generated, so the voice never speaks a scrubbed name either.
//
// IMPORTANT — this is a DETAILED EXPLAINER of the client's actual coverage:
// DOLLAR FIGURES + PERCENTAGES ARE KEPT (the client needs the real facts/numbers
// to understand what's available). We strip the CARRIER NAME and PRODUCT NAME
// only. Guarantee language is softened (never imply a guaranteed result).
function scrubSlidePlan(w, u) {
  const strip = new Set(CARRIER_BLOCKLIST)
  for (const n of productTokens(u)) if (n && n.length >= 4) strip.add(n.toLowerCase())
  const terms = [...strip].filter(Boolean).sort((a, b) => b.length - a.length)
  const res = terms.map((t) => new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&') + '(?:\\s?(?:iul|life insurance company|life insurance|life|insurance company|insurance|company|policy|group|financial|iii|ii|iv|vi|v(?![a-z])|\\u2120|\\u00ae|\\u2122))*', 'ig'))
  // guarantee language: soften/strip so nothing implies a guaranteed result.
  // "guaranteed minimum floor" → "minimum floor" (keeps the concept, drops the
  // promise word); bare "guaranteed"/"risk-free"/"no risk" removed outright.
  // POSITIVE guarantee promises only (negated disclaimers like "non-guaranteed"
  // are ACCURATE and handled separately → rewritten to "illustrated").
  // ILLUSTRATION TERMS OF ART — never softened. "The guaranteed column /
  // element / basis" NAMES the contractual-minimum ledger; it is not a promise.
  // Rewriting it inverts the meaning ("the projected column is what the
  // contract must do" — false), and deleting it understates the floor.
  // MIRROR of app/_lib/compliance.ts ILLUSTRATION_SENSE — keep in sync.
  const ILLUSTRATION_SENSE = 'column|columns|element|elements|basis|ledger|scale'
  const guar = [
    [/\bguaranteed\s+(?=minimum|floor|rate|return|value|income)/ig, ''],   // drop just the promise word, keep the noun
    [new RegExp(`\\b(?:100%\\s+)?guaranteed\\b(?!\\s+(?:${ILLUSTRATION_SENSE})\\b)`, 'ig'), 'projected'],
    [new RegExp(`\\bguarantees?\\b(?!\\s+(?:${ILLUSTRATION_SENSE})\\b)`, 'ig'), 'assurance'],
    [/\brisk[- ]free\b/ig, ''], [/\bno risk\b/ig, ''], [/\bget rich\b/ig, ''],
  ]
  const clean = (s) => {
    if (typeof s !== 'string') return s
    let out = s
    for (const re of res) out = out.replace(re, '')   // carrier + product NAMES only
    // negated disclaimers → keep meaning as "illustrated"; positive promises → soften
    out = out.replace(/\bnon[-\s]?guaranteed\b/ig, 'illustrated').replace(/\bnot\s+guaranteed\b/ig, 'illustrated')
    for (const [re, sub] of guar) out = out.replace(re, sub)  // soften positive guarantee promises
    // (dollar figures + percentages are intentionally PRESERVED — they're the
    // coverage facts the client needs.)
    // Only SAFE cosmetic collapses here (never reconstruct grammar).
    out = out
      .replace(/(^|\s)\+?\s*(?:iii|ii|iv|vi)\b/gi, '$1')   // orphaned version fragments ("+ III")
      .replace(/(^|\s)\+(?=\s|$)/g, '$1')
      // ORPHAN CLEANUP — removing a carrier NAME strands the bits that clung to it:
      //  "Mutual of Omaha's plan" → "'s plan"  → drop the leading possessive
      //  "an [Product] strategy"  → "an  strategy" (double space handled below), but
      //  "An [Product]" as a whole heading → "An" — a dangling article with nothing
      //  after it. Strip a stranded leading possessive, and drop a trailing/leading
      //  article/preposition left with no noun. Deterministic, not grammar-rebuilding.
      .replace(/(^|[\s([{])['’]s\b/gi, '$1')                       // leading "'s"
      .replace(/\b(an?|the|with|of|by|for|from|to|and)[\s]*$/i, '') // trailing dangling word
      .replace(/^[\s]*(an?|the|with|of|by|for|from|to|and)[\s]*$/i, '') // whole string == one article
      .replace(/\s{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.,!?;:])\1+/g, '$1')
    return out.replace(/^[\s—–\-,;:'’]+|[\s—–\-,;:]+$/g, '').replace(/^([a-z])/, (m) => m.toUpperCase()).trim()
  }
  // scrubbing can empty a CRITICAL field (intro line, title, a slide heading);
  // a blank renders as a broken slide, so fall back to a neutral generic phrase.
  const orEmpty = (v, fb) => (v && v.trim()) ? v : fb
  // Record narration lines the scrub actually CHANGED. Word-level name removal can
  // leave the sentence with a hole ("an [Carrier] indexed strategy" → "an strategy",
  // "so let's sort it out" → "so let's it up") that the voice reads as a stumble.
  // We collect before/after here and hand them to smoothScrubbedSlides() (an async
  // model pass) to close the gaps. ⚠ mirror of app/_lib/compliance.ts smoothScrubbed.
  const scrubbed = []
  if (w.intro) {
    w.intro.line1 = orEmpty(clean(w.intro.line1), 'A closer look at your plan')
    w.intro.line2 = orEmpty(clean(w.intro.line2), 'Prepared for you by your advisor')
  }
  if (w.cta) w.cta.line = orEmpty(clean(w.cta.line), 'Talk with your agent')
  w.title = orEmpty(clean(w.title), 'Your plan')
  for (const s of (w.scenes || [])) {
    const beforeN = s.narration
    s.narration = clean(s.narration)
    if (typeof beforeN === 'string' && s.narration && beforeN !== s.narration) scrubbed.push({ set: (v) => { s.narration = v }, after: s.narration })
    if (s.layout) {
      const beforeH = s.layout.heading
      s.layout.heading = orEmpty(clean(s.layout.heading), 'Your plan')
      // a scrubbed HEADING can read broken too ("An Starting Point", "Long- Upside")
      // — smooth it with the same pass. (2-word min filter in the smoother skips
      // trivial ones.)
      if (typeof beforeH === 'string' && s.layout.heading && beforeH !== s.layout.heading) scrubbed.push({ set: (v) => { s.layout.heading = v }, after: s.layout.heading })
      s.layout.kicker = clean(s.layout.kicker)  // kicker may be empty (optional)
    }
    for (const b of (s.blocks || [])) {
      // figure blocks are KEPT (the $ value is a coverage fact); scrub only its
      // label text for a carrier/product name.
      if (b.type === 'figure' && b.figure) { b.figure.label = clean(b.figure.label); b.figure.prefix = clean(b.figure.prefix); b.figure.suffix = b.figure.suffix }
      for (const it of (b.items || [])) { if (it) { it.text = clean(it.text); it.highlight = clean(it.highlight) } }
      for (const cd of (b.cards || [])) { if (cd) { cd.label = clean(cd.label); cd.value = clean(cd.value); cd.sub = clean(cd.sub) } }
      for (const p of (b.pins || [])) { if (p) p.label = clean(p.label) }
    }
    // keep all blocks (figures/cards carry the numbers); only drop a card that
    // was left completely value-less by name-scrubbing.
    s.blocks = (s.blocks || []).filter((b) => !(b.type === 'cards' && (b.cards || []).every((c) => !c || (!c.value && !c.label))))
  }
  w.__scrubbed = scrubbed   // consumed by smoothScrubbedSlides()
  return w
}

// Re-smooth the narration lines the scrub broke. Word-level name removal leaves
// awkward/dropped-word sentences the voice stumbles over; this runs ONE cheap
// model pass over ONLY the changed lines, rewriting them into natural English
// under the same compliance constraints. Never reintroduces a name, never invents
// a figure, best-effort (on any failure the scrubbed text ships as-is).
// ⚠ KEEP IN SYNC with app/_lib/compliance.ts smoothScrubbed().
async function smoothScrubbedSlides(w) {
  const pairs = (w && w.__scrubbed) || []
  // include 1-word results too — a scrubbed heading can collapse to a lone dangling
  // article ("An") that still needs repair/removal.
  const changed = pairs.filter((p) => p.after && /[a-z]/i.test(p.after))
  if (!changed.length) return w
  try {
    const list = changed.map((p, i) => `${i}. ${p.after}`).join('\n')
    const sys = 'You repair short narration lines for a client-facing insurance illustration explainer. ' +
      'Each line had carrier and product NAMES removed and guarantee wording softened, which left awkward or dropped-word phrasing. ' +
      'Rewrite each line so it reads naturally in plain spoken English.\n' +
      'HARD RULES:\n' +
      '- NEVER reintroduce a carrier, company, or branded product name.\n' +
      '- NEVER promise or imply a guaranteed return; keep figures framed as illustrated/projected.\n' +
      '- KEEP every dollar amount, percentage, and age EXACTLY as written. Invent nothing.\n' +
      '- Keep the same meaning and roughly the same length. Fix duplicated words and dangling grammar.\n' +
      '- If a line already reads fine, return it unchanged.\n' +
      'Reply with ONLY a JSON array of strings, in the same order, no prose or code fences.'
    const raw = await claude(sys, list, 1500, { model: claude.MODELS.CHEAP, cache: true })
    const m = raw.match(/\[[\s\S]*\]/)
    if (!m) return w
    const arr = JSON.parse(m[0])
    if (!Array.isArray(arr) || arr.length !== changed.length) return w
    arr.forEach((v, i) => {
      const s = typeof v === 'string' ? v.trim() : ''
      if (!s || complianceLeaks({ scenes: [{ narration: s }] }).length) return   // rejected: a name crept back
      const figs = (changed[i].after.match(/\$[\d,]+|\b\d+(?:\.\d+)?%|\b\d{2,}\b/g) || [])
      if (figs.some((f) => !s.includes(f))) return   // rejected: dropped a figure
      changed[i].set(s)
    })
  } catch { /* best-effort — scrubbed text still ships */ }
  return w
}
// returns the list of blocklisted terms that survived into the final text (should
// be empty). Used for the post-scrub leak assertion in the log.
function complianceLeaks(w) {
  const hay = JSON.stringify(w || {}).toLowerCase()
  return CARRIER_BLOCKLIST.filter((t) => hay.includes(t))
}

/**
 * generateSlidePlan — the full generation, MINUS the render. Writes dir-plan.json
 * + all assets into `pub` and returns { planPath, assetNames } for the caller to
 * render + upload. `deps` injects the VPS's existing helpers (gemini image, tts
 * limiter) so we don't duplicate them.
 */
async function generateSlidePlan({ pub, source, preparer, recipient, music, glass, footer, forcedAccent, shots, presenter, photoPlacement, photos, brief, deps, log }) {
  const say = log || (() => {})
  const kind = source.kind // 'website' | 'pdf' | 'text'
  say(`comprehending ${kind} (${source.text.length} chars)...`)
  const u = await comprehend(source.text, kind)

  const shotByPath = new Map(); const shotPaths = []
  ;(shots || []).forEach((sh) => { const p = (sh.path || '/').replace(/\/$/, '') || '/'; shotByPath.set(p, sh); shotPaths.push(p) })

  // COMPLIANCE: detect regulated (insurance/financial illustration) content up
  // front so the writer gets the strict clause, then scrub the output in code.
  const regulated = isRegulated(u)
  if (regulated) say('⚖ regulated content detected — compliance mode ON')

  say('writing slide deck...')
  if (brief && (brief.angle || (brief.keyPoints && brief.keyPoints.length))) say('honoring approved brief')
  let w = await writerFromUnderstanding(u, shotPaths, regulated, brief)

  // CODE-LEVEL SCRUB (belt-and-suspenders): strip carrier/product names + specific
  // dollar figures + rate % from EVERY on-screen + spoken string, BEFORE VO is
  // generated (so the voice never speaks them either). Then assert nothing leaked.
  if (regulated) {
    w = scrubSlidePlan(w, u)
    // name removal is word-level, so a scrubbed sentence can lose a word and read
    // broken ("an strategy", "so let's it up"). Re-smooth ONLY the changed lines
    // with a cheap model pass BEFORE VO, so the voice never speaks a stumble.
    const nFixed = (w.__scrubbed || []).length
    if (nFixed) { await smoothScrubbedSlides(w); say(`✓ re-smoothed ${nFixed} scrubbed narration line(s)`) }
    delete w.__scrubbed
    const leaked = complianceLeaks(w)
    if (leaked.length) say('⚠ COMPLIANCE: carrier/product term(s) survived scrub: ' + leaked.join(', '))
    else say('✓ compliance scrub clean — no carrier/product/figure leaks')
  }

  // build scenes
  const scenes = w.scenes.map((s) => {
    const k = s.kind || (s.beat === 'intro' ? 'intro' : s.beat === 'cta' ? 'cta' : 'slide')
    const blocks = (s.blocks || []).map((b) => {
      if (b.type === 'screenshot') { const sh = shotByPath.get(String(b.page || '').replace(/\/$/, '') || '/'); return sh ? { type: 'screenshot', file: sh.hero, pins: b.pins || [] } : null }
      return b
    }).filter(Boolean)
    const visual = (k === 'slide' || k === 'figure') ? { type: 'slide' } : { type: 'kinetic' }
    return { id: s.id, beat: s.beat, narration: s.narration, on_screen: (s.layout && s.layout.heading) || s.on_screen || '', layout: s.layout, blocks, visual, backdrop: undefined, _bp: s.backdrop_prompt }
  })

  // PERSONALIZED OPENING — on an explainer prepared FOR a named client, the very
  // first thing the narrator should do is address the client BY NAME and thank
  // them for letting the agent (presenter/preparer) walk them through this
  // summary. We PREPEND this to the intro scene's narration (keeping whatever the
  // writer wrote after it) so it's guaranteed + consistent. Compliance-safe: it
  // names only the CLIENT and the AGENT, never the carrier/product.
  // ⚠ KEEP IN SYNC with app/_lib/personalize.ts (buildOpeningNarration) — the
  // Vercel V3/editorial paths use that shared copy; this is the slides mirror.
  {
    const clientFirst = String(recipient || '').trim().split(/\s+/)[0]  // first name feels personal
    // CANONICAL agent name = the "prepared by" name the cover + CTA use (preparer).
    // Prefer it over presenter.name so the greeting NEVER names a different agent
    // than the rest of the deck (they come from the same brand profile in the app;
    // this guards the case where they diverge).
    const agentName = preparer || (presenter && presenter.name)
    const introScene = scenes.find((s) => s.beat === 'intro') || scenes[0]
    if (clientFirst && agentName && introScene) {
      const doc = regulated ? 'illustration summary' : 'summary'
      const greet = `${clientFirst}, thank you for letting ${agentName} share this ${doc} with you.`
      let body = introScene.narration || ''
      // avoid double-greeting: if the writer's intro also opens by naming the
      // client or the agent (a "Hi — this is a walkthrough <agent> put together"
      // self-intro), drop that leading sentence so we don't say it twice.
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const namesClient = new RegExp(`^\\s*(hi[,!. ]+)?${esc(clientFirst)}\\b`, 'i').test(body)
      const firstSentence = (body.match(/^.*?[.!?](\s|$)/) || [''])[0]
      const selfIntro = agentName && new RegExp(esc(agentName), 'i').test(firstSentence) && /\b(this is|walkthrough|put together|prepared|here)\b/i.test(firstSentence)
      if (selfIntro) body = body.slice(firstSentence.length).trim()  // drop the writer's redundant self-intro
      introScene.narration = namesClient ? body : `${greet} ${body}`.trim()
    }
  }

  // ASSETS — VO + (optional) backdrops, generated CONCURRENTLY (not one-by-one)
  // so the wall-clock is ~max, not ~sum. VO goes through deps.tts (a pool of ~3,
  // respecting ElevenLabs' concurrency); images fan out fully (they retry). Each
  // scene resolves its OWN cues against its OWN VO result. This is the big
  // speedup (~3-4 min off a typical video) with zero quality change.
  const NEUTRAL = ' Identity-neutral: NO people, NO faces. Dark, moody, cinematic, defocused, heavily shadowed. No text, no logos.'
  // PHOTOS are now OPT-IN: default = the animated code background (instant, $0).
  // Only generate photographic backdrops when `photos` is requested AND we have
  // an image generator. (Intro/cta never get backdrops.)
  const wantPhotos = !!photos && !!deps.geminiImage

  // fire VO + backdrops for every scene at once; await all.
  await Promise.all(scenes.map(async (s) => {
    // VO (pooled) — capture duration + resolve this scene's cues
    const voP = deps.tts(() => ttsTimed(s.narration, join(pub, `dir-vo-${s.id}.mp3`))).then((timed) => {
      const durF = Math.round(timed.durationSec * FPS)
      s._voFrames = durF
      const toFrame = (cue) => { const sec = cueSec(timed.words, cue); return sec == null ? null : Math.round(sec * FPS) }
      const ordered = (arr) => { let prev = 12; arr.forEach((it, i) => { let f = toFrame(it.cue); const evenly = Math.round(12 + (durF - 24) * (i / Math.max(1, arr.length))); if (f == null || f < prev + 4) f = Math.max(prev + 8, evenly); it.cueFrame = f; prev = f; delete it.cue }) }
      for (const b of (s.blocks || [])) { if (b.type === 'bullets') ordered(b.items); if (b.type === 'cards') ordered(b.cards); if (b.type === 'screenshot') (b.pins || []).forEach((p) => { p.cueFrame = toFrame(p.cue); delete p.cue }) }
    })
    // backdrop (optional, best-effort)
    let bdP = Promise.resolve()
    if (wantPhotos && s._bp && s.beat !== 'intro' && s.beat !== 'cta') {
      bdP = deps.geminiImage(s._bp + NEUTRAL, join(pub, `dir-bd-${s.id}.png`)).then(() => { s.backdrop = `dir-bd-${s.id}.png` }, (e) => say(`bd${s.id} skipped: ${(e.message || '').slice(0, 40)}`))
    }
    await Promise.all([voP, bdP])
    delete s._bp
  }))

  // BEAT-GRID scene starts — MUST match remotion's directedMetadata exactly, so
  // the server can grab a real thumbnail at each scene's midpoint from the final
  // mp4 (and the Fix-a-Scene feature can target frame ranges). bpm=128, GAP=0.35s.
  const BEATF = (60 / 128) * FPS, GAP = Math.round(0.35 * FPS)
  // The COVER must stay on screen long enough to READ the client's name + the
  // agent's name — hold it ~3.5s minimum (≈8 beats) on every explainer, even if
  // the intro VO is short. Other scenes keep the 2-beat floor.
  const COVER_MIN_BEATS = Math.ceil((3.5 * FPS) / BEATF)  // ~7.5 → 8 beats
  const starts = []; let t = Math.round(BEATF)
  for (const s of scenes) {
    starts.push(Math.round(t))
    const floor = s.beat === 'intro' ? COVER_MIN_BEATS : 2
    const beats = Math.max(floor, Math.ceil(((s._voFrames || 60) + GAP) / BEATF))
    t += beats * BEATF
  }
  const total = Math.round(t + 4 * BEATF)
  scenes.forEach((s) => delete s._voFrames)

  // music
  if (deps.stageMusic) { try { await deps.stageMusic(music, join(pub, 'dir-music.mp3')) } catch (e) { say(`music skipped: ${e.message.slice(0, 40)}`) } }

  // look + palette + chrome + cta
  const validLooks = ['noir', 'ledger', 'datamesh']
  const look = validLooks.includes(w.look) ? w.look : 'noir'
  const palette = buildBrandPalette(kind === 'website' ? source.brand : null, forcedAccent)
  // The uploaded logo is the AGENT's OWN brand (the agent uploaded it), NOT the
  // carrier's — ALWAYS show it, including on regulated illustrations. Same for
  // the client NAME (`recipient`) and the agent photo below: they're the agent's
  // identity, never scrubbed. Compliance only strips the CARRIER/PRODUCT NAME.
  let logo
  try { await readFile(join(pub, 'brand-logo.png')); logo = 'brand-logo.png' } catch {}
  // recipient in chrome: the real client name (passed as `recipient`) always
  // shows. Only the AUDIENCE-NAME FALLBACK can accidentally be the carrier, so
  // that fallback (and only it) is suppressed when regulated.
  const chromeRecipient = recipient || (!regulated && u.audiences && u.audiences[0] && u.audiences[0].name) || null
  // The footer + closing contact are the AGENT'S, NEVER our platform. The caller
  // (app) builds `footer` from the agent's profile (website/calendly/phone/email/
  // company). Fall back to the agent's own company/name — never docs2video.com,
  // which is our brand and has no business on a client-facing insurance video.
  const agentContact = footer || preparer || (u.brand && u.brand.company) || null
  const chrome = { company: preparer, logo, recipient: chromeRecipient, footer: agentContact, glass: glass || 'vivid' }
  // Closing CTA contact: prefer a real contact the writer found in the source,
  // then the agent's own footer/contact — but NEVER the source URL if it is ours
  // or empty. This is what stops "docs2video.com" appearing on the last slide.
  const ctaContact = (w.cta && w.cta.contact) || agentContact || null
  const doc = { title: w.title, look, chrome, intro: { ...w.intro, preparer, recipient }, cta: { line: (w.cta && w.cta.line) || 'Get started today', contact: ctaContact }, scenes }
  // presenter headshot (opt-in). photoPlacement: cover|closing|both|none|auto.
  // The photo is staged as brand-presenter.png by the caller; we set placement flags.
  if (presenter && presenter.photo) {
    // Default to BOTH for the explainer: the agent's face belongs on the cover
    // (next to the client's name) AND on the closing contact card. Only an
    // explicit 'cover'/'closing'/'none' narrows it.
    const pl = photoPlacement || 'both'
    doc.presenter = { name: presenter.name, role: presenter.role, photo: presenter.photo,
      onCover: pl === 'cover' || pl === 'both' || pl === 'auto', onClosing: pl === 'closing' || pl === 'both' || pl === 'auto' }
  }
  if (palette) doc.palette = palette
  // SFX safety: the renderer's Sfx component loads sfx/*.wav and a missing file
  // cancels the render. If the wavs aren't present, disable SFX in the plan so
  // the render never crashes on them (deploy should provide them, this is a net).
  try { const { existsSync } = require('fs'); if (!existsSync(join(pub, 'sfx', 'impact-soft.wav'))) doc.noSfx = true } catch { doc.noSfx = true }

  await writeFile(join(pub, 'dir-plan.json'), JSON.stringify(doc, null, 2))
  const assetNames = ['dir-plan.json', ...scenes.map((s) => `dir-vo-${s.id}.mp3`), ...scenes.filter((s) => s.backdrop).map((s) => s.backdrop), 'dir-music.mp3']
  // per-scene timing + chapter labels for the SLIDES panel + Fix-a-Scene:
  //   startSec = when each scene begins, midSec = a good thumbnail moment,
  //   label = the heading (or CTA/intro text), voFile = the scene's isolated VO.
  const sceneMeta = scenes.map((s, i) => ({
    id: s.id, index: i,
    startSec: Math.round((starts[i] / FPS) * 10) / 10,
    endSec: Math.round(((starts[i + 1] ?? total) / FPS) * 10) / 10,
    midSec: Math.round((((starts[i] + (starts[i + 1] ?? total)) / 2) / FPS) * 10) / 10,
    label: (s.layout && s.layout.heading) || s.on_screen || (s.beat === 'cta' ? (doc.cta.line) : s.beat === 'intro' ? doc.title : `Scene ${i + 1}`),
    narration: s.narration, voFile: `dir-vo-${s.id}.mp3`,
  }))
  return { plan: doc, assetNames, understanding: u, starts, total, sceneMeta }
}

/**
 * generateSceneVO — regenerate ONE scene's voiceover (Fix-a-Scene). Handles an
 * optional pronunciation override (e.g. {word:'Reg FD', say:'Regulation F D'})
 * by injecting it into the speakable pass for this clip only. Returns the timed
 * result ({words, durationSec}) so cues can be re-resolved.
 */
async function generateSceneVO({ pub, text, outName, pronounce, tts }) {
  // apply an ad-hoc pronunciation override on top of the standard normalization
  let spoken = text
  if (pronounce && pronounce.word && pronounce.say) {
    try { spoken = spoken.replace(new RegExp(pronounce.word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), pronounce.say) } catch {}
  }
  const run = () => ttsTimed(spoken, join(pub, outName))
  return tts ? await tts(run) : await run()
}

module.exports = { generateSlidePlan, generateSceneVO, speakable, speakableNumbers, ttsTimed, cueSec, buildBrandPalette, cloudflareImage, cloudflareAvailable, claude, comprehend, isRegulated, productTokens, scrubSlidePlan, smoothScrubbedSlides, complianceLeaks, CARRIER_BLOCKLIST }
