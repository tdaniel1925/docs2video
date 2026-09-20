// One-shot: repair the garbled narration lines the compliance name-scrub left
// behind (dropped words → the voice stumbles), re-record ONLY the fixed scenes,
// re-time their blocks, and re-render. Reuses every other scene's VO + all assets.
// Overwrites the same video id so the link stays stable.
//
// Run ON THE VPS:  cd /root/video-service && node fix-narration-rerender.js
const { createClient } = require('@supabase/supabase-js')
const { join } = require('path')
const { spawn, execFile } = require('child_process')
const { readFile, writeFile, mkdir, rm } = require('fs/promises')
const WebSocket = require('ws')
const { ttsTimed, cueSec } = require('./slides')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const REMOTION_DIR = join(__dirname, 'remotion')
const FPS = 30

const USER_ID = '17d8c77a-868d-4961-a6a3-07f1e8b12aee'
const VIDEO_ID = 'bd2e471b-17eb-45f5-8059-ebc40aaa3142'

// scene id -> repaired narration (approved). Only these get re-recorded.
const FIX = {
  1: "Renee, thank you for letting Michele de Vahle share this illustration summary with you. Life insurance can feel confusing, so let's sort it out together. This is a plain-language walk through your options, so you can compare and choose with confidence.",
  3: "Let's line the three up side by side. One's an affordable start that expires, one grows slowly, and one builds value over time.",
  4: "Term is the easiest place to start because it's the most affordable. The trade-off is that it covers you for a set period and then it expires, leaving you without protection unless you renew.",
  6: "Then there's growing coverage, and this is where things get interesting. It doesn't expire, and it can build cash value you may be able to tap into down the road.",
  8: "Coverage can also include living benefits, which means you don't have to pass away for the policy to help you. Under qualifying circumstances, you may be able to access a portion of your benefit while you're still living.",
  9: "Life changes, and your coverage should be able to change with it. This kind of policy offers flexibility, so you can adjust your protection as your family, income, and goals evolve.",
  10: "To make this real, your advisor can prepare an illustration, a starting-point example that shows how the numbers might look for you. Just remember these figures are hypothetical and illustrated only.",
  11: "The upside here is long-term. Coverage is designed to build over years and decades, so the earlier you start, the more time your policy has to grow.",
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false }, realtime: { transport: WebSocket } })
  const pub = join(REMOTION_DIR, 'public')
  const staged = []
  await mkdir(pub, { recursive: true }); await mkdir(join(REMOTION_DIR, 'out'), { recursive: true })

  // 1) fetch persisted plan
  const planKey = `${USER_ID}/${VIDEO_ID}_plan.json`
  const planDl = await sb.storage.from('videos').download(planKey)
  if (planDl.error || !planDl.data) throw new Error('no saved plan')
  const saved = JSON.parse(Buffer.from(await planDl.data.arrayBuffer()).toString('utf8'))
  const plan = saved.plan

  // 2) re-record ONLY the fixed scenes; re-time their blocks against new timings
  for (const s of plan.scenes) {
    const fixed = FIX[s.id]
    if (!fixed) continue
    console.log(`scene ${s.id}: re-recording…`)
    s.narration = fixed
    const voName = `dir-vo-${s.id}.mp3`
    const outPath = join(pub, voName)
    const timed = await ttsTimed(fixed, outPath)   // ElevenLabs, same voice
    staged.push(outPath)
    const durF = Math.round(timed.durationSec * FPS)
    for (const b of (s.blocks || [])) {
      const items = b.type === 'bullets' ? b.items : b.type === 'cards' ? b.cards : null
      if (!items) continue
      items.forEach((it, i) => {
        if (it && it.cue) { const cs = cueSec(timed.words, it.cue); it.cueFrame = cs == null ? Math.round(12 + (durF - 24) * (i / Math.max(1, items.length))) : Math.round(cs * FPS) }
        else if (it && typeof it.cueFrame === 'number') it.cueFrame = Math.min(it.cueFrame, Math.max(12, durF - 20))
      })
    }
    // upload the new per-scene VO so future edits/renders reuse it
    const vb = await readFile(outPath)
    await sb.storage.from('videos').upload(`${USER_ID}/${VIDEO_ID}_${voName}`, vb, { contentType: 'audio/mpeg', upsert: true })
  }

  // 3) pull the OTHER scenes' VO + music + backdrops (unchanged clips)
  const pull = async (storageName, localName) => {
    if (staged.some((p) => p.endsWith(localName))) return true  // already have the fresh one
    try { const dl = await sb.storage.from('videos').download(`${USER_ID}/${storageName}`); if (dl.data) { const p = join(pub, localName); await writeFile(p, Buffer.from(await dl.data.arrayBuffer())); staged.push(p); return true } } catch {} return false
  }
  for (const s of plan.scenes) if (!FIX[s.id]) await pull(`${VIDEO_ID}_dir-vo-${s.id}.mp3`, `dir-vo-${s.id}.mp3`)
  if (!(await pull(`${VIDEO_ID}_dir-music.mp3`, 'dir-music.mp3'))) {
    const mp = join(pub, 'dir-music.mp3'); await new Promise((res, rej) => execFile('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '5', '-q:a', '9', mp], { timeout: 30000 }, (e) => e ? rej(e) : res())); staged.push(mp)
  }
  if (plan.chrome && plan.chrome.logo) await pull(`${VIDEO_ID}_${plan.chrome.logo}`, plan.chrome.logo)
  if (plan.presenter && plan.presenter.photo) await pull(`${VIDEO_ID}_${plan.presenter.photo}`, plan.presenter.photo)
  for (const s of plan.scenes) { if (s.backdrop) await pull(`${VIDEO_ID}_${s.backdrop}`, s.backdrop) }
  console.log('assets staged:', staged.length)

  // 4) write plan as --props + render
  const PROPS = join(pub, `dv-${VIDEO_ID}-narrfix-props.json`)
  await writeFile(PROPS, JSON.stringify({ plan })); staged.push(PROPS)
  const reOut = join(REMOTION_DIR, 'out', `${VIDEO_ID}-narrfix.mp4`)
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

  // 5) upload over same id + persist patched plan
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
