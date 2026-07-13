/**
 * Fetch dark bokeh backdrops (photos + a video loop) from Pexels for the
 * commercial demo. Picks the darkest results so white text stays legible.
 * Run: npx tsx scripts/fetch-pexels-bg.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public')
const KEY = process.env.PEXELS_API_KEY!

async function getJson(url: string) {
  const r = await fetch(url, { headers: { Authorization: KEY } })
  if (!r.ok) throw new Error(`${r.status} ${await r.text().then(t => t.slice(0, 120))}`)
  return r.json()
}
async function download(url: string, file: string) {
  const r = await fetch(url)
  writeFileSync(join(OUT, file), Buffer.from(await r.arrayBuffer()))
  const kb = Math.round((await (await fetch(url)).arrayBuffer()).byteLength / 1024)
  console.log(`  saved ${file} (${kb} KB)`)
}

async function main() {
  // Photos: dark bokeh — grab a handful, keep the 3 that are landscape + large.
  const photo = await getJson('https://api.pexels.com/v1/search?query=dark%20bokeh%20lights%20blur&orientation=landscape&per_page=12')
  const picks = (photo.photos || []).filter((p: any) => p.width >= p.height).slice(0, 3)
  for (let i = 0; i < picks.length; i++) {
    const src = picks[i].src.large2x || picks[i].src.large
    await download(src, `pexels-bg-${i + 1}.jpg`)
    console.log(`  bg-${i + 1} by ${picks[i].photographer} (Pexels ${picks[i].id})`)
  }
  // Video: one slow bokeh loop, HD.
  try {
    const vid = await getJson('https://api.pexels.com/videos/search?query=bokeh%20particles%20dark&orientation=landscape&per_page=8')
    const v = (vid.videos || []).find((x: any) => x.duration >= 6 && x.duration <= 30)
    const f = v?.video_files?.filter((x: any) => x.width <= 1920).sort((a: any, b: any) => b.width - a.width)[0]
    if (f) { await download(f.link, 'pexels-bg-loop.mp4'); console.log(`  loop by ${v.user?.name} (Pexels ${v.id}, ${v.duration}s)`) }
    else console.warn('  no suitable video found')
  } catch (e) { console.warn('  video fetch skipped:', e instanceof Error ? e.message : e) }
  console.log('done')
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
