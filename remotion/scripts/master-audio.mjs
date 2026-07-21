// Professional audio master for a video: builds ONE continuous VO track from the
// per-scene clips (placed at their real timeline positions), loudness-normalizes
// both VO and music, then SIDECHAIN-DUCKS the music under the VO so the voice is
// ALWAYS on top. Outputs a single `voMaster.mp3` (full VO on the timeline) and a
// `musicDucked.mp3` (music that dips whenever the VO speaks). Remotion then just
// plays those two at volume 1.0.
//
// Usage: DIR=apex node scripts/master-audio.mjs
//   DIR       = public/<DIR>/ folder holding vo-*.mp3 + music.mp3 + durations.json
//   INTRO     = seconds before the first VO (default 3.2 - intro_xf 0.5 = 2.7)
//   PAD, XF   = per-scene pad / crossfade (must match the composition)
import { readFileSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIR = process.env.DIR || 'apex'
const P = join(HERE, '..', 'public', DIR)
const FPS = 30
const PAD = parseFloat(process.env.PAD || '0.6')
const XF = parseFloat(process.env.XF || '0.4')
const BODY_START = parseFloat(process.env.BODY_START || (3.2 - 0.5)) // intro - intro_xf
const VO_OFFSET = parseFloat(process.env.VO_OFFSET || '0.18') // per-scene VO nudge; 0 = VO lands exactly when the slide appears
const log = (...a) => console.log('[master]', ...a)

const data = JSON.parse(readFileSync(join(P, 'durations.json'), 'utf8'))
const vo = data.vo
const n = vo.length

// compute each VO clip's absolute start time on the timeline (mirrors the comp)
const segD = vo.map((d) => (d || 7) + PAD)
let cursor = 0
const starts = segD.map((d) => { const s = BODY_START + cursor + VO_OFFSET; cursor += d - XF; return s })

// total timeline length (body). music is at least this long.
const bodyEnd = BODY_START + segD.reduce((a, b) => a + b, 0) - (n - 1) * XF
const totalSec = Math.ceil(bodyEnd + 5)
log(`VO clips: ${n}, timeline ~${totalSec}s`)

// 1) Build one continuous VO track: place each clip at its start time (adelay),
//    normalize each to a consistent speech loudness, then mix them.
// BULLETPROOF placement: CONCATENATE [silence gap][clip][silence gap][clip]...
// The beats are sequential (never overlap), so simple concatenation puts each clip
// at its exact absolute start with zero risk of amix/adelay re-basing the timeline
// (the old adelay+amix approach silently slid the whole VO ~INTRO seconds early).
// Gap before clip i = starts[i] - (end of clip i-1). First gap = BODY_START.
const voMaster = join(P, 'voMaster.mp3')
const parts = []                    // filter labels to concat, in order
const inputs = []
const filters = []
let inIdx = 0
let clock = 0                       // running end-time of what we've placed
const silenceLabel = (durSec, tag) => {
  // anullsrc silence of the given duration
  filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${durSec.toFixed(3)}[${tag}]`)
  return `[${tag}]`
}
for (let i = 0; i < n; i++) {
  const gap = Math.max(0, starts[i] - clock)
  if (gap > 0.001) parts.push(silenceLabel(gap, `sil${i}`))
  inputs.push('-i', join(P, `vo-${i}.mp3`))
  filters.push(`[${inIdx}:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[c${i}]`)
  parts.push(`[c${i}]`)
  clock = starts[i] + vo[i]         // clip's real (untrimmed) length
  inIdx++
}
// tail silence to reach totalSec
if (totalSec - clock > 0.001) parts.push(silenceLabel(totalSec - clock, 'siltail'))
filters.push(`${parts.join('')}concat=n=${parts.length}:v=0:a=1[vo]`)
execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[vo]', '-ar', '44100', '-ac', '2', voMaster], { stdio: 'ignore' })
log('voMaster.mp3 built (continuous VO on the timeline)')

// 2) Sidechain-duck the music under the VO:
//    - loudnorm the music to a steady level (kills the progressive swell)
//    - sidechaincompress: music is compressed hard WHENEVER the VO is present
//    - result: music sits at a comfortable bed level, dips further under speech,
//      and comes back up in the gaps — VO is always on top.
const music = join(P, 'music.mp3')
const musicDucked = join(P, 'musicDucked.mp3')
// music chain: loudnorm to a lower target than VO (-23 LUFS bed), gentle limiter,
// then duck against the VO sidechain. threshold/ratio tuned so speech clearly wins.
execFileSync('ffmpeg', ['-y',
  '-i', music, '-i', voMaster,
  '-filter_complex',
  // [0]=music bed, [1]=vo sidechain key.
  // MUSIC PREP: dynaudnorm FIRST evens out the track's internal level (so the
  // compressor isn't fighting the swell), then loudnorm to a steady bed target.
  // aloop FIRST so the music always FILLS the full timeline (ElevenLabs caps music
  // at ~300s; long videos ran out ~35s early). loop=-1 = infinite, then atrim to
  // exact length. size is samples-per-loop; 2^31-1 lets aloop hold the whole track.
  `[0:a]aresample=44100,aloop=loop=-1:size=2147483647,dynaudnorm=f=250:g=15:p=0.9:m=6,loudnorm=I=-24:TP=-3:LRA=5,atrim=0:${totalSec}[bed];` +
  // KEY: smooth the VO envelope so the ducking follows the OVERALL speech, not
  // every syllable — this is what kills the pumping. Lowpass + slow gate-ish
  // smoothing on the sidechain key.
  `[1:a]aresample=44100,lowpass=f=1000[key];` +
  // GENTLE duck: low ratio + SLOW attack & LONG release so the music glides down
  // under speech and eases back up smoothly (no lurching / gain-pumping).
  `[bed][key]sidechaincompress=threshold=0.05:ratio=3:attack=120:release=900:makeup=1:link=average[ducked];` +
  // 3s fade-out at the very end so music resolves cleanly (was cutting off abruptly).
  `[ducked]alimiter=limit=0.9,afade=t=out:st=${(totalSec - 3).toFixed(2)}:d=3[out]`,
  '-map', '[out]', '-ar', '44100', '-ac', '2', musicDucked,
], { stdio: 'ignore' })
log('musicDucked.mp3 built (music loops to full length + fades out at end)')
log('DONE — point the composition at voMaster.mp3 + musicDucked.mp3 at volume 1.0')
