// POSTER HYPE — Apex recruiting hype in HOPE-poster / political-pop-art style.
// Teal/red/cream/navy, bold posterized flat portraits + halftone. ~60s.
// Writes public/posterhype/. Rachel VO + upbeat music + a grid of stylized faces.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'posterhype'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY
const env = {}; for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = env.CLOUDFLARE_API_KEY, CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const log = (...a) => console.log('[poster]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
try { copyFileSync(join(HERE, '..', 'public', 'apex', 'logo.png'), join(OUT, 'logo.png')) } catch {}

// ~60s hype VO. Short punchy lines.
const LINES = [
  "This isn't just a company. It's a movement.",
  "Everyday people, from every walk of life, building something bigger together.",
  "Two ways to earn. One mission — to help businesses grow, and change your own life doing it.",
  "You bring the drive. Apex brings the tools, the training, and the team.",
  "No ceilings. No limits. Just a path, and people who want to see you win.",
  "The question isn't whether it works. It's whether you're ready.",
  "Join the movement. This is Apex.",
]

// HOPE-poster / Shepard-Fairey pop-art face tiles. Generic stylized faces only.
const POSTER = "Bold political HOPE poster pop-art portrait, Shepard Fairey style, heavily posterized flat shading with hard color blocks, limited palette of teal, crimson red, cream beige and dark navy, high contrast, halftone texture, screenprint look, confident forward-facing head-and-shoulders portrait, propaganda poster aesthetic. Clean solid background split into red and teal blocks. NO text, NO words, NO letters anywhere.";
const FACES = [
  "a confident young woman with short hair, slight smile",
  "a bearded man in a collared shirt looking forward",
  "an older man with glasses, warm expression",
  "a young man with a fade haircut, determined look",
  "a woman with long hair and hoop earrings, smiling",
  "a bald man with a goatee, strong jaw",
  "a middle-aged woman, professional, kind eyes",
  "a young man with curly hair and a light beard",
  "a man in a suit and tie, serious and proud",
  "a woman with glasses and a bob haircut",
  "a broad-shouldered man, confident half-smile",
  "a young woman entrepreneur, hair in a bun",
  "a man with a mustache and rolled sleeves",
  "a smiling woman with freckles and wavy hair",
  "a distinguished older gentleman, silver hair",
]

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function flux(prompt, outPath, w = 768, h = 768) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6, width: w, height: h }) }); if (!r.ok) throw new Error(`${r.status}`); const j = await r.json(); if (!j?.result?.image) throw new Error('no image'); writeFileSync(outPath, Buffer.from(j.result.image, 'base64')) }

async function genVO() { const durs = []; for (let i = 0; i < LINES.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { b = await openaiTTS(LINES[i]) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) } writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES }, null, 2)); log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`); return durs }
async function genFaces() { for (let i = 0; i < FACES.length; i++) { const f = join(OUT, `face-${i}.png`); if (!FORCE && existsSync(f)) { log(`face-${i} cached`); continue } const prompt = `${POSTER} The subject is ${FACES[i]}.`; for (let a = 0; a < 3; a++) { try { await flux(prompt, f); log(`face-${i} ok`); break } catch (e) { if (a < 2) await new Promise((s) => setTimeout(s, 2000)) } } } }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Energetic, anthemic, driving hype music for a recruiting brand promo, powerful beat, rising and inspiring, cinematic build, instrumental.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL ' + r.status); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }

let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 55 } }
const timeline = total + LINES.length * 0.4 + 6
if (ONLY !== 'vo' && ONLY !== 'music') await genFaces()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('POSTER ASSETS DONE ~' + timeline.toFixed(0) + 's')
