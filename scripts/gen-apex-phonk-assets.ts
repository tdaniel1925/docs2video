/**
 * Assets for the Apex COMIC-PHONK edit (style ref: youtube fnySKJBeSNc).
 * Gritty comic-book panels (Gemini image gen) + heavy phonk-style track + VO.
 * Narrative: insurance pro drowning in chaos -> SmartViewz as the weapon ->
 * clarity/power -> victory. Ink line-work, extreme close-ups, high contrast,
 * Apex navy+red. Comic panels are what get zoom-pulsed/strobed in the video.
 *
 * Run: npx tsx scripts/gen-apex-phonk-assets.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { GoogleGenAI } from '@google/genai'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public', 'c-apexPHONK')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const KEY = process.env.ELEVENLABS_API_KEY!
const VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

// shared style spine so all panels feel like one comic
const SPINE = `Gritty high-contrast COMIC-BOOK illustration, heavy black ink line-work, bold cross-hatching and halftone shading, dramatic chiaroscuro lighting, cinematic extreme composition. Deep navy (#152a52) shadows with alarming crimson red (#d81f27) accents and stark white highlights. Aggressive, intense, "phonk edit" energy. NO text, NO speech bubbles, NO logos, NO watermark. 16:9.`

// 6 panels — the arc. Each is a strong single image built for zoom-pulse + parallax.
const PANELS: { id: string; prompt: string }[] = [
  { id: 'p1-overwhelm', prompt: `${SPINE} EXTREME CLOSE-UP of a stressed insurance agent's face, sweat on brow, eyes wide with pressure, buried under a chaotic storm of flying paperwork, spreadsheets and policy documents swirling around the head like a tornado. Ominous, claustrophobic. Cold blue shadow palette.` },
  { id: 'p2-question', prompt: `${SPINE} A lone agent silhouette standing before a towering, monstrous wall of tangled data, charts and numbers looming like a beast in the dark. Small figure vs overwhelming threat. Suspenseful build-up. Blue-black monochrome with faint red glow.` },
  { id: 'p3-weapon', prompt: `${SPINE} Heroic low-angle shot: the agent's hand slams down a glowing device/tablet emitting a burst of brilliant red-white light that cuts through the darkness like a weapon being drawn. Power, turning point, "the drop". Explosive light rays.` },
  { id: 'p4-clarity', prompt: `${SPINE} The agent, now confident and powerful, standing tall as the chaotic storm of paperwork is blasted away into clean glowing streams of organized light. Rage-turned-to-mastery expression, sinister confident grin. High-energy red and orange.` },
  { id: 'p5-strike', prompt: `${SPINE} Dynamic action panel: dramatic pointing gesture / decisive strike pose, speed-lines radiating from center, comic impact-burst behind. Maximum kinetic energy, the climax hit. Blazing red, black, white strobe-ready contrast.` },
  { id: 'p6-victory', prompt: `${SPINE} Triumphant hero shot from below: the agent standing victorious atop a peak/summit, cape-like coat, fist raised, dawn light breaking. Aspirational "reach the apex" power. Bold crimson sky, heavy ink silhouette.` },
]

async function genPanel(p: { id: string; prompt: string }) {
  const res = await genai.models.generateContent({
    model: IMAGE_MODEL,
    contents: p.prompt,
    config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } } as any,
  })
  const parts = res.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if (part.inlineData) {
      writeFileSync(join(OUT, `${p.id}.png`), Buffer.from(part.inlineData.data!, 'base64'))
      console.log(`[art] ${p.id}.png`)
      return
    }
  }
  throw new Error(`no image returned for ${p.id}`)
}

// short, punchy VO — this style is music-driven, so keep it sparse and hard-hitting
const VO = [
  "Drowning in spreadsheets.",
  "Your book of business... a monster you can't tame.",
  "Until now.",
  "SmartViewz. Ask your book anything. Get answers in seconds.",
  "Spot every lapse. Every cross-sell. Every move.",
  "Stop guessing. Start winning. Reach the Apex.",
]

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    // more intense delivery for this style
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.55 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 150)}`)
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()))
  console.log(`[vo] ${file}`)
}

// heavy phonk-style bed via ElevenLabs Music (slow ominous build -> hard drop)
async function music() {
  const prompt = `Aggressive Brazilian phonk / funk instrumental. Starts slow and ominous with a dark suspenseful vocal-chop melodic loop building tension for about 10 seconds, then DROPS into a high-tempo distorted bass-heavy 808 kick loop, hard-hitting, gritty, relentless. Cinematic, intense, hype edit energy.`
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, music_length_ms: 34000 }),
  })
  if (!res.ok) { console.error(`[music] FAILED ${res.status}: ${(await res.text()).slice(0, 200)}`); return }
  writeFileSync(join(OUT, 'music.mp3'), Buffer.from(await res.arrayBuffer()))
  console.log('[music] music.mp3')
}

async function main() {
  const only = process.argv[2] // 'art' | 'vo' | 'music' | undefined(all)
  if (!only || only === 'art') for (const p of PANELS) { try { await genPanel(p) } catch (e) { console.error(`[art] ${p.id} FAILED:`, (e as Error).message) } }
  if (!only || only === 'vo') for (let i = 0; i < VO.length; i++) await tts(VO[i], `vo-${i + 1}.mp3`)
  if (!only || only === 'music') await music()
  console.log('done')
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
