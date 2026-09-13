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
const ANTHROPIC = envVal('ANTHROPIC_API_KEY')

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
"shot"  — a prompt for a VIDEO model describing what is filmed.

RULES FOR "shot", and they are absolute:

1. NEVER describe text, writing, letters, signage, screens with words, logos,
   labels, documents you can read, or a phone or computer display showing an
   interface. The video model cannot spell and invents nonsense words. Any
   readable surface ruins the shot.
2. Name a specific CAMERA MOVE every time: slow push in, tracking sideways,
   crane down, arc around, handheld follow, rise straight up. Vary them —
   eight shots that all push in reads as cheap.
3. Film PEOPLE and PLACES and OBJECTS: a face, hands, a room, weather, light.
   Human moments, not abstractions.
4. Name the light and the mood: dawn light through a window, harsh overhead
   fluorescent, warm lamp glow, overcast.
5. One thing happening. Not a montage inside a shot.

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
  const got = { clips: [], vo: [], music: null }
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
    url,
    beats: beats.map((b, i) => ({
      line: b.line, accent: b.accent, vo: b.vo,
      clip: got.clips[i] ? path.basename(got.clips[i]) : null,
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
