// APEX COMP PLAN — DETAILED EXPLAINER (~31 beats, ~5 min).
// CORRECT to APEX_COMP_ENGINE_SPEC: seller earns 60% of BV (not the sale);
// BV is explained; worked examples labeled illustrative. Torn-paper (FLUX),
// Rachel VO, ElevenLabs music. Writes public/compd/.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'compd')
mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY

const env = {}
for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = env.CLOUDFLARE_API_KEY, CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const log = (...a) => console.log('[compd]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
try { copyFileSync(join(HERE, '..', 'public', 'apex', 'logo.png'), join(OUT, 'logo.png')) } catch {}

/* ===== 31 beats. kind: 'scene'<n> uses paper image f-<n>; else a data panel id ===== */
// Each beat: [voiceText, kind] where kind = 'S' (paper scene) or a data-panel key.
const BEATS = [
  // A — setup
  ["The Apex compensation plan is built on two ladders — Technology, and Insurance. You can climb one, or both.", 'S'],           // 0
  ["And it's free to start. Zero dollars to begin — no paywall, no catch.", 'zero'],                                              // 1
  ["Let's walk through exactly how you get paid on each.", 'S'],                                                                   // 2
  // B — tech ladder
  ["The Technology ladder is open to everyone — licensed or not. You earn by putting Apex's A.I. tools in the hands of businesses.", 'S'], // 3
  ["First, one quick term: Business Volume, or B.V.", 'bvdef'],                                                                  // 4
  ["For every product, Apex designates a Business Volume — and that's the amount your commission is based on.", 'bvdef2'],       // 5
  ["You get paid two ways. First, a commission on the B.V. of every sale you personally make.", 'twoways'],                      // 6
  ["Second, override income — a share that comes back to you as the team you build makes sales too.", 'override'],               // 7
  ["So your income grows two ways at once: what you sell, and what your team sells.", 'both'],                                   // 8
  ["You're paid on what you sell — and paid again as the team you build sells too.", 'S'],                                       // 9
  ["Your override income grows with your rank. There are nine ranks — Starter to Elite.", 'ranks'],                             // 10
  ["Higher ranks unlock deeper override levels — from one level at Starter, all the way to seven levels deep at the top.", 'levels'], // 12
  ["Level one always pays thirty percent of the override pool — your enrollment override, on everyone you personally bring in.", 'l1'], // 13
  ["And every rank you reach pays a one-time bonus — more than ninety-three thousand dollars in bonuses along the way.", 'bonuses'], // 14
  ["One rule to earn overrides: produce at least fifty points of personal volume a month. Sell a little, stay qualified.", 'pv'], // 15
  // C — insurance ladder
  ["The second ladder is Insurance — for licensed agents. It's a completely separate business.", 'S'],                            // 16
  ["You earn fifty to ninety percent of the first-year premium on every policy you write.", 'range'],                             // 17
  ["And it's paid directly by A-rated carriers — straight to you.", 'carriers'],                                                 // 18
  ["You own the book of business. Your clients, your renewals, your asset.", 'S'],                                                // 19
  ["Seven ranks, from Pre-Associate at fifty percent, up to M.G.A. at ninety. You climb by production and quality.", 'inranks'],  // 20
  ["Build a team, and you earn generational overrides on their production — six generations deep.", 'gens'],                      // 21
  ["Here's what that looks like. Recruit five agents. They each recruit three — a team of twenty, each writing five thousand a month.", 'exteam'], // 22
  ["Your override income? Around seven thousand five hundred dollars a month — on top of your own commissions. Ninety thousand a year.", 'ex7500'], // 23
  ["Produce consistently and you earn a weekly production bonus — one to four percent on top.", 'weekly'],                        // 24
  ["Build a shop as an M.G.A., and you earn quarterly recruiting bonuses — up to six thousand dollars a quarter.", 'recruit'],    // 25
  // D — together
  ["Here's what makes Apex different. The two ladders run on completely separate trees — no mixing, fully compliant.", 'dualtree'], // 26
  ["But one person can run both at once.", 'S'],                                                                                  // 27
  ["Lead with technology. Build an insurance career. Or stack them — two income streams, one team.", 'streams'],                  // 28
  ["Every rank is permanent. Once you earn it, you keep it. And there's no ceiling on either ladder.", 'S'],                      // 29
  ["Two ladders. One opportunity. This is the Apex compensation plan. Start free, at reach the apex dot net.", 'S'],             // 30
]
const LINES = BEATS.map((b) => b[0])
// scene beats (paper image) = those with kind 'S'
const SCENE_BEATS = BEATS.map((b, i) => b[1] === 'S' ? i : -1).filter((i) => i >= 0)
const PANEL_KIND = {}; BEATS.forEach((b, i) => { if (b[1] !== 'S') PANEL_KIND[i] = b[1] })

/* ===== torn-paper scene prompts (navy/red/cream) for the scene beats ===== */
// HARD no-text + character-contrast rules (FLUX kept baking misspelled words in,
// and cream figures vanished on cream paper). Repeat the ban emphatically.
const PAPER = "Cut-paper craft collage illustration, layered navy blue, red, and cream construction paper, visible torn edges, soft drop shadows, paper grain, patriotic corporate feel, premium editorial paper-craft. 16:9. CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO writing, NO labels, NO signs, NO headlines anywhere in the image — surfaces must be completely blank. Any character or figure MUST strongly contrast its background (e.g. a dark navy or bright red figure — NEVER a cream/white figure on a cream/white area), clearly separated with a visible outline or shadow."
const SCENE_PROMPTS = {
  0: `${PAPER} Two tall paper ladders side by side reaching upward, one navy one red, a paper figure between them ready to climb.`,
  2: `${PAPER} A paper path branching into two directions with small paper signposts, a journey beginning.`,
  3: `${PAPER} A paper laptop with a glowing paper A.I. spark, handed toward a paper business person, technology for everyone.`,
  10: `${PAPER} A paper salesperson figure and a small paper team of figures behind, money/coins as paper circles flowing up, earning on sales and team.`,
  16: `${PAPER} A paper insurance shield with a red cross and a paper license badge, a professional agent figure, separate business.`,
  19: `${PAPER} A paper book / ledger with paper client cards and a small house, owning your book of business.`,
  27: `${PAPER} A single paper figure with one foot on a navy paper ladder and one on a red paper ladder, doing both at once.`,
  29: `${PAPER} A paper ladder extending up beyond the frame into open cream sky, permanent steps, no ceiling, limitless.`,
  30: `${PAPER} A hero paper figure at a paper summit at sunrise, two paper ladders behind, generous cream space lower-center for a logo, triumphant finale.`,
}

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.12 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function genVO() {
  const durs = []
  for (let i = 0; i < LINES.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { log(`vo-${i} → openai (${e.message})`); b = await openaiTTS(LINES[i]) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) }
  writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES, panels: PANEL_KIND }, null, 2)); log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s (~${(durs.reduce((a, b) => a + b, 0) / 60).toFixed(1)}min)`); return durs
}
async function flux(prompt, outPath) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6, width: 1280, height: 720 }) }); if (!r.ok) throw new Error(`${r.status}`); const j = await r.json(); if (!j?.result?.image) throw new Error('no image'); writeFileSync(outPath, Buffer.from(j.result.image, 'base64')) }
async function genImgs() { for (const i of SCENE_BEATS) { const f = join(OUT, `f-${i}.png`); if (!FORCE && existsSync(f)) { log(`f-${i} cached`); continue } const prompt = SCENE_PROMPTS[i] || `${PAPER} An abstract paper composition of navy and red ladders.`; for (let a = 0; a < 3; a++) { try { await flux(prompt, f); log(`f-${i} ok`); break } catch (e) { log(`f-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2000)) } } } }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Confident, warm, professional corporate underscore for an explainer video. Gentle and steady, motivating but unobtrusive, clean, sits under narration, instrumental, resolves hopeful.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL', r.status); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }

let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 240 } }
const timeline = total + LINES.length * 0.5 + 8
if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('COMPD ASSETS DONE — timeline ~' + timeline.toFixed(0) + 's (~' + (timeline / 60).toFixed(1) + 'min)')
