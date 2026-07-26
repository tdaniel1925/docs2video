// COMP PLAN VIDEO 1 — "Two Ladders, One Opportunity" (~90s overview).
// Grounded in APEX_COMP_ENGINE_SPEC. Torn-paper (FLUX, navy/red/cream). VO
// (Rachel) + ElevenLabs music. Some beats are DATA panels drawn in code (no
// scene image needed). Writes public/comp1/.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'comp1')
mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY

const env = {}
for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = env.CLOUDFLARE_API_KEY, CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const log = (...a) => console.log('[comp1]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

// reuse the real Apex logo
try { copyFileSync(join(HERE, '..', 'public', 'apex', 'logo.png'), join(OUT, 'logo.png')) } catch {}

/* ============ 22 beats (VO) — grounded in the comp spec ============ */
const LINES = [
  "The Apex compensation plan is built on two ladders — and you can climb one, or both.",           // 0 scene
  "And the best part? It's free to start. Zero dollars to begin.",                                   // 1 DATA $0
  "The first ladder is Technology. It's open to everyone — licensed, or not.",                       // 2 scene
  "You earn by putting Apex's A.I. tools in the hands of businesses.",                                // 3 scene
  "On every sale, you keep the majority — and a share flows up through your team.",                  // 4 DATA 60/40
  "Nine ranks, from Starter to Elite.",                                                               // 5 DATA ranks
  "Each rank you reach unlocks deeper override levels across your team — up to seven levels deep.",   // 6 DATA levels
  "And every rank pays a one-time bonus — more than ninety-three thousand dollars along the way.",    // 7 DATA bonuses
  "The second ladder is Insurance — for licensed agents.",                                            // 8 scene
  "You earn fifty to ninety percent of first-year premium.",                                          // 9 DATA range
  "Paid directly by A-rated carriers — on a book of business you own.",                               // 10 DATA carriers
  "Build a team of agents, and you earn generational overrides on their production.",                 // 11 DATA gens
  "Up to six generations deep.",                                                                       // 12 scene (gens visual)
  "Reach the top ranks and you unlock leadership bonuses — weekly, and quarterly.",                   // 13 DATA bonuses2
  "The two ladders run on separate trees — completely independent.",                                  // 14 DATA dual-tree
  "So there's no mixing, and no cap.",                                                                 // 15 scene
  "Here's what makes Apex different.",                                                                 // 16 scene
  "You can run both ladders at once.",                                                                 // 17 scene
  "Lead with technology. Build an insurance career. Or stack them together.",                         // 18 scene
  "Two income streams. One team behind you.",                                                          // 19 DATA streams
  "And no ceiling on either.",                                                                         // 20 scene
  "Two ladders. One opportunity. This is the Apex compensation plan.",                                // 21 scene
]

// DATA panels (code-drawn) vs paper scenes.
const DATA = new Set([1, 4, 5, 6, 7, 9, 10, 11, 13, 14, 19])

/* ============ torn-paper scene prompts (navy/red/cream) ============ */
const PAPER = "Cut-paper craft collage illustration, layered navy blue, red, and cream construction paper, visible torn edges, soft drop shadows, paper grain, patriotic corporate feel, premium editorial paper-craft. 16:9. NO text, NO letters, NO numbers, NO logos, NO words."
const SCENES = {
  0: `${PAPER} Two tall paper ladders side by side reaching upward, one navy one red, a paper figure standing between them ready to choose or climb both.`,
  1: `${PAPER} A paper laptop and paper A.I. spark/lightbulb, open to everyone, a welcoming paper figure, technology.`,
  2: `${PAPER} A paper hand offering a small paper laptop/tool to a paper business person, and a small paper team behind, sharing tools and building a team.`,
  5: `${PAPER} A paper insurance shield with a red cross and a paper license badge, professional, an insurance agent figure.`,
  8: `${PAPER} Two separate paper ladders clearly divided by a torn paper gap, yet a single paper figure with a foot on each, separate but both.`,
  9: `${PAPER} A confident paper figure climbing, choice of paths, stacking two paper blocks/ladders together, momentum.`,
  10: `${PAPER} A paper ladder extending up beyond the top of the frame into open cream sky, no ceiling, limitless, uplifting.`,
  11: `${PAPER} A hero paper figure at a paper summit at sunrise with two paper ladders behind, generous cream space for a logo, triumphant finale.`,
}

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function genVO() {
  const durs = []
  for (let i = 0; i < LINES.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { log(`vo-${i} → openai`); b = await openaiTTS(LINES[i]) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) }
  writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES, data: [...DATA] }, null, 2)); log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`); return durs
}
async function flux(prompt, outPath) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6, width: 1280, height: 720 }) }); if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 120)}`); const j = await r.json(); if (!j?.result?.image) throw new Error('no image'); writeFileSync(outPath, Buffer.from(j.result.image, 'base64')) }
async function genImgs() { const ids = Object.keys(SCENES).map(Number); for (const i of ids) { const f = join(OUT, `f-${i}.png`); if (!FORCE && existsSync(f)) { log(`f-${i} cached`); continue } for (let a = 0; a < 3; a++) { try { await flux(SCENES[i], f); log(`f-${i} ok`); break } catch (e) { log(`f-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2000)) } } } }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Confident, uplifting, cinematic corporate anthem, building and motivational, a sense of opportunity and ambition, instrumental, professional, resolves hopeful.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL', r.status); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }

let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 80 } }
const timeline = total + LINES.length * 0.6 + 8
if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('COMP1 ASSETS DONE — timeline ~' + timeline.toFixed(0) + 's')
