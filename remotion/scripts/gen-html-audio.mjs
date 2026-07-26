// Audio for the Apex comp HTML explainer: one Rachel VO clip per scene + a music
// bed. Writes public/htmlaudio/vo-N.mp3 + music.mp3. A second step base64-embeds
// them into the .html.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'htmlaudio'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1'
const env = {}; for (const f of ['.env.local', '.env']) { for (const base of [ROOT, join(HERE, '..')]) { const p = join(base, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const log = (...a) => console.log('[htmlaudio]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

// one line per SCENE (matches the 8 scenes in apex-comp-explainer.html)
const LINES = [
  "Welcome to the Apex Technology compensation plan — a simple, honest walkthrough of how you get paid.",
  "First, one key term. For every product, Apex designates a Business Volume — and that B.V. is the amount your commission is based on.",
  "You get paid two ways. A commission on the B.V. of what you personally sell, plus override income as the team you build makes sales too.",
  "Your earning power grows with your rank. There are nine ranks, from Starter all the way to Elite.",
  "And the higher you climb, the deeper you earn. Level one always pays thirty percent, and at Ruby and above, you earn on the entire pool.",
  "Every rank you reach also pays a one-time bonus — more than ninety-three thousand dollars along the way.",
  "To earn overrides, one simple rule: produce at least fifty personal volume each month. Sell a little, and stay qualified.",
  "That's the plan. Sell the tools, build your team, and climb. Welcome to Apex.",
]

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.13 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function genVO() { const durs = []; for (let i = 0; i < LINES.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { b = await openaiTTS(LINES[i]) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) } writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs }, null, 2)); log(`VO total ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`); return durs }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Confident, warm, professional corporate underscore for an explainer, steady and motivating, sits gently under narration, instrumental.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL ' + r.status); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }

const d = await genVO(); const total = d.reduce((a, b) => a + b, 0)
await genMusic(total + LINES.length * 0.4 + 6)
log('HTML AUDIO DONE')
