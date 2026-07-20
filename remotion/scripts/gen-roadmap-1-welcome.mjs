// ROADMAP EPISODE 1 — WELCOME TO APEX (distributor training series).
// Torn-paper (FLUX), Rachel VO, EL music. Writes public/road1/.
// REP-FACING training. Compliance: never expose internal waterfall / company cut;
// BV = a value Apex "designates" per product. See feedback_apex_comp_video_compliance.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'road1'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY
const env = {}; for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = env.CLOUDFLARE_API_KEY, CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const log = (...a) => console.log('[road1]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
try { copyFileSync(join(HERE, '..', 'public', 'apex', 'logo.png'), join(OUT, 'logo.png')) } catch {}

// [vo, kind]  kind 'S' = paper scene (image), else data-panel id.
// ONE IDEA = ONE SLIDE. Each line talks ONLY about the slide it's paired with.
// A line never starts describing the NEXT slide's topic. This keeps picture and
// words locked so no slide overstays (e.g. the '48' line must NOT mention the
// three steps — those belong to the steps slide's own line).
const BEATS = [
  ["Welcome to Apex. You just made a decision that could change everything. This roadmap takes you from day one to your first paycheck.", 'S'],                    // 0 scene
  ["Here's what makes Apex different. Most companies give you one way to earn. Apex gives you two, under one roof.", 'twopaths'],                                    // 1 twopaths
  ["On the Technology side, you put powerful A.I. tools in the hands of businesses. No license required, open to everyone.", 'S'],                                  // 2 scene
  ["On the Insurance side, if you're a licensed agent, you sell life insurance and earn on every policy.", 'S'],                                                    // 3 scene
  ["And here's the belief that drives it all: every agent in this industry is our customer, whether they join us or not.", 'mission'],                              // 4 mission
  ["So you earn two ways. On what you personally sell, and on what your team produces.", 'earn'],                                                                   // 5 earn
  ["Now, your first forty-eight hours matter most. The people who start fast are the ones who succeed.", 'first48'],                                                // 6 first48 (ONLY the 48hr idea)
  ["So take three simple actions right away. Complete your profile and set up how you get paid. Pick your path. And make your list of people to talk to.", 'threesteps'], // 7 threesteps (the 3 steps live HERE)
  ["This series is your map. We'll cover the products, the plan, how to invite, present, close, and build a team.", 'series'],                                      // 8 series
  ["You don't need to know everything today. You just need to start. Let's take that first step together.", 'S'],                                                  // 9 scene
]
const LINES = BEATS.map((b) => b[0])
const SCENE_BEATS = BEATS.map((b, i) => b[1] === 'S' ? i : -1).filter((i) => i >= 0)
const PANEL_KIND = {}; BEATS.forEach((b, i) => { if (b[1] !== 'S') PANEL_KIND[i] = b[1] })
const PAPER = "Cut-paper craft collage illustration, layered navy blue, red, and cream construction paper, visible torn edges, soft drop shadows, paper grain, patriotic corporate feel, premium editorial paper-craft. 16:9. CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO writing, NO labels anywhere — surfaces completely blank. Any figure MUST strongly contrast its background (dark navy or bright red figure, NEVER cream on cream), with a visible outline or shadow."
const SCENE_PROMPTS = {
  0: `${PAPER} A bright red paper figure standing at the base of a tall navy paper mountain path that winds upward toward a cream sunrise, the start of a journey, welcome.`,
  2: `${PAPER} A red paper hand offering a small glowing navy paper laptop with a paper spark to a paper business person, A.I. technology tools.`,
  3: `${PAPER} A confident red paper insurance agent figure holding a navy paper shield protecting a small paper family, life insurance.`,
  9: `${PAPER} A red paper figure taking a determined first step onto a navy paper path of stepping stones rising into a cream sky, take the first step.`,
}
async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.12 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function genVO() { const durs = []; for (let i = 0; i < LINES.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { b = await openaiTTS(LINES[i]) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) } writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES, panels: PANEL_KIND }, null, 2)); log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s (~${(durs.reduce((a, b) => a + b, 0) / 60).toFixed(1)}min)`); return durs }
async function flux(prompt, outPath) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6, width: 1280, height: 720 }) }); if (!r.ok) throw new Error(`${r.status}`); const j = await r.json(); if (!j?.result?.image) throw new Error('no image'); writeFileSync(outPath, Buffer.from(j.result.image, 'base64')) }
async function genImgs() { for (const i of SCENE_BEATS) { const f = join(OUT, `f-${i}.png`); if (!FORCE && existsSync(f)) { log(`f-${i} cached`); continue } const prompt = SCENE_PROMPTS[i] || `${PAPER} Abstract navy and red paper path.`; for (let a = 0; a < 3; a++) { try { await flux(prompt, f); log(`f-${i} ok`); break } catch (e) { if (a < 2) await new Promise((s) => setTimeout(s, 2000)) } } } }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Uplifting, warm, inspiring corporate underscore for a welcome training video, hopeful and motivating, steady build, sits under narration, instrumental.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL'); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }
let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 100 } }
const timeline = total + LINES.length * 0.5 + 8
if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('ROAD1 ASSETS DONE ~' + timeline.toFixed(0) + 's')
