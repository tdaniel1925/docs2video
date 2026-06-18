import { interpolate, Easing } from 'remotion'
import { MOTION } from './tokens'

/**
 * Frame-accurate "settle" entrance: returns 0→1 progress for an element that
 * starts at `delayFrames`, easing with the Aurora settle curve. Deterministic —
 * pure function of the current frame.
 */
export function settleProgress(frame: number, delayFrames: number): number {
  return interpolate(
    frame,
    [delayFrames, delayFrames + MOTION.entranceFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(MOTION.settle[0], MOTION.settle[1], MOTION.settle[2], MOTION.settle[3]),
    }
  )
}

/** A gentle continuous float (for background drift), frame-based. */
export function drift(frame: number, periodFrames: number, amplitude: number): number {
  return Math.sin((frame / periodFrames) * Math.PI * 2) * amplitude
}
