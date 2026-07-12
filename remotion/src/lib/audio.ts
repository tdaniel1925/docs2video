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
