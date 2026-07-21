// Fetch one cinematic Pexels stock clip per beat for the pexels cinematic trailer.
// Downloads best landscape MP4 (~1080p) to public/pexels/f-<i>.mp4. Reuses cine2 VO+music.
import { readFileSync, existsSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const OUT = join(HERE, '..', 'public', 'pexels'); mkdirSync(OUT, { recursive: true })
const FORCE = process.env.FORCE === '1'
const env = {}; for (const f of ['.env.local', '.env']) { for (const base of [ROOT, join(HERE, '..')]) { const p = join(base, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } } }
const KEY = env.PEXELS_API_KEY
const log = (...a) => console.log('[pexels]', ...a)
try { copyFileSync(join(HERE, '..', 'public', 'apex', 'logo.png'), join(OUT, 'logo.png')) } catch {}

// One search query per beat, matching the cine2 grounded-aspirational shot list.
// picks: which result index to prefer (variety / avoid dupes)
const QUERIES = [
  { q: 'person sunrise window contemplative', pick: 0 },        // 0 decision
  { q: 'runner training dawn determined', pick: 0 },            // 1 ready to begin
  { q: 'confident businessman walking city', pick: 0 },         // 2 forward energy
  { q: 'diverse team working together office', pick: 0 },       // 3 connection
  { q: 'business handshake rooftop sunset', pick: 0 },          // 4 partnership
  { q: 'opening door bright light', pick: 0 },                  // 5 opportunity
  { q: 'person mountain summit sunrise success', pick: 0 },     // 6 achievement
  { q: 'creative planning ideas wall office', pick: 0 },        // 7 ambition
  { q: 'crowd people walking together sunrise', pick: 0 },      // 8 rise together
]

async function search(q) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=8&orientation=landscape&size=medium`
  const r = await fetch(url, { headers: { Authorization: KEY } })
  if (!r.ok) throw new Error(`search ${r.status}`)
  const j = await r.json()
  return j.videos || []
}
function bestFile(v) {
  // prefer a ~1080p h264 mp4, not huge
  const files = v.video_files.filter((f) => f.file_type === 'video/mp4')
  const hd = files.filter((f) => f.height >= 1080 && f.height <= 1440).sort((a, b) => a.height - b.height)
  return (hd[0] || files.sort((a, b) => b.width - a.width)[0])
}
async function download(fileUrl, out) {
  const r = await fetch(fileUrl)
  if (!r.ok) throw new Error(`dl ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  writeFileSync(out, buf)
  return buf.length
}

const usedIds = new Set()
for (let i = 0; i < QUERIES.length; i++) {
  const out = join(OUT, `f-${i}.mp4`)
  if (!FORCE && existsSync(out)) { log(`f-${i} cached`); continue }
  const { q, pick } = QUERIES[i]
  try {
    const vids = await search(q)
    // choose first not-yet-used video (variety), starting at `pick`
    let chosen = null
    for (let k = pick; k < vids.length; k++) { if (!usedIds.has(vids[k].id)) { chosen = vids[k]; break } }
    if (!chosen) chosen = vids[0]
    if (!chosen) { log(`f-${i} NO RESULTS for "${q}"`); continue }
    usedIds.add(chosen.id)
    const file = bestFile(chosen)
    const kb = Math.round((await download(file.link, out)) / 1024)
    log(`f-${i} "${q}" -> id ${chosen.id} ${file.width}x${file.height} ${chosen.duration}s (${kb}KB)`)
  } catch (e) { log(`f-${i} FAIL: ${e.message}`) }
  await new Promise((s) => setTimeout(s, 400))
}
log('PEXELS FETCH DONE')
