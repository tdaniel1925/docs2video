// JORDYN REAL — cinematic promo VO + music for the composition that animates the
// ACTUAL jordyn.app screenshots/illustrations (in public/jordyn2/). Images already
// captured via Playwright; this only makes VO + music.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'jordyn2'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY
const env = {}; for (const f of ['.env.local', '.env']) { for (const base of [ROOT, join(HERE, '..')]) { const p = join(base, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const log = (...a) => console.log('[jordyn2]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
try { copyFileSync(join(HERE, '..', 'public', 'glossy', 'logo.png'), join(OUT, 'logo.png')) } catch {}

// Cinematic VO using Jordyn's REAL site copy/voice. ~60s.
const LINES = [
  "Any A.I. can check your email.",                                                    // 0
  "Jordyn runs it.",                                                                    // 1
  "It sweeps your inboxes, reads what matters, and drafts replies in your voice.",      // 2
  "It checks your pipeline and tells you exactly what's still pending.",                // 3
  "It answers your phone, and follows up so nothing slips.",                            // 4
  "And nothing sends without your okay.",                                              // 5
  "Jordyn arrives already knowing your industry — no setup, no prompt engineering.",    // 6
  "It's the assistant with a brain for your business.",                                // 7
  "Start free at jordyn.app.",                                                          // 8
]

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.42, similarity_boost: 0.82, style: 0.28 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function genVO() { const durs = []; for (let i = 0; i < LINES.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { b = await openaiTTS(LINES[i]) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) } writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES }, null, 2)); log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`); return durs }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Warm, premium, modern product-launch underscore, clean and confident with a gentle uplifting groove and light percussion, sophisticated tech brand feel, builds subtly, instrumental.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL ' + r.status); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }

let total = 0
if (ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 45 } }
const timeline = total + LINES.length * 0.4 + 8
if (ONLY !== 'vo') await genMusic(timeline)
log('JORDYN2 ASSETS DONE ~' + timeline.toFixed(0) + 's')
