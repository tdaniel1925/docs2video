/**
 * JORDYN — THE DRAWN CUT. 47 seconds, every frame illustrated.
 *
 * WHY THIS EXISTS. The stock-footage version was rejected, correctly. The
 * numbers say why: 41 stock shots came from 23 clips, and 18 of those shots
 * were the SAME CLIP PLAYING AGAIN — some three times over. When a line of
 * narration ran longer than its shots, the builder padded it by cycling back
 * through footage already on screen. That is the "thrown together" feeling,
 * and it was structural rather than bad luck.
 *
 * THE RULE HERE IS ABSOLUTE: one shot, one drawing, never reused. 27 shots,
 * 27 separate images. If a line needs more time, it gets another DRAWING, not
 * the last one again.
 *
 * Everything moves. At 2:45 that would be $67 and half a day; at 47 seconds
 * it is about $30, which is cheap enough to simply do rather than compromise
 * over. The thing Trent liked about the last cut was the way the custom
 * drawings moved — so this is that, for the whole film.
 *
 * CONSISTENCY ACROSS 27 SEPARATE GENERATIONS is the hard part. Two things
 * hold it: the STYLE block and the FIGURE block are repeated VERBATIM in
 * every single call, and the figure has no face. A faceless silhouette cannot
 * drift the way features do — proven on the paper-cut film, where the same
 * figure held across eight independently generated scenes.
 */

import fs from 'fs'
import path from 'path'

