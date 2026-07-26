// JORDYN ~3-MINUTE ad — full production asset generator.
//  - 16 Rachel (ElevenLabs) VO beats (grounded in the real product) + durations
//  - 16 Gemini flat-editorial scenes (matches jordyn.app illustration system)
//  - ~3min ElevenLabs music bed
// Writes into public/jordyn-long/.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'jordyn-long')
mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1'
const ONLY = process.env.ONLY // 'vo' | 'img' | 'music'

const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f)
  if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const ELEVEN = env.ELEVENLABS_API_KEY
const VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
const OPENAI = env.OPENAI_API_KEY
const GEMINI = env.GEMINI_API_KEY
const IMG_MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const log = (...a) => console.log(...a)
const durOf = (file) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())

/* ================= SCRIPT — 16 beats, grounded in the source ============== */
const LINES = [
  // ACT 1 — problem + difference
  "It's 9am, and you're already behind — sixty emails deep, before the real work even starts.", // 0
  "So you try an AI. But ChatGPT and the others assume you're an AI expert. A blank box, waiting on you to prompt it, train it, babysit it.", // 1
  "Jordyn is different. It's the AI assistant with a brain for your business.", // 2
  // ACT 2 — how it works
  "Just tell Jordyn your industry. Insurance, real estate, law, HVAC — its brain installs in seconds.", // 3
  "It arrives already fluent — the vocabulary, the paperwork, the deadlines of your world.", // 4
  "Connect your inbox — Gmail, Outlook, or Fastmail. Nothing's stored, and you can revoke it anytime.", // 5
  "Then Jordyn learns you — your clients, your deals, and the way you actually write.", // 6
  // ACT 3 — what it does
  "Every morning, one briefing. Your whole inbox, swept overnight — only what actually needs you, each with a next step.", // 7
  "Your pipeline builds itself. Every deal, decision, and deadline recorded from your email, automatically.", // 8
  "Replies, letters, and PDFs — drafted in your voice, on your letterhead. And nothing sends without your okay.", // 9
  "Set it up in plain English. 'Whenever an email about the Chen file arrives, update it and flag me.' Say it once, it runs forever.", // 10
  "It even answers your phone. A real local number, answering in your name. Or just say, 'call Maria about Tuesday' — and Jordyn dials.", // 11
  "And it connects to the tools you already use — Gmail, Calendar, Drive, Slack, HubSpot, Stripe, DocuSign — over five hundred apps.", // 12
  // ACT 4 — ROI + close
  "Add it up: the triage, the follow-ups, the pipeline you keep in your head — that's hours back, every single week.", // 13
  "At a hundred and forty-nine a month, one closed deal covers years of it. And deals stop dying in your inbox.", // 14
  "Jordyn. Not a tool you operate — an assistant that works. Start free at jordyn dot app.", // 15
]

/* ================= FLAT-EDITORIAL SCENE PROMPTS =========================== */
const STYLE = "Flat modern editorial vector illustration, soft warm muted style. Palette: warm cream #faf9f5 background, terracotta rust #c4623f, warm tan #d8a07a, sage green #b6c4a2, soft gold #e5d9a8, muted charcoal #4a3f35. Gentle soft shadows, simple rounded organic shapes, subtle film grain, calm premium, generous negative space, high-end SaaS brand illustration. Soft ambient light. 16:9. NO text, NO letters, NO logos, NO words."
const CHAR = "A friendly professional character in this flat editorial style, terracotta blazer, warm approachable, consistent across scenes."

