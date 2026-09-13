/**
 * THE COMMERCIAL GENERATOR — a business in, a finished film out.
 *
 * One instruction, six stages, no hand-tuning. It reads a business, writes a
 * script, writes its own shot list, generates footage and voice and music in
 * parallel, reads the beat grid off the music it just made, and hands the
 * whole plan to Remotion to render.
 *
 * THE DIVISION OF LABOUR IS THE WHOLE IDEA.
 *
 * fal generates the WORLD — moving footage, a voice, a score. Remotion owns
 * every WORD — the headline, the price, the logo, the call to action. That is
 * not a stylistic choice: generated video cannot spell. Left to itself it
 * writes "Cdnsanr Pruerhe" on a flyer, which is a fatal defect for a design
 * company's advert and a bad one for anybody else. So the model is never
 * asked to draw text at all, and every legible word in the finished film is
 * real type rendered at 1080p.
 *
 * It also means the same film can be re-rendered in another language, or with
 * a different price, without regenerating a single frame.
 *
 *   node scripts/make-commercial.mjs jordyn.app
 *   node scripts/make-commercial.mjs "a family dental practice in Tupelo"
 */

import fs from 'fs'
import path from 'path'

/* ── keys ────────────────────────────────────────────────────────────────── */
const ENV = 'C:/dev/1 - PrismGraphs/.env.local'
const envVal = (k) => {
  const m = fs.readFileSync(ENV, 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'))
  if (!m) throw new Error(`${k} not found in ${ENV}`)
  return m[1].trim()
}
const FAL = envVal('FAL_KEY')
const GEMINI = (() => { try { return envVal('GEMINI_API_KEY') } catch { return null } })()
const ANTHROPIC = envVal('ANTHROPIC_API_KEY')

const STYLE_ARG = (process.argv.find((a) => a.startsWith('--style=')) || '').split('=')[1]
/** 'live' films the world; 'paper' builds it out of cut paper. */
const STYLE = STYLE_ARG === 'paper' ? 'paper' : 'live'

const SLUG = (process.argv[2] || '').trim()
if (!SLUG) throw new Error('pass a website or a description')
const NAME = SLUG.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
const OUT = path.resolve(`public/commercials/${NAME}`)

const log = (...a) => console.log(...a)

/* ── 1. READ THE BUSINESS ────────────────────────────────────────────────── */
/**
 * A URL gets fetched and stripped to text; a plain description is used as
 * given. Either way the model only ever sees words — it is writing a script,
 * not judging a design.
 */
const readBusiness = async () => {
  if (!/\./.test(SLUG) || /\s/.test(SLUG)) return { about: SLUG, url: null }
  const url = SLUG.startsWith('http') ? SLUG : `https://${SLUG}`
  try {
    const html = await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })).text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000)
    return { about: text, url }
  } catch {
    return { about: SLUG, url }
  }
}

/* ── 2 + 3. THE SCRIPT AND THE SHOT LIST, IN ONE CALL ────────────────────── */
/**
 * Written together on purpose. A script produced without knowing what can be
 * filmed yields lines nothing can illustrate ("our proprietary workflow
 * engine"), and a shot list written after the fact ends up decorating them.
 * One call sees both halves and has to make them agree.
 *
 * The rules in this prompt are the accumulated lessons of the films built by
 * hand before it: no text in frame, a named camera move on every shot, and
 * one thought per beat.
 */
/**
 * THE RULES THAT DIFFER BY STYLE.
 *
 * Both forbid readable surfaces, for the same reason and with the same force:
 * neither a video model nor an image model can spell, and one invented word
 * on screen undoes the film. Everything else about them is opposite — live
 * action wants a camera move and real light, paper wants a flat composition
 * and a recurring character.
 */
const LIVE_RULES = `RULES FOR "shot", and they are absolute:

1. NEVER describe text, writing, letters, signage, screens with words, logos,
   labels, documents you can read, or a phone or computer display showing an
   interface. The video model cannot spell and invents nonsense words.
2. Name a specific CAMERA MOVE every time: slow push in, tracking sideways,
   crane down, arc around, handheld follow, rise straight up. Vary them.
3. Film PEOPLE and PLACES and OBJECTS — a face, hands, a room, weather, light.
4. Name the light and the mood.
5. One thing happening. Not a montage inside a shot.`

const PAPER_RULES = `This film is CUT-PAPER CRAFT ANIMATION. Every scene is a flat
paper-collage illustration that will be animated afterwards.

RULES FOR "shot", and they are absolute:

1. NEVER describe text, writing, letters, numbers, signage, logos or labels.
   The image model cannot spell. A paper card or tag may appear, but it is
   BLANK.
2. Describe everything as MADE OF PAPER: paper envelopes, a paper telephone,
   paper folders, a paper sunburst, layered paper hills.
3. The recurring character appears in most scenes, doing something — sitting,
   reaching, watching, relaxing. Describe their POSTURE and EXPRESSION, never
   their clothing or features (those are fixed elsewhere and must not drift).
4. ONE clear idea per scene, composed flat and centred. No camera moves —
   paper does not pan.
5. The final scene leaves generous empty space in the lower centre for a logo.`

