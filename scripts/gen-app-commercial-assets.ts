/**
 * Voiceover + music for the Docs2Video APP commercial (kinetic style w/ UI shots).
 * Run: npx tsx scripts/gen-app-commercial-assets.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public')
const KEY = process.env.ELEVENLABS_API_KEY!
const VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

// One clip per section. Original ad copy for the Docs2Video product.
const VO = [
  "Every day, your team sends documents that never get read.",
  "Docs2Video changes that. Upload any document — a policy, a contract, a report — and our AI turns it into a polished, narrated video.",
  "The script writes itself, scene by scene. You review every word, and stay in full control.",
  "Branded slides, generated automatically. Don't like one? Regenerate it in a click.",
  "Then send it, and watch them watch — with view tracking, branded share pages, and payments built in.",
  "For HR. For training. For development teams. And purpose-built for insurance agents.",
  "Docs2Video. A product of Docs2Cash. Your documents, finally worth watching. Start free at docs2video dot com.",
]

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 150)}`)
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()))
  console.log(`[vo] ${file}`)
}

async function main() {
  for (let i = 0; i < VO.length; i++) await tts(VO[i], `app-vo-${i + 1}.mp3`)
  if (existsSync(join(OUT, 'commercial-music.mp3'))) { copyFileSync(join(OUT, 'commercial-music.mp3'), join(OUT, 'app-music.mp3')); console.log('music reused') }
  console.log('done')
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
