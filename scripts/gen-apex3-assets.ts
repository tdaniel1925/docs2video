/**
 * Shared VO + music for the Apex 3-treatment demo (editorial / kinetic / grid).
 * SAME message across all three — only the composition differs. One VO set + one
 * music track, reused by all three compositions.
 * Run: npx tsx scripts/gen-apex3-assets.ts [vo|music|all]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public', 'c-apex3')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
const KEY = process.env.ELEVENLABS_API_KEY!
const VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

// 5 beats — the shared SmartViewz story
const VO = [
  "Your book of business — finally talking back.",
  "SmartViewz. The AI that reads your whole book. Ask it anything.",
  "Who's about to lapse? Twelve policies this month — with cross-sells on five.",
  "Spot every lapse. Surface every cross-sell. Never miss a thing.",
  "Stop guessing. Start knowing. Reach the Apex.",
]

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.4 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 150)}`)
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()))
  console.log(`[vo] ${file}`)
}

async function music() {
  const prompt = `Modern confident commercial instrumental for a premium insurance-tech brand. Clean electronic pulse, warm bass, subtle piano, building steadily toward an uplifting resolve. Professional, aspirational, not cheesy. No vocals. ~30 seconds.`
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, music_length_ms: 30000 }),
  })
  if (!res.ok) { console.error(`[music] FAILED ${res.status}: ${(await res.text()).slice(0, 200)}`); return }
  writeFileSync(join(OUT, 'music.mp3'), Buffer.from(await res.arrayBuffer()))
  console.log('[music] music.mp3')
}

async function main() {
  const only = process.argv[2]
  if (!only || only === 'vo' || only === 'all') for (let i = 0; i < VO.length; i++) await tts(VO[i], `vo-${i + 1}.mp3`)
  if (!only || only === 'music' || only === 'all') await music()
  console.log('done')
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
