// =============================================================================
// THE SCENE KIT on the render service (videoStyle 'kit').
//
// The app plans the video (app/_lib/kit-planner.ts: Claude picks one kit scene
// per beat) and sends the finished plan here. This file does the rest, before
// the render: one voice clip per scene WITH word timings (so a big number lands
// on the spoken word), the agent's real logo and photo, the music, and a
// compliance safety net. Then server.js renders KitVideo.
//
// Every per-video file lives in ONE folder, public/kit-<videoId>/, and is
// NAMED in the props — so the Lambda uploader (remotion/scripts/lambda-render.mjs)
// finds and uploads every one of them (and `assetDir` makes it walk the whole
// folder too). Two kit videos can render at once without touching each
// other's files.
//
// kitTimeline below MIRRORS remotion/src/kit/spec.ts (kitTimeline).
// tests/kit-engine.test.ts checks the two agree — change both together.
// =============================================================================

const { mkdir, writeFile, rm } = require('fs/promises')
const { join } = require('path')

const KIT = {
  FPS: 30,
  VO_LEAD: 12,
  VO_TAIL: 22,
  END_HOLD: 75,
  PREVIEW_FRAMES: 240,
  MIN_FRAMES: { title: 120, bignumber: 105, comparison: 120, timeline: 120, chart: 120, checklist: 105, quote: 105, cta: 150 },
  CUT: { calm: 20, premium: 16, energetic: 12 },
  // Feel → the bundled music bed (inside the Lambda site; never uploaded per video).
  MUSIC: { calm: 'music/bed-warm-128.wav', premium: 'music/bed-corporate-128.wav', energetic: 'music/bed-uplifting-128.wav' },
  MUSIC_MOOD: {
    calm: 'Create background music. Instrumental only, no vocals. Gentle, warm and unhurried — soft piano and strings. Fade out at the end.',
    premium: 'Create background music. Instrumental only, no vocals. Polished, confident and modern — light synth pads, soft pulse. Fade out at the end.',
    energetic: 'Create background music. Instrumental only, no vocals. Upbeat and bright — light percussion, positive and clean. Fade out at the end.',
  },
}

/** Mirror of spec.ts kitTimeline. */
function kitTimeline(scenes, feel, opts = {}) {
  const cut = KIT.CUT[feel] || 16
  const voFrames = scenes.map((s) => (opts.preview ? 0 : Math.max(0, Math.round((s.voSec || 0) * KIT.FPS))))
  const durations = scenes.map((s, i) => {
    if (opts.preview) return KIT.PREVIEW_FRAMES
    const last = i === scenes.length - 1
    const need = KIT.VO_LEAD + voFrames[i] + (last ? KIT.END_HOLD : KIT.VO_TAIL + cut)
    return Math.max(KIT.MIN_FRAMES[s.type] || 105, need)
  })
  const starts = []
  let t = 0
  durations.forEach((d, i) => { starts.push(t); t += d - (i < durations.length - 1 ? cut : 0) })
  return { starts, durations, voFrames, cut, total: Math.max(1, t) }
}

const feelOf = (plan) => (plan && plan.look && KIT.CUT[plan.look.feel] ? plan.look.feel : 'premium')

/** Every on-screen string of a scene, as [object, key] pairs (for the scrub). */
function stringSlots(s) {
  const slots = []
  const add = (o, k) => { if (o && typeof o[k] === 'string') slots.push([o, k]) }
  ;['headline', 'sub', 'label', 'context', 'heading', 'verdict', 'takeaway', 'quote', 'attribution', 'action'].forEach((k) => add(s, k))
  for (const side of [s.left, s.right]) { if (!side) continue; add(side, 'label'); (side.points || []).forEach((_, i) => add(side.points, i)) }
  ;(s.steps || []).forEach((st) => { add(st, 'when'); add(st, 'label') })
  ;(s.points || []).forEach((p) => add(p, 'label'))
  ;(s.items || []).forEach((_, i) => add(s.items, i))
  return slots
}

