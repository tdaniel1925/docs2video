/**
 * COMMERCIAL PIPELINE (VPS) — the production port of
 * scripts/director/make-commercial.ts. Runs on the VPS: read a URL (or pasted
 * text) → comprehend (Claude) → DIRECT a commercial spec (styleId + beats) →
 * per-beat word-timed VO + literal hero images → build the commercialSchema props
 * JSON + assets in `public/<assetDir>/`. The caller (server.js /generate-commercial)
 * then renders the TemplateCommercial composition + uploads.
 *
 * Reuses slides.js helpers (claude, comprehend, ttsTimed, cloudflareImage, brand
 * palette) so we don't duplicate the API plumbing. Only NEW piece here is the
 * director prompt + the beat→props mapping.
 */
const { writeFile } = require('fs/promises')
const { join } = require('path')
const { execFile } = require('child_process')
const { claude, comprehend, ttsTimed, cloudflareImage, cloudflareAvailable } = require('./slides')

const FPS = 30
const STYLE_IDS = ['fintech', 'luxury', 'tech', 'upbeat', 'emerald', 'redblueprint', 'data', 'playful', 'casino', 'clean']
function extractJson(t) { const s = t.indexOf('{'); const e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)) }
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'brand'

// ---------- single-page HTML fetch → text (no browser; enough for a commercial) ----------
async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; docs2video/1.0)' }, signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`fetch ${r.status}`)
  return await r.text()
}
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 60000)
}