const writeFilm = async (about, url) => {
  const sys = `You write 40-second commercials. You return JSON only.

Return: { "beats": [ { "vo": string, "line": string, "accent": string, "shot": string } ] }

EIGHT beats. For each:

"vo"    — one sentence of narration, spoken aloud. Plain, confident, no jargon.
          Contractions are fine. Never a list of features.
"line"  — the words shown ON SCREEN for this beat. SHORTER than the vo, 3-8
          words. This is a headline, not a subtitle — never repeat the vo
          verbatim.
"accent"— the 1-3 words inside "line" to colour differently. Must appear in
          "line" exactly.
"shot"  — a prompt describing what is SEEN in this beat.

${STYLE === 'paper' ? PAPER_RULES : LIVE_RULES}

STRUCTURE: beat 1 is the problem the viewer already feels. Beat 2 makes it
worse. Beat 3 is the turn. Beats 4-6 are proof. Beat 7 is the strongest single
fact. Beat 8 is the close.`

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system: sys,
      messages: [{ role: 'user', content: `The business:\n${url ? url + '\n' : ''}${about}` }],
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('script failed: ' + JSON.stringify(j).slice(0, 300))
  /*
   * EVERY text block, not the first one.
   *
   * A long system prompt can put a thinking block at content[0], and reading
   * that alone yields an empty string — which surfaced as "no JSON in
   * response" rather than as the wrong-block-index it actually was.
   */
  const raw = (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('no JSON in script response — stop_reason=' + j.stop_reason + ', got ' + raw.length + ' chars')
  return JSON.parse(m[0]).beats
}

/* ── the paper look ──────────────────────────────────────────────────────── */
/**
 * THE STYLE AND THE CHARACTER ARE FIXED HERE, NOT WRITTEN BY THE LLM.
 *
 * Consistency across eight separately-generated scenes comes from repeating
 * these two blocks VERBATIM in every prompt. The model is never asked to
 * remember the character between calls — it is told again each time. The LLM
 * writes only what HAPPENS; what it looks like is not its decision.
 *
 * Taken from scripts/gen-jordyn-paper.mjs, which produced the paper set that
 * already works.
 */
const PAPER_STYLE = 'Cut-paper craft illustration, handmade layered construction-paper collage, flat 2D characters with simple friendly features, visible torn and cut paper edges, soft realistic drop shadows between paper layers, subtle paper grain and fiber texture, warm color palette (cream #faf9f5 background, terracotta rust #c4623f, warm peach #e8b4a0, soft gold #e5d9a8, sage green #b6c4a2), gentle even lighting, charming and warm, editorial paper-craft advertising style, 16:9. NO text, NO letters, NO logos, NO words anywhere.'

const PAPER_CHARACTER = "The recurring character: a simple flat cut-paper person, round friendly head, minimal dot eyes, wearing a rust-and-cream outfit, same character in every scene."

const paperScene = async (i, what) => {
  const file = path.join(OUT, `scene-${i + 1}.png`)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI}`
  const prompt = `${PAPER_STYLE} ${PAPER_CHARACTER} Scene: ${what}`
  /* three tries: image models refuse or return empty often enough that one
     attempt would lose a scene to noise */
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
        }),
      })
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 120)}`)
      const j = await r.json()
      const img = (j.candidates?.[0]?.content?.parts || []).find((q) => q.inlineData?.data)
      if (!img) throw new Error('no image in response')
      fs.writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'))
      return file
    } catch (e) {
      if (a === 2) { log(`  FAIL scene ${i + 1} — ${e.message.slice(0, 100)}`); return null }
      await new Promise((res) => setTimeout(res, 2500))
    }
  }
  return null
}

/* ── fal helpers ─────────────────────────────────────────────────────────── */
const falQueue = async (model, body) => {
  const r = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Key ${FAL}` },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 200))
  return j.request_id
}

const falWait = async (model, id, tries = 200) => {
  /* the status path is the model's FAMILY, not the full route — a queue id
     for minimax/h3-max/text-to-video is polled at minimax/h3-max */
  const base = model.split('/').slice(0, 2).join('/')
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 4000))
    const s = await fetch(`https://queue.fal.run/${base}/requests/${id}/status`, { headers: { authorization: `Key ${FAL}` } })
    const sj = await s.json()
    if (sj.status === 'COMPLETED') {
      const res = await fetch(`https://queue.fal.run/${base}/requests/${id}`, { headers: { authorization: `Key ${FAL}` } })
      return res.json()
    }
    if (sj.status === 'FAILED') throw new Error('generation failed')
  }
  throw new Error('timed out')
}

const download = async (url, to) => {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  fs.writeFileSync(to, buf)
  return buf.length
}

