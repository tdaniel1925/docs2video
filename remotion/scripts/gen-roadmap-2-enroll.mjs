// ROADMAP EPISODE 2 — ENROLLMENT & FIRST STEPS (distributor training series).
// Torn-paper (FLUX), Rachel VO, EL music. Writes public/road2/.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'road2'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY
const env = {}; for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = env.CLOUDFLARE_API_KEY, CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const log = (...a) => console.log('[road2]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
try { copyFileSync(join(HERE, '..', 'public', 'apex', 'logo.png'), join(OUT, 'logo.png')) } catch {}

// [vo, kind]  kind 'S' = paper scene (image), else data-panel id.
const BEATS = [
  ["In this episode, we'll get you fully enrolled and set up — so you're ready to earn from day one.", 'S'],                                                              // 0
  ["Apex is referral-based. You joined through the link of the person who introduced you — that's your sponsor, and they're on your team to help you win.", 'sponsor'],     // 1
  ["When you signed up, you chose your path: licensed, or non-licensed. Both are welcome — it simply sets which ladder you start on.", 'licpath'],                        // 2
  ["If you're not licensed, you start on the Technology ladder right away. If you are licensed, you can run both.", 'S'],                                                 // 3
  ["Your first job inside the back office is simple: complete your profile. Add your photo, your phone, and your details.", 'profile'],                                   // 4
  ["Then set up how you get paid. Add your payment information and your tax form, so your commissions reach you with no delays.", 'getpaid'],                             // 5
  ["Take a few minutes to explore your back office — your team view, your compensation, your commissions, your products, and this training center.", 'backoffice'],       // 6
  ["Now the most important part — your first forty-eight hours. Three actions set the tone for everything that follows.", 'first48'],                                     // 7
  ["One: finish your setup. Two: choose your path and learn your products. Three: write your list — everyone you know who wants more.", 'threesteps'],                    // 8
  ["Do these, and you're no longer just signed up — you're in business. In the next episode, we tour your back office in detail. Let's go.", 'S'],                        // 9
]
const LINES = BEATS.map((b) => b[0])
const SCENE_BEATS = BEATS.map((b, i) => b[1] === 'S' ? i : -1).filter((i) => i >= 0)
const PANEL_KIND = {}; BEATS.forEach((b, i) => { if (b[1] !== 'S') PANEL_KIND[i] = b[1] })
const PAPER = "Cut-paper craft collage illustration, layered navy blue, red, and cream construction paper, visible torn edges, soft drop shadows, paper grain, patriotic corporate feel, premium editorial paper-craft. 16:9. CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO writing, NO labels anywhere — surfaces completely blank. Any figure MUST strongly contrast its background (dark navy or bright red figure, NEVER cream on cream), with a visible outline or shadow."
const SCENE_PROMPTS = {
  0: `${PAPER} A red paper figure sitting at a navy paper desk with a glowing paper checklist, getting set up, ready to begin.`,
  3: `${PAPER} A red paper figure choosing between two glowing navy paper doorways, two paths, choosing your path.`,
  9: `${PAPER} A red paper figure stepping confidently through an open navy paper door into a bright cream horizon, now in business, momentum.`,
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
log('ROAD2 ASSETS DONE ~' + timeline.toFixed(0) + 's')
