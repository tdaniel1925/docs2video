/**
 * JORDYN — THE FILM. Stills that move.
 *
 * Two things are different here from every commercial this repo has built.
 *
 * ONE: THE SCRIPT CAME FIRST. Every previous script was written one line per
 * picture, so each line was built to caption a shot rather than to follow the
 * sentence before it. That is why they read as sound bites — the lines were
 * freely interchangeable, which is proof no argument was being made. This
 * script was written as continuous prose around a single claim and only then
 * broken into beats. The full reasoning is in scripts/writing/jordyn-script.md
 * and it is worth reading before changing a word here.
 *
 * TWO: THE HERO SHOTS ACTUALLY MOVE. A still is generated, approved, and then
 * sent to an image-to-video model which animates THAT EXACT FRAME. This is the
 * technique behind the cinematic AI films — not text-to-video, which invents a
 * new scene every call and produces clips that will not cut together.
 * Proven before this file was written: a slow push-in held the illustration
 * style across all five seconds with no warping and nothing invented.
 *
 * Only three of the eleven beats are animated. A clip is ~$1 against ~12c for
 * a still, and more importantly a film where everything drifts is worse than
 * one where three moments move and the rest are held. The three chosen are the
 * ones carrying the argument: the promise, the turn, and the landing.
 */

import fs from 'fs'
import path from 'path'

