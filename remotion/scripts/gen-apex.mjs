// APEX AFFINITY GROUP ~2.5min recruiting/brand video — cinematic navy/red
// photographic corporate style. Grounded in reachtheapex.net. 16 beats.
// Gemini for photo-real scenes (better people coherence than FLUX), Rachel VO,
// ElevenLabs music. Writes into public/apex/.
import { readFileSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'apex')
mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY

const env = {}
for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const GEMINI = env.GEMINI_API_KEY, IMG_MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const log = (...a) => console.log('[apex]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

// copy the real Apex logo in (colour version)
try { copyFileSync(join(HERE, '..', 'public', 'apex-src', 'apex-logo.png'), join(OUT, 'logo.png')) } catch {}

/* ================= SCRIPT — 16 beats (~2.5min), grounded in the site ====== */
const LINES = [
  "Most people are told to pick a lane. Build a career — or chase the new thing. At Apex, you don't have to choose.", // 0
  "Apex Affinity Group is built on two proven paths to real income. Insurance. A.I. technology. Or both.", // 1
  "Path one: a real insurance career. Write for A-rated national carriers your clients already trust.", // 2
  "Term life. Whole life. Annuities. Honest coverage that protects families — and a book of business you own.", // 3
  "Path two: an unfair advantage. A.I. tools built for how insurance is actually sold.", // 4
  "SmartViewz lets you ask your entire book of business anything — and get answers in seconds.", // 5
  "And Docs2Video turns any document into a branded explainer video that opens doors and closes deals.", // 6
  "Apex is the only insurance organization of its kind — a real tech stack, purpose-built for agents.", // 7
  "Licensed, or brand new — it doesn't matter. Full training, mentorship, and licensing support are included.", // 8
  "And it's free to start. Zero dollars to begin. No paywall, no catch.", // 9
  "Your income has no ceiling. Earn on every policy you place — plus overrides as you build a team.", // 10
  "Two income streams. One team behind you. And no cap on how far you can go.", // 11
  "This isn't just another opportunity. It's the carriers, the technology, and the training to actually win.", // 12
  "Whether you want a career, a side income, or a business of your own — there's a place for you here.", // 13
  "Two paths. One opportunity. Room for everyone.", // 14
  "Apex Affinity Group. Start your journey today.", // 15
]

/* ================= CINEMATIC NAVY/RED PHOTOGRAPHIC SCENE PROMPTS ========== */
// Corporate, warm-cinematic photography feel; navy blue + red + clean white
// brand accents; real, aspirational, diverse professionals. NO text/logos.
const CINE = "Cinematic professional corporate photography, warm natural lighting, shallow depth of field, premium and aspirational, modern insurance/finance brand aesthetic with navy blue and subtle red accents, clean and trustworthy, realistic diverse people, 16:9, high detail. NO text, NO logos, NO words, NO watermarks."
const SCENES = [
  `${CINE} A confident professional standing at a fork / two diverging paths, thoughtful and hopeful, symbolic of choosing a direction, soft morning light.`, // 0
  `${CINE} A diverse team of professionals collaborating in a bright modern office, energy and unity, a sense of a company built on two strengths.`, // 1
  `${CINE} A warm insurance agent meeting a family at a kitchen table, trust and reassurance, protecting what matters, documents on the table.`, // 2
  `${CINE} A happy multi-generational family at home, safe and protected, warm and genuine, the human reason behind life insurance.`, // 3
  `${CINE} A sharp young professional using a laptop and tablet with a subtle glowing digital interface, an A.I. advantage, modern and confident.`, // 4
  `${CINE} A professional looking at a sleek analytics dashboard on a large screen, insight and clarity, data turning into answers, cool blue tones.`, // 5
  `${CINE} A professional presenting a polished video on a screen to an engaged client, technology opening doors, modern office.`, // 6
  `${CINE} A striking modern office / tech operations center with screens, a sense of a purpose-built technology platform, navy and blue tones, premium.`, // 7
  `${CINE} A mentor coaching a newer team member, training and support, encouraging and warm, a hand-up not a hand-out, bright office.`, // 8
  `${CINE} A hopeful person taking a confident first step through an open doorway into light, a fresh start, no barrier to entry, uplifting.`, // 9
  `${CINE} A successful professional reviewing growth on a screen, upward momentum, earned success, warm and confident.`, // 10
  `${CINE} A leader and a growing team celebrating a win together in an office, camaraderie and momentum, two income streams, one team.`, // 11
  `${CINE} A determined professional at the summit / rooftop at golden hour looking over a city, achievement and possibility, cinematic.`, // 12
  `${CINE} A diverse group of different ages and backgrounds standing together confidently, room for everyone, inclusive and welcoming.`, // 13
  `${CINE} Two professionals shaking hands / a team united, partnership and opportunity, warm and decisive, a clear path forward.`, // 14
  `${CINE} An aspirational hero shot of a confident professional at sunrise, optimism and a new beginning, generous clean sky space for a logo, premium.`, // 15
]

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function genVO() {
  const durs = []
  for (let i = 0; i < LINES.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { log(`vo-${i} → openai`); b = await openaiTTS(LINES[i]) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) }
  writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES }, null, 2)); log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`); return durs
}
async function genImg(i, prompt) {
  const f = join(OUT, `f-${i}.png`); if (!FORCE && existsSync(f)) { log(`f-${i} cached`); return }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMG_MODEL}:generateContent?key=${GEMINI}`
  for (let a = 0; a < 3; a++) { try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }) }); if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 110)}`); const j = await r.json(); const img = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data); if (!img) throw new Error('no image'); writeFileSync(f, Buffer.from(img.inlineData.data, 'base64')); log(`f-${i} ok`); return } catch (e) { log(`f-${i} try${a + 1}: ${e.message}`); if (a < 2) await new Promise((s) => setTimeout(s, 2500)); else log(`f-${i} GIVE UP`) } }
}
async function genImgs() { const idx = SCENES.map((_, i) => i); while (idx.length) { const b = idx.splice(0, 2); await Promise.all(b.map((i) => genImg(i, SCENES[i]))) } }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Confident, uplifting, cinematic corporate anthem. Building orchestral and electronic hybrid, motivational and inspiring, a sense of ambition and momentum, driving but professional, instrumental, builds to a triumphant hopeful resolve.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL', r.status); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }

let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 150 } }
const timeline = total + LINES.length * 0.6 + 8
if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('APEX ASSETS DONE — timeline ~' + timeline.toFixed(0) + 's')
