import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
const OUT = join(__dirname, '..', 'remotion', 'public', 'c-apexFLAT')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
const KEY = process.env.ELEVENLABS_API_KEY!
;(async () => {
  const prompt = `Upbeat, cheerful corporate-pop instrumental. Bright acoustic guitar strumming, warm handclaps, a happy glockenspiel/bell melody, light kick drum, positive and low-pressure. Friendly explainer-video vibe. Builds gently, stays optimistic. No vocals. ~30 seconds.`
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, music_length_ms: 30000 }),
  })
  if (!res.ok) { console.error('FAIL', res.status, (await res.text()).slice(0,200)); process.exit(1) }
  writeFileSync(join(OUT, 'music.mp3'), Buffer.from(await res.arrayBuffer()))
  console.log('music.mp3 written')
})()
