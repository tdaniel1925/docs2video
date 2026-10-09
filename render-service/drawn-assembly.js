// =============================================================================
// DRAWN SLIDES ASSEMBLY — the "Drawn slides" look (imageEngine:'fal').
//
// The drawn slides used to sit dead still and jump from one to the next. Now:
//  · every slide has a slow Ken Burns zoom (4% over the slide, alternating in
//    and out, centred so the drawn words never leave the frame), and
//  · slides cross-fade into each other (0.5 s) instead of hard cuts.
//
// Timing stays exactly the same as before: slide i lasts its narration + 0.8 s
// (5 s with no narration). The picture of slide i is made D seconds LONGER so
// the cross-fade happens over the next slide's start — the voice of each slide
// still starts at exactly the same moment as its picture.
//
// Two steps, so memory stays small however many slides there are:
//   1. one short Ken Burns clip per slide (picture only),
//   2. one pass that cross-fades the clips and lays the voice track under them.
// Pure helpers are exported for tests.
// =============================================================================

const { join } = require('path')

const FPS = 30
const TAIL = 0.8        // slide lingers after its narration (same as the classic path)
const SILENT = 5        // a slide without narration
const XFADE = 0.5       // cross-fade length, seconds
const ZOOM = 0.04       // Ken Burns: 1.00 → 1.04 (or back) over the slide

const n3 = (v) => (Math.round(v * 1000) / 1000).toString()

/**
 * Slide timing from each slide's narration length (seconds; 0 = no narration).
 * @returns {{ durations: number[], starts: number[], clipLengths: number[], voice: [number, number][], total: number }}
 *   durations: each slide's own time on screen; starts: when it starts;
 *   clipLengths: its picture clip (durations + the cross-fade, except the last);
 *   voice: when someone is talking (for the music ducking); total: video length.
 */
function drawnTimeline(narrationSecs, { tail = TAIL, silent = SILENT, xfade = XFADE } = {}) {
  const durations = narrationSecs.map((s) => (s > 0 ? s + tail : silent))
  const starts = []
  let t = 0
  for (const d of durations) { starts.push(t); t += d }
  const clipLengths = durations.map((d, i) => (i < durations.length - 1 ? d + xfade : d))
  const voice = narrationSecs.map((s, i) => (s > 0 ? [starts[i], starts[i] + s] : null)).filter(Boolean)
  return { durations, starts, clipLengths, voice, total: t }
}

/**
 * The Ken Burns filter for one slide picture: upscale 2x (smooth sub-pixel
 * motion), slow centred zoom, back to 1920x1080 at 30 fps for `seconds`.
 * Even slides zoom in, odd slides zoom out.
 */
function kenBurnsFilter(index, seconds, { zoom = ZOOM, fps = FPS } = {}) {
  const frames = Math.max(1, Math.round(seconds * fps))
  const z = index % 2 === 0
    ? `1+${zoom}*on/${frames}`
    : `${1 + zoom}-${zoom}*on/${frames}`
  return [
    'scale=3840:2160:force_original_aspect_ratio=decrease',
    'pad=3840:2160:(ow-iw)/2:(oh-ih)/2',
    'setsar=1',
    `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=${fps}`,
    `trim=duration=${n3(seconds)}`,
    'setpts=PTS-STARTPTS',
    'format=yuv420p',
  ].join(',')
}

/**
 * The join pass: cross-fade clip inputs 0..n-1 (picture) and lay the voice
 * under them. `audio[i]` is the ffmpeg input index of slide i's narration, or
 * -1 for a silent slide. Output labels [vout] and [aout].
 */
function joinFilter({ durations, audio, xfade = XFADE, sampleRate = 48000 }) {
  const n = durations.length
  const parts = []
  for (let i = 0; i < n; i++) parts.push(`[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=${FPS}[c${i}]`)
  if (n === 1) parts.push('[c0]null[vout]')
  let prev = 'c0'
  let offset = 0
  for (let i = 1; i < n; i++) {
    offset += durations[i - 1]
    const out = i === n - 1 ? 'vout' : `x${i}`
    parts.push(`[${prev}][c${i}]xfade=transition=fade:duration=${n3(xfade)}:offset=${n3(offset)}[${out}]`)
    prev = out
  }
  const aLabels = []
  for (let i = 0; i < n; i++) {
    if (audio[i] >= 0) {
      parts.push(`[${audio[i]}:a]aformat=sample_rates=${sampleRate}:channel_layouts=stereo,apad,atrim=duration=${n3(durations[i])},asetpts=PTS-STARTPTS[a${i}]`)
    } else {
      parts.push(`anullsrc=channel_layout=stereo:sample_rate=${sampleRate},atrim=duration=${n3(durations[i])}[a${i}]`)
    }
    aLabels.push(`[a${i}]`)
  }
  parts.push(`${aLabels.join('')}concat=n=${n}:v=0:a=1[aout]`)
  return parts.join(';')
}

/**
 * Build the Drawn slides video. Expects slide_<i>.png and (for narrated
 * slides) audio_<i>.mp3 in `workDir`, like the classic path.
 * @returns {Promise<{ durations: number[], voice: [number, number][], total: number }>}
 */
async function assembleDrawnSlides({ workDir, slideCount, audioBuffers, outputPath, runFfmpeg, probeAudioDuration, onClip }) {
  const narr = []
  for (let i = 0; i < slideCount; i++) {
    const has = audioBuffers[i] && audioBuffers[i].length > 100
    if (!has) { narr.push(0); continue }
    const real = await probeAudioDuration(join(workDir, `audio_${i}.mp3`))
    narr.push(real > 0 ? real : Math.round(audioBuffers[i].length / 16000) + 0.2)
  }
  const tl = drawnTimeline(narr)

  // 1) one Ken Burns clip per slide (picture only)
  const clips = []
  for (let i = 0; i < slideCount; i++) {
    const clip = join(workDir, `kb_${i}.mp4`)
    await runFfmpeg([
      '-loop', '1', '-framerate', String(FPS), '-t', n3(tl.clipLengths[i]), '-i', join(workDir, `slide_${i}.png`),
      '-vf', kenBurnsFilter(i, tl.clipLengths[i]),
      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-y', clip,
    ])
    clips.push(clip)
    if (onClip) await onClip(i)
  }

  // 2) cross-fade the clips + the voice track, one pass
  const args = []
  for (const c of clips) args.push('-i', c)
  const audio = []
  let idx = clips.length
  for (let i = 0; i < slideCount; i++) {
    if (narr[i] > 0) { args.push('-i', join(workDir, `audio_${i}.mp3`)); audio.push(idx++) } else audio.push(-1)
  }
  args.push(
    '-filter_complex', joinFilter({ durations: tl.durations, audio }),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k',
    '-t', n3(tl.total),
    '-movflags', '+faststart', '-y', outputPath,
  )
  await runFfmpeg(args)
  return { durations: tl.durations, voice: tl.voice, total: tl.total }
}

module.exports = { FPS, TAIL, SILENT, XFADE, ZOOM, drawnTimeline, kenBurnsFilter, joinFilter, assembleDrawnSlides }
