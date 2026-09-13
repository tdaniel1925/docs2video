/**
 * JORDYN — THE EDGE CUT. Paper craft, but hard.
 *
 * Every paper film built so far has been warm and gentle: cream grounds, slow
 * wipes, a settling float. Right for a dentist, right for an insurance
 * explainer, and exactly wrong for "the perfect employee". The note was fair
 * — it looked slow and boring.
 *
 * So this one inverts the palette and the pacing. Ink grounds instead of
 * cream, one hot accent, hard cuts instead of wipes, and a structure where
 * SHE moves while everything around her is stuck. That contrast is the whole
 * idea: the world is a slow paper world, and she is the only thing in it
 * with speed.
 *
 * The compliance-free cousin of make-illustration-explainer — same pipeline,
 * opposite temperature.
 */

import fs from 'fs'
import path from 'path'

const ENV = 'C:/dev/1 - PrismGraphs/.env.local'
const envVal = (k) => {
  const m = fs.readFileSync(ENV, 'utf8').match(new RegExp(`^${k}=(.*)$`, 'm'))
  if (!m) throw new Error(`${k} not found`)
  return m[1].trim()
}
const FAL = envVal('FAL_KEY')
const GEMINI = envVal('GEMINI_API_KEY')

const OUT = path.resolve('public/commercials/jordyn-edge')
const log = (...a) => console.log(...a)

/**
 * THE LOOK — the same craft, a different temperature.
 *
 * Ink and bone instead of cream and sage, one hot terracotta accent, HARD
 * cut edges rather than soft torn ones, and high-contrast raking light that
 * throws real shadows between the layers. Paper can be graphic; it has just
 * been asked to be cosy every time until now.
 */
const STYLE = 'Cut-paper craft illustration, bold graphic construction-paper collage, HIGH CONTRAST, dramatic raking side light throwing hard shadows between paper layers, sharp clean-cut paper edges with occasional aggressive torn rips, deep ink charcoal #1a1714 background, bone white #f2ede3, ONE hot terracotta accent #d1502f, minimal cool slate #3f4a52, stark and confident, editorial poster style, strong diagonal composition, 16:9. NO text, NO letters, NO numbers, NO logos, NO words anywhere.'

/**
 * SHE IS A SHAPE, NOT A PERSON.
 *
 * A paper figure with a face invites the viewer to judge whether she looks
 * like a real assistant. A silhouette does not — it reads as capability
 * rather than as a character, which is what the product actually is. It also
 * holds far better across eight separately-generated scenes than a face
 * would.
 */
const HER = 'The recurring figure: a confident cut-paper silhouette in hot terracotta, no facial features, sharp angular posture, always mid-motion and always the ONLY warm-coloured thing in the frame. Everyone and everything else is ink, slate or bone.'

/**
 * THE SCRIPT IS WRITTEN HERE, NOT GENERATED.
 *
 * The LLM writes a good general commercial, and this needs a specific voice
 * — short, blunt, no sentence longer than a breath. Hand-written because the
 * point of this cut is attitude, and attitude is the thing a general prompt
 * sands off.
 */
const BEATS = [
  {
    vo: 'Every business owner wants the same person.',
    line: 'Everyone wants',
    accent: 'the same person',
    shot: 'A long queue of identical flat ink-coloured paper figures standing still in a stark bone-white space, all facing the same direction, rigid and waiting. Strong diagonal shadows across the floor.',
  },
  {
    vo: 'Nobody applies. The ones who come close are gone by spring.',
    line: 'Nobody applies',
    accent: 'Nobody',
    shot: 'A single empty ink paper chair in a stark empty room, a torn paper gap where a figure should be, harsh raking light, dramatic long shadow.',
  },
  {
    vo: 'So we built her instead.',
    line: 'So we built her',
    accent: 'built her',
    shot: 'A confident terracotta cut-paper silhouette assembling itself from sharp angular paper shards flying together in a dark ink space, mid-formation, explosive and precise.',
  },
  {
    vo: 'She reads every email overnight.',
    line: 'Every inbox. Overnight.',
    accent: 'Overnight',
    shot: 'The terracotta paper silhouette moving fast through a dense wall of dark grey paper envelopes, the envelopes flying apart in her wake, motion and disruption, hard diagonal composition.',
  },
  {
    vo: 'She answers your phone. Callers book while they are still talking.',
    line: 'She picks up.',
    accent: 'picks up',
    shot: 'A bold terracotta paper silhouette holding an angular ink-black paper telephone, sharp paper sound-wave shards radiating outward in strong diagonals, dark dramatic background.',
  },
  {
    vo: 'She writes, invoices, chases and files. In your voice.',
    line: 'In your voice.',
    accent: 'your voice',
    shot: 'A terracotta paper silhouette at the centre of a fast spiral of angular ink and slate paper shapes orbiting her, everything in motion around a still centre, dark ground, graphic and kinetic.',
  },
  {
    vo: 'She does not call in sick. She does not hand in her notice.',
    line: 'She never leaves.',
    accent: 'never leaves',
    shot: 'A stark ink paper doorway with harsh light spilling through it, and a terracotta paper silhouette standing firm in front of it, facing inward, not leaving. Strong single light source, deep shadow.',
  },
  {
    vo: 'The perfect employee was always a fantasy. Now she starts tomorrow.',
    line: 'She starts tomorrow.',
    accent: 'tomorrow',
    shot: 'A single bold terracotta paper silhouette standing confident and alone in a wide stark ink space, dramatic light from one side, generous empty space in the lower centre, poster-like and final.',
  },
]

