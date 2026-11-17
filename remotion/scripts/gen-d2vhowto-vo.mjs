// Docs2Video 'Make your first video' how-to narration, through fal.ai:
//   1. ONE continuous take: fal-ai/elevenlabs/tts/eleven-v3 (voice Sarah)
//   2. word timings + transcript check: fal-ai/elevenlabs/speech-to-text
// Writes public/showcase/d2vhowto/vo.mp3, vo.json (per-beat start/end) and transcript.txt.
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
import { writeFileSync } from 'fs'
const FAL = process.env.FAL_KEY
const DIR = 'public/showcase/d2vhowto'
const SEGMENTS = [
  "[warm] Welcome to Docs2Video. Let's make your first video together. It takes about five minutes of your time.",
  "On Home, pick how you'd like to start. Most people start with a document, like a quote, an illustration, or a policy summary.",
  "Drop in your file, and press Read it. Reading it is free.",
  "In a few seconds, you'll see the main point of your video, and the numbers it will use. Remove anything you don't want, or ask for a change in plain words.",
  "Pick how long it should be, and the story is written for you.",
  "Next, your brand. Add your name, your role, and a photo, so your client knows it's from you.",
  "Add how to reach you. It's saved, so you only do this once.",
  "Now, choose a look. Pick one of the templates, or open My looks for the 3D styles. Press Free preview to see your first scene.",
  "On Scenes, read each one. Press Edit to change what the voice says.",
  "Pick a voice. Press play to hear it, and turn music on or off.",
  "The opening introduces you, and the closing shows your client how to reach you.",
  "Last, check everything on one page, and press Make it. Your video is ready in about ten minutes. You can close the page. We'll email you.",
  "Then type your client's email, and press Send. They watch it on a page in your brand, and you'll see when they do.",
  "[warm] That's it. Go make your first one.",
]
const queue = async (model, body) => {
  const r = await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${FAL}` }, body: JSON.stringify(body) })
  const j = await r.json(); if (!r.ok) throw new Error(model + ' ' + JSON.stringify(j).slice(0, 300)); return j
}
const wait = async (q) => {
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const s = await (await fetch(q.status_url, { headers: { authorization: `Key ${FAL}` } })).json()
    if (s.status === 'COMPLETED') return (await fetch(q.response_url, { headers: { authorization: `Key ${FAL}` } })).json()
    if (s.status === 'FAILED' || s.error) throw new Error('fal failed ' + JSON.stringify(s).slice(0, 300))
  }
  throw new Error('fal timed out')
}
const tts = await wait(await queue('fal-ai/elevenlabs/tts/eleven-v3', { text: SEGMENTS.join('\n\n'), voice: 'Sarah', stability: 0.5 }))
const url = tts.audio?.url; if (!url) throw new Error('no audio ' + JSON.stringify(tts).slice(0, 300))
writeFileSync(`${DIR}/vo.mp3`, Buffer.from(await (await fetch(url)).arrayBuffer()))
const stt = await wait(await queue('fal-ai/elevenlabs/speech-to-text', { audio_url: url, language_code: 'eng' }))
const words = (stt.words || []).filter((w) => (w.type ?? 'word') === 'word')
writeFileSync(`${DIR}/transcript.txt`, stt.text || '')
// align: walk the script words in order and match them to the transcript words
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')
let wi = 0; const segs = []; const misses = []
for (const seg of SEGMENTS) {
  const body = seg.replace(/^\[[^\]]+\]\s*/, '')
  const want = body.split(/\s+/).map(norm).filter(Boolean)
  let first = null, last = null
  for (const t of want) {
    let k = wi; while (k < words.length && k < wi + 6 && norm(words[k].text) !== t) k++
    if (k < words.length && norm(words[k].text) === t) { first ??= words[k]; last = words[k]; wi = k + 1 } else misses.push(t)
  }
  segs.push({ start: first?.start ?? null, end: last?.end ?? null, text: body })
}
const total = words.at(-1)?.end ?? null
writeFileSync(`${DIR}/vo.json`, JSON.stringify({ via: 'fal-ai/elevenlabs/tts/eleven-v3', voice: 'Sarah', total, segments: segs, misses }, null, 2))
console.log('vo ok', total, 's · words', words.length, '· script words not heard as written:', misses.length, misses.slice(0, 20).join(' '))
for (const s of segs) console.log(s.start?.toFixed(2), '-', s.end?.toFixed(2), s.text.slice(0, 50))