/* ── main ────────────────────────────────────────────────────────────────── */
const run = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  log(`\n— reading ${SLUG}`)
  const { about, url } = await readBusiness()
  log(`  ${about.length} characters of context`)

  log('— writing the script and the shot list')
  const beats = await writeFilm(about, url)
  log(`  ${beats.length} beats`)
  beats.forEach((b, i) => log(`  ${i + 1}. "${b.line}"`))

  /*
   * EVERYTHING AT ONCE. Footage, voice and music have no dependency on each
   * other, and the footage is by far the slowest — running them in sequence
   * would triple the wall clock for the same money.
   */
  log('\n— generating footage, voice and music')
  const jobs = []
  const got = { clips: [], scenes: [], vo: [], music: null }

  /*
   * THE ONE STAGE THAT DIFFERS BY STYLE.
   *
   * Live action asks fal for moving footage; paper asks Gemini for stills
   * that Remotion animates afterwards. Paper is 3-10x cheaper — eight scenes
   * is roughly 30 cents against $3.20 — because a still costs a fraction of
   * a clip, and for cut-paper it is also the BETTER answer: a video model
   * renders a soft wobbly approximation of paper, where a still holds the
   * crisp torn edge and the designed motion is added on top.
   */
  if (STYLE === 'paper') {
    if (!GEMINI) throw new Error('paper style needs GEMINI_API_KEY')
    const done = await Promise.all(beats.map((b, i) => paperScene(i, b.shot)))
    done.forEach((file, i) => { if (file) got.scenes[i] = file })
    log(`  ${done.filter(Boolean).length}/${beats.length} paper scenes drawn`)
  } else {
    for (const [i, b] of beats.entries()) {
      jobs.push({
        kind: 'clip', i,
        model: 'minimax/h3-max/text-to-video',
        id: await falQueue('minimax/h3-max/text-to-video', {
          prompt: b.shot, duration: 6, resolution: '1080P',
        }),
      })
    }
    log(`  ${beats.length} clips queued`)
  }

  for (const [i, b] of beats.entries()) {
    jobs.push({
      kind: 'vo', i,
      model: 'fal-ai/elevenlabs/tts/eleven-v3',
      id: await falQueue('fal-ai/elevenlabs/tts/eleven-v3', {
        text: b.vo,
        voice: 'Rachel',
        stability: 0.5,
      }),
    })
  }
  log(`  ${beats.length} voice lines queued`)

  jobs.push({
    kind: 'music', i: 0,
    model: 'fal-ai/elevenlabs/music',
    id: await falQueue('fal-ai/elevenlabs/music', {
      prompt: 'Confident modern corporate underscore, steady pulse, warm and optimistic, building. No vocals. 45 seconds.',
      music_length_ms: 45000,
    }),
  })
  log('  music queued')

  const t0 = Date.now()
  for (const job of jobs) {
    try {
      const out = await falWait(job.model, job.id)
      const u = out.video?.url ?? out.audio?.url ?? out.audio_url?.url ?? out.audio_file?.url
      if (!u) throw new Error('no media: ' + JSON.stringify(out).slice(0, 160))
      const ext = job.kind === 'clip' ? 'mp4' : 'mp3'
      const file = path.join(OUT, `${job.kind}-${job.i + 1}.${ext}`)
      const size = await download(u, file)
      if (job.kind === 'clip') got.clips[job.i] = file
      else if (job.kind === 'vo') got.vo[job.i] = file
      else got.music = file
      log(`  ok ${job.kind} ${job.i + 1} — ${(size / 1e6).toFixed(1)}MB  ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    } catch (e) {
      log(`  FAIL ${job.kind} ${job.i + 1} — ${e.message.slice(0, 120)}`)
    }
  }

  /* the plan Remotion renders from — no hand editing between here and the film */
  const plan = {
    name: NAME,
    style: STYLE,
    url,
    beats: beats.map((b, i) => ({
      line: b.line, accent: b.accent, vo: b.vo,
      clip: got.clips[i] ? path.basename(got.clips[i]) : null,
      scene: got.scenes[i] ? path.basename(got.scenes[i]) : null,
      voFile: got.vo[i] ? path.basename(got.vo[i]) : null,
    })),
    music: got.music ? path.basename(got.music) : null,
  }
  /* the real spoken length of each line — the cut is timed off these */
  const { execSync } = await import('child_process')
  plan.voDurations = plan.beats.map((b) => {
    if (!b.voFile) return 5.2
    try {
      const cmd = `ffprobe -v error -show_entries format=duration -of csv=p=0 "${path.join(OUT, b.voFile)}"`
      return +execSync(cmd).toString().trim()
    } catch { return 5.2 }
  })
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan, null, 2))
  log(`\n— plan written to ${path.join(OUT, 'plan.json')}`)
  log(`  clips ${got.clips.filter(Boolean).length}/${beats.length}  voice ${got.vo.filter(Boolean).length}/${beats.length}  music ${got.music ? 'yes' : 'no'}`)
}

run().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
