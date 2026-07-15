/* FRAMECHECK — the VISUAL/MOTION quality gate that preflight.mjs lacks. It works
 * on a RENDERED mp4 (pixels, not source), so it catches the class of bug that
 * still-picking misses: end-of-video FLASHING/flicker, empty/broken beats, and
 * hard-cut jank. It also lays down an evenly-spaced frame sweep so a human (or
 * me) can LOOK at the whole video, not 2 cherry-picked frames.
 *
 * How it works (all via ffmpeg/ffprobe, no deps):
 *   1. Extract N evenly-spaced frames across the FULL duration → out dir.
 *   2. For each frame compute average R,G,B + luma (via ffmpeg signalstats).
 *   3. FLASH = |luma[i] - luma[i-1]| jumps beyond a threshold repeatedly in a
 *      short window (flicker) OR any single jump > hard threshold near the end.
 *   4. EMPTY = a frame whose color variance is ~0 (one flat color = dead beat).
 *   5. Prints a verdict + the exact suspect frame files to open.
 *
 * Usage: node scripts/director/framecheck.mjs <video.mp4> [--frames=40] [--out=dir]
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true] }))
const video = process.argv[2]
if (!video || !fs.existsSync(video)) { console.error('usage: framecheck.mjs <video.mp4> [--frames=40] [--out=dir]'); process.exit(2) }
const N = parseInt(args.frames || '40', 10)
const OUT = args.out || path.join(path.dirname(video), 'framecheck-' + path.basename(video, path.extname(video)))
fs.mkdirSync(OUT, { recursive: true })

function sh(cmd) { return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString() }
function dur() { return parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${video}"`).trim()) }

const D = dur()
const fps = 30
const totalFrames = Math.round(D * fps)
console.log(`\n▶ framecheck: ${path.basename(video)}  (${D.toFixed(1)}s, ~${totalFrames} frames)\n`)

// ---- PER-FRAME FLASH DETECTION (the real fix) ----
// One cheap ffmpeg pass outputs EVERY frame's average luma (signalstats YAVG via
// metadata). A flash/flicker is a 1-3 frame luma spike that reverses — invisible
// to a 40-frame sweep but obvious frame-by-frame. This is what a still can't see
// and what the coarse sweep missed.
function perFrameFlash() {
  let raw
  try {
    // metadata=print writes lavfi.signalstats.YAVG per frame to stdout
    raw = execSync(`ffmpeg -loglevel error -i "${video}" -vf "signalstats,metadata=print:file=-" -f null - 2>/dev/null`, { maxBuffer: 1 << 28 }).toString()
  } catch (e) {
    try { raw = (e.stdout || '').toString() } catch { raw = '' }
  }
  const ys = [...raw.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) => parseFloat(m[1]))
  if (ys.length < 10) return { ok: false, luma: [], flashes: [], note: 'per-frame luma unavailable' }
  const flashes = []
  // A real FLASH is a jump that comes BACK (a lone bright/dark frame or a wide
  // blowout that reverses) — NOT a clean hard CUT between a dark scene and a
  // bright one that STAYS bright. Distinguishing them avoids false-positives on
  // normal scene cuts (BCBS: a dark beat cut to a bright sunset shot, 17→78,
  // stayed 78 — that's a cut, not a flash).
  const SPIKE = 22, HARD = 60, NEAR_WHITE = 205, WINDOW = 8, RETURN_FRAC = 0.55
  for (let i = 1; i < ys.length - 1; i++) {
    const dPrev = ys[i] - ys[i - 1], dNext = ys[i] - ys[i + 1]
    // (a) 1-3 frame flicker: differs from BOTH neighbors same-direction
    if (Math.abs(dPrev) > SPIKE && Math.abs(dNext) > SPIKE && Math.sign(dPrev) === Math.sign(dNext)) {
      flashes.push({ frame: i, t: i / fps, luma: ys[i], prev: ys[i - 1], next: ys[i + 1], kind: 'flicker' }); continue
    }
    // (b) a big jump — only a FLASH if it REVERSES within WINDOW frames (returns
    // toward the pre-jump level) or peaks near-white. A sustained jump = a cut.
    if (Math.abs(dPrev) > HARD) {
      const from = ys[i - 1], to = ys[i]
      let reverses = false
      for (let j = i + 1; j <= Math.min(ys.length - 1, i + WINDOW); j++) {
        // did luma come back at least RETURN_FRAC of the way toward `from`?
        if (Math.abs(ys[j] - from) < Math.abs(to - from) * (1 - RETURN_FRAC)) { reverses = true; break }
      }
      if (reverses || to >= NEAR_WHITE) {
        flashes.push({ frame: i, t: i / fps, luma: ys[i], prev: ys[i - 1], next: ys[i + 1], kind: to >= NEAR_WHITE ? 'white-flash' : 'reversing-jump' })
      }
      // else: sustained jump = a clean scene CUT — not flagged
    }
  }
  // collapse adjacent flash frames into single events
  const events = []
  for (const f of flashes) { const last = events[events.length - 1]; if (last && f.frame - last.endFrame <= 3) { last.endFrame = f.frame } else events.push({ startFrame: f.frame, endFrame: f.frame, t: f.t, luma: f.luma, prev: f.prev, next: f.next }) }
  return { ok: true, luma: ys, flashes: events }
}
const flashResult = perFrameFlash()

// 1. extract N evenly-spaced frames as jpgs (00.jpg ... N-1.jpg), with their frame index
const idxs = Array.from({ length: N }, (_, i) => Math.min(totalFrames - 1, Math.round((i / (N - 1)) * (totalFrames - 1))))
const stats = []
for (let i = 0; i < N; i++) {
  const t = idxs[i] / fps
  const jpg = path.join(OUT, `${String(i).padStart(2, '0')}_f${idxs[i]}.jpg`)
  sh(`ffmpeg -y -loglevel error -ss ${t.toFixed(3)} -i "${video}" -frames:v 1 "${jpg}"`)
  // signalstats: average luma + per-channel avg via a second pass on the jpg
  const s = sh(`ffmpeg -loglevel error -i "${jpg}" -vf "signalstats,metadata=print" -f null - 2>&1 || true`)
  const yavg = parseFloat((s.match(/YAVG:([\d.]+)/) || [])[1] || 'NaN')
  // color spread via crop-free stddev proxy: use signalstats YHIGH-YLOW as variance proxy
  const yhigh = parseFloat((s.match(/YHIGH:([\d.]+)/) || [])[1] || 'NaN')
  const ylow = parseFloat((s.match(/YLOW:([\d.]+)/) || [])[1] || 'NaN')
  const spread = (isNaN(yhigh) || isNaN(ylow)) ? NaN : (yhigh - ylow)
  stats.push({ i, frame: idxs[i], t, jpg: path.basename(jpg), yavg, spread })
}

// 2. analyze
const fails = [], warns = []
for (let i = 1; i < stats.length; i++) {
  const a = stats[i - 1], b = stats[i]
  const dLuma = Math.abs(b.yavg - a.yavg)
  // a big luma jump between adjacent SAMPLED frames (which are ~D/N apart) that
  // then REVERSES on the next sample = flicker/flash. Detect an up-down spike.
  if (i < stats.length - 1) {
    const c = stats[i + 1]
    const up = b.yavg - a.yavg, down = b.yavg - c.yavg
    if (Math.abs(up) > 40 && Math.abs(down) > 40 && Math.sign(up) === Math.sign(down)) {
      fails.push(`FLASH/flicker spike at ~${b.t.toFixed(1)}s (frame ${b.frame}, luma ${a.yavg.toFixed(0)}→${b.yavg.toFixed(0)}→${c.yavg.toFixed(0)}) — open ${b.jpg}`)
    }
  }
  // near-end hard flash: last 20% of the video, any big swing
  if (b.t > D * 0.8 && dLuma > 55) warns.push(`Large luma swing near end at ~${b.t.toFixed(1)}s (${a.yavg.toFixed(0)}→${b.yavg.toFixed(0)}) — check ${b.jpg} for end-flashing`)
}
// empty/flat frames
for (const s of stats) {
  if (!isNaN(s.spread) && s.spread < 12) warns.push(`Near-flat frame at ~${s.t.toFixed(1)}s (frame ${s.frame}, spread ${s.spread.toFixed(0)}) — possible empty/broken beat: ${s.jpg}`)
}

// per-frame flash events → fails (these are the end-flashing class of bug)
if (flashResult.ok) {
  for (const ev of flashResult.flashes) {
    const span = ev.endFrame - ev.startFrame + 1
    fails.push(`FLASH: ${span}-frame luma spike at ~${ev.t.toFixed(2)}s (frame ${ev.startFrame}${span > 1 ? '-' + ev.endFrame : ''}, ${ev.prev.toFixed(0)}→${ev.luma.toFixed(0)}→${ev.next.toFixed(0)}) — a 1-3 frame flash/flicker`)
  }
  console.log(`  per-frame luma scan: ${flashResult.luma.length} frames analyzed, ${flashResult.flashes.length} flash event(s)`)
} else {
  warns.push(`per-frame flash scan unavailable (${flashResult.note || 'ffmpeg metadata not parsed'}) — flashing NOT verified`)
}

// 3. verdict
console.log(`  swept ${N} frames → ${OUT}`)
if (fails.length) { console.log(`\n  ✗ ${fails.length} FAIL:`); fails.forEach((f) => console.log('    ✗ ' + f)) }
if (warns.length) { console.log(`\n  ⚠ ${warns.length} WARN:`); warns.forEach((w) => console.log('    ⚠ ' + w)) }
if (!fails.length && !warns.length) console.log('\n  ✓ no flash/empty-frame issues detected in the sweep')
console.log(`\n  → REVIEW ALL ${N} frames in ${OUT} before declaring the video good. Do NOT trust 2 stills.\n`)
process.exit(fails.length ? 1 : 0)
