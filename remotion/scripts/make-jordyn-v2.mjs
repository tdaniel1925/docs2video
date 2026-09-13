/**
 * JORDYN v2 — build every asset for both cuts.
 *
 * Reads the beat sheet (scripts/jordyn-beats.mjs) and fetches or generates
 * whatever each shot needs, then writes two plans: the long film and the
 * 45-second cut.
 *
 * WHAT COSTS WHAT, and why the mix is this way:
 *
 *   stock      free   real 1080p footage of real people. Carries the problem
 *                     and the urgency, because both are about a person's day.
 *   product    free   the app's own screenshots, copied from the Jordyn repo.
 *                     A claim about software should show the software.
 *   built      free   drawn in Remotion at render time. ALL the numbers live
 *                     here — a generated image cannot be trusted with a figure,
 *                     and the payback number is the most important frame in
 *                     the film.
 *   anim       ~$1    illustration animated by image-to-video. Three shots
 *                     only: the turn, the stakes, the trust beat. Those are
 *                     ideas rather than things, so there is nothing to film.
 *
 * The short cut reuses every one of these. Only its narration is new, which
 * is a few cents, so the second film is effectively free.
 */

import fs from 'fs'
import path from 'path'
import { ACTS, MUSIC, VOICE, shotList, shortList } from './jordyn-beats.mjs'

const ROOT = 'C:/dev/1 - PrismGraphs'
const JORDYN_REPO = 'C:/dev/1 - jordyn 2026'
const envVal = (k) => {
  const m = fs.readFileSync(`${ROOT}/.env.local`, 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'))
  if (!m) throw new Error(`${k} not set`)
  return m[1].trim()
}
const FAL = envVal('FAL_KEY')
const GEMINI = envVal('GEMINI_API_KEY')
const PEXELS = envVal('PEXELS_API_KEY')

const OUT = path.resolve('public/commercials/jordyn-v2')
const log = (...a) => console.log(...a)
const only = process.argv[2]   // 'stock' | 'anim' | 'voice' | 'product' — for reruns

/** The house style, repeated VERBATIM in every illustration call. */
const STYLE = 'Warm editorial illustration, near-white cream ground (#faf9f5 to #FDFAF5), deep clay terracotta accent (#c96442), muted sage green (#7d8c6f), warm ink (#3d3929) used sparingly for depth only. Soft natural light, generous negative space, calm and premium, modern editorial magazine style, gentle grain, delicate line work. 16:9. NO text, NO letters, NO numbers, NO words, NO logos, NO user interface.'

/* ── fal queue ───────────────────────────────────────────────────────────
 * The queue accepts an invalid body with a 200 and then reports COMPLETED.
 * The real outcome is only in the RESULT's http status, so every wait below
 * checks that rather than trusting the status field.
 */
const falQueue = async (model, body) => {
  const r = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${FAL}` },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok || !j.request_id) throw new Error(JSON.stringify(j).slice(0, 160))
  return j.request_id
}
const falWait = async (model, id) => {
  const base = model.split('/').slice(0, 2).join('/')
  for (let i = 0; i < 220; i++) {
    await new Promise((r) => setTimeout(r, 4000))
    const s = await fetch(`https://queue.fal.run/${base}/requests/${id}/status`, { headers: { authorization: `Key ${FAL}` } })
    const sj = await s.json().catch(() => ({}))
    if (sj.status === 'COMPLETED') {
      const res = await fetch(`https://queue.fal.run/${base}/requests/${id}`, { headers: { authorization: `Key ${FAL}` } })
      const rj = await res.json()
      if (res.status !== 200) throw new Error(`${res.status}: ${JSON.stringify(rj).slice(0, 160)}`)
      return rj
    }
    if (sj.status === 'FAILED') throw new Error('job failed')
  }
  throw new Error('timed out')
}
const grab = async (url, file) => {
  fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()))
  return path.basename(file)
}

