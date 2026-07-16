/**
 * Voiceover + music for the Valor Financial Specialists commercial.
 * Grounded in what Valor actually is: an IMO/FMO helping independent insurance
 * agents grow — Life & Annuity solutions, a carrier portfolio, and marketing
 * support for "insurance entrepreneurs."
 * Run: npx tsx scripts/gen-valor-assets.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public')
const KEY = process.env.ELEVENLABS_API_KEY!
const VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

// 6 sections. True to Valor's positioning; confident, premium, advisor tone.
const VO = [
  "Building an insurance business on your own is hard.",
  "Valor Financial Specialists changes that. We partner with independent agents to help them grow.",
  "Top-rated carriers. A full portfolio of life and annuity solutions.",
  "Real marketing support — built for insurance entrepreneurs, not corporations.",
  "The training, the tools, and the team behind your success.",
  "Valor Financial Specialists. Grow with valor. Visit valorfs dot com.",
]

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.82, style: 0.3 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 150)}`)
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()))
  console.log(`[vo] ${file}`)
}

async function main() {
  for (let i = 0; i < VO.length; i++) await tts(VO[i], `valor-vo-${i + 1}.mp3`)
  if (existsSync(join(OUT, 'commercial-music.mp3'))) { copyFileSync(join(OUT, 'commercial-music.mp3'), join(OUT, 'valor-music.mp3')); console.log('music reused') }
  console.log('done')
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
