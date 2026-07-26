// Generate assets for ONE vertical video: VO (10), scenes (10), music.
// Usage: VERT=insurance node scripts/gen-vertical.mjs   (ONLY=vo|img|music, FORCE=1)
// Writes into public/vert-<id>/ and a captions json for the composition.
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { VERTICALS } from './verticals-config.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const VERT = process.env.VERT
const FORCE = process.env.FORCE === '1'
const ONLY = process.env.ONLY
if (!VERT || !VERTICALS[VERT]) { console.error('Set VERT= one of:', Object.keys(VERTICALS).join(', ')); process.exit(1) }
const V = VERTICALS[VERT]
const OUT = join(HERE, '..', 'public', `vert-${VERT}`)
mkdirSync(OUT, { recursive: true })

const env = {}
for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const GEMINI = env.GEMINI_API_KEY, IMG_MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const log = (...a) => console.log(`[${VERT}]`, ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}: ${(await r.text()).slice(0, 120)}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }

async function genVO() {
  const durs = []
  for (let i = 0; i < V.lines.length; i++) {
    const f = join(OUT, `vo-${i}.mp3`)
    if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue }
    let buf; try { buf = ELEVEN ? await eleven(V.lines[i]) : await openaiTTS(V.lines[i]) } catch (e) { log(`vo-${i} eleven fail → openai`); buf = await openaiTTS(V.lines[i]) }
    writeFileSync(f, buf); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`)
  }
  // write captions+durations bundle for the composition
  writeFileSync(join(OUT, 'data.json'), JSON.stringify({ vo: durs, label: V.label, tagIntro: V.tagIntro, captions: V.captions }, null, 2))
  const total = durs.reduce((a, b) => a + b, 0); log(`VO ${total.toFixed(1)}s`); return durs
}
async function genImg(i, prompt) {
  const f = join(OUT, `f-${i}.png`); if (!FORCE && existsSync(f)) { log(`f-${i} cached`); return }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent?key=${GEMINI}`
  for (let a = 0; a < 3; a++) { try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }) }); if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 110)}`); const j = await r.json(); const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data); if (!img) throw new Error('no image'); writeFileSync(f, Buffer.from(img.inlineData.data, 'base64')); log(`f-${i} ok`); return } catch (e) { log(`f-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2500)); else log(`f-${i} GIVE UP`) } }
}
async function genImgs() { const idx = V.scenes.map((_, i) => i); while (idx.length) { const b = idx.splice(0, 2); await Promise.all(b.map((i) => genImg(i, V.scenes[i]))) } }
async function genMusic(sec) {
  const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return }
  // reuse the master film's music if present (identical vibe, saves a call)
  const shared = join(HERE, '..', 'public', 'jordyn-long', 'music.mp3')
  if (existsSync(shared)) { copyFileSync(shared, f); log('music reused from master'); return }
  const ms = Math.min(300000, Math.round((sec + 4) * 1000))
  const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Warm, uplifting, modern corporate background music. Gentle acoustic guitar and soft piano, steady optimistic pulse, builds to a confident resolve, instrumental, unobtrusive.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL', r.status); return }; writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok')
}
// logo
try { copyFileSync(join(HERE, '..', 'public', 'jordyn-long', 'logo.png'), join(OUT, 'logo.png')) } catch {}

let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'data.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 80 } }
const timeline = total + V.lines.length * 0.75 + 8
if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('DONE — timeline ~' + timeline.toFixed(0) + 's')