const SCENES = [
  `${STYLE} ${CHAR} Scene: at a desk early morning, slightly overwhelmed, many soft flat envelope shapes and notification dots floating around a large stylized inbox, window light.`, // 0
  `${STYLE} ${CHAR} Scene: facing a large empty rounded chat/prompt panel with a small blinking cursor, looking uncertain, a subtle question mark motif, minimal.`, // 1
  `${STYLE} Scene: a warm glowing terracotta 'brain' orb of soft light radiating gentle rays, floating in calm cream space with soft sage leaf shapes, an assistant arriving, hero icon, no character.`, // 2
  `${STYLE} ${CHAR} Scene: happily selecting from a few floating rounded industry icon cards (a little house, a shield, a wrench, a gavel), the brain orb assembling beside them.`, // 3
  `${STYLE} ${CHAR} Scene: presenting neat organized flat folders, a calendar, and document cards floating in a tidy arc, everything labeled with blank tags, pleased and confident.`, // 4
  `${STYLE} Scene: a friendly flat illustration of an email inbox icon connecting via a soft glowing link to a secure shield/lock symbol, cream background, sage and rust accents, trust and security, no character.`, // 5
  `${STYLE} ${CHAR} Scene: calmly watching soft flat envelope shapes flow into a tidy inbox tray and turn into organized contact cards, the assistant sorting, serene.`, // 6
  `${STYLE} Scene: a clean 'morning briefing' concept — a tidy vertical stack of rounded summary cards with soft peach status dots and small avatars, a coffee cup beside it, morning light, calm and organized, no character, blurred placeholder lines for text.`, // 7
  `${STYLE} Scene: a self-building pipeline / kanban concept — soft rounded deal cards flowing into tidy columns left to right, sage and gold accents, an upward sense of progress, cream UI, no character, no readable text.`, // 8
  `${STYLE} ${CHAR} Scene: reviewing a nicely formatted flat letter/PDF document on letterhead that the assistant drafted, a small approval checkmark, pen in hand, pleased.`, // 9
  `${STYLE} Scene: a plain-English automation concept — a soft rounded rule card with a little lightning/gear icon, an arrow looping to show it repeating automatically, warm accents, cream, no character, no readable text.`, // 10
  `${STYLE} ${CHAR} Scene: relaxed while a friendly flat phone with soft sound-wave arcs is answered by a glowing assistant presence, effortless, warm — the phone feature.`, // 11
  `${STYLE} Scene: a friendly flat grid/constellation of soft rounded app-integration icon tiles (mail, calendar, cloud, chat, card, document) connected by gentle lines to a central Jordyn orb, cream, warm accents, no character, no readable text.`, // 12
  `${STYLE} Scene: a calm 'time saved' concept — a soft flat clock or hourglass with gentle sparkles and a few floating checkmarks, warm optimistic, cream, sense of hours reclaimed, no character, no readable text.`, // 13
  `${STYLE} ${CHAR} Scene: shaking hands / closing a deal, happy and confident, a soft flat handshake and a small rising chart or a house-sold / policy-issued shape, warm success, generous space.`, // 14
  `${STYLE} ${CHAR} Scene: the confident professional stands calmly holding a tablet, soft sage leaf shapes in a rounded frame behind them, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`, // 15
]

/* ---- VO ---- */
async function eleven(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15 } }),
  })
  if (!r.ok) throw new Error(`eleven ${r.status}: ${(await r.text()).slice(0, 140)}`)
  return Buffer.from(await r.arrayBuffer())
}
async function openaiTTS(text) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: text }) })
  if (!r.ok) throw new Error(`openai ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}
async function genVO() {
  const durs = []
  for (let i = 0; i < LINES.length; i++) {
    const f = join(OUT, `vo-${i}.mp3`)
    if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached ${durs[i].toFixed(2)}s`); continue }
    let buf; try { buf = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { log(`vo-${i} eleven fail ${e.message} → openai`); buf = await openaiTTS(LINES[i]) }
    writeFileSync(f, buf); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`)
  }
  writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES }, null, 2))
  const total = durs.reduce((a, b) => a + b, 0); log(`VO TOTAL ${total.toFixed(1)}s (~${(total / 60).toFixed(1)}min)`); return durs
}

/* ---- images ---- */
async function genImg(i, prompt) {
  const f = join(OUT, `f-${i}.png`)
  if (!FORCE && existsSync(f)) { log(`f-${i} cached`); return }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent?key=${GEMINI}`
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }) })
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 120)}`)
      const j = await r.json(); const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
      if (!img) throw new Error('no image'); writeFileSync(f, Buffer.from(img.inlineData.data, 'base64')); log(`f-${i} ok`); return
    } catch (e) { log(`f-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2500)); else log(`f-${i} GIVE UP`) }
  }
}
async function genImgs() {
  const idx = SCENES.map((_, i) => i)
  while (idx.length) { const b = idx.splice(0, 2); await Promise.all(b.map((i) => genImg(i, SCENES[i]))) }
}

/* ---- music ---- */
async function genMusic(sec) {
  const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return }
  const ms = Math.min(300000, Math.round((sec + 4) * 1000))
  const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Warm, uplifting, modern corporate background music for a product film. Gentle acoustic guitar and soft piano, steady optimistic pulse, light percussion, gradually building through several sections to a confident hopeful resolve. Human, reassuring, professional, instrumental, unobtrusive.', music_length_ms: ms }) })
  if (r.status !== 200) { log('music FAIL', r.status, (await r.text()).slice(0, 160)); return }
  writeFileSync(f, Buffer.from(await r.arrayBuffer())); log(`music ok ~${(ms / 1000).toFixed(0)}s`)
}

/* ---- run ---- */
let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) }
else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 170 } }
const timeline = total + LINES.length * 0.7
if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('JORDYN LONG ASSETS DONE — timeline ~' + timeline.toFixed(0) + 's')
