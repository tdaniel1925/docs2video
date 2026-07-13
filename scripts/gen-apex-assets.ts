/**
 * Voiceover + music for the Apex (reachtheapex.net) commercial.
 * Grounded in Apex's real positioning: "Two paths, one opportunity" — sell
 * insurance with A-rated carriers AND earn from AI tools, build a team, uncapped
 * income, real training. "Everyone wins at Apex."
 * Run: npx tsx scripts/gen-apex-assets.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public')
const KEY = process.env.ELEVENLABS_API_KEY!
const VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

// 6 sections — true to Apex's "two paths" message. Confident, aspirational.
const VO = [
  "What if your career had no ceiling?",
  "At Apex, there are two paths — and one opportunity.",
  "Sell life and annuities with top-rated, A-rated carriers your clients already trust.",
  "Or earn from AI tools that open doors — and build a team while you do it.",
  "Real training. Real mentorship. And a company that protects families.",
  "Two ways to win. One opportunity. Everyone wins at Apex. Reach the Apex.",
]

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.48, similarity_boost: 0.82, style: 0.35 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 150)}`)
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()))
  console.log(`[vo] ${file}`)
}

async function main() {
  for (let i = 0; i < VO.length; i++) await tts(VO[i], `apex-vo-${i + 1}.mp3`)
  if (existsSync(join(OUT, 'commercial-music.mp3'))) { copyFileSync(join(OUT, 'commercial-music.mp3'), join(OUT, 'apex-music.mp3')); console.log('music reused') }
  console.log('done')
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
