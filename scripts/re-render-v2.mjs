// Re-submits a Creatomate render for a v2 video whose assets already exist
// in storage. Usage: node scripts/re-render-v2.mjs <userId> <videoId>
import { readFileSync } from 'node:fs'
import { parseBuffer } from 'music-metadata'

const [userId, videoId] = process.argv.slice(2)
if (!userId || !videoId) {
  console.error('Usage: node scripts/re-render-v2.mjs <userId> <videoId>')
  process.exit(1)
}

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim()
const supabaseUrl = get('NEXT_PUBLIC_SUPABASE_URL')
const apiKey = get('CREATOMATE_API_KEY')
const base = `${supabaseUrl}/storage/v1/object/public/videos/${userId}/${videoId}`

const scenes = []
for (let i = 0; i < 50; i++) {
  const audioUrl = `${base}/v2-audio-${i}.mp3`
  const res = await fetch(audioUrl)
  if (!res.ok) break
  const buf = Buffer.from(await res.arrayBuffer())
  const meta = await parseBuffer(buf, 'audio/mpeg')
  const duration = Math.round((meta.format.duration || 3) * 100) / 100
  scenes.push({ imageUrl: `${base}/v2-slide-${i}.png`, audioUrl, duration })
  console.log(`scene ${i}: ${duration}s`)
}
if (!scenes.length) { console.error('No assets found'); process.exit(1) }

const FADE = 0.5, HOLD = 0.75
const elements = []
let t = 0
scenes.forEach((s, i) => {
  const isLast = i === scenes.length - 1
  const dur = s.duration + (isLast ? HOLD : 0)
  elements.push({
    type: 'image', track: 1, source: s.imageUrl, time: t, duration: dur,
    animations: i > 0 ? [{ time: 0, duration: FADE, easing: 'quadratic-out', type: 'fade' }] : undefined,
  })
  elements.push({ type: 'audio', track: 2, source: s.audioUrl, time: t, duration: s.duration })
  t += dur
})

const r = await fetch('https://api.creatomate.com/v1/renders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    source: { output_format: 'mp4', width: 1920, height: 1080, duration: t, elements },
    metadata: JSON.stringify({ videoId, userId, deductedCost: 0 }),
  }),
})
const data = await r.json()
const render = Array.isArray(data) ? data[0] : data
console.log('resubmit:', r.status, '| render id:', render?.id, '| format:', render?.output_format)