/**
 * COMPLIANCE SAFETY NET. The app already checked every scene against the
 * shared blocklist (app/_lib/compliance.ts); this runs the render service's
 * byte-identical copy (slides.js CARRIER_BLOCKLIST) once more over the words
 * on screen AND the words spoken, removing carrier/product NAMES only —
 * figures, the client's name and the agent's identity stay. Returns the list
 * of what it removed (should be empty).
 */
function scrubKitPlan(plan, blocklist) {
  if (!plan || !plan.regulated || !Array.isArray(blocklist) || !blocklist.length) return []
  const terms = [...new Set(blocklist.map((t) => String(t).toLowerCase()).filter(Boolean))].sort((a, b) => b.length - a.length)
  const res = terms.map((t) => new RegExp(`(?<![a-z0-9])${t.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}(?![a-z0-9])(?:\\s?(?:iul|life insurance company|life insurance|insurance company|insurance|company|financial|group|\\u2120|\\u00ae|\\u2122))*`, 'ig'))
  const removed = []
  const clean = (str) => {
    let out = str
    for (const re of res) out = out.replace(re, (m) => { removed.push(m.trim()); return '' })
    return out === str ? str : out.replace(/(^|[\s([{])['’]s\b/gi, '$1').replace(/\s{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim()
  }
  for (const s of plan.scenes || []) {
    for (const [o, k] of stringSlots(s)) o[k] = clean(o[k])
    if (typeof s.narration === 'string') s.narration = clean(s.narration)
  }
  return removed
}

/**
 * Turn the app's plan into a renderable one: voice + timings per scene, real
 * logo/photo files, music. `deps`:
 *   ttsTimed(text, outPath, voiceId) → { words, durationSec }   (slides.js)
 *   tts(fn)                          → runs fn in the voice pool (≤3 at once)
 *   fetchTo(url, outPath)            → downloads (SSRF-guarded) or throws
 *   aiMusic(prompt, outPath)         → optional AI music, throws on failure
 *   audioDurationSec(path)           → measured length (ffprobe)
 *   normalize(path)                  → optional: voice to -16 LUFS (normalizeVoice below)
 */
async function prepareKitPlan({ pub, videoId, plan, assets = {}, voiceId, music = {}, deps, log = () => {} }) {
  const dirName = `kit-${String(videoId).replace(/[^a-zA-Z0-9-]/g, '')}`
  const dir = join(pub, dirName)
  await mkdir(dir, { recursive: true })
  const out = JSON.parse(JSON.stringify(plan))
  out.brand = out.brand || {}

  // The agent's REAL logo files (light for dark pages, dark for light pages,
  // any = one we can't tell). Never drawn. A failed download just means the
  // name shows as words instead.
  const logo = {}
  for (const k of ['light', 'dark', 'any']) {
    const url = assets[`logo_${k}`]
    if (!url) continue
    try { await deps.fetchTo(url, join(dir, `logo-${k}.png`)); logo[k] = `${dirName}/logo-${k}.png` } catch (e) { log(`logo ${k} skipped: ${e.message}`) }
  }
  out.brand.logo = Object.keys(logo).length ? logo : undefined
  if (assets.presenter_photo && out.brand.presenter) {
    try { await deps.fetchTo(assets.presenter_photo, join(dir, 'presenter.png')); out.brand.presenter.photo = `${dirName}/presenter.png` } catch (e) { log(`presenter photo skipped: ${e.message}`); delete out.brand.presenter.photo }
  } else if (out.brand.presenter) delete out.brand.presenter.photo

  // One voice clip per scene, all at once through the voice pool. Word
  // timings come back with it (ElevenLabs exact; OpenAI estimated).
  await Promise.all((out.scenes || []).map(async (s) => {
    const file = `${dirName}/vo-${s.id}.mp3`
    const timed = await deps.tts(() => deps.ttsTimed(s.narration, join(pub, file), voiceId))
    // Every clip at the same loudness (-16 LUFS), whichever voice service made it.
    if (deps.normalize) await deps.normalize(join(pub, file)).catch((e) => log(`voice level not normalised (${e.message})`))
    let sec = Number(timed && timed.durationSec) || 0
    if (deps.audioDurationSec) { const measured = await deps.audioDurationSec(join(pub, file)).catch(() => 0); if (measured > 0) sec = measured }
    s.vo = file
    s.voSec = Math.round(sec * 1000) / 1000
    s.words = (timed && Array.isArray(timed.words) ? timed.words : []).map((w) => ({ w: w.w, start: Math.round(w.start * 1000) / 1000, end: Math.round(w.end * 1000) / 1000 }))
  }))

  // Music: the user's own track, else AI music they asked for, else the
  // bundled bed that matches the look's feel. Always SOMETHING — the duck
  // and the loop (MusicBed) do the rest.
  const feel = feelOf(out)
  out.audio = out.audio || {}
  out.audio.music = KIT.MUSIC[feel]
  if (music.url) {
    try { await deps.fetchTo(music.url, join(dir, 'music.mp3')); out.audio.music = `${dirName}/music.mp3` } catch (e) { log(`music download skipped: ${e.message}`) }
  } else if ((music.ai || music.prompt) && deps.aiMusic) {
    try { await deps.aiMusic(music.prompt || KIT.MUSIC_MOOD[feel], join(dir, 'music.mp3')); out.audio.music = `${dirName}/music.mp3` } catch (e) { log(`AI music skipped (bundled bed instead): ${e.message}`) }
  }
  if (!out.audio.sfx) out.audio.sfx = out.regulated ? 'quiet' : 'standard'

  const timeline = kitTimeline(out.scenes, feel)
  const sceneMeta = out.scenes.map((s, i) => {
    const a = timeline.starts[i], b = a + timeline.durations[i]
    const label = s.headline || s.heading || s.label || s.quote || s.action || `Scene ${i + 1}`
    return {
      id: s.id, index: i, type: s.type,
      startSec: Math.round((a / KIT.FPS) * 10) / 10, endSec: Math.round((b / KIT.FPS) * 10) / 10,
      // the picture for the scene list: after it has settled, before the next cut
      midSec: Math.round(((a + Math.min(timeline.durations[i] - timeline.cut - 4, Math.max(75, timeline.durations[i] * 0.6))) / KIT.FPS) * 10) / 10,
      label: String(label).slice(0, 120), narration: s.narration, voFile: s.vo,
    }
  })
  return { plan: out, dirName, dir, timeline, sceneMeta }
}

/** Free preview: the kit plan as one still (the first content scene, settled). */
function previewKitJob(body) {
  const plan = body && body.plan
  if (!plan || !Array.isArray(plan.scenes) || !plan.scenes.length) throw new Error('No scene to preview.')
  const timeline = kitTimeline(plan.scenes, feelOf(plan), { preview: true })
  const idx = plan.scenes.findIndex((s) => s.type !== 'title' && s.type !== 'cta')
  const at = idx >= 0 ? idx : 0
  return { comp: 'KitVideo', props: { plan, still: true, timeline }, frame: timeline.starts[at] + 150 }
}

/**
 * Bring a voice clip to -16 LUFS (true peak -1.5 dB) in place. Timing is
 * untouched (same start, same length), so the word timings stay exact.
 */
function normalizeVoice(file) {
  const { execFile } = require('child_process')
  const tmp = file.replace(/.mp3$/i, '') + '.norm.mp3'
  return new Promise((resolve, reject) => execFile('ffmpeg', ['-v', 'error', '-y', '-i', file, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-b:a', '160k', tmp], { timeout: 60000 }, (e) => {
    if (e) return reject(e)
    require('fs').rename(tmp, file, (e2) => (e2 ? reject(e2) : resolve()))
  }))
}

async function cleanupKit(dir) { if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {}) }

module.exports = { KIT, kitTimeline, scrubKitPlan, prepareKitPlan, previewKitJob, cleanupKit, stringSlots, normalizeVoice }
