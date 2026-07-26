// FULL PRODUCTION asset generator for the docs2video "Pulse" 30s ad.
//   - 6 cinematic Gemini backdrops (16:9 2K, dark teal, NO text/logos)
//   - Rachel (ElevenLabs) VO per beat + durations.json
//   - Lyria 2 music bed (synth fallback if Lyria unavailable), full-length
// Writes into remotion/public/d2v-pulse/. Idempotent-ish: skips existing files
// unless FORCE=1.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'd2v-pulse')
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

/* ---------------- SCRIPT (8 spoken beats, ~30s) ------------------ */
// Grounded in real features. Beat i pairs with scene i in the composition.
const LINES = [
  "Your best ideas are stuck in documents nobody opens.",           // 0 hook
  "Meet docs2video.",                                                // 1 brand
  "Drop in a link, a file, or a few notes.",                         // 2 how-1
  "AI writes the script, matches your brand, and narrates it — in a real voice.", // 3 how-2
  "Tuned for twelve industries. File to finished film in about four minutes.",    // 4 proof
  "Share it on a page that tracks every view — or export the video, deck, or PDF.",// 5 features
  "There's even an API, so your whole workflow can make videos on autopilot.",     // 6 api
  "docs2video dot com. Start free — two videos, on us.",             // 7 cta
]

/* ---------------- BACKDROP PROMPTS (cohesive look) --------------- */
const STYLE = "Cinematic abstract 3D render, dark navy-to-black background with deep teal (#12c2b4) and soft cyan volumetric light, subtle depth of field, premium software-brand aesthetic, glossy glass and light ribbons, high detail, 16:9, ABSOLUTELY NO text, NO words, NO letters, NO logos, NO UI, NO charts."
const BACKDROPS = [
  `${STYLE} Mood: quiet tension — scattered translucent paper-like sheets drifting in dark space, dim and unread, cool shadows.`,
  `${STYLE} Mood: arrival — a single radiant teal light bloom emerging from darkness at center, elegant and confident.`,
  `${STYLE} Mood: input — a glowing conduit / pipeline of light flowing left to right through dark space, particles streaming in.`,
  `${STYLE} Mood: intelligence — soft neural filaments and flowing ribbons of teal light weaving through darkness, sense of writing/creation.`,
  `${STYLE} Mood: proof — clean luminous grid horizon receding into dark space, teal accents, sense of scale and speed.`,
  `${STYLE} Mood: reach — abstract concentric rings / broadcast ripples of teal light expanding across a dark plane.`,
  `${STYLE} Mood: automation — sleek interlocking light-rings and orbital motion in dark space, precise and futuristic.`,
  `${STYLE} Mood: finale — deep black space with a warm-cool teal glow rising from the lower center, cinematic and premium, room at center.`,
]

/* ---------------- 1) VO ------------------------------------------ */
async function eleven(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2 } }),
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
    log(`vo-${i} ${d.toFixed(2)}s  "${LINES[i].slice(0, 40)}"`)
  }
  writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durations, lines: LINES }, null, 2))
  return durations
}

/* ---------------- 2) BACKDROPS (Gemini REST) --------------------- */
async function genBackdrop(i, prompt) {
  const f = join(OUT, `bg-${i}.png`)
  if (!FORCE && existsSync(f)) { log(`bg-${i} cached`); return }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent?key=${GEMINI}`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
        }),
      })
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 140)}`)
      const j = await r.json()
      const parts = j.candidates?.[0]?.content?.parts || []
      const img = parts.find((p) => p.inlineData?.data)
      if (!img) throw new Error('no image in response')
      writeFileSync(f, Buffer.from(img.inlineData.data, 'base64'))
      log(`bg-${i} ok`); return
    } catch (e) {
      log(`bg-${i} attempt ${attempt + 1} failed: ${e.message}`)
      if (attempt === 2) log(`bg-${i} GIVING UP (scene falls back to pure CSS backdrop)`)
      else await new Promise((res) => setTimeout(res, 2500))
    }
  }
}
async function genBackdrops() {
  // limited concurrency (2 at a time)
  const idx = BACKDROPS.map((_, i) => i)
  while (idx.length) {
    const batch = idx.splice(0, 2)
    await Promise.all(batch.map((i) => genBackdrop(i, BACKDROPS[i])))
  }
}

/* ---------------- 3) MUSIC (Lyria → synth fallback) -------------- */
async function lyria(prompt, seconds) {
  // Lyria 2 via generateContent (audio). Intermittent — caller falls back.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/lyria-2:generateContent?key=${GEMINI}`
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO'] } }),
  })
  if (!r.ok) throw new Error(`lyria ${r.status}: ${(await r.text()).slice(0, 140)}`)
  const j = await r.json()
  const parts = j.candidates?.[0]?.content?.parts || []
  const au = parts.find((p) => p.inlineData?.mimeType?.startsWith('audio/'))
  if (!au) throw new Error('no audio in lyria response')
  return Buffer.from(au.inlineData.data, 'base64')
}
function synthBed(seconds) {
  const music = join(OUT, 'music.mp3')
  execFileSync('ffmpeg', ['-y',
    '-f', 'lavfi', '-i', `sine=frequency=110:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=164.81:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=220:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=329.63:duration=${seconds}`,
    '-filter_complex',
    `[0:a]volume=0.5[a];[1:a]volume=0.3[b];[2:a]volume=0.2[c];[3:a]volume=0.12[d];` +
    `[a][b][c][d]amix=inputs=4:normalize=0[m];` +
    `[m]tremolo=f=1.6:d=0.22,highpass=f=85,lowpass=f=1400,` +
    `afade=t=in:st=0:d=1.5,afade=t=out:st=${seconds - 2.5}:d=2.5,volume=0.55[out]`,
    '-map', '[out]', '-ac', '2', '-ar', '44100', music,
  ], { stdio: 'ignore' })
  return music
}
async function genMusic(totalSec) {
  const f = join(OUT, 'music.mp3')
  const len = Math.ceil(totalSec + 3)
  if (!FORCE && existsSync(f)) { log('music cached'); return }
  try {
    const buf = await lyria('Upbeat, modern, uplifting corporate technology background music, clean electronic, motivational, driving but not distracting, instrumental.', len)
    // Lyria returns wav/pcm; transcode + loop/pad to len via ffmpeg
    const raw = join(OUT, '_lyria_raw'); writeFileSync(raw, buf)
    execFileSync('ffmpeg', ['-y', '-i', raw, '-af', `afade=t=in:st=0:d=1.2,afade=t=out:st=${len - 2}:d=2`, '-t', String(len), '-ac', '2', '-ar', '44100', f], { stdio: 'ignore' })
    log('music via Lyria ok')
  } catch (e) {
    log(`Lyria failed (${e.message}) → synth bed`)
    synthBed(len); log('music via synth bed')
  }
}

/* ---------------- run -------------------------------------------- */
const vo = await genVO()
const total = vo.reduce((a, b) => a + b, 0) + vo.length * 0.6 + 1
log(`total timeline ~${total.toFixed(1)}s`)
await genBackdrops()
await genMusic(total)
log('PRODUCTION ASSETS DONE')
