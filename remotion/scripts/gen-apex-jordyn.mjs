// Jordyn, in the Apex house style: torn/cut-paper art in the navy-red-white
// palette of reachtheapex.net/jordyn. Everything else matches the ten funnel
// pain films — same CommercialVertical engine, same 6-beat shape, same Rachel
// VO, same caption cards — only the art and the chrome theme change.
//
//   node scripts/gen-apex-jordyn.mjs            (ONLY=vo|img|music, FORCE=1)
//
// Writes public/vert-apex-jordyn/, so it renders with vert="apex-jordyn".
//
// The palette is sampled from the RENDERED page, not its stylesheet. The site
// loads Bootstrap and a legacy `site-preview` theme whose CSS is full of
// #2b4c7e navy and #c2914a gold that never paint — the trap that produced a
// wrong-brand Apex video once before. What actually renders: navy #1e3a72,
// red #cc2027, white, off-white #f5f7fb. The site's own hero already tears a
// paper edge across the bottom, so cut-paper is its idiom, not an imposition.
//
// Copy is drawn from that page: "Any AI can check your email. Jordyn runs it",
// the three What It Does cards, and the approval guarantee. Rep pricing ($129)
// appears on the end card only — it is on the public page, but it belongs in
// text where it can be read, not in narration where it has to be spoken.
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'vert-apex-jordyn')
mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1'
const ONLY = process.env.ONLY
const log = (...a) => console.log('[apex-jordyn]', ...a)

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

const PAPER = "Cut-paper craft collage illustration: handmade layered construction paper, visible torn and cut paper edges, soft realistic drop shadows between the paper layers, subtle paper grain and fibre texture. Strict palette: deep navy blue #1e3a72, bright red #cc2027, clean white, and cool off-white #f5f7fb. Confident, premium, editorial paper-craft advertising style, generous negative space. 16:9. NO text, NO letters, NO logos, NO words."
const ONE = "ONE single continuous scene in one frame — not a grid, not multiple panels, not a character sheet, not a before-and-after split."

const LINES = [
  "Any AI can check your email. Reading it was never the part that ate your day.", // 0
  "Jordyn runs it — and it arrives already speaking insurance.", // 1
  "Every morning, a briefing: your flagged deals, and replies already drafted in your voice.", // 2
  "It answers a real local number in your business name, and every call comes back transcribed and filed.", // 3
  "Your pipeline builds itself out of your inbox. And nothing sends without your approval.", // 4
  "Jordyn. The AI assistant that runs your business.", // 5
]

const SCENES = [
  `${PAPER} A small paper figure standing before a large blank paper panel with a single blinking paper cursor mark on it, arms slightly raised in uncertainty — an empty box waiting to be told what to do. Navy panel, white paper figure, one small red accent. ${ONE}`,
  `${PAPER} A glowing layered paper orb at centre radiating cut-paper rays, with paper envelopes, a paper telephone handset and small paper pipeline cards assembling around it in a calm arc. ABSOLUTELY NO people, NO figures, NO hands — paper objects and shapes only. ${ONE}`,
  `${PAPER} A paper desk at sunrise seen head-on: a single tidy paper briefing card standing upright, a short stack of paper envelopes beside it with two flagged in bright red, and a small paper coffee cup. Calm, ordered, early-morning. ${ONE}`,
  `${PAPER} A layered paper telephone handset at the left with cut-paper sound-wave arcs travelling rightward and turning into a neat paper transcript card that files itself into a paper folder. Navy and red paper, white background. NO people. ${ONE}`,
  `${PAPER} Paper deal cards flowing from a paper envelope on the left into three tidy upright columns that build themselves into a rising staircase, with one large red paper approval stamp mark pressed over the front card. NO people. ${ONE}`,
  `${PAPER} A confident paper figure standing centre-right with a paper telephone, paper envelope and paper pipeline cards arranged in a rounded arc behind them, navy and red layered paper, generous empty white space in the lower centre for a logo. Optimistic finale. ${ONE}`,
]

const CAPTIONS = [
  { head: 'Any AI can check your email.', sub: 'Reading it was never the hard part.' },
  { logoHead: 'runs it.', sub: 'And it arrives already speaking insurance.' },
  { kicker: 'Runs your inbox', head: 'A briefing, every morning.', sub: 'Flagged deals. Replies drafted in your voice.' },
  { kicker: 'Answers & makes calls', head: 'A real number, in your name.', sub: 'Every call transcribed and filed to the client.' },
  { kicker: 'Builds your pipeline', head: 'It builds itself, from your inbox.', sub: 'And nothing sends without your approval.', accent: 'nothing sends without your approval.' },
  { finale: true },
]

const TAG_INTRO = 'The AI assistant that runs your business.'

const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

async function eleven(t) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15 } }),
  })
  if (!r.ok) throw new Error(`eleven ${r.status}: ${(await r.text()).slice(0, 120)}`)
  return Buffer.from(await r.arrayBuffer())
}
async function openaiTTS(t) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }),
  })
  if (!r.ok) throw new Error(`openai ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

async function genVO() {
  const durs = []
  for (let i = 0; i < LINES.length; i++) {
    const f = join(OUT, `vo-${i}.mp3`)
    if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue }
    let buf
    try { buf = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) }
    catch { log(`vo-${i} eleven fail → openai`); buf = await openaiTTS(LINES[i]) }
    writeFileSync(f, buf); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`)
  }
  writeFileSync(join(OUT, 'data.json'), JSON.stringify({ vo: durs, label: 'Jordyn for Apex', tagIntro: TAG_INTRO, captions: CAPTIONS }, null, 2))
  log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`)
  return durs
}

async function genImg(i, prompt) {
  const f = join(OUT, `f-${i}.png`)
  if (!FORCE && existsSync(f)) { log(`f-${i} cached`); return }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent?key=${GEMINI}`
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }),
      })
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 110)}`)
      const j = await r.json()
      const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
      if (!img) throw new Error('no image')
      writeFileSync(f, Buffer.from(img.inlineData.data, 'base64')); log(`f-${i} ok`); return
    } catch (e) {
      log(`f-${i} try${a + 1}: ${e.message}`)
      if (a < 2) await new Promise((s) => setTimeout(s, 2500)); else log(`f-${i} GIVE UP`)
    }
  }
}
async function genImgs() {
  const idx = SCENES.map((_, i) => i)
  while (idx.length) { const b = idx.splice(0, 2); await Promise.all(b.map((i) => genImg(i, SCENES[i]))) }
}

// Jordyn's mark carries the film (it is Jordyn's product); the Apex mark closes
// it, because the CTA and the $129 rep price are Apex's, not Jordyn's.
function copyShared() {
  const pairs = [
    [join(HERE, '..', 'public', 'jordyn-long', 'logo.png'), 'logo.png'],
    [join(HERE, '..', 'public', 'apex', 'logo.png'), 'apex-logo.png'],
    [join(HERE, '..', 'public', 'apex', 'music.mp3'), 'music.mp3'],
  ]
  for (const [src, dest] of pairs) {
    if (existsSync(src) && (FORCE || !existsSync(join(OUT, dest)))) copyFileSync(src, join(OUT, dest))
    if (!existsSync(join(OUT, dest))) log(`WARNING: missing ${dest} — render will fail`)
  }
}

if (ONLY !== 'img' && ONLY !== 'music') await genVO()
if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
if (ONLY !== 'vo' && ONLY !== 'img') copyShared()
log('DONE')
