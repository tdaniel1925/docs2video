// One-shot: fix broken on-screen HEADINGS the name-scrub left ("An Starting Point"
// → "A Starting Point", "Long- Upside" → "The Long-Term Upside"). Headings don't
// affect audio, so ALL existing VO is reused as-is — no re-recording. Same id.
const { createClient } = require('@supabase/supabase-js')
const { join } = require('path')
const { spawn, execFile } = require('child_process')
const { readFile, writeFile, mkdir, rm } = require('fs/promises')
const WebSocket = require('ws')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const REMOTION_DIR = join(__dirname, 'remotion')
const USER_ID = '17d8c77a-868d-4961-a6a3-07f1e8b12aee'
const VIDEO_ID = 'bd2e471b-17eb-45f5-8059-ebc40aaa3142'

// scene id -> corrected heading
const HFIX = { 10: 'A Starting Point', 11: 'The Long-Term Upside' }

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const pub = join(REMOTION_DIR, 'public')
  const staged = []
  await mkdir(pub, { recursive: true }); await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })

  const planKey = `${USER_ID}/${VIDEO_ID}_plan.json`
  const planDl = await sb.storage.from('videos').download(planKey)
  if (planDl.error || !planDl.data) throw new Error('no saved plan')
  const saved = JSON.parse(Buffer.from(await planDl.data.arrayBuffer()).toString('utf8'))
  const plan = saved.plan

  for (const s of plan.scenes) {
    if (HFIX[s.id] && s.layout) { console.log(`scene ${s.id}: "${s.layout.heading}" -> "${HFIX[s.id]}"`); s.layout.heading = HFIX[s.id] }
  }

  const pull = async (storageName, localName) => {
    try { const dl = await sb.storage.from('videos').download(`${USER_ID}/${storageName}`); if (dl.data) { const p = join(pub, localName); await writeFile(p, Buffer.from(await dl.data.arrayBuffer())); staged.push(p); return true } } catch {} return false
  }
  for (const s of plan.scenes) await pull(`${VIDEO_ID}_dir-vo-${s.id}.mp3`, `dir-vo-${s.id}.mp3`)
  if (!(await pull(`${VIDEO_ID}_dir-music.mp3`, 'dir-music.mp3'))) {
    const mp = join(pub, 'dir-music.mp3'); await new Promise((res, rej) => execFile('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '5', '-q:a', '9', mp], { timeout: 30000 }, (e) => e ? rej(e) : res())); staged.push(mp)
  }
  if (plan.chrome && plan.chrome.logo) await pull(`${VIDEO_ID}_${plan.chrome.logo}`, plan.chrome.logo)
  if (plan.presenter && plan.presenter.photo) await pull(`${VIDEO_ID}_${plan.presenter.photo}`, plan.presenter.photo)
  for (const s of plan.scenes) { if (s.backdrop) await pull(`${VIDEO_ID}_${s.backdrop}`, s.backdrop) }
  console.log('assets staged:', staged.length)

  const PROPS = join(pub, `dv-${VIDEO_ID}-headfix-props.json`)
  await writeFile(PROPS, JSON.stringify({ plan })); staged.push(PROPS)
  const reOut = join(REMOTION_DIR, 'out', `${VIDEO_ID}-headfix.mp4`)
  console.log('rendering…')
  await new Promise((resolve, reject) => {
    const child = spawn('npx', ['remotion', 'render', 'DirectedVideo', reOut, `--props=${PROPS}`, '--log=info', '--concurrency=8', '--gl=swiftshader', '--image-format=jpeg'], { cwd: REMOTION_DIR, env: { ...process.env } })
    let buf = ''
    const onChunk = (b) => { const t = b.toString(); buf = (buf + t).slice(-2000); const m = [...t.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop(); if (m) process.stdout.write(`\r  frame ${m[1]}/${m[2]}   `) }
    child.stdout.on('data', onChunk); child.stderr.on('data', onChunk)
    child.on('error', (e) => reject(new Error(`render: ${e.message}`)))
    child.on('close', (c) => { process.stdout.write('\n'); c === 0 ? resolve() : reject(new Error(`render exit ${c}: ${buf.slice(-300)}`)) })
  })
  staged.push(reOut)

  const vbuf = await readFile(reOut)
  await sb.storage.from('videos').upload(`${USER_ID}/${VIDEO_ID}.mp4`, vbuf, { contentType: 'video/mp4', upsert: true })
  const { data: urlData } = sb.storage.from('videos').getPublicUrl(`${USER_ID}/${VIDEO_ID}.mp4`)
  saved.plan = plan
  await sb.storage.from('videos').upload(planKey, Buffer.from(JSON.stringify(saved)), { contentType: 'application/json', upsert: true })
  await sb.from('videos').update({ status: 'completed', video_url: urlData.publicUrl, progress_pct: 100, progress_detail: null }).eq('id', VIDEO_ID)
  console.log('DONE ->', urlData.publicUrl)
  for (const f of staged) await rm(f, { force: true }).catch(() => {})
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
