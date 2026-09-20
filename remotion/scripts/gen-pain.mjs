// Generate assets for ONE funnel-pain film: VO (6), scenes (6), music, logo.
//
//   PAIN=inbox node scripts/gen-pain.mjs          (ONLY=vo|img|music, FORCE=1)
//   PAIN=all   node scripts/gen-pain.mjs          (every pain, in sequence)
//
// Writes into public/vert-pain-<id>/ — deliberately under the `vert-` prefix so
// CommercialVertical renders these with ZERO changes: pass vert="pain-inbox".
// The composition is already data-driven (it maps over data.json's vo array),
// so a 6-beat film and a 10-beat film are the same component.
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PAINS, ONE } from './pains-config.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const FORCE = process.env.FORCE === '1'
const ONLY = process.env.ONLY

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

async function build(id) {
  const P = PAINS[id]
  const OUT = join(HERE, '..', 'public', `vert-pain-${id}`)
  mkdirSync(OUT, { recursive: true })
  const log = (...a) => console.log(`[${id}]`, ...a)

  if (P.lines.length !== P.scenes.length || P.lines.length !== P.captions.length) {
    throw new Error(`${id}: lines/scenes/captions must be the same length (${P.lines.length}/${P.scenes.length}/${P.captions.length})`)
  }

  async function genVO() {
    const durs = []
    for (let i = 0; i < P.lines.length; i++) {
      const f = join(OUT, `vo-${i}.mp3`)
      if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue }
      let buf
      try { buf = ELEVEN ? await eleven(P.lines[i]) : await openaiTTS(P.lines[i]) }
      catch { log(`vo-${i} eleven fail → openai`); buf = await openaiTTS(P.lines[i]) }
      writeFileSync(f, buf); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`)
    }
    writeFileSync(join(OUT, 'data.json'), JSON.stringify({ vo: durs, label: P.label, tagIntro: P.tagIntro, captions: P.captions }, null, 2))
    const total = durs.reduce((a, b) => a + b, 0); log(`VO ${total.toFixed(1)}s`); return durs
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
    const idx = P.scenes.map((_, i) => i)
    // ONE is appended here rather than baked into all 60 scene strings — it's a
    // guard against the model's grid habit, not art direction.
    while (idx.length) { const b = idx.splice(0, 2); await Promise.all(b.map((i) => genImg(i, `${P.scenes[i]} ${ONE}`))) }
  }

  // Music + logo come from the master film — identical vibe, and it keeps the
  // ten pain films sonically identical to the nine industry films.
  function copyShared() {
    for (const [name, dest] of [['music.mp3', 'music.mp3'], ['logo.png', 'logo.png']]) {
      const src = join(HERE, '..', 'public', 'jordyn-long', name)
      if (existsSync(src) && (FORCE || !existsSync(join(OUT, dest)))) copyFileSync(src, join(OUT, dest))
    }
    if (!existsSync(join(OUT, 'music.mp3'))) log('WARNING: no music.mp3 — render will fail')
    if (!existsSync(join(OUT, 'logo.png'))) log('WARNING: no logo.png — render will fail')
  }

  let total = 0
  if (ONLY !== 'img' && ONLY !== 'music') { total = (await genVO()).reduce((a, b) => a + b, 0) }
  else { try { total = JSON.parse(readFileSync(join(OUT, 'data.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 48 } }
  if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
  if (ONLY !== 'vo' && ONLY !== 'img') copyShared()
  const timeline = total + P.lines.length * 0.75 + 8 - (P.lines.length - 1) * 0.4
  log(`DONE — timeline ~${timeline.toFixed(0)}s`)
}

const want = process.env.PAIN
if (!want || (want !== 'all' && !PAINS[want])) {
  console.error('Set PAIN=all or one of:', Object.keys(PAINS).join(', '))
  process.exit(1)
}
for (const id of want === 'all' ? Object.keys(PAINS) : [want]) await build(id)