// ---------- brand palette (extract the site accent, build a cinematic dark set) ----------
const FRAMEWORK_HEXES = new Set(['#ffffff', '#000000', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da', '#6c757d', '#343a40', '#212529', '#007bff', '#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#28a745', '#198754', '#20c997', '#17a2b8', '#f5f5f5', '#eeeeee', '#e0e0e0'])
function hexToRgb(h) { const n = h.replace('#', ''); return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)] }
function rgbToHex(r, g, b) { const c = (n) => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2); return '#' + c(r) + c(g) + c(b) }
function lift(hex, k) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) }
function lum(h) { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 }
function sat(h) { const [r, g, b] = hexToRgb(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx }

// Pull the true brand accent from a page's HTML/CSS: most-frequent, saturated,
// non-framework hex (filters Bootstrap/Tailwind defaults — the Apex bug).
function extractAccent(html) {
  const hexes = [...html.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase())
  const varHit = [...html.matchAll(/--[\w-]*(?:primary|brand|accent|main|theme)[\w-]*\s*:\s*(#[0-9a-fA-F]{6})/gi)].map((m) => m[1].toLowerCase())
  const freq = {}
  for (const h of hexes) { if (FRAMEWORK_HEXES.has(h)) continue; if (sat(h) < 0.35) continue; const l = lum(h); if (l < 0.05 || l > 0.9) continue; freq[h] = (freq[h] || 0) + 1 }
  for (const v of varHit) if (!FRAMEWORK_HEXES.has(v) && sat(v) >= 0.3) freq[v] = (freq[v] || 0) + 5   // CSS vars weigh heavier
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([h]) => h)
  const primary = ranked[0] || null
  const secondary = ranked.find((h) => Math.abs(lum(h) - lum(primary || '#000')) > 0.12 || sat(h) > 0.5 && h !== primary) || null
  return { primary, secondary }
}
function buildBrand(accent, secondary) {
  let acc = accent || '#6ea8fe'
  if (lum(acc) < 0.22) acc = lift(acc, 0.35)
  const [ar, ag, ab] = hexToRgb(acc)
  return {
    bg: rgbToHex(ar * 0.08 + 8, ag * 0.08 + 9, ab * 0.08 + 12),
    bg2: rgbToHex(ar * 0.16 + 12, ag * 0.16 + 14, ab * 0.16 + 20),
    panel: rgbToHex(ar * 0.10 + 22, ag * 0.10 + 22, ab * 0.10 + 26),
    accent: acc, accentHi: lift(acc, 0.4),
    accent2: secondary && lum(secondary) > 0.15 ? lift(secondary, lum(secondary) < 0.3 ? 0.35 : 0) : lift(acc, 0.15),
    cream: '#f4f1ea', mute: '#9fa2ad', white: '#ffffff',
  }
}

// ---------- DIRECT: Claude writes the commercial spec (styleId + beats) ----------
async function direct(u, brandName) {
  const sys = `You are a creative DIRECTOR writing a punchy ~30-40 second COMMERCIAL for a brand, from a complete understanding of what it is. Output a tight SPEC our renderer executes. Return ONLY JSON:
{
  "styleId": "ONE of: fintech (SaaS/finance, grotesk, terminal intro), luxury (premium/wealth/high-end, serif, elegant), tech (developer/infra/AI, assembly intro), upbeat (energetic/consumer, bold caps), emerald (growth/green/eco/health), redblueprint (bold/industrial/security), data (analytics/dashboards), playful (fun/creative/consumer app, rounded), casino (gaming/entertainment/bold caps), clean (minimal/design-forward). Pick what fits the brand's TONE.",
  "wordmark": { "pre": "first part of the brand name", "post": "second part to color-accent (may be empty)" },
  "logoLetter": "single uppercase initial for the logo mark",
  "musicPrompt": "a vivid prompt for an INSTRUMENTAL commercial music track that fits THIS brand's tone and energy — name the genre, instruments, tempo/energy, and mood, and say it should build toward the end. Instrumental only, no vocals. (e.g. 'Upbeat modern corporate electronic track, confident and premium, strong clear kick drum pulse, driving bass, bright synth plucks, builds energy toward the end')",
  "beats": [
    { "kind": "shot|meet|stats|grid|chat|quote|split|cta",
      "vo": "one natural spoken sentence for THIS beat (conversational, contractions, speak to 'you'; NO ellipsis '...'; say numbers naturally)",
      "kicker": "(optional) tiny label above the headline",
      "pre": "(shot/quote) headline text before the hot phrase",
      "hot": "(shot/quote) the 1-3 word phrase to light up in accent color. The renderer concatenates pre + hot + post, so write them as ONE sentence broken at word boundaries — e.g. pre 'Your data is ' (trailing space) + hot 'sitting idle', NOT pre 'Your data is' + hot 'sitting idle'",
      "post": "(optional) headline text after hot",
      "sub": "(meet/shot) small subtitle line",
      "img_prompt": "(shot ONLY) a cinematic, dark, photorealistic, IDENTITY-NEUTRAL 16:9 backdrop that LITERALLY illustrates this beat's words — no people/faces, no text, no logos",
      "stats": [ { "value": <number>, "prefix": "$", "suffix": "M|%|k", "label": "SHORT LABEL", "decimals": 0 } ],
      "items": [ { "icon": "single emoji", "title": "feature", "desc": "one line" } ],
      "chat": { "q": "a question a user would ask", "a": "the product's answer (concrete, references a real capability)" },
      "split": { "leftLabel": "OLD WAY", "leftSub": "before", "rightLabel": "NEW WAY", "rightSub": "after", "both": "(optional) unifying line" },
      "cta": { "headline": "the closing promise (short)", "button": "action label (e.g. Start Free)", "url": "the brand's domain, no https://" }
    }
  ]
}
STRUCTURE (5-7 beats, ~30-40s total):
- Beat 1 = "shot": a tension/hook headline over a literal cinematic backdrop (img_prompt MUST match the words).
- Beat 2 = "meet": reveal the brand (wordmark) with a one-line positioning sub.
- Then 2-4 PROOF beats chosen to fit the product: "stats" (real key_numbers → number+label), "grid" (3-4 features), "chat" (a real Q&A the product answers), "split" (old vs new), or "quote" (a punchy value line). Prefer stats/chat if there are real numbers or a clear "ask anything" capability.
- Final beat = "cta": the promise + button + the real domain.
RULES:
- Use ONLY facts from the understanding. Real numbers only in stats (strip units into prefix/suffix; e.g. "$2.8M" -> value 2.8, prefix "$", suffix "M", decimals 1). Never invent metrics.
- VO must be natural spoken sentences, one per beat, that TOGETHER tell the story. No "..." ever (it makes the voice choke). Contractions. Speak to "you".
- Headlines SHORT (2-6 words). Labels SHORT (1-2 words, will render uppercase).
- img_prompt only on "shot" beats and must be LITERAL to that beat + identity-neutral (architecture, screens, objects, light, texture, abstract data — NEVER a person).
- Pick the styleId that matches the brand's real tone; don't default to fintech for everything.`
  return extractJson(await claude(sys, 'UNDERSTANDING:\n' + JSON.stringify(u, null, 2) + (brandName ? `\n\nBRAND NAME: ${brandName}` : ''), 4000))
}

function ffprobeDur(file) {
  return new Promise((resolve) => {
    execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 15000 },
      (err, stdout) => resolve(err ? 3 : (parseFloat(String(stdout).trim()) || 3)))
  })
}

// ---------- MUSIC: ElevenLabs Music — a REAL generated track at an EXACT length,
// prompted per-commercial (the project's music approach; NOT a pre-made bed).
// ElevenLabs caps a single generation ~ a few minutes; our commercials are ~40s
// so `music_length_ms` = the video length is always in range. Returns true on
// success. Falls back to the caller's staged bed on any failure. ----
async function elevenMusic(prompt, lengthMs, outPath) {
  const KEY = process.env.ELEVENLABS_API_KEY
  if (!KEY) throw new Error('no ELEVENLABS_API_KEY')
  const ms = Math.max(10000, Math.min(300000, Math.round(lengthMs)))   // clamp to the API's supported range
  const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: `${prompt} Instrumental only, no vocals.`, music_length_ms: ms }),
    signal: AbortSignal.timeout(180000),
  })
  if (!r.ok) throw new Error(`eleven-music ${r.status}: ${(await r.text()).slice(0, 160)}`)
  await writeFile(outPath, Buffer.from(await r.arrayBuffer()))
}

