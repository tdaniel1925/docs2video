import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate, spring, Easing } from 'remotion'

/**
 * THE MOTION KIT — what turns a deck into a commercial.
 *
 * A review of the first cut named the problem exactly: "it feels like a very
 * nice presentation deck being advanced". Every scene was a static composition
 * where things faded in and then held. The fix is not MORE animation — it is
 * PURPOSEFUL animation: the camera always drifting a little, elements arriving
 * in sequence rather than together, and things visibly happening because
 * Jordyn is doing the work.
 *
 * THE SPRING IS RESTRAINED ON PURPOSE. damping 20 / stiffness 120 gives a
 * confident settle with a hint of overshoot. The default Remotion spring
 * bounces, which reads as playful; this brand reads better as calm and sure.
 * Entrances land in 10-18 frames with 2-4 frame staggers between siblings.
 */
export const FPS = 30
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The house spring. Smooth, confident, very slight overshoot. */
export const ease = (frame: number, at: number, damping = 20, stiffness = 120) =>
  clamp(spring({ frame: frame - at, fps: FPS, config: { damping, stiffness, mass: 0.9 } }), 0, 1.15)

/** A firmer one for impacts — the stamp, the logo. */
export const hit = (frame: number, at: number) =>
  clamp(spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 220, mass: 0.9 } }), 0, 1.2)

/**
 * NO FRAME IS EVER STILL.
 *
 * A slow push-in or pull-back under the whole scene. Two or three percent is
 * enough — at that size it reads as "filmed" rather than "zooming", and it is
 * the single cheapest thing that stops a shot feeling like a slide.
 */
export const Camera: React.FC<{
  hold: number
  /** 'in' pushes toward the subject, 'out' pulls back to reveal. */
  dir?: 'in' | 'out'
  /** How far, as a fraction. 0.03 is three percent. */
  amount?: number
  /** A little horizontal drift, for scenes with room to move. */
  driftX?: number
  origin?: string
  children: React.ReactNode
}> = ({ hold, dir = 'in', amount = 0.03, driftX = 0, origin = '50% 50%', children }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, Math.max(1, hold)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad),
  })
  const scale = dir === 'in' ? 1 + amount * t : 1 + amount * (1 - t)
  const x = driftX * t
  return (
    <AbsoluteFill style={{ transform: `scale(${scale}) translateX(${x}px)`, transformOrigin: origin }}>
      {children}
    </AbsoluteFill>
  )
}

/**
 * Children arrive one after another rather than all at once.
 *
 * The four job-spec cards landing together is what made that scene read as a
 * slide; landing 4 frames apart makes it read as a list being written.
 */
export const Stagger: React.FC<{
  at?: number
  step?: number
  dist?: number
  /** 'up' rises into place, 'left' slides in from the right. */
  from?: 'up' | 'left' | 'scale'
  children: React.ReactNode[]
}> = ({ at = 4, step = 4, dist = 26, from = 'up', children }) => {
  const frame = useCurrentFrame()
  return (
    <>
      {React.Children.map(children, (child, i) => {
        const p = ease(frame, at + i * step)
        const k = clamp(p, 0, 1)
        const t = from === 'up' ? `translateY(${(1 - k) * dist}px)`
          : from === 'left' ? `translateX(${(1 - k) * dist}px)`
          : `scale(${0.92 + 0.08 * k})`
        return <div style={{ opacity: clamp(p * 1.6, 0, 1), transform: t }}>{child}</div>
      })}
    </>
  )
}

/** A checkbox that actually ticks, with the tick drawing itself. */
export const Tick: React.FC<{ at: number; size?: number; color: string; on?: string }> =
({ at, size = 30, color, on }) => {
  const frame = useCurrentFrame()
  const p = ease(frame, at, 18, 140)
  const draw = clamp((frame - at - 3) / 8, 0, 1)
  const filled = clamp(p, 0, 1)
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flex: '0 0 auto',
      border: `3px solid ${color}`,
      background: on ? `rgba(${parseInt(on.slice(1, 3), 16)},${parseInt(on.slice(3, 5), 16)},${parseInt(on.slice(5, 7), 16)},${filled * 0.16})` : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M4 12.5 L9.5 18 L20 6.5" stroke={on ?? color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="30" strokeDashoffset={30 * (1 - draw)} />
      </svg>
    </div>
  )
}

/**
 * A light sweep that travels across a piece of text once, as it lands.
 *
 * Used on the NEVER column — small, and it makes a static word feel switched
 * on rather than merely present.
 */
export const Sheen: React.FC<{ at: number; dur?: number; children: React.ReactNode }> =
({ at, dur = 20, children }) => {
  const frame = useCurrentFrame()
  const t = clamp((frame - at) / dur, 0, 1)
  return (
    <span style={{ position: 'relative', display: 'inline-block', overflow: 'hidden' }}>
      {children}
      <span style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)',
        transform: `translateX(${-120 + t * 260}%)`,
        opacity: t > 0 && t < 1 ? 1 : 0,
        pointerEvents: 'none',
      }} />
    </span>
  )
}

/**
 * THE SHOT SHAKES WHEN SOMETHING LANDS.
 *
 * A few frames of decaying wobble under an impact — the stamp, the logo. Two
 * or three pixels is plenty; more reads as an earthquake.
 */
export const Shake: React.FC<{ at: number; amount?: number; dur?: number; children: React.ReactNode }> =
({ at, amount = 5, dur = 14, children }) => {
  const frame = useCurrentFrame()
  const t = frame - at
  const decay = t >= 0 && t < dur ? (1 - t / dur) : 0
  const x = Math.sin(t * 2.9) * amount * decay
  const y = Math.cos(t * 3.4) * amount * 0.6 * decay
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px)` }}>{children}</AbsoluteFill>
}

/**
 * PARALLAX — layers move at different rates, so a flat composition gains depth.
 *
 * depth 0 is the background (barely moves), 1 is the foreground.
 */
export const Layer: React.FC<{ hold: number; depth: number; children: React.ReactNode }> =
({ hold, depth, children }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, Math.max(1, hold)], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) })
  return <AbsoluteFill style={{ transform: `translateY(${-t * 14 * depth}px) scale(${1 + t * 0.012 * depth})` }}>{children}</AbsoluteFill>
}

/**
 * TYPES ITSELF, one character at a time — for a drafted reply.
 *
 * A cursor blocks at the end while it runs, so it reads as being written now
 * rather than having been pasted.
 */
export const Typed: React.FC<{ text: string; at: number; cps?: number; style?: React.CSSProperties }> =
({ text, at, cps = 34, style }) => {
  const frame = useCurrentFrame()
  const n = clamp(Math.floor(((frame - at) / FPS) * cps), 0, text.length)
  const done = n >= text.length
  return (
    <span style={style}>
      {text.slice(0, n)}
      {!done && <span style={{ opacity: Math.floor(frame / 5) % 2 ? 1 : 0.25 }}>|</span>}
    </span>
  )
}