/* ── stock footage ───────────────────────────────────────────────────────
 *
 * One clip per distinct query. Several shots share a query (the same footage
 * cut twice with different framing is normal in a commercial), so this
 * deduplicates before fetching — 41 stock shots come from 23 searches.
 */
const stockFile = (q) => `stock-${q.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.mp4`

async function fetchStock(queries) {
  const done = {}
  for (const [i, q] of queries.entries()) {
    const file = path.join(OUT, stockFile(q))
    if (fs.existsSync(file) && fs.statSync(file).size > 50_000) { done[q] = path.basename(file); continue }
    try {
      const r = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=6&orientation=landscape&size=medium`,
        { headers: { Authorization: PEXELS } })
      if (!r.ok) throw new Error(`search ${r.status}`)
      const vids = (await r.json()).videos || []
      if (!vids.length) throw new Error('no results')
      /* prefer a clip long enough to cut from, and around 1080p rather than
         a 4K file that costs minutes to download for a 1.2 second shot */
      const v = vids.find((x) => x.duration >= 6) ?? vids[0]
      const files = (v.video_files || []).filter((f) => f.file_type === 'video/mp4')
      const hd = files.filter((f) => f.height >= 1000 && f.height <= 1200).sort((a, b) => a.height - b.height)
      const pick = hd[0] ?? files.sort((a, b) => b.width - a.width)[0]
      if (!pick) throw new Error('no mp4')
      done[q] = await grab(pick.link, file)
      log(`  ${i + 1}/${queries.length} ${q.slice(0, 44)}`)
    } catch (e) {
      log(`  FAIL ${q.slice(0, 40)} — ${e.message.slice(0, 60)}`)
    }
  }
  return done
}

/* ── product screenshots ─────────────────────────────────────────────────
 * Copied out of the Jordyn repo rather than re-shot. These are the real UI.
 */
function copyProduct(files) {
  const done = {}
  for (const f of files) {
    const src = path.join(JORDYN_REPO, 'public/marketing', f)
    const dst = path.join(OUT, f)
    if (!fs.existsSync(src)) { log(`  MISSING ${f}`); continue }
    fs.copyFileSync(src, dst)
    done[f] = f
  }
  /* the logo, for the open and the CTA */
  const logo = path.join(JORDYN_REPO, 'public/logo.png')
  if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(OUT, 'logo.png'))
  return done
}

/* ── the three animated shots ────────────────────────────────────────────
 *
 * Still first, then image-to-video on that exact frame. Anchoring to an
 * approved still is what keeps the look consistent — text-to-video invents a
 * new scene each call and the clips will not cut together.
 */
const I2V = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'

async function still(name, prompt) {
  const file = path.join(OUT, `${name}.png`)
  if (fs.existsSync(file) && fs.statSync(file).size > 20_000) return file
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI}`
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${STYLE} Scene: ${prompt}` }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
        }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const j = await r.json()
      const img = (j.candidates?.[0]?.content?.parts || []).find((q) => q.inlineData?.data)
      if (!img) throw new Error('no image')
      fs.writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'))
      return file
    } catch (e) {
      if (a === 2) { log(`  FAIL still ${name} — ${e.message}`); return null }
      await new Promise((z) => setTimeout(z, 2500))
    }
  }
}

async function animate(name, stillPath, motion) {
  const file = path.join(OUT, `${name}.mp4`)
  if (fs.existsSync(file) && fs.statSync(file).size > 200_000) return path.basename(file)
  const b64 = fs.readFileSync(stillPath).toString('base64')
  const id = await falQueue(I2V, { prompt: motion, image_url: `data:image/png;base64,${b64}`, duration: '5' })
  const out = await falWait(I2V, id)
  if (!out.video?.url) throw new Error('no video in result')
  return grab(out.video.url, file)
}

/* ── run ─────────────────────────────────────────────────────────────────── */
const run = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const LONG = shotList({})
  const SHORT = shortList()
  const ALL = [...LONG, ...SHORT]

  /* 1 — stock, deduplicated */
  const queries = [...new Set(ALL.filter((s) => s.kind === 'stock').map((s) => s.q))]
  let stock = {}
  if (!only || only === 'stock') {
    log(`\n— stock footage: ${queries.length} searches for ${ALL.filter((s) => s.kind === 'stock').length} shots`)
    stock = await fetchStock(queries)
    log(`  ${Object.keys(stock).length}/${queries.length} fetched`)
  }

  /* 2 — product screens */
  const pfiles = [...new Set(ALL.filter((s) => s.kind === 'product').map((s) => s.file))]
  let product = {}
  if (!only || only === 'product') {
    log(`\n— product screenshots: ${pfiles.length}`)
    product = copyProduct(pfiles)
    log(`  ${Object.keys(product).length}/${pfiles.length} copied`)
  }

  /* 3 — the three animated shots */
  const ANIMS = {
    turn: {
      prompt: 'Warm morning light flooding into a calm cream room through a tall arched window, a clay-coloured desk neat and ready, a small sage plant, everything in order and waiting. Optimistic, warm, uncluttered, full bleed edge to edge.',
      motion: 'Slow confident cinematic push-in as warm light strengthens across the room. Dust motes drift gently. Nothing else moves. No people, no new objects, no text.',
    },
    stakes: {
      prompt: 'Two clean paths diverging across a wide calm cream ground, one rising confidently upward in deep clay terracotta, the other flattening out in pale sage. Editorial, graphic, generous negative space, full bleed edge to edge, NO border, NO frame.',
      motion: 'The frame drifts slowly upward following the rising path as the two separate further apart. Calm and inevitable. No people, no new objects, no text.',
    },
    trust: {
      prompt: 'A single deep clay terracotta envelope resting alone and perfectly centred on a wide cream surface, one clean soft shadow beneath it, enormous calm negative space all around. FULL BLEED, the cream runs edge to edge, NO border, NO frame, NO mat, NO mounted print.',
      motion: 'A very slow drift that gradually decelerates and comes to a complete deliberate rest. The light settles. Absolutely nothing else moves. No people, no new objects, no text.',
    },
  }
  const anim = {}
  if (!only || only === 'anim') {
    log('\n— animated shots: 3')
    for (const [name, a] of Object.entries(ANIMS)) {
      const sp = await still(name, a.prompt)
      if (!sp) continue
      try { anim[name] = await animate(name, sp, a.motion); log(`  ok ${name}`) }
      catch (e) { log(`  FAIL ${name} — ${e.message.slice(0, 70)} (still will be used)`); anim[name] = null }
    }
  }

  /* 4 — narration, both cuts */
  const voice = {}
  if (!only || only === 'voice') {
    const lines = []
    LONG.forEach((s, i) => { if (s.vo) lines.push({ key: `L${i}`, vo: s.vo }) })
    SHORT.forEach((s, i) => { if (s.vo) lines.push({ key: `S${i}`, vo: s.vo }) })
    log(`\n— narration: ${lines.length} lines`)
    const jobs = []
    for (const ln of lines) {
      const f = path.join(OUT, `vo-${ln.key}.mp3`)
      if (fs.existsSync(f) && fs.statSync(f).size > 3000) { voice[ln.key] = path.basename(f); continue }
      jobs.push({ ...ln, id: await falQueue(VOICE.model, { text: ln.vo, voice: VOICE.voice, stability: VOICE.stability }) })
    }
    for (const j of jobs) {
      try {
        const out = await falWait(VOICE.model, j.id)
        const u = out.audio?.url ?? out.audio_url?.url
        voice[j.key] = await grab(u, path.join(OUT, `vo-${j.key}.mp3`))
      } catch (e) { log(`  FAIL vo ${j.key} — ${e.message.slice(0, 60)}`) }
    }
    log(`  ${Object.keys(voice).length}/${lines.length} spoken`)
  }

  /* 5 — music */
  let music = null
  const mfile = path.join(OUT, 'music.mp3')
  if (fs.existsSync(mfile) && fs.statSync(mfile).size > 100_000) music = 'music.mp3'
  else if (!only || only === 'voice') {
    log('\n— music')
    try {
      const id = await falQueue('fal-ai/elevenlabs/music', { prompt: MUSIC.prompt, music_length_ms: MUSIC.ms })
      const out = await falWait('fal-ai/elevenlabs/music', id)
      music = await grab(out.audio?.url ?? out.audio_url?.url, mfile)
      log('  ok')
    } catch (e) { log(`  FAIL music — ${e.message.slice(0, 70)}`) }
  }

  /* 6 — the plans. Real durations read off the audio, never estimated. */
  const { execFileSync } = await import('child_process')
  const dur = (f) => {
    try {
      /* execFileSync, not a shell: the path contains spaces and going through
         a shell silently lost the argument once, defaulting every line */
      return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
        '-of', 'csv=p=0', path.join(OUT, f)]).toString().trim()) || null
    } catch { return null }
  }

  const buildPlan = (list, prefix, name) => ({
    name,
    music,
    bpm: MUSIC.bpm,
    shots: list.map((s, i) => {
      const voKey = s.vo ? `${prefix}${i}` : null
      return {
        kind: s.kind,
        act: s.act,
        hold: s.hold,
        key: Boolean(s.key),
        line: s.line ?? null,
        accent: s.accent ?? null,
        see: s.see ?? null,
        build: s.build ?? null,
        /* whichever asset this shot plays */
        src: s.kind === 'stock' ? (stock[s.q] ?? null)
          : s.kind === 'product' ? (product[s.file] ?? s.file ?? null)
            : s.kind === 'anim' ? (anim[s.reuse ?? 'turn'] ?? `${s.reuse ?? 'turn'}.png`)
              : null,
        /* a still fallback when a clip failed, so one bad job never costs the shot */
        poster: s.kind === 'anim' ? `${s.reuse ?? 'turn'}.png` : null,
        vo: s.vo ?? null,
        voFile: voKey && voice[voKey] ? voice[voKey] : null,
        voSecs: voKey && voice[voKey] ? dur(voice[voKey]) : null,
      }
    }),
  })

  /* the anim shots in the long cut are named by act order, not by `reuse` */
  const NAME_BY_ACT = { 'what-she-is': 'turn', 'why-now': 'stakes', close: 'trust' }
  const fixAnim = (plan) => {
    for (const s of plan.shots) {
      if (s.kind !== 'anim') continue
      const n = NAME_BY_ACT[s.act] ?? 'turn'
      s.src = anim[n] ?? `${n}.png`
      s.poster = `${n}.png`
    }
    return plan
  }

  const longPlan = fixAnim(buildPlan(LONG, 'L', 'jordyn-v2'))
  const shortPlan = fixAnim(buildPlan(SHORT, 'S', 'jordyn-v2'))
  fs.writeFileSync(path.join(OUT, 'plan-long.json'), JSON.stringify(longPlan, null, 2))
  fs.writeFileSync(path.join(OUT, 'plan-short.json'), JSON.stringify(shortPlan, null, 2))

  const sum = (p) => p.shots.reduce((a, s) => a + s.hold, 0)
  log(`\n— plans written`)
  log(`  long  ${longPlan.shots.length} shots, ${sum(longPlan).toFixed(0)}s, ${longPlan.shots.filter((s) => s.src).length} with assets`)
  log(`  short ${shortPlan.shots.length} shots, ${sum(shortPlan).toFixed(0)}s, ${shortPlan.shots.filter((s) => s.src).length} with assets`)
}

run().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