const ROOT = 'C:/dev/1 - PrismGraphs'
const JORDYN_REPO = 'C:/dev/1 - jordyn 2026'
const envVal = (k) => {
  const m = fs.readFileSync(`${ROOT}/.env.local`, 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'))
  if (!m) throw new Error(`${k} not set`)
  return m[1].trim()
}
const FAL = envVal('FAL_KEY')
const GEMINI = envVal('GEMINI_API_KEY')

const OUT = path.resolve('public/commercials/jordyn-drawn')
const log = (...a) => console.log(...a)
const stage = process.argv[2]

/**
 * THE LOOK — jordyn.app's own palette, verbatim in every call.
 *
 * Changing a single word between calls is how a set of drawings stops looking
 * like one film.
 */
const STYLE = 'Warm editorial cut-paper illustration. Near-white cream ground (#faf9f5), deep clay terracotta (#c96442), muted sage green (#7d8c6f), warm ink (#3d3929) for depth only. Soft directional light casting gentle shadows between layers, generous negative space, calm and premium, modern editorial magazine style, delicate line work, subtle paper grain. FULL BLEED — the artwork fills the entire frame edge to edge. NO border, NO frame, NO mat, NO mounted print. 16:9. NO text, NO letters, NO numbers, NO words, NO logos, NO readable interface.'

/**
 * THE FIGURE — faceless on purpose.
 *
 * Drawn faces drift between separately generated images: the same "person"
 * comes back with a different nose, and at a cut every 1.5 seconds a viewer
 * notices. A silhouette has nothing to drift. It also reads as "any business
 * owner" rather than one specific woman, which is the right reading for a
 * film addressed to "you".
 */
const FIGURE = 'The recurring figure is a cut-paper silhouette in deep clay terracotta with NO facial features and no visible face, confident posture, always mid-motion. She is the boldest shape in the frame; everything around her is cream and sage.'

/**
 * THE 27 SHOTS.
 *
 * The script is the 47-second cut, unchanged — it was not the problem. What
 * changes is that every shot now names its OWN drawing. No two entries below
 * describe the same picture.
 *
 * `hold` is seconds. `motion` is the camera, never new events: asking a video
 * model for action invites it to invent objects that break the frame, which
 * was measured before any of this was built.
 */
const SHOTS = [
  /* ── open on the brand ─────────────────────────────────────────────── */
  { id: 'logo', kind: 'logo', hold: 1.8, see: 'The mark, the sparkle' },

  /* ── the problem: one person doing four jobs ───────────────────────── */
  {
    id: 'serving', hold: 1.15,
    vo: 'You are the salesperson, the scheduler, the bookkeeper and the receptionist.',
    line: 'All four jobs', accent: 'four',
    draw: 'A clay paper figure leaning across a cream shop counter handing something to a second smaller sage paper figure, warm side light, a simple counter and shelf behind. Busy but calm, generous space above.',
    motion: 'Very slow push-in toward the counter. Light steadies. Nothing else moves.',
  },
  {
    id: 'calendar', hold: 1.15,
    draw: 'The clay paper figure seen from behind facing a large cream wall grid of empty sage squares, one hand raised to place a small clay marker into a square. Clean, graphic, generous negative space.',
    motion: 'Slow drift to the right across the wall grid. The figure holds still.',
  },
  {
    id: 'paperwork', hold: 1.15,
    draw: 'The clay paper figure hunched over a cream desk buried under overlapping pale sage paper sheets and receipts spilling toward the viewer, warm raking light, long shadows.',
    motion: 'Slow push-in over the spilling paper toward the figure. Nothing else moves.',
  },
  {
    id: 'phone-answer', hold: 1.15,
    draw: 'The clay paper figure holding an angular sage paper telephone handset to where an ear would be, sharp paper sound-wave shards radiating outward in clean diagonals across a cream ground.',
    motion: 'Slow pull-back revealing more of the radiating shards. Calm and steady.',
  },

  /* ── the volume ────────────────────────────────────────────────────── */
  {
    id: 'inbox-flood', hold: 1.3,
    vo: 'Sixty emails a day. The phone never stops. And it is all on you.',
    line: 'All on you', accent: 'on you',
    draw: 'A towering precarious stack of pale cream paper envelopes filling most of the frame, four of them deep clay terracotta scattered through the middle and almost lost, the small clay figure dwarfed at the base of the stack.',
    motion: 'Very slow upward drift along the stack, as if looking up it. Nothing else moves.',
  },
  {
    id: 'phone-ignored', hold: 1.3,
    draw: 'A single sage paper telephone alone on a wide empty cream surface, bright concentric paper rings pulsing outward from it, nobody there to answer. Stark, generous negative space.',
    motion: 'Extremely slow push-in on the telephone. The light settles. Nothing else moves.',
  },
  {
    id: 'late', hold: 1.3,
    draw: 'The clay paper figure small and alone at a desk in a wide cream room, one warm pool of lamp light around her, the rest of the room falling into soft sage shadow. Evening, quiet, still working.',
    motion: 'Very slow pull-back widening the empty room around the figure. Nothing else moves.',
  },

  /* ── KEY: the turn ─────────────────────────────────────────────────── */
  {
    id: 'turn', hold: 3.0, key: true,
    vo: 'Jordyn is an AI employee for your business.',
    line: 'An AI employee', accent: 'AI employee',
    draw: 'Warm morning light flooding through a tall arched window into a calm cream room, a clay desk neat and ready, a small sage plant, everything in order and waiting. Optimistic, warm, uncluttered, the light itself the subject.',
    motion: 'Slow confident cinematic push-in as the warm light strengthens across the room. Dust motes drift gently. Nothing else moves.',
  },

  /* ── what she does ─────────────────────────────────────────────────── */
  {
    id: 'inbox-sorted', hold: 1.45,
    vo: 'She works your inbox, answers your phone, and chases every invoice until it is paid.',
    line: 'Inbox. Phone. Invoices.', accent: 'Invoices',
    draw: 'The same tall stack of cream paper envelopes, now neatly squared and calm, with exactly four deep clay terracotta envelopes resting cleanly on top. Soft morning light, orderly and satisfying.',
    motion: 'Slow push-in toward the four clay envelopes on top. Calm and settled.',
  },
  {
    id: 'she-answers', hold: 1.45,
    draw: 'A confident clay paper silhouette holding an angular sage telephone, a small cream paper calendar page floating beside her with one square marked in clay. Clean diagonal composition, bright cream ground.',
    motion: 'Gentle drift toward the floating calendar page. The figure holds still.',
  },
  {
    id: 'invoice-chase', hold: 1.45,
    draw: 'A single clay paper document flying forward across a cream ground leaving a clean trailing arc behind it, a sage paper coin shape waiting ahead of it. Kinetic, graphic, purposeful.',
    motion: 'Slow push following the flying document forward. Nothing else moves.',
  },

  /* ── the economics ─────────────────────────────────────────────────── */
  {
    id: 'weeks-gone', hold: 1.6,
    vo: 'Eight hours a week on email. Ten working weeks a year, gone.',
    line: 'Ten weeks, gone', accent: 'gone',
    draw: 'A wide cream wall covered in a neat grid of small pale sage paper squares, with ten of them in deep clay lifting up and away out of the grid, leaving clean empty gaps behind. Editorial, graphic, generous space.',
    motion: 'Very slow upward drift following the lifting clay squares. The grid holds still.',
  },
  {
    id: 'weeks-clock', hold: 1.4,
    draw: 'A large cream paper clock face with no hands on a wide cream ground, a thick clay paper wedge cut out of it and lifted away, leaving a clean gap. Bold, graphic, generous negative space.',
    motion: 'Slow push-in on the lifted clay wedge. The clock face holds still.',
  },
  {
    id: 'weeks-pile', hold: 1.4,
    draw: 'A neat stack of ten clay paper rectangles resting on a wide cream surface beside a much larger stack of pale sage ones, clear scale contrast, soft shadows. Editorial and calm.',
    motion: 'Slow lateral drift from the clay stack across to the sage. Steady.',
  },
  {
    id: 'hire-stack', hold: 1.6,
    vo: 'Hiring it out costs fifty thousand and up.',
    line: 'Or hire at $50k+', accent: '$50k+',
    draw: 'A tall precarious column of stacked pale sage paper blocks towering up out of frame on a cream ground, a tiny clay figure standing at its base looking up. Dramatic scale contrast, long shadow.',
    motion: 'Slow upward tilt along the towering column. Nothing else moves.',
  },

  /* ── KEY: the payback, as a drawing ────────────────────────────────── */
  {
    id: 'payback-art', hold: 1.4,
    draw: 'A small confident clay paper block sitting beside the base of that same towering sage column, tiny against it but bright and solid, warm light falling on the small block only. Cream ground, generous space.',
    motion: 'Slow push-in on the small clay block as the light strengthens on it.',
  },
  {
    id: 'coin-return', hold: 1.3,
    draw: 'Five small sage paper coin shapes arranged in a clean arc returning toward a single clay paper block on a cream ground, orderly and purposeful. Graphic, generous space.',
    motion: 'Gentle drift along the arc of returning coins toward the clay block.',
  },
  { id: 'payback', kind: 'built', build: 'payback', hold: 3.2, key: true,
    vo: 'She costs four ninety-nine a month, and pays for herself in five working days.',
    see: 'THE MONEY SHOT — typed, never drawn' },

  /* ── why now ───────────────────────────────────────────────────────── */
  {
    id: 'pace-1', hold: 1.0,
    vo: 'Business is getting faster.',
    line: 'Business is getting faster', accent: 'faster',
    draw: 'Many small clay and sage paper figures streaming fast across a wide cream ground in the same direction, motion-blurred trailing paper shapes behind them. Kinetic, urgent, graphic.',
    motion: 'Fast lateral drift following the streaming figures. Energetic.',
  },
  {
    id: 'pace-2', hold: 1.0,
    draw: 'A dense field of angular clay and sage paper arrows all pointing forward and to the right across a cream ground, tightly packed and overlapping, strong diagonal momentum.',
    motion: 'Quick push forward through the arrow field. Driving.',
  },
  {
    id: 'pace-3', hold: 1.0,
    draw: 'A clean clay paper line climbing steeply upward across a wide cream ground, small sage paper markers falling away below it. Sharp, confident, graphic.',
    motion: 'Fast upward drift following the climbing line. Rising.',
  },
  {
    id: 'answered-first', hold: 1.5,
    vo: 'Your competitors answer in minutes, and the customer who waits goes elsewhere.',
    line: 'Whoever answers first', accent: 'first',
    draw: 'Two cream paper doorways side by side, one with a bright warm clay figure stepping through it toward the viewer, the other empty and dim in sage shadow. Clear contrast, editorial composition.',
    motion: 'Slow push toward the bright clay doorway. The dim one holds still.',
  },
  {
    id: 'waiting', hold: 1.5,
    draw: 'A lone sage paper figure standing and waiting beside a cream counter with nobody behind it, one long shadow stretching across an empty floor. Still, patient, slightly cold.',
    motion: 'Very slow pull-back widening the empty space around the waiting figure.',
  },

  /* ── KEY: the stakes ───────────────────────────────────────────────── */
  {
    id: 'stakes', hold: 2.8, key: true,
    vo: 'Get there while it is still an advantage.',
    line: 'While it is still an advantage', accent: 'advantage',
    draw: 'Two clean paths diverging across a wide calm cream ground, one rising confidently upward in deep clay terracotta, the other flattening out in pale sage. Editorial, graphic, generous negative space.',
    motion: 'The frame drifts slowly upward following the rising clay path as the two separate further. Calm and inevitable.',
  },

  /* ── KEY: the trust beat ───────────────────────────────────────────── */
  {
    id: 'trust', hold: 2.8, key: true,
    vo: 'And nothing sends without you. Ever.',
    line: 'Nothing sends without you', accent: 'without you',
    draw: 'A single deep clay terracotta envelope resting alone and perfectly centred on a wide cream surface, one clean soft shadow beneath it, enormous calm negative space all around. Held, deliberate, waiting.',
    motion: 'A very slow drift that gradually decelerates to a complete deliberate rest. The light settles. Absolutely nothing else moves.',
  },
  {
    id: 'hand-waiting', hold: 1.5,
    draw: 'A clay paper figure seated calmly at a cream desk with one hand resting beside a single sage paper card, unhurried, in control. Warm light, generous space, quiet confidence.',
    motion: 'Extremely slow push-in toward the resting hand and the card. Settled.',
  },

  /* ── the setup ─────────────────────────────────────────────────────── */
  {
    id: 'brain', hold: 1.5,
    vo: 'Type your industry. Her brain builds in thirty seconds.',
    line: 'Type your industry', accent: 'your industry',
    draw: 'Small clay and sage paper shapes flying inward from all sides and assembling into one clean rounded clay form at the centre of a cream ground, mid-assembly, precise and purposeful.',
    motion: 'Slow push-in on the assembling centre form as the pieces settle inward.',
  },
  {
    id: 'connected', hold: 1.5,
    draw: 'Four clean sage paper cards arranged in a confident row across a cream ground, each connected to a central clay paper shape by a simple clean line. Orderly, graphic, generous space.',
    motion: 'Gentle lateral drift across the row of connected cards. Steady.',
  },

  /* ── the ask ───────────────────────────────────────────────────────── */
  { id: 'cta', kind: 'cta', hold: 3.6, key: true,
    vo: 'Four ninety-nine a month. Fourteen days free. Jordyn dot app.',
    see: 'LOGO + CTA' },
]

/* ── fal ─────────────────────────────────────────────────────────────────
 * The queue answers 200 to an invalid body and then reports COMPLETED; the
 * real outcome is only in the RESULT's http status.
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
      if (res.status !== 200) throw new Error(`${res.status}: ${JSON.stringify(rj).slice(0, 150)}`)
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

/** One drawing. STYLE and FIGURE go in verbatim, every time. */
async function drawOne(id, what) {
  const file = path.join(OUT, `${id}.png`)
  if (fs.existsSync(file) && fs.statSync(file).size > 20_000) return file
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI}`
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${STYLE} ${FIGURE} Scene: ${what}` }] }],
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
      if (a === 2) { log(`  FAIL draw ${id} — ${e.message}`); return null }
      await new Promise((z) => setTimeout(z, 2500))
    }
  }
}

