// CINEMATIC TRAILER V2 — grounded, high-energy Apex Affinity Group hype (~50s).
// LESS neon: aspirational realism (real people, motion, landscapes, golden hour,
// dramatic natural light). BIG camera movement in the composition. Writes public/cine2/.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'cine2'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY
const env = {}; for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = env.CLOUDFLARE_API_KEY, CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const log = (...a) => console.log('[cine2]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
try { copyFileSync(join(HERE, '..', 'public', 'apex', 'logo.png'), join(OUT, 'logo.png')) } catch {}

// ~50s trailer VO — names Apex Affinity Group. Grounded, aspirational, building.
const LINES = [
  "Somewhere, right now, someone decides today is the day everything changes.",                          // 0
  "They're done waiting. Done wondering what if.",                                                        // 1
  "They bet on themselves — and they never look back.",                                                   // 2
  "At Apex Affinity Group, we build people. And people build everything.",                                // 3
  "Real tools. Real training. A real team that rises together.",                                          // 4
  "You put in the work. We open the door.",                                                               // 5
  "This is where ordinary people do the extraordinary.",                                                  // 6
  "Your future isn't something you wait for. It's something you build.",                                  // 7
  "Apex Affinity Group. Rise together.",                                                                  // 8
]

// Grounded aspirational CINEMATIC realism. Natural dramatic light, golden hour, motion.
const CINE = "Cinematic film still, aspirational and emotional, dramatic natural lighting, golden hour warmth with deep shadows, rich cinematic color grade, shallow depth of field, subtle film grain, anamorphic, epic and grounded, photojournalistic realism, ultra detailed, atmospheric. NO text, NO words, NO letters, NO logos, NO neon signs.";
const SHOTS = {
  0: `${CINE} A person standing at a window at sunrise, warm light on their face, quiet resolve, the moment of decision.`,
  1: `${CINE} A determined runner lacing up shoes on empty stadium steps at dawn, ready to begin, sweat and grit.`,
  2: `${CINE} A confident entrepreneur walking briskly through a sunlit city street, motion, purpose, forward energy.`,
  3: `${CINE} A diverse team of professionals laughing and working together around a table bathed in warm window light, real connection.`,
  4: `${CINE} A mentor and a younger person shaking hands on a rooftop at golden hour, city skyline behind, trust and partnership.`,
  5: `${CINE} A hand pushing open a heavy door into a burst of bright warm light, opportunity opening.`,
  6: `${CINE} An ordinary person standing triumphant on a mountain ridge at sunrise, arms at sides, vast landscape, achievement.`,
  7: `${CINE} A person sketching big plans on a bright wall of ideas, energy and ambition, sunlight streaming in.`,
  8: `${CINE} A large diverse group of people walking forward together toward a glowing sunrise horizon, unity, movement, rising together.`,
}

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.42, similarity_boost: 0.85, style: 0.3 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function flux(prompt, outPath) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6, width: 1280, height: 720 }) }); if (!r.ok) throw new Error(`${r.status}`); const j = await r.json(); if (!j?.result?.image) throw new Error('no image'); writeFileSync(outPath, Buffer.from(j.result.image, 'base64')) }

async function genVO() { const durs = []; for (let i = 0; i < LINES.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { b = await openaiTTS(LINES[i]) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) } writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES }, null, 2)); log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`); return durs }
async function genShots() { for (const i of Object.keys(SHOTS)) { const f = join(OUT, `f-${i}.png`); if (!FORCE && existsSync(f)) { log(`f-${i} cached`); continue } for (let a = 0; a < 3; a++) { try { await flux(SHOTS[i], f); log(`f-${i} ok`); break } catch (e) { if (a < 2) await new Promise((s) => setTimeout(s, 2000)) } } } }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Uplifting epic cinematic trailer music, emotional and powerful, driving percussion, soaring strings building to a triumphant anthemic climax, inspiring and high-energy, instrumental.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL ' + r.status); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }

let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 45 } }
const timeline = total + LINES.length * 0.35 + 9
if (ONLY !== 'vo' && ONLY !== 'music') await genShots()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('CINE2 ASSETS DONE ~' + timeline.toFixed(0) + 's')
