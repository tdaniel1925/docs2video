import React from 'react'
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { useKit } from './theme'

// =============================================================================
// ONE MOTION SYSTEM for every kit scene.
//
//  settle()    an element arriving: rises a little, fades in, settles — the
//              speed comes from the look's feel (calm slower, energetic faster).
//  spread()    when item i of n appears: spread across the voice, never all
//              in the first second (the "never freeze" rule).
//  landing()   a count-up that LANDS on the narrated word (word timings from
//              the voice service), with a fallback when there are none.
//  <Alive>     keeps a scene moving for its whole length: a slow drift and a
//              breath that never stop.
// =============================================================================

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** 0→1 as an element arrives at `at` (scene frames). */
export function useSettle(at: number, dur = 18): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { speed } = useKit()
  return spring({ frame: (frame - at) * speed, fps, config: { damping: 18, stiffness: 120, mass: 0.9 }, durationInFrames: dur })
}

/** Style for an arriving element: rise + fade (+ optional scale). */
export function settleStyle(p: number, opts: { rise?: number; scale?: number; x?: number } = {}): React.CSSProperties {
  const rise = opts.rise ?? 28
  const sc = opts.scale ? 1 - opts.scale * (1 - p) : 1
  return {
    opacity: clamp01(p * 1.25),
    transform: `translate(${(1 - p) * (opts.x ?? 0)}px, ${(1 - p) * rise}px) scale(${sc})`,
  }
}

/**
 * When item i of n should appear. Items are spread from `from` to `to`
 * (scene frames) — usually the voice's first 10% to 75% — so new things keep
 * arriving while the voice talks. A cue frame (the item's words being said)
 * wins when it is in range.
 */
export function spread(i: number, n: number, from: number, to: number, cue?: number | null): number {
  const even = n <= 1 ? from : Math.round(from + ((to - from) * i) / (n - 1))
  if (cue != null && cue >= from - 6 && cue <= to + 30) return Math.max(from, cue - 4)
  return even
}

/**
 * The count-up for a hero number: runs for `run` frames and FINISHES on the
 * landing frame (the narrated word). Returns 0..1 progress plus a "just
 * landed" pulse (1 at landing, decaying) for the impact.
 */
export function useLanding(landAt: number, run = 34): { p: number; pulse: number } {
  const frame = useCurrentFrame()
  const { speed } = useKit()
  const r = Math.max(14, Math.round(run / speed))
  const p = interpolate(frame, [landAt - r, landAt], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const since = frame - landAt
  const pulse = since < 0 ? 0 : Math.exp(-since / 9)
  return { p, pulse }
}

/** A gentle wave for things that have landed (idle motion). */
export function useIdle(rate = 0.035, amp = 1, phase = 0): number {
  const frame = useCurrentFrame()
  return Math.sin(frame * rate + phase) * amp
}

/**
 * Keeps a scene alive for its whole length: slow drift + breath. Subtle by
 * design — the eye reads it as "living", never as "wobbling".
 */
export const Alive: React.FC<{ children: React.ReactNode; amount?: number; style?: React.CSSProperties }> = ({ children, amount = 1, style }) => {
  const frame = useCurrentFrame()
  const { speed } = useKit()
  const a = amount * (0.7 + speed * 0.3)
  const dx = Math.sin(frame * 0.011) * 5 * a
  const dy = Math.cos(frame * 0.009) * 4 * a
  const s = 1 + (Math.sin(frame * 0.017) * 0.004 + frame * 0.00003) * a
  return <div style={{ position: 'absolute', inset: 0, transform: `translate(${dx}px, ${dy}px) scale(${s})`, ...style }}>{children}</div>
}

/** A soft light sweep across the content late in a long hold (a fresh motion event). */
export const LateSweep: React.FC<{ at: number; color: string }> = ({ at, color }) => {
  const frame = useCurrentFrame()
  const p = clamp01((frame - at) / 30)
  if (p <= 0 || p >= 1) return null
  const x = interpolate(p, [0, 1], [-40, 140])
  const o = interpolate(p, [0, 0.35, 1], [0, 0.22, 0])
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', opacity: o }}>
      <div style={{ position: 'absolute', top: '-20%', left: `${x}%`, width: '38%', height: '140%', background: `linear-gradient(100deg, transparent, ${color}, transparent)`, transform: 'skewX(-14deg)', filter: 'blur(26px)' }} />
    </div>
  )
}

// The cuts (calm = dissolve, build = push, reveal = zoom-through) live in KitVideo.tsx (cut()).