const I2V = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'

async function animateOne(id, stillPath, motion) {
  const file = path.join(OUT, `${id}.mp4`)
  if (fs.existsSync(file) && fs.statSync(file).size > 200_000) return path.basename(file)
  const b64 = fs.readFileSync(stillPath).toString('base64')
  const req = await falQueue(I2V, {
    prompt: `${motion} No people appear or disappear, no new objects, no text, no letters, no numbers.`,
    image_url: `data:image/png;base64,${b64}`,
    duration: '5',
  })
  const out = await falWait(I2V, req)
  if (!out.video?.url) throw new Error('no video')
  return grab(out.video.url, file)
}

/* ── run ─────────────────────────────────────────────────────────────────── */
const run = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const logo = path.join(JORDYN_REPO, 'public/logo.png')
  if (fs.existsSync(logo)) fs.copyFileSync(logo, path.join(OUT, 'logo.png'))

  const drawn = SHOTS.filter((s) => s.draw)

  /* 1 — the drawings, in parallel: each is ~20s and they do not depend on
     each other, so 27 sequential calls would be nine wasted minutes */
  if (!stage || stage === 'draw') {
    log(`\n— drawing ${drawn.length} scenes (every shot its own image, zero reuse)`)
    const made = await Promise.all(drawn.map((s) => drawOne(s.id, s.draw)))
    log(`  ${made.filter(Boolean).length}/${drawn.length} drawn`)
  }

  /* 2 — animate every one of them. Sequential: each is ~2.5 min and a
     failure that took the others with it would be expensive. */
  const clips = {}
  if (!stage || stage === 'anim') {
    log(`\n— animating ${drawn.length} (about ${(drawn.length * 2.5 / 60).toFixed(1)}h)`)
    for (const [i, s] of drawn.entries()) {
      const still = path.join(OUT, `${s.id}.png`)
      if (!fs.existsSync(still)) { log(`  skip ${s.id} — no still`); continue }
      try {
        clips[s.id] = await animateOne(s.id, still, s.motion)
        log(`  ${i + 1}/${drawn.length} ${s.id}`)
      } catch (e) {
        /* the still is a perfectly good shot; losing the film to one failed
           job is not acceptable on work that costs real money */
        log(`  FAIL ${s.id} — ${e.message.slice(0, 60)} (still will be used)`)
      }
    }
  }

  /* 3 — narration and music */
  const voice = {}
  let music = null
  if (!stage || stage === 'audio') {
    const lines = SHOTS.filter((s) => s.vo)
    log(`\n— narration: ${lines.length} lines`)
    const jobs = []
    for (const s of lines) {
      const f = path.join(OUT, `vo-${s.id}.mp3`)
      if (fs.existsSync(f) && fs.statSync(f).size > 3000) { voice[s.id] = path.basename(f); continue }
      jobs.push({ id: s.id, req: await falQueue('fal-ai/elevenlabs/tts/eleven-v3', { text: s.vo, voice: 'Rachel', stability: 0.42 }) })
    }
    for (const j of jobs) {
      try {
        const out = await falWait('fal-ai/elevenlabs/tts/eleven-v3', j.req)
        voice[j.id] = await grab(out.audio?.url ?? out.audio_url?.url, path.join(OUT, `vo-${j.id}.mp3`))
      } catch (e) { log(`  FAIL vo ${j.id}`) }
    }
    log(`  ${Object.keys(voice).length}/${lines.length} spoken`)

    const mfile = path.join(OUT, 'music.mp3')
    if (fs.existsSync(mfile) && fs.statSync(mfile).size > 100_000) music = 'music.mp3'
    else {
      log('— music')
      try {
        const id = await falQueue('fal-ai/elevenlabs/music', {
          prompt: 'Confident modern corporate underscore at 122 BPM. Driving but warm — a clear steady pulse, bright plucked synth and muted guitar over a soft kick, optimistic and forward-moving, the feeling of a business accelerating. Builds through the middle, drops to almost nothing near the end, then returns for the final statement. Premium, never frantic. No vocals. 55 seconds.',
          music_length_ms: 55000,
        })
        const out = await falWait('fal-ai/elevenlabs/music', id)
        music = await grab(out.audio?.url ?? out.audio_url?.url, mfile)
        log('  ok')
      } catch (e) { log(`  FAIL music — ${e.message.slice(0, 60)}`) }
    }
  }

  /* 4 — the plan, with real measured audio lengths */
  const { execFileSync } = await import('child_process')
  const dur = (f) => {
    try {
      return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
        '-of', 'csv=p=0', path.join(OUT, f)]).toString().trim()) || null
    } catch { return null }
  }
  const has = (f) => fs.existsSync(path.join(OUT, f))

  const plan = {
    name: 'jordyn-drawn',
    music: music ?? (has('music.mp3') ? 'music.mp3' : null),
    shots: SHOTS.map((s) => {
      const vf = voice[s.id] ?? (has(`vo-${s.id}.mp3`) ? `vo-${s.id}.mp3` : null)
      return {
        id: s.id,
        kind: s.kind ?? 'drawn',
        build: s.build ?? null,
        hold: s.hold,
        key: Boolean(s.key),
        line: s.line ?? null,
        accent: s.accent ?? null,
        see: s.see ?? null,
        /* the clip if it animated, the still underneath if it did not */
        src: s.draw ? (has(`${s.id}.mp4`) ? `${s.id}.mp4` : has(`${s.id}.png`) ? `${s.id}.png` : null) : null,
        poster: s.draw ? `${s.id}.png` : null,
        vo: s.vo ?? null,
        voFile: vf,
        voSecs: vf ? dur(vf) : null,
      }
    }),
  }
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan, null, 2))

  const moving = plan.shots.filter((s) => s.src?.endsWith('.mp4')).length
  log(`\n— plan written`)
  log(`  ${plan.shots.length} shots, ${plan.shots.reduce((a, s) => a + s.hold, 0).toFixed(0)}s`)
  log(`  ${moving} animated, ${plan.shots.filter((s) => s.src?.endsWith('.png')).length} held stills`)
  log(`  unique drawings: ${new Set(plan.shots.filter((s) => s.src).map((s) => s.src)).size} — reuse is impossible by construction`)
}

run().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