const ENV = 'C:/dev/1 - PrismGraphs/.env.local'
const envVal = (k) => {
  const m = fs.readFileSync(ENV, 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'))
  if (!m) throw new Error(`${k} not found in .env.local`)
  return m[1].trim()
}
const FAL = envVal('FAL_KEY')
const GEMINI = envVal('GEMINI_API_KEY')

const OUT = path.resolve('public/commercials/jordyn-film')
const log = (...a) => console.log(...a)

/**
 * THE LOOK — read off jordyn.app, not invented.
 *
 * The last paper film was told to match the site and did not: it used dark ink
 * grounds when the site is near-white, which is most of why it "did not have
 * the same look and feel as the jordyn website". These are the site's own
 * values — cream grounds, clay accent, sage, warm ink for depth ONLY.
 *
 * Repeated VERBATIM in every call. Changing one word between calls is how a
 * set of stills stops looking like one film.
 */
const STYLE = 'Warm editorial illustration, near-white cream ground (#F8F8F8 to #FDFAF5), deep clay terracotta accent (#B5563A), muted sage green, warm ink (#2B2320) used sparingly for depth only. Soft natural light, generous negative space, calm and premium, modern editorial magazine style, gentle grain, delicate line work. Nothing harsh, nothing dark, nothing cluttered. 16:9. NO text, NO letters, NO numbers, NO words, NO logos, NO user interface, NO screens with content.'

/**
 * THE BEATS.
 *
 * `vo` is the script, split at its natural sentence breaks — the prose was
 * written first and cut here, rather than each line being written to fit a
 * picture.
 *
 * `line` / `accent` are drawn in Remotion, never in the image: image models
 * cannot spell reliably, and every previous film that tried has had gibberish
 * somewhere in it.
 *
 * `move` marks the three shots sent for animation. See the note at the top.
 */
const BEATS = [
  {
    vo: 'It is not that you have too much to do. It is that all of it has to go through you.',
    line: 'All of it goes through you',
    accent: 'through you',
    move: false,
    shot: 'A single small desk seen from a distance in a large calm near-white room, one warm clay-coloured chair, soft morning light from a tall arched window casting a long gentle shadow. Everything in the composition funnels toward that one desk. Quiet, spacious, slightly lonely.',
  },
  {
    vo: 'Sixty emails, and four of them matter.',
    line: 'Sixty. Four matter.',
    accent: 'Four',
    move: false,
    shot: 'A tall precarious stack of pale cream paper envelopes on a desk, four of them in deep clay terracotta scattered through the middle of the pile, almost lost. Soft side light, shallow depth, generous empty space above the stack.',
  },
  {
    vo: 'The invoice you never sent. The client who went quiet, and you have not noticed yet.',
    line: 'The one you missed',
    accent: 'missed',
    move: false,
    shot: 'A cream paper document lying alone and forgotten under the edge of a desk, half in shadow, a thin shaft of light just missing it. Sage green floor, warm ink shadow. Melancholy, still, understated.',
  },
  {
    vo: 'So you have thought about help.',
    line: 'So you thought about help',
    accent: 'help',
    move: false,
    shot: 'Two empty chairs facing each other across a calm near-white room, one warm clay, one pale cream, a soft pool of window light between them. Nobody in either. Spacious, hopeful, unresolved.',
  },
  {
    vo: 'And then you have thought about what help costs. Not the salary. The six weeks of explaining. The things sent in your name before they knew what your name meant.',
    line: 'Six weeks of explaining',
    accent: 'Six weeks',
    move: false,
    shot: 'A calendar-like grid of six pale sage squares stretching across a cream wall, each one slightly heavier and more shadowed than the last, a small clay figure shape at the far end looking small against them. Abstract, editorial, patient.',
  },
  {
    vo: 'That is the real reason you are still doing it yourself.',
    line: 'That is the real reason',
    accent: 'real reason',
    move: false,
    shot: 'A lone clay-coloured chair pulled up close to a desk in a wide empty cream room, seen from behind and slightly above, the room enormous around it. One small warm lamp. Resigned, quiet, human.',
  },
  {
    /* MOVES — the promise. The film turns from problem to answer here, and a
       camera that begins to move as it does carries that turn physically. */
    vo: "Jordyn starts already knowing your business. Your industry's words on the first day.",
    line: 'She arrives already knowing',
    accent: 'already knowing',
    move: true,
    motion: 'Extremely slow, gentle cinematic push-in toward the centre of the frame. Warm light strengthens almost imperceptibly across the scene. Dust motes drift slowly. Everything else stays perfectly still. No people appear, no new objects, no text.',
    shot: 'Warm morning light flooding into a calm cream room through a tall arched window, a clay-coloured desk now neat and ready, a small sage plant, everything in order and waiting. Optimistic, warm, uncluttered, the light itself the subject.',
  },
  {
    vo: 'She works the whole inbox overnight, so the four that matter are waiting on top.',
    line: 'Sorted before your coffee',
    accent: 'before your coffee',
    move: false,
    shot: 'The same tall stack of pale cream envelopes, now neatly squared and calm, with exactly four deep clay terracotta envelopes resting cleanly on top of the pile. Soft morning light, orderly, satisfying, generous space around it.',
  },
  {
    vo: 'She writes the chase you keep putting off. She answers the phone in your name, and books the appointment while they are still talking.',
    line: 'Written. Answered. Booked.',
    accent: 'Booked.',
    move: false,
    shot: 'Three simple clay and sage paper shapes arranged in a confident left-to-right rhythm across a cream ground — a folded letter, a rounded handset silhouette, a small marked square — each casting a soft shadow. Clean, editorial, rhythmic. No text of any kind.',
  },
  {
    /* MOVES — the turn. Three words, and the whole film pivots on them. Motion
       arriving at stillness is the one idea this shot has to carry, which is
       something a static frame genuinely cannot do. */
    vo: 'And then she stops.',
    line: 'And then she stops.',
    accent: 'stops',
    move: true,
    motion: 'A very slow drift that gradually decelerates and comes to a complete, deliberate rest. The light settles. Absolutely nothing else moves. No people, no new objects, no text.',
    shot: 'A single deep clay terracotta envelope resting alone and perfectly centred on a wide empty cream surface, one clean soft shadow beneath it, enormous calm negative space all around. Held, deliberate, waiting. Poster-like.',
  },
  {
    vo: 'Every email she writes is a draft until you press send. Every single one.',
    line: 'Nothing sends without you',
    accent: 'without you',
    move: false,
    shot: 'A calm cream surface with one clay-coloured rounded rectangle shape sitting in the lower right, clearly waiting to be touched, soft shadow beneath. Minimal, confident, generous space. No text, no letters, no interface.',
  },
  {
    /* MOVES — the landing. The claim resolves here and the frame should breathe
       rather than cut dead on a static image. */
    vo: 'She does the work. You keep the last word.',
    line: 'You keep the last word',
    accent: 'last word',
    move: true,
    motion: 'An extremely slow, barely perceptible pull-back revealing a little more of the calm room. Warm light holds steady. Everything is still and settled. No people, no new objects, no text.',
    shot: 'A wide calm cream room at golden hour, one clay chair pushed neatly in at a tidy desk, warm low light across the floor, a sense of the day being finished and in order. Generous empty space in the lower centre. Peaceful, premium, final.',
  },
]

/* ── fal queue helpers ────────────────────────────────────────────────────
 *
 * NOTE ON THE QUEUE: submitting returns 200 with a request_id even for an
 * invalid body, and the status endpoint then reports COMPLETED. The real
 * outcome is only visible in the RESULT's http status — a 422 there carries
 * the validation detail. So every helper below checks the result status and
 * never treats COMPLETED as proof of success.
 */
const falQueue = async (model, body) => {
  const r = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Key ${FAL}` },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok || !j.request_id) throw new Error(JSON.stringify(j).slice(0, 180))
  return j.request_id
}

const falWait = async (model, id, tries = 200) => {
  const base = model.split('/').slice(0, 2).join('/')
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 4000))
    const s = await fetch(`https://queue.fal.run/${base}/requests/${id}/status`, { headers: { authorization: `Key ${FAL}` } })
    const sj = await s.json().catch(() => ({}))
    if (sj.status === 'COMPLETED') {
      const res = await fetch(`https://queue.fal.run/${base}/requests/${id}`, { headers: { authorization: `Key ${FAL}` } })
      const rj = await res.json()
      /* COMPLETED is not success — see the note above. */
      if (res.status !== 200) throw new Error(`${res.status}: ${JSON.stringify(rj).slice(0, 180)}`)
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

/* ── the still ────────────────────────────────────────────────────────────── */
const paperScene = async (i, what) => {
  const file = path.join(OUT, `scene-${i + 1}.png`)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI}`
  /* STYLE first and verbatim every time — the consistency depends on it. */
  const prompt = `${STYLE} Scene: ${what}`
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
        }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      const j = await r.json()
      const img = (j.candidates?.[0]?.content?.parts || []).find((q) => q.inlineData?.data)
      if (!img) throw new Error('no image in response')
      fs.writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'))
      return file
    } catch (e) {
      if (a === 2) { log(`  FAIL scene ${i + 1} — ${e.message}`); return null }
      await new Promise((res) => setTimeout(res, 2500))
    }
  }
}

/* ── the still, moved ─────────────────────────────────────────────────────── */
const I2V = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'

/**
 * Animate one approved still.
 *
 * The prompt describes the CAMERA and nothing else. Asking for action invites
 * the model to invent objects and people, which is what breaks the frame —
 * measured before this was written: a camera-only prompt held the illustration
 * style across the whole clip with no warping at all.
 */
const animate = async (i, stillPath, motion) => {
  const b64 = fs.readFileSync(stillPath).toString('base64')
  const id = await falQueue(I2V, {
    prompt: motion,
    image_url: `data:image/png;base64,${b64}`,
    duration: '5',
  })
  const out = await falWait(I2V, id)
  const u = out.video?.url
  if (!u) throw new Error('no video in result')
  return grab(u, path.join(OUT, `clip-${i + 1}.mp4`))
}

/* ── run ──────────────────────────────────────────────────────────────────── */
const run = async () => {
  fs.mkdirSync(OUT, { recursive: true })

  log(`\n— drawing ${BEATS.length} stills`)
  const scenes = await Promise.all(BEATS.map((b, i) => paperScene(i, b.shot)))
  log(`  ${scenes.filter(Boolean).length}/${BEATS.length} drawn`)

  /* THE THREE THAT MOVE. Sequential rather than parallel: each is a couple of
     minutes and a dollar, and a failure that takes the other two with it is
     worse than waiting. */
  log(`\n— animating ${BEATS.filter((b) => b.move).length} hero shots`)
  const clips = []
  for (const [i, b] of BEATS.entries()) {
    if (!b.move || !scenes[i]) continue
    try {
      clips[i] = await animate(i, scenes[i], b.motion)
      log(`  ok clip ${i + 1}`)
    } catch (e) {
      /* A held still is a perfectly good shot. Losing the whole film because
         one clip failed is not acceptable on work that costs real money. */
      log(`  FAIL clip ${i + 1} — ${e.message.slice(0, 90)} (falling back to the still)`)
    }
  }

  log('\n— voice and music')
  const voJobs = []
  for (const [i, b] of BEATS.entries()) {
    /* Higher stability than the edge cut. This film is calm and considered;
       the flat hard read that suited "the perfect employee" would fight it. */
    voJobs.push({ i, id: await falQueue('fal-ai/elevenlabs/tts/eleven-v3', { text: b.vo, voice: 'Rachel', stability: 0.7 }) })
  }

  /* MUSIC IS GENERATED FIRST SO THE CUTS CAN FOLLOW IT. The last film cut on
     2.71s and 6.69s against a 119 BPM track — arbitrary numbers driven by
     voice length alone, which is exactly why it felt thrown together. */
  const musicId = await falQueue('fal-ai/elevenlabs/music', {
    prompt: 'Warm, calm, unhurried underscore at 84 BPM with a clear steady pulse. Felt piano and soft sustained strings, gentle and premium, quietly confident rather than dramatic. Builds very slightly in the final third and resolves. No vocals, no percussion hits. 80 seconds.',
    music_length_ms: 80000,
  })

  const vo = []
  for (const job of voJobs) {
    try {
      const out = await falWait('fal-ai/elevenlabs/tts/eleven-v3', job.id)
      const u = out.audio?.url ?? out.audio_url?.url
      vo[job.i] = await grab(u, path.join(OUT, `vo-${job.i + 1}.mp3`))
      log(`  ok vo ${job.i + 1}`)
    } catch (e) { log(`  FAIL vo ${job.i + 1} — ${e.message.slice(0, 80)}`) }
  }

  let music = null
  try {
    const out = await falWait('fal-ai/elevenlabs/music', musicId)
    const u = out.audio?.url ?? out.audio_url?.url
    music = await grab(u, path.join(OUT, 'music.mp3'))
    log('  ok music')
  } catch (e) { log(`  FAIL music — ${e.message.slice(0, 80)}`) }

  const { execSync, execFileSync } = await import('child_process')
  if (music) {
    try {
      execSync(`node scripts/beatgrid.mjs "${path.join(OUT, 'music.mp3')}" "${path.join(OUT, 'beatgrid.json')}"`, { cwd: process.cwd() })
      log('  beat grid written')
    } catch (e) { log(`  no beat grid: ${e.message.slice(0, 80)}`) }
  }

  const plan = {
    name: 'jordyn-film',
    style: 'jordyn',
    music,
    beats: BEATS.map((b, i) => ({
      line: b.line, accent: b.accent, vo: b.vo, figure: null,
      scene: scenes[i] ? path.basename(scenes[i]) : null,
      /* A clip when we have one, the still underneath when we do not. */
      clip: clips[i] ?? null,
      voFile: vo[i] ?? null,
    })),
    voDurations: BEATS.map((_, i) => {
      if (!vo[i]) return 3.5
      try {
        /* execFileSync, not execSync: the path has spaces in it ("1 - PrismGraphs")
           and going through a shell silently lost the argument once, so every
           line fell back to the default and the whole film cut to nothing. */
        const d = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(OUT, vo[i])]).toString().trim()
        return Number(d) || 3.5
      } catch { return 3.5 }
    }),
  }
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan, null, 2))

  const total = plan.voDurations.reduce((a, b) => a + b, 0)
  log(`\n— plan written. ${total.toFixed(0)}s of narration, ${clips.filter(Boolean).length} moving shots.`)
}

run().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
