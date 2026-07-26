// FULL PRODUCTION asset generator for the JORDYN ("AI assistant with a brain")
// 30s commercial. Warm cream/peach/sage palette (from jordyn.app).
//   - 8 Gemini visuals: warm cinematic backdrops + CONCEPTUAL UI mockups
//     (morning briefing, pipeline board, chat/voice, phone) — faux UI, no real
//     screenshots, warm brand.
//   - Rachel (ElevenLabs) VO per beat + durations.json
//   - warm synth music bed, full-length
// Writes into remotion/public/jordyn/.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'jordyn')
mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1'

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

/* ---------------- SCRIPT (8 beats, ~30s) — grounded in jordyn.app ---------- */
const LINES = [
  "Every other AI agent starts the same way — a blank box, waiting on you.",          // 0 blank box
  "You prompt it. You train it. You babysit it. You do the work.",                    // 1 you operate
  "Jordyn is different.",                                                              // 2 the turn
  "Tell it your industry, and Jordyn arrives already fluent — the words, the paperwork, the deadlines.", // 3 fluent
  "Then it reads your inbox and learns your clients, your deals, your voice.",         // 4 learns you
  "No prompting. It just works — morning briefings, a pipeline that builds itself, replies in your voice.", // 5 it works
  "It even answers your phone, and makes your calls.",                                // 6 phone
  "Jordyn. Not a tool you operate — an assistant that works. Start free at jordyn dot app.", // 7 cta
]

/* ---------------- VISUAL PROMPTS (warm brand, conceptual UI) --------------- */
// Warm palette: cream #faf9f5, peach #e8b4a0, gold #e5d9a8, sage #b6c4a2.
const WARM = "Warm, calm, premium aesthetic. Soft cream and warm off-white background (#faf9f5), gentle peach (#e8b4a0), soft gold (#e5d9a8) and sage green (#b6c4a2) accents. Soft diffused morning light, subtle depth of field, cozy but sophisticated, editorial. 16:9."
const NOTEXT = "ABSOLUTELY NO readable text, NO paragraphs of words, NO logos, NO brand names — abstract shapes and UI silhouettes only, blurred placeholder lines where text would be."
const UI = `${WARM} A clean, modern, minimal SaaS app interface concept, rounded cards, soft shadows, generous whitespace, friendly not techy. ${NOTEXT}`
const ABS = `${WARM} Cinematic abstract composition, soft flowing light ribbons and warm bokeh, organic and human, sense of calm intelligence. ${NOTEXT}`

const VISUALS = [
  `${ABS} Mood: overwhelm before relief — a soft chaotic swirl of many faint translucent envelope/paper shapes drifting, warm but cluttered, early morning.`,
  `${ABS} Mood: the turn — a single calm warm glowing orb of soft light emerging from the clutter, reassuring, human warmth.`,
  `${UI} Concept: an assistant 'brain' assembling — a glowing warm neural sphere forming from soft connecting nodes and cards, sense of instant setup, on a cream interface.`,
  `${ABS} Mood: fluency — warm flowing ribbons of light like language and knowledge weaving together, organic, confident, sage and peach tones.`,
  `${UI} Concept: a 'morning briefing' dashboard card — a tidy vertical list of summary cards with soft peach status dots and rounded avatars, calm and organized, cream background, blurred placeholder text lines.`,
  `${UI} Concept: a self-building pipeline / kanban board of soft rounded cards flowing into columns, a small compose/reply panel beside it, warm sage and gold accents, cream UI, blurred placeholder text.`,
  `${UI} Concept: an incoming phone call on a soft rounded interface — a warm glowing call button and gentle sound waves, an assistant answering, cozy cream and peach, minimal, no text.`,
  `${ABS} Mood: finale — a serene warm cream space with a soft golden glow rising from lower center, calm and premium, generous open room at center, morning-light optimism.`,
]

/* ---------------- 1) VO ------------------------------------------ */
async function eleven(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15 } }),
  })
  if (!r.ok) throw new Error(`eleven ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return Buffer.from(await r.arrayBuffer())
}
async function openaiTTS(text) {
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: text }),
  })
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return Buffer.from(await r.arrayBuffer())
}
async function genVO() {
  const durations = []
  for (let i = 0; i < LINES.length; i++) {
    const f = join(OUT, `vo-${i}.mp3`)
    if (!FORCE && existsSync(f)) { durations.push(durOf(f)); log(`vo-${i} cached ${durations[i].toFixed(2)}s`); continue }
    let buf
    try { buf = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) }
    catch (e) { log(`vo-${i} eleven fail (${e.message}) → openai`); buf = await openaiTTS(LINES[i]) }
    writeFileSync(f, buf); const d = durOf(f); durations.push(d)
    log(`vo-${i} ${d.toFixed(2)}s  "${LINES[i].slice(0, 42)}"`)
  }
  writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durations, lines: LINES }, null, 2))
  return durations
}

/* ---------------- 2) VISUALS (Gemini REST) ---------------------- */
async function genBg(i, prompt) {
  const f = join(OUT, `bg-${i}.png`)
  if (!FORCE && existsSync(f)) { log(`bg-${i} cached`); return }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent?key=${GEMINI}`
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }),
      })
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 130)}`)
      const j = await r.json()
      const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
      if (!img) throw new Error('no image')
      writeFileSync(f, Buffer.from(img.inlineData.data, 'base64')); log(`bg-${i} ok`); return
    } catch (e) { log(`bg-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2500)); else log(`bg-${i} GIVE UP → CSS fallback`) }
  }
}
async function genVisuals() {
  const idx = VISUALS.map((_, i) => i)
  while (idx.length) { const b = idx.splice(0, 2); await Promise.all(b.map((i) => genBg(i, VISUALS[i]))) }
}

/* ---------------- 3) MUSIC (warm synth bed) --------------------- */
function synthBed(seconds) {
  const music = join(OUT, 'music.mp3')
  // warm major chord (C-E-G-C) with gentle tremolo + soft filtering, calm/optimistic
  execFileSync('ffmpeg', ['-y',
    '-f', 'lavfi', '-i', `sine=frequency=130.81:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=196:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=261.63:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=329.63:duration=${seconds}`,
    '-filter_complex',
    `[0:a]volume=0.45[a];[1:a]volume=0.3[b];[2:a]volume=0.22[c];[3:a]volume=0.14[d];` +
    `[a][b][c][d]amix=inputs=4:normalize=0[m];` +
    `[m]tremolo=f=1.4:d=0.18,highpass=f=95,lowpass=f=1300,` +
    `afade=t=in:st=0:d=2,afade=t=out:st=${seconds - 2.5}:d=2.5,volume=0.5[out]`,
    '-map', '[out]', '-ac', '2', '-ar', '44100', music,
  ], { stdio: 'ignore' })
}
async function genMusic(total) {
  const f = join(OUT, 'music.mp3'); const len = Math.ceil(total + 3)
  if (!FORCE && existsSync(f)) { log('music cached'); return }
  synthBed(len); log(`music synth bed ${len}s`)
}

/* ---------------- run -------------------------------------------- */
const vo = await genVO()
const total = vo.reduce((a, b) => a + b, 0) + vo.length * 0.7 + 1
log(`total timeline ~${total.toFixed(1)}s`)
await genVisuals()
await genMusic(total)
log('JORDYN ASSETS DONE')
