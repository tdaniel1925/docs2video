/**
 * Generate all audio assets for the Docs2Video commercial demo:
 *  - 6 voiceover clips (ElevenLabs, Rachel) — one per section so the kinetic
 *    text can sync exactly to the narration
 *  - music: ElevenLabs Music (exact 46s) → fallback to the existing demo track
 * Run: npx tsx scripts/gen-commercial-assets.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public')
const KEY = process.env.ELEVENLABS_API_KEY!
const VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Rachel

// Original commercial copy — one entry per on-screen section.
export const VO_SECTIONS = [
  'Every day, your best work gets sent as a PDF... and ignored.',
  'Proposals. Policies. Reports. Brilliant — and unread.',
  'Docs2Video changes that. Upload any document, and our AI turns it into a polished, narrated video — in about a minute.',
  'Real narration that tells a story. Designs that move. Your brand, front and center.',
  'Send it. Track it. Watch clients actually respond.',
  'One document. One minute. One video that does the talking. Docs2Video. Start free at docs2video dot com.',
]

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 },
    }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 150)}`)
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()))
  console.log(`[vo] ${file} ok`)
}

async function music() {
  // Try ElevenLabs Music with an EXACT duration (the recommendation from the
  // music-generator discussion). Any failure → fall back to the existing track.
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Upbeat modern corporate electronic commercial track, confident and premium, strong clear kick drum pulse, driving bass, bright synth plucks, builds energy toward the end. Instrumental only, no vocals.',
        music_length_ms: 46000,
      }),
    })
    if (!res.ok) throw new Error(`music ${res.status}: ${(await res.text()).slice(0, 200)}`)
    writeFileSync(join(OUT, 'commercial-music.mp3'), Buffer.from(await res.arrayBuffer()))
    console.log('[music] ElevenLabs Music ok (exact 46s)')
    return
  } catch (e) {
    console.warn('[music] ElevenLabs Music failed:', e instanceof Error ? e.message : e)
  }
  const fallback = join(OUT, 'demo-music.mp3')
  if (existsSync(fallback)) {
    copyFileSync(fallback, join(OUT, 'commercial-music.mp3'))
    console.log('[music] fell back to existing demo track')
  } else {
    throw new Error('no music available')
  }
}

async function main() {
  for (let i = 0; i < VO_SECTIONS.length; i++) {
    await tts(VO_SECTIONS[i], `commercial-vo-${i + 1}.mp3`)
  }
  await music()
  console.log('done')
}

main().catch(e => { console.error('FAILED:', e); process.exit(1) })
