import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
import { writeFileSync } from 'fs'
const ms = Number(process.argv[2] || 76000)
const prompt = 'Upbeat modern electro-pop launch commercial track, 128 BPM, driving four-on-the-floor kick from the very first beat, punchy claps, bright plucky synth hook, fun and energetic, confident and playful, steady tempo throughout, builds to a big final hit. Instrumental only, no vocals.'
const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
  method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ prompt, music_length_ms: ms }),
})
if (!res.ok) throw new Error(`eleven-music ${res.status} ${await res.text()}`)
writeFileSync('public/restylez/music.mp3', Buffer.from(await res.arrayBuffer()))
console.log('music ok')