/* ── generation ──────────────────────────────────────────────────────────── */
const paperScene = async (i, what) => {
  const file = path.join(OUT, `scene-${i + 1}.png`)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI}`
  const prompt = `${STYLE} ${HER} Scene: ${what}`
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
      if (!img) throw new Error('no image')
      fs.writeFileSync(file, Buffer.from(img.inlineData.data, 'base64'))
      return file
    } catch (e) {
      if (a === 2) { log(`  FAIL scene ${i + 1} — ${e.message}`); return null }
      await new Promise((res) => setTimeout(res, 2500))
    }
  }
}

const falQueue = async (model, body) => {
  const r = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${FAL}` },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 160))
  return j.request_id
}
const falWait = async (model, id) => {
  const base = model.split('/').slice(0, 2).join('/')
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 4000))
    const s = await fetch(`https://queue.fal.run/${base}/requests/${id}/status`, { headers: { authorization: `Key ${FAL}` } })
    const sj = await s.json()
    if (sj.status === 'COMPLETED') {
      const res = await fetch(`https://queue.fal.run/${base}/requests/${id}`, { headers: { authorization: `Key ${FAL}` } })
      return res.json()
    }
    if (sj.status === 'FAILED') throw new Error('failed')
  }
  throw new Error('timed out')
}

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  log(`\n— drawing ${BEATS.length} scenes`)
  const scenes = await Promise.all(BEATS.map((b, i) => paperScene(i, b.shot)))
  log(`  ${scenes.filter(Boolean).length}/${BEATS.length} drawn`)

  log('— voice and music')
  const voJobs = []
  for (const [i, b] of BEATS.entries()) {
    /* lower stability than the warm films: a flatter, harder read */
    voJobs.push({ i, id: await falQueue('fal-ai/elevenlabs/tts/eleven-v3', { text: b.vo, voice: 'Rachel', stability: 0.35 }) })
  }
  const musicId = await falQueue('fal-ai/elevenlabs/music', {
    prompt: 'Dark driving electronic underscore, hard percussive pulse, tense and confident, building relentlessly, modern and edgy, no vocals. 40 seconds.',
    music_length_ms: 40000,
  })

  const vo = []
  for (const job of voJobs) {
    try {
      const out = await falWait('fal-ai/elevenlabs/tts/eleven-v3', job.id)
      const u = out.audio?.url ?? out.audio_url?.url
      const f = path.join(OUT, `vo-${job.i + 1}.mp3`)
      fs.writeFileSync(f, Buffer.from(await (await fetch(u)).arrayBuffer()))
      vo[job.i] = path.basename(f)
      log(`  ok vo ${job.i + 1}`)
    } catch (e) { log(`  FAIL vo ${job.i + 1}`) }
  }

  let music = null
  try {
    const out = await falWait('fal-ai/elevenlabs/music', musicId)
    const u = out.audio?.url ?? out.audio_url?.url
    fs.writeFileSync(path.join(OUT, 'music.mp3'), Buffer.from(await (await fetch(u)).arrayBuffer()))
    music = 'music.mp3'
    log('  ok music')
  } catch { log('  FAIL music') }

  const { execSync } = await import('child_process')
  const plan = {
    name: 'jordyn-edge',
    style: 'edge',
    music,
    beats: BEATS.map((b, i) => ({
      line: b.line, accent: b.accent, vo: b.vo, figure: null,
      scene: scenes[i] ? path.basename(scenes[i]) : null,
      voFile: vo[i] ?? null, clip: null,
    })),
    voDurations: BEATS.map((_, i) => {
      if (!vo[i]) return 3.5
      try {
        return +execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${path.join(OUT, vo[i])}"`).toString().trim()
      } catch { return 3.5 }
    }),
  }
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan, null, 2))
  log(`\n— plan written. ${plan.voDurations.reduce((a, b) => a + b, 0).toFixed(0)}s of narration.`)
}

run().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1) })