/**
 * generateCommercial — the full generation, MINUS the render. Writes the props
 * JSON path + all assets into `pub/<assetDir>/` and returns { props, propsPath,
 * assetDir } for the caller to render + upload. `deps` injects the image + tts +
 * music helpers; falls back to the slides.js helpers when omitted.
 */
async function generateCommercial({ pub, url, text, brandName, music, forceStyle, videoId, deps = {}, log }) {
  const say = log || (() => {})
  const { mkdir } = require('fs/promises')
  const imageGen = deps.geminiImage || (cloudflareAvailable() ? cloudflareImage : null)
  const tts = deps.tts || ((fn) => fn())

  // 1) SOURCE
  say('Reading source...')
  let sourceText, domain = ''
  if (url) { const html = await fetchText(url); sourceText = htmlToText(html); try { domain = new URL(url).hostname.replace(/^www\./, '') } catch {}; var homeHtml = html }
  else if (text) { sourceText = String(text).slice(0, 60000); var homeHtml = '' }
  else throw new Error('Provide url or text')
  if (!sourceText || sourceText.trim().length < 60) throw new Error('Not enough readable text at that URL.')

  // 2) COMPREHEND
  say('Understanding the brand...')
  const u = await comprehend(sourceText, url ? 'website' : 'text')

  // 3) BRAND palette
  const { primary, secondary } = homeHtml ? extractAccent(homeHtml) : { primary: null, secondary: null }
  const brand = buildBrand(primary, secondary)

  // 4) DIRECT
  say('Writing the commercial...')
  const spec = await direct(u, brandName)
  let styleId = (forceStyle && STYLE_IDS.includes(forceStyle)) ? forceStyle : spec.styleId
  if (!STYLE_IDS.includes(styleId)) styleId = 'fintech'

  const assetDir = videoId ? `c-${videoId}` : slug(brandName || (spec.wordmark && spec.wordmark.pre) || u.category)
  const dir = join(pub, assetDir)
  await mkdir(join(dir, 'gen'), { recursive: true })
  const assetNames = []   // paths relative to `dir` (for staging/cleanup)

  // 5) ASSETS: per-beat VO (measured so beats fit the voice) + literal hero images
  say('Generating voice + visuals...')
  const beats = []
  for (let i = 0; i < spec.beats.length; i++) {
    const be = spec.beats[i]
    const voId = `${assetDir.slice(0, 6)}-${i + 1}`
    let dur = 4
    if (be.vo && String(be.vo).trim()) {
      try {
        const timed = await tts(() => ttsTimed(be.vo, join(dir, `${voId}.mp3`)))
        dur = Math.max(2.4, (timed.durationSec || 3) + 0.5)   // pad so the beat never cuts the voice
        assetNames.push(`${voId}.mp3`)
      } catch (e) { say(`vo ${i + 1} failed: ${e.message}`) }
    }
    let img
    if (be.kind === 'shot' && be.img_prompt && imageGen) {
      try { await imageGen(be.img_prompt + ' Cinematic, photorealistic, dark, moody, 16:9. No people, no faces, no text, no logos.', join(dir, 'gen', `shot${i + 1}.png`)); img = `gen/shot${i + 1}.png`; assetNames.push(`gen/shot${i + 1}.png`) }
      catch (e) { say(`img ${i + 1} failed: ${e.message}`) }
    }
    beats.push({
      dur: Math.round(dur * 100) / 100, vo: be.vo ? voId : undefined, kind: be.kind,
      img, kicker: be.kicker, pre: be.pre, hot: be.hot, post: be.post, sub: be.sub,
      stats: be.stats, items: be.items, chat: be.chat, split: be.split, cta: be.cta,
    })
  }

  // 6) MUSIC — a REAL track from ElevenLabs Music, prompted for THIS brand and
  // generated at the video's EXACT length (the project's approach — every video
  // gets its own custom score). Video length is known now (intro + sum of beat
  // durs + tail). MusicBed loops it as a safety net if it comes back a touch
  // short. If the API fails, `deps.stageMusic` writes a short SILENT track (the
  // ffmpeg last-resort) so the render never dies — we retry rather than ship a
  // generic bed on a paid commercial.
  const videoSec = (90 + beats.reduce((t, b) => t + b.dur * FPS, 0) + 6) / FPS
  const musicOut = join(dir, 'music.mp3')
  const musicPrompt = spec.musicPrompt || 'Modern cinematic commercial track, confident and premium, clear kick drum pulse, driving bass, builds energy toward the end.'
  let musicOk = false
  try {
    say('Composing the soundtrack...')
    await elevenMusic(musicPrompt, videoSec * 1000, musicOut)   // +0ms extra; MusicBed loop covers any rounding
    assetNames.push('music.mp3'); musicOk = true
  } catch (e) {
    say(`ElevenLabs Music failed (${e.message}) — using a silent track (retry recommended)`)
    if (deps.stageMusic) { try { await deps.stageMusic('silent', musicOut); assetNames.push('music.mp3'); musicOk = true } catch (e2) { say(`silent fallback failed: ${e2.message}`) } }
  }
  const musicFrames = musicOk ? (Math.round((await ffprobeDur(musicOut)) * FPS) || 900) : 900

  // 7) PROPS (commercialSchema)
  const props = {
    styleId, brand,
    wordmark: spec.wordmark || { pre: brandName || 'Brand', post: '' },
    logoLetter: spec.logoLetter || ((spec.wordmark && spec.wordmark.pre) || brandName || 'B')[0].toUpperCase(),
    assetDir,
    music: { file: 'music.mp3', frames: musicFrames },
    introFrames: 90, duck: { loud: 0.2, duck: 0.08 }, bug: true,
    beats,
  }
  for (const b of props.beats) if (b.kind === 'cta' && b.cta && !b.cta.url && domain) b.cta.url = domain

  const propsPath = join(pub, `commercial-${videoId || assetDir}-props.json`)
  await writeFile(propsPath, JSON.stringify(props))
  return { props, propsPath, assetDir, assetNames, styleId, totalSec: videoSec }
}

module.exports = { generateCommercial }
