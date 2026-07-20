// COMP VIDEO 2 — THE TECHNOLOGY LADDER (deep, ~3-4 min).
// Correct to APEX_COMP_ENGINE_SPEC. Torn-paper (FLUX), Rachel VO, EL music.
// Writes public/comp2/. Reuses master-audio + a per-video composition.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'comp2'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY
const env = {}; for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = env.CLOUDFLARE_API_KEY, CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const log = (...a) => console.log('[comp2]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
try { copyFileSync(join(HERE, '..', 'public', 'apex', 'logo.png'), join(OUT, 'logo.png')) } catch {}

// [vo, kind]  kind 'S' = paper scene (image), else data-panel id
// NOTE: rep-facing ONLY. Never discuss the internal waterfall / company / vendor
// cuts — reps only care about what THEY earn. Present in plain dollars.
const BEATS = [
  ["This is the Apex Technology ladder — how everyone, licensed or not, earns with Apex.", 'S'],                         // 0
  ["You earn by putting Apex's A.I. tools — like SmartViewz and Docs2Video — in the hands of businesses.", 'S'],         // 1
  ["You get paid two ways. First, a commission on every sale you personally make.", 'twoways'],                          // 2
  ["Second, override income — a share that comes back to you as the team you build makes sales too.", 'override'],       // 3
  ["So your income grows two ways at once: what you sell, and what your team sells.", 'S'],                              // 4
  ["Now, your rank. There are nine ranks, from Starter to Elite, based on your monthly volume.", 'ranks'],               // 5
  ["Each rank has a target — your own personal volume, plus your team's group volume.", 'reqs'],                         // 6
  ["Reach Bronze at just a hundred fifty personal, three hundred group. The targets grow as you climb.", 'reqs2'],       // 7
  ["Every rank you reach unlocks deeper override levels — how far down your team you get paid.", 'levels'],              // 8
  ["Starter earns on one level. Elite earns on all seven — from your recruits, to their recruits, and beyond.", 'levels2'], // 9
  ["Your enrollment override pays on everyone you personally bring in — the biggest share, at every rank.", 'l1'],       // 10
  ["And the deeper levels pay more as you rank up — the higher your rank, the more of your team you earn on.", 'schedule'], // 11
  ["Every rank also pays a one-time bonus — more than ninety-three thousand dollars in bonuses along the way.", 'bonuses'], // 12
  ["One simple rule to earn overrides: produce at least fifty points of personal volume a month. Sell a little, stay qualified.", 'pv'], // 13
  ["That's the Technology ladder. Sell the tools, build a team, and climb — nine ranks, seven levels deep, no ceiling.", 'S'], // 14
]
const LINES = BEATS.map((b) => b[0])
const SCENE_BEATS = BEATS.map((b, i) => b[1] === 'S' ? i : -1).filter((i) => i >= 0)
const PANEL_KIND = {}; BEATS.forEach((b, i) => { if (b[1] !== 'S') PANEL_KIND[i] = b[1] })
const PAPER = "Cut-paper craft collage illustration, layered navy blue, red, and cream construction paper, visible torn edges, soft drop shadows, paper grain, patriotic corporate feel, premium editorial paper-craft. 16:9. CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO writing, NO labels anywhere — surfaces completely blank. Any figure MUST strongly contrast its background (dark navy or bright red figure, NEVER cream on cream), with a visible outline or shadow."
const SCENE_PROMPTS = {
  0: `${PAPER} A single tall navy paper ladder reaching up, a bright red paper figure at its base looking up, technology ladder.`,
  1: `${PAPER} A red paper hand offering a small navy paper laptop with a glowing paper spark to a paper business person, A.I. tools.`,
  4: `${PAPER} A red paper figure and a small navy paper team behind, two streams of paper coins flowing to the figure, two ways to earn.`,
  14: `${PAPER} A red paper figure climbing high up a navy paper ladder that extends beyond the frame into cream sky, no ceiling.`,
}
async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.12 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function genVO() { const durs = []; for (let i = 0; i < LINES.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { b = await openaiTTS(LINES[i]) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) } writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES, panels: PANEL_KIND }, null, 2)); log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s (~${(durs.reduce((a, b) => a + b, 0) / 60).toFixed(1)}min)`); return durs }
async function flux(prompt, outPath) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6, width: 1280, height: 720 }) }); if (!r.ok) throw new Error(`${r.status}`); const j = await r.json(); if (!j?.result?.image) throw new Error('no image'); writeFileSync(outPath, Buffer.from(j.result.image, 'base64')) }
async function genImgs() { for (const i of SCENE_BEATS) { const f = join(OUT, `f-${i}.png`); if (!FORCE && existsSync(f)) { log(`f-${i} cached`); continue } const prompt = SCENE_PROMPTS[i] || `${PAPER} Abstract navy and red paper ladders.`; for (let a = 0; a < 3; a++) { try { await flux(prompt, f); log(`f-${i} ok`); break } catch (e) { if (a < 2) await new Promise((s) => setTimeout(s, 2000)) } } } }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Confident, warm, professional corporate underscore for an explainer, steady and motivating, sits under narration, instrumental.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL'); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }
let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 150 } }
const timeline = total + LINES.length * 0.5 + 8
if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('COMP2 ASSETS DONE ~' + timeline.toFixed(0) + 's')
