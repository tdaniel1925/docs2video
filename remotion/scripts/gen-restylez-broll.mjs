/**
 * THE BRAND FILM'S FOOTAGE — seven shots, generated.
 *
 * The existing Restylez launch film runs on 25 real product screenshots and
 * is the better film for proving the product works. This is a different job:
 * no UI at all, just the feeling and the outcome — the midnight frustration,
 * the box of flyers arriving, the face of someone who did not have to hire an
 * agency. It runs alongside that film rather than replacing it.
 *
 * SEVEN SHOTS, ONE TAKE EACH. Video bills by the second and the promotional
 * rate (about a quarter of list) ends 14 September, so this is deliberately
 * one pass: ~70 seconds of 1080p for roughly $2.80. Anything that comes back
 * wrong gets cut around in the edit rather than regenerated.
 *
 *   node scripts/gen-restylez-broll.mjs           # all seven
 *   node scripts/gen-restylez-broll.mjs 1 4       # just those
 */

import fs from 'fs'
import path from 'path'

const KEY = (() => {
  const f = 'C:/dev/1 - PrismGraphs/.env.local'
  const m = fs.readFileSync(f, 'utf8').match(/^FAL_KEY=(.*)$/m)
  if (!m) throw new Error('FAL_KEY not found in ' + f)
  return m[1].trim()
})()

const OUT = path.resolve('public/restylez/broll')

/*
 * THE SHOTS, AGAINST THE SCRIPT THAT ALREADY EXISTS.
 *
 * The narration is recorded (public/restylez/vo.json, 11 lines, 52s) so these
 * are written to sit UNDER specific lines rather than to be pretty on their
 * own. The note on each says which line it carries.
 *
 * Every prompt names the camera move explicitly. Left to itself the model
 * picks one, and seven shots that all track left is what makes generated
 * footage read as generated.
 */
const SHOTS = [
  {
    id: '1-midnight',
    vo: 'Still dragging boxes around at midnight?',
    prompt: 'A tired woman alone at a desk late at night, lit only by a laptop screen. Empty coffee cups beside her. She rubs her eyes and drags the mouse back and forth. Slow push in on her face. Cool blue screen light against a dark room, shallow depth of field, cinematic, filmic grain.',
  },
  {
    id: '2-frustration',
    vo: 'the 40th version — nothing works',
    prompt: 'Close on a hand pushing a mouse in small frustrated circles, then stopping. A pile of crumpled printouts beside the keyboard. The camera slowly cranes down over the desk. Dim warm lamp light, high contrast, moody, cinematic, shallow depth of field.',
  },
  {
    id: '3-flyer-lands',
    vo: 'Meet ReStyles. Agency quality, agency speed.',
    prompt: 'A beautifully printed flyer laid on a clean bright table, sharp and vivid, as morning light sweeps across it. The camera pushes in slowly on the paper. Crisp, optimistic, warm daylight, extremely shallow depth of field, cinematic product photography.',
  },
  {
    id: '4-press',
    vo: 'Every size, print ready.',
    prompt: 'A commercial printing press running at speed, sheets of colourful printed material flying through the rollers. The camera tracks sideways along the machine. Industrial, warm practical lighting, motion blur on the moving paper, cinematic, filmic.',
  },
  {
    id: '5-the-box',
    vo: 'Premium work, for your business.',
    prompt: 'A small business owner opens a cardboard box on a shop counter and lifts out a stack of freshly printed flyers. She smiles as she looks at them. The camera is handheld, slightly behind her shoulder, moving in. Warm natural window light, authentic, documentary style, shallow depth of field.',
  },
  {
    id: '6-boardroom',
    vo: 'Whole decks from a document or a topic.',
    prompt: 'A confident woman presenting to three colleagues in a modern meeting room, gesturing toward a large bright screen behind her. The camera arcs slowly around the table. Clean daylight, glass and pale wood, professional, cinematic, shallow depth of field.',
  },
  {
    id: '7-spread',
    vo: 'The deck, the cards, the posts, the postcard.',
    prompt: 'An overhead shot of many printed pieces fanned out across a pale table — flyers, postcards, business cards, a brochure — all in the same colour palette. The camera rises straight up, slowly revealing more of the spread. Soft even daylight, crisp, editorial, cinematic.',
  },
]

const submit = async (prompt) => {
  const r = await fetch('https://queue.fal.run/minimax/h3-max/text-to-video', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Key ${KEY}` },
    /* 1080P — uppercase. The API rejects '1080p' outright, which cost a
       take to discover. */
    body: JSON.stringify({ prompt, duration: 10, resolution: '1080P' }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(j).slice(0, 200))
  return j.request_id
}

const wait = async (id) => {
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const s = await fetch(`https://queue.fal.run/minimax/h3-max/requests/${id}/status`, { headers: { authorization: `Key ${KEY}` } })
    const sj = await s.json()
    if (sj.status === 'COMPLETED') {
      const res = await fetch(`https://queue.fal.run/minimax/h3-max/requests/${id}`, { headers: { authorization: `Key ${KEY}` } })
      return res.json()
    }
    if (sj.status === 'FAILED') throw new Error('generation failed')
  }
  throw new Error('timed out')
}

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const want = process.argv.slice(2)
  const list = want.length ? SHOTS.filter((s) => want.includes(s.id.split('-')[0])) : SHOTS

  /* SUBMITTED ALL AT ONCE. Seven in sequence is seven times the wall clock
     for the same money; the queue runs them in parallel. */
  console.log(`submitting ${list.length} shots…`)
  const jobs = []
  for (const shot of list) {
    try {
      jobs.push({ shot, id: await submit(shot.prompt) })
      console.log('  queued', shot.id)
    } catch (e) {
      console.log('  FAILED to queue', shot.id, '-', e.message)
    }
  }

  const t0 = Date.now()
  for (const { shot, id } of jobs) {
    try {
      const out = await wait(id)
      const url = out.video?.url
      if (!url) throw new Error('no video in response')
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
      fs.writeFileSync(path.join(OUT, `${shot.id}.mp4`), buf)
      console.log('ok   ', shot.id, (buf.length / 1e6).toFixed(1) + 'MB', ((Date.now() - t0) / 1000).toFixed(0) + 's')
    } catch (e) {
      console.log('FAIL ', shot.id, '-', e.message)
    }
  }
}

run().catch((e) => { console.error(e); process.exit(1) })
