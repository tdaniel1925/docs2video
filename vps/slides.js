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
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'
const DOC_MODEL = process.env.DOC_MODEL || 'gemini-flash-latest'
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

const FPS = 30

// ---------- Anthropic (raw HTTP, no SDK) ----------
async function claude(system, user, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  return j.content[0].text
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
  return extractJson(await claude(sys, `SOURCE TYPE: ${kindHint}\n\nFULL SOURCE TEXT:\n${sourceText.slice(0, 120000)}`, 6000))
}

async function writerFromUnderstanding(u, shotPaths) {
  const sys = `You are an intelligent creative DIRECTOR + SCRIPTWRITER building an ANIMATED EXPLAINER DECK (~90-120s, works like a talking PowerPoint). You get a COMPLETE researched UNDERSTANDING. Tell the WHOLE story faithfully.

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
${shotPaths.length ? `- SCREENSHOTS (REQUIRED): use "screenshot" blocks on 2-3 slides. Page paths (use EXACTLY): ${shotPaths.join(', ')}. 1-2 pins each (x,y % 0-100) with label+cue.` : `- NO screenshots available (document/text source) — do NOT emit screenshot blocks.`}
- CUES: for every bullet/card/pin, "cue" = a short verbatim substring of THAT scene's narration. Bullets' cues in speaking order.
- Identity-neutral imagery (NO people). Compliance: never promise returns; illustrations are illustrated/hypothetical, not guaranteed.
- Faithful + complete for every audience.`
  return extractJson(await claude(sys, 'UNDERSTANDING:\n' + JSON.stringify(u, null, 2), 12000))
}

function figFromKeyNumber(kn) {
  if (!kn) return null
  const raw = String(kn.value); const m = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/); if (!m) return null
  return { value: parseFloat(m[0]), prefix: /\$/.test(raw) ? '$' : '', suffix: /%/.test(raw) ? '%' : /\/mo|per month/i.test(raw) ? '/mo' : /sec/i.test(raw) ? 's' : '', label: kn.label }
}

/**
 * generateSlidePlan — the full generation, MINUS the render. Writes dir-plan.json
 * + all assets into `pub` and returns { planPath, assetNames } for the caller to
 * render + upload. `deps` injects the VPS's existing helpers (gemini image, tts
 * limiter) so we don't duplicate them.
 */
async function generateSlidePlan({ pub, source, preparer, recipient, music, glass, footer, forcedAccent, shots, presenter, photoPlacement, deps, log }) {
  const say = log || (() => {})
  const kind = source.kind // 'website' | 'pdf' | 'text'
  say(`comprehending ${kind} (${source.text.length} chars)...`)
  const u = await comprehend(source.text, kind)

  const shotByPath = new Map(); const shotPaths = []
  ;(shots || []).forEach((sh) => { const p = (sh.path || '/').replace(/\/$/, '') || '/'; shotByPath.set(p, sh); shotPaths.push(p) })

  say('writing slide deck...')
  const w = await writerFromUnderstanding(u, shotPaths)

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

  // backdrops (best-effort) + VO with cue resolution
  const NEUTRAL = ' Identity-neutral: NO people, NO faces. Dark, moody, cinematic, defocused, heavily shadowed. No text, no logos.'
  for (const sc of scenes) {
    if (sc.beat === 'intro' || sc.beat === 'cta') { delete sc._bp; continue }
    if (deps.geminiImage && sc._bp) {
      try { await deps.geminiImage(sc._bp + NEUTRAL, join(pub, `dir-bd-${sc.id}.png`)); sc.backdrop = `dir-bd-${sc.id}.png` } catch (e) { say(`bd${sc.id} skipped: ${e.message.slice(0, 40)}`) }
    }
    delete sc._bp
  }
  for (const s of scenes) {
    const timed = await deps.tts(() => ttsTimed(s.narration, join(pub, `dir-vo-${s.id}.mp3`)))
    const durF = Math.round(timed.durationSec * FPS)
    const toFrame = (cue) => { const sec = cueSec(timed.words, cue); return sec == null ? null : Math.round(sec * FPS) }
    const ordered = (arr) => { let prev = 12; arr.forEach((it, i) => { let f = toFrame(it.cue); const evenly = Math.round(12 + (durF - 24) * (i / Math.max(1, arr.length))); if (f == null || f < prev + 4) f = Math.max(prev + 8, evenly); it.cueFrame = f; prev = f; delete it.cue }) }
    for (const b of (s.blocks || [])) { if (b.type === 'bullets') ordered(b.items); if (b.type === 'cards') ordered(b.cards); if (b.type === 'screenshot') (b.pins || []).forEach((p) => { p.cueFrame = toFrame(p.cue); delete p.cue }) }
  }

  // music
  if (deps.stageMusic) { try { await deps.stageMusic(music, join(pub, 'dir-music.mp3')) } catch (e) { say(`music skipped: ${e.message.slice(0, 40)}`) } }

  // look + palette + chrome + cta
  const validLooks = ['noir', 'ledger', 'datamesh']
  const look = validLooks.includes(w.look) ? w.look : 'noir'
  const palette = buildBrandPalette(kind === 'website' ? source.brand : null, forcedAccent)
  let logo
  try { await readFile(join(pub, 'brand-logo.png')); logo = 'brand-logo.png' } catch {}
  const chrome = { company: preparer, logo, recipient: recipient || (u.audiences && u.audiences[0] && u.audiences[0].name), footer: footer || 'docs2video.com', glass: glass || 'vivid' }
  const ctaContact = (w.cta && w.cta.contact) || (source.url ? new URL(source.url).hostname.replace(/^www\./, '') : null)
  const doc = { title: w.title, look, chrome, intro: { ...w.intro, preparer, recipient }, cta: { line: (w.cta && w.cta.line) || 'Get started today', contact: ctaContact }, scenes }
  // presenter headshot (opt-in). photoPlacement: cover|closing|both|none|auto.
  // The photo is staged as brand-presenter.png by the caller; we set placement flags.
  if (presenter && presenter.photo) {
    const pl = photoPlacement || 'closing'
    doc.presenter = { name: presenter.name, role: presenter.role, photo: presenter.photo,
      onCover: pl === 'cover' || pl === 'both', onClosing: pl === 'closing' || pl === 'both' || pl === 'auto' }
  }
  if (palette) doc.palette = palette

  await writeFile(join(pub, 'dir-plan.json'), JSON.stringify(doc, null, 2))
  const assetNames = ['dir-plan.json', ...scenes.map((s) => `dir-vo-${s.id}.mp3`), ...scenes.filter((s) => s.backdrop).map((s) => s.backdrop), 'dir-music.mp3']
  return { plan: doc, assetNames, understanding: u }
}

module.exports = { generateSlidePlan, speakable, speakableNumbers, ttsTimed, cueSec, buildBrandPalette }
