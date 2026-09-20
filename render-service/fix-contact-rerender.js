// One-shot: re-render an existing slide-deck video with ONLY the closing contact
// fixed (chrome.footer + cta.contact were "docs2video.com"/null → the agent's real
// contact). Reuses the persisted plan + ALL existing VO clips + backdrops — no
// regeneration, no AI rewriting. Overwrites the same video id so the link is stable.
//
// Run ON THE VPS:  cd /root/video-service && node fix-contact-rerender.js
const { createClient } = require('@supabase/supabase-js')
const { join } = require('path')
const { spawn, execFile } = require('child_process')
const { readFile, writeFile, mkdir, rm } = require('fs/promises')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
const REMOTION_DIR = join(__dirname, 'remotion')

// --- the video to fix + the real contact to stamp on the closing slide ---
const USER_ID = '17d8c77a-868d-4961-a6a3-07f1e8b12aee'
const VIDEO_ID = 'bd2e471b-17eb-45f5-8059-ebc40aaa3142'   // the GOOD redo (overlap fixed)
const CONTACT = '1-813-546-3452 | mdevahle@gmail.com'      // Michele's real contact (matches her original closing)

async function main() {
  const WebSocket = require('ws')
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const pub = join(REMOTION_DIR, 'public')
  const staged = []
  await mkdir(pub, { recursive: true }); await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })

  // 1) fetch the persisted plan
  const planKey = `${USER_ID}/${VIDEO_ID}_plan.json`
  const planDl = await sb.storage.from('videos').download(planKey)
  if (planDl.error || !planDl.data) throw new Error('no saved plan')
  const saved = JSON.parse(Buffer.from(await planDl.data.arrayBuffer()).toString('utf8'))
  const plan = saved.plan

  // 2) THE FIX — swap the closing contact only. Nothing else changes.
  console.log('BEFORE  chrome.footer =', JSON.stringify(plan.chrome && plan.chrome.footer), '| cta.contact =', JSON.stringify(plan.cta && plan.cta.contact))
  if (!plan.chrome) plan.chrome = {}
  plan.chrome.footer = CONTACT
  if (!plan.cta) plan.cta = {}
  plan.cta.contact = CONTACT
  console.log('AFTER   chrome.footer =', JSON.stringify(plan.chrome.footer), '| cta.contact =', JSON.stringify(plan.cta.contact))

  // 3) pull every asset the render needs, under the EXACT plan filenames
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
  console.log('pulled', staged.length, 'assets')

  // 4) write plan as --props + render DirectedVideo (same flags as the app)
  const PROPS = join(pub, `dv-${VIDEO_ID}-contactfix-props.json`)
  await writeFile(PROPS, JSON.stringify({ plan })); staged.push(PROPS)
  const reOut = join(REMOTION_DIR, 'out', `${VIDEO_ID}-contactfix.mp4`)
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

  // 5) upload over the same id (link stays stable) + persist the patched plan
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
