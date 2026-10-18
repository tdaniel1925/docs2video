// =============================================================================
// AUDIO MIX — music under the voice, for every video the render service mixes
// with ffmpeg (Cinematic / Aurora / Infographic, Editorial, Drawn slides, the
// classic slide video).
//
// What it fixes:
//  1. The voice was cut in half. ffmpeg's `amix` divides every input by the
//     number of inputs unless told `normalize=0`, so voice AND music both came
//     out at half level. Every mix here uses normalize=0: the voice stays at
//     exactly the level it was recorded at.
//  2. The music never moved. It now does what the commercial template does:
//     about 0.20 between lines, about 0.08 while someone is talking, with short
//     ramps so it never "pumps".
//  3. The music runs out. The track is looped (-stream_loop -1) and cut to the
//     video's own length, with a fade in and a fade out at the true end.
//
// When the voice is talking comes from the narration itself (ffmpeg's
// silencedetect), or from exact times the caller already knows (Drawn slides).
//
// No network, no paid calls. Pure helpers are exported for tests.
// =============================================================================

const { execFile } = require('child_process')

/** The commercial template's levels (remotion/src/templates/TemplateCommercial.tsx duck default). */
const MUSIC_LOUD = 0.2   // between lines
const MUSIC_DUCK = 0.08  // under the voice
const DUCK_RAMP = 0.3    // seconds to ease down before a line / back up after it
const MERGE_GAP = 0.9    // a pause shorter than this stays ducked (no pumping between words)

/**
 * Turn ffmpeg silencedetect output into the times someone is talking.
 * @param {string} stderr  ffmpeg's log
 * @param {number} duration total length in seconds
 * @returns {[number, number][]} talking segments [start, end] in seconds
 */
function parseSpeech(stderr, duration) {
  const silences = []
  let open = null
  for (const line of String(stderr || '').split(/\r?\n/)) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/)
    if (s) { open = Math.max(0, parseFloat(s[1])); continue }
    const e = line.match(/silence_end:\s*([\d.]+)/)
    if (e && open !== null) { silences.push([open, parseFloat(e[1])]); open = null }
  }
  if (open !== null) silences.push([open, duration])
  const speech = []
  let t = 0
  for (const [a, b] of silences) {
    if (a > t + 0.05) speech.push([t, Math.min(a, duration)])
    t = Math.max(t, b)
  }
  if (duration > t + 0.05) speech.push([t, duration])
  return speech.filter(([a, b]) => b > a)
}

/** Join talking segments separated by a pause shorter than `gap` seconds. */
function mergeSegments(segs, gap = MERGE_GAP) {
  const sorted = [...(segs || [])].filter((s) => Array.isArray(s) && s[1] > s[0]).sort((a, b) => a[0] - b[0])
  const out = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a - last[1] < gap) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

const n3 = (v) => (Math.round(v * 1000) / 1000).toString()

/**
 * The ffmpeg `volume` expression for the ducking envelope: LOUD between lines,
 * DUCK under each line, a linear ease of `ramp` seconds into and out of each one.
 * Segments are merged first, so terms never overlap; min(1, …) keeps it safe anyway.
 */
function duckVolumeExpr(segs, { loud = MUSIC_LOUD, duck = MUSIC_DUCK, ramp = DUCK_RAMP, gap = MERGE_GAP } = {}) {
  const merged = mergeSegments(segs, gap)
  if (!merged.length) return n3(loud)
  const r = n3(ramp)
  const terms = merged.map(([a, b]) => `clip((t-${n3(a - ramp)})/${r},0,1)*clip((${n3(b + ramp)}-t)/${r},0,1)`)
  return `${n3(loud)}-${n3(loud - duck)}*min(1,${terms.join('+')})`
}

/** The level the envelope gives at time t (same maths as the expression; for tests + checks). */
function duckLevelAt(t, segs, { loud = MUSIC_LOUD, duck = MUSIC_DUCK, ramp = DUCK_RAMP, gap = MERGE_GAP } = {}) {
  const clip = (v) => Math.min(1, Math.max(0, v))
  let sum = 0
  for (const [a, b] of mergeSegments(segs, gap)) sum += clip((t - (a - ramp)) / ramp) * clip((b + ramp - t) / ramp)
  return loud - (loud - duck) * Math.min(1, sum)
}

/**
 * The whole -filter_complex for "voice (input 0) at full level + looped music
 * (input 1) ducked under it". Output label [aout].
 */
function musicBedFilter({ segments, duration, loud, duck, ramp, fadeIn = 1.5, fadeOut = 2.5, voice = '0:a', music = '1:a' }) {
  const vol = duckVolumeExpr(segments, { loud, duck, ramp })
  const end = Math.max(0, duration)
  const fo = Math.max(0, end - fadeOut)
  return [
    `[${voice}]aformat=sample_rates=48000:channel_layouts=stereo[narr]`,
    `[${music}]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${n3(end)},asetpts=PTS-STARTPTS,` +
      `volume='${vol}':eval=frame,afade=t=in:st=0:d=${n3(fadeIn)},afade=t=out:st=${n3(fo)}:d=${n3(fadeOut)}[bed]`,
    // normalize=0: amix must NOT divide the voice by the number of inputs.
    `[narr][bed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`,
  ].join(';')
}

function run(bin, args, timeout) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) { err.message = `${err.message}\n${String(stderr || '').slice(-600)}`; return reject(err) }
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') })
    })
  })
}

async function probeDuration(file, ffprobe = 'ffprobe') {
  const { stdout } = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], 20000)
  const d = parseFloat(stdout.trim())
  return Number.isFinite(d) && d > 0 ? d : 0
}

/** When is someone talking in this file's audio? silencedetect on the narration. */
async function detectSpeech(file, { duration, ffmpeg = 'ffmpeg', noise = '-38dB', minSilence = 0.3 } = {}) {
  const total = duration || (await probeDuration(file))
  const { stderr } = await run(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', `silencedetect=noise=${noise}:d=${minSilence}`, '-f', 'null', '-'], 180000)
  return { segments: parseSpeech(stderr, total), duration: total }
}

/**
 * Mix `musicPath` under the voice already in `videoIn`, writing `outPath`.
 * The picture is copied untouched. `segments` (seconds) skips the detection
 * when the caller knows exactly when the voice plays.
 * @returns {Promise<{ segments: [number, number][], duration: number }>}
 */
async function mixMusicUnderVoice({ videoIn, musicPath, outPath, segments, loud, duck, ramp, ffmpeg = 'ffmpeg', timeout = 300000 }) {
  const duration = await probeDuration(videoIn)
  if (!duration) throw new Error('mixMusicUnderVoice: could not read the video length')
  let segs = segments
  if (!Array.isArray(segs)) {
    try { segs = (await detectSpeech(videoIn, { duration, ffmpeg })).segments }
    catch (e) { console.warn(`[audio-mix] speech detection failed (${e.message}) — music stays at the under-voice level`); segs = [[0, duration]] }
  }
  const filter = musicBedFilter({ segments: segs, duration, loud, duck, ramp })
  await run(ffmpeg, [
    '-y', '-i', videoIn, '-stream_loop', '-1', '-i', musicPath,
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-t', n3(duration), '-movflags', '+faststart', outPath,
  ], timeout)
  return { segments: segs, duration }
}

module.exports = {
  MUSIC_LOUD, MUSIC_DUCK, DUCK_RAMP, MERGE_GAP,
  parseSpeech, mergeSegments, duckVolumeExpr, duckLevelAt, musicBedFilter,
  probeDuration, detectSpeech, mixMusicUnderVoice,
}
