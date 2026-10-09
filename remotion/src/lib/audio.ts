import { interpolate } from 'remotion'

/* ============================================================================
 * AUDIO plumbing — shared across all videos. Pure functions, identical math to
 * the copy-pasted versions; only the per-brand tuning VALUES differ (passed in).
 * Consolidates the duplicated musicDuck envelope + beat-lock snap logic.
 * ==========================================================================*/

export type VoWindow = { start: number; end: number }

export type DuckOpts = {
  loud?: number      // music level when no VO (per-brand taste)
  duck?: number      // music level under VO
  ramp?: number      // frames to ramp in/out (longer = gentler, no pump)
  fadeInEnd?: number // frame the opening fade-in completes
  fadeOutStart?: number // frame the closing fade-out begins (defaults total-24)
  fadeOutEnd?: number   // frame fully faded (defaults total-6)
}

/**
 * Build the smooth music-ducking volume function.
 *   · music sits at `loud` except while VO plays, where it eases to `duck`
 *   · one continuous smoothstep envelope → no pops, no pumping
 *   · opening fade-in + closing fade-out
 * Returns a (frame) => volume function to pass to <Audio volume={...} />.
 */
export function makeMusicDuck(voWindows: VoWindow[], total: number, opts: DuckOpts = {}) {
  const LOUD = opts.loud ?? 0.3
  const DUCK = opts.duck ?? 0.1
  const RAMP = opts.ramp ?? 18
  const fadeInEnd = opts.fadeInEnd ?? 16
  const fadeOutStart = opts.fadeOutStart ?? total - 24
  const fadeOutEnd = opts.fadeOutEnd ?? total - 6
  const clampOpts = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const }
  return (f: number): number => {
    let voice = 0
    for (const w of voWindows) {
      voice = Math.max(voice, Math.min(
        interpolate(f, [w.start - RAMP, w.start], [0, 1], clampOpts),
        interpolate(f, [w.end - RAMP, w.end], [1, 0], clampOpts)))
    }
    const eased = voice * voice * (3 - 2 * voice) // smoothstep
    const level = LOUD + (DUCK - LOUD) * eased
    const fade = interpolate(f, [0, fadeInEnd, fadeOutStart, fadeOutEnd], [0, 1, 1, 0], clampOpts)
    return level * fade
  }
}

/**
 * Snap raw cumulative beat-start frames to the nearest beat on the grid, so cuts
 * land on the musical pulse. First start stays at 0; others nudge ≤ maxNudge so
 * VO stays in sync. Returns the snapped starts (cascades — each subsequent cut is
 * on-grid too).
 */
export function beatLock(rawStarts: number[], gridFrames: number[], maxNudge: number): number[] {
  const snap = (f: number): number => {
    let best = f, bd = Infinity
    for (const g of gridFrames) {
      const d = Math.abs(g - f)
      if (d < bd && d <= maxNudge) { bd = d; best = g }
    }
    return best
  }
  // first start is fixed (usually 0, or the intro offset); the rest snap to grid
  return rawStarts.map((s, i) => (i === 0 ? s : snap(s)))
}

/** Helper: convert a beatgrid.json (beats in seconds) to frames at a given fps. */
export function gridToFrames(beatsSec: number[], fps: number): number[] {
  return beatsSec.map((s) => Math.round(s * fps))
}

/** Helper: derive per-beat durations from snapped starts that tile with no gaps. */
export function durationsFromStarts(starts: number[], totalMinusTail: number): number[] {
  return starts.map((s, i) => (i < starts.length - 1 ? starts[i + 1] : totalMinusTail) - s)
}

/**
 * The explainer videos' music envelope (Slide Deck / DirectedVideo, Cinematic /
 * Aurora / V3Video, Editorial, Infographic) — the SAME levels as the commercial
 * template: 0.20 between lines, 0.08 under the voice, short smooth ramps, a fade
 * in at the start and out at the end. The ffmpeg mixes in the render service
 * (render-service/audio-mix.js) use the same numbers.
 */
export const EXPLAINER_MUSIC = { loud: 0.2, duck: 0.08, ramp: 12 } as const
export function explainerMusicDuck(voWindows: VoWindow[], total: number) {
  const fadeInEnd = Math.max(1, Math.min(30, Math.round(total * 0.1)))
  const fadeOutStart = Math.max(fadeInEnd + 1, total - Math.min(45, Math.round(total * 0.15)))
  const fadeOutEnd = Math.max(fadeOutStart + 1, total - 6)
  return makeMusicDuck(voWindows, total, { ...EXPLAINER_MUSIC, fadeInEnd, fadeOutStart, fadeOutEnd })
}

/**
 * Voice windows for a run of back-to-back scenes that each play their own voice
 * file from their first frame (V3, Editorial, Infographic). A scene is its voice
 * plus a short pad, so the window ends a little before the scene does.
 */
export function sceneVoiceWindows(scenes: { durationInFrames: number; audio?: string | null }[], startAt = 0): VoWindow[] {
  const out: VoWindow[] = []
  let t = startAt
  for (const sc of scenes) {
    const d = Math.max(0, sc.durationInFrames || 0)
    if (sc.audio && d > 0) out.push({ start: t, end: t + Math.max(1, d - Math.min(24, Math.round(d * 0.15))) })
    t += d
  }
  return out
}
