// JORDYN GLOSSY-3D PROMO — Docs2Video-style glossy 3D infographic slides, but in
// JORDYN's warm palette (rust-orange + cream). Gemini 3-pro-image HERO SCENES (glossy
// 3D objects on a warm gradient, LEFT side kept clear for code-drawn text). Rachel VO + music.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'glossy'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY
const env = {}; for (const f of ['.env.local', '.env']) { for (const base of [ROOT, join(HERE, '..')]) { const p = join(base, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const GEMINI = env.GEMINI_API_KEY, IMAGE_MODEL = env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const log = (...a) => console.log('[glossy]', ...a)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
const genai = new GoogleGenAI({ apiKey: GEMINI })

// ~90s. Each beat = a slide: headline + fact chips (code-drawn) over a Gemini hero scene.
const BEATS = [
  { vo: "Meet Jordyn — the A.I. assistant with a brain for your business.", head: 'Meet Jordyn', hi: 'Jordyn', hero: 'a friendly glowing 3D assistant orb character with a warm terracotta glow, soft and approachable' },
  { vo: "Generic chatbots start from zero. Jordyn already knows your industry on day one.", head: 'Knows Your Industry', hi: 'Your Industry', hero: 'a glossy 3D brain made of warm terracotta glass connected to floating industry icons, intelligence' },
  { vo: "It reads and manages your inbox, answers your phone, and builds your pipeline — automatically.", head: 'Your Whole Day, Handled', hi: 'Handled', hero: 'a glossy 3D email envelope, a phone, and a rising pipeline chart floating together in warm terracotta glass' },
  { vo: "Every reply is drafted in your voice. Nothing sends without your okay.", head: 'In Your Voice', hi: 'Your Voice', hero: 'a glossy 3D speech bubble and a checkmark shield in warm terracotta glass, approval and trust' },
  { vo: "Every morning, Jordyn hands you a briefing of exactly what needs your attention.", head: 'Morning Briefing', hi: 'Briefing', hero: 'a glossy 3D clipboard checklist with a rising sun behind it in warm terracotta and cream, a morning briefing' },
  { vo: "The result? About eight hours back, every single week.", head: '~8 Hours Back', hi: '8 Hours', hero: 'a glossy 3D clock with warm terracotta hands and floating time particles, saving time' },
  { vo: "One closed deal covers years of Jordyn. Your future assistant is ready today.", head: 'Try Jordyn Today', hi: 'Today', hero: 'a glossy 3D upward arrow and a handshake in warm terracotta glass, success and ROI, celebratory' },
]

const PALETTE = "Brand palette: warm terracotta rust-orange (#c0603f) as the hero accent, soft cream and warm off-white background, subtle deep charcoal-brown shadows. Premium, warm, inviting."
const STYLE = `Ultra-premium glossy 3D infographic marketing slide, 16:9. A single hero 3D object rendered in smooth glossy glass/plastic with soft studio lighting, gentle rim light, reflections, soft shadow, floating slightly. Clean modern gradient background (warm cream to soft terracotta). ${PALETTE} The LEFT 45% of the frame MUST be kept clean and empty (just the gradient background) so text can be added later — place the hero object on the RIGHT side. CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO labels, NO UI text anywhere in the image. High-end, polished, Apple-keynote quality.`

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function gemImage(prompt, outPath) {
  for (let a = 0; a < 3; a++) {
    try {
      const resp = await genai.models.generateContent({ model: IMAGE_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } } })
      const parts = resp.candidates?.[0]?.content?.parts ?? []
      for (const p of parts) { if (p.inlineData) { writeFileSync(outPath, Buffer.from(p.inlineData.data, 'base64')); return true } }
      throw new Error('no image in response')
    } catch (e) { log(`  gem retry ${a}: ${String(e.message || e).slice(0, 80)}`); if (a < 2) await new Promise((s) => setTimeout(s, 2500)) }
  }
  return false
}

async function genVO() { const durs = []; for (let i = 0; i < BEATS.length; i++) { const f = join(OUT, `vo-${i}.mp3`); if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue } let b; try { b = ELEVEN ? await eleven(BEATS[i].vo) : await openaiTTS(BEATS[i].vo) } catch (e) { b = await openaiTTS(BEATS[i].vo) } writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`) } writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, beats: BEATS.map(({ vo, ...r }) => r) }, null, 2)); log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`); return durs }
async function genImgs() { for (let i = 0; i < BEATS.length; i++) { const f = join(OUT, `f-${i}.png`); if (!FORCE && existsSync(f)) { log(`f-${i} cached`); continue } const prompt = `${STYLE}\n\nThe hero object is: ${BEATS[i].hero}.`; const ok = await gemImage(prompt, f); log(`f-${i} ${ok ? 'ok' : 'FAILED'}`) } }
async function genMusic(sec) { const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return } const ms = Math.min(300000, Math.round((sec + 4) * 1000)); const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Warm, modern, optimistic corporate tech underscore for a product promo, clean and premium, gentle uplifting groove, sits under narration, instrumental.', music_length_ms: ms }) }); if (r.status !== 200) { log('music FAIL ' + r.status); return } writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok') }

let total = 0
if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) } else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 55 } }
const timeline = total + BEATS.length * 0.5 + 9
if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
log('GLOSSY ASSETS DONE ~' + timeline.toFixed(0) + 's')
