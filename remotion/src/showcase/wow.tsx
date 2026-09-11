import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate, spring, Easing, random } from 'remotion'
import { FPS, clamp, ease } from './motion'

/**
 * THE WOW KIT — contrast, not more motion.
 *
 * The note on the last cut was that it is "much better but has no pop". That
 * is not a shortage of animation: the video already runs 83 effects. It is
 * that all fifteen beats are WEIGHTED THE SAME — the same layout, mostly the
 * same cream ground, each one politely fading in and holding for its turn.
 * Nothing spikes, so nothing lands.
 *
 * Everything here exists to make some beats hit much harder than their
 * neighbours, which only works if other beats get quieter. Three registers,
 * used in blocks so the switch between them is itself the event:
 *
 *   CINEMATIC — depth, blur, slow push. For the emotional beats.
 *   KINETIC   — slams, hard cuts, shake, flash. For the hard beats.
 *   DATA      — numbers and charts building themselves. For the proof beats.
 *
 * The beat grid is real (127.8 BPM, public/showcase/jordyn-hire/beatgrid.json)
 * so the slams can land on the actual kick rather than near it. A slam two
 * frames off the beat reads as a mistake; on it, it reads as expensive.
 */

/* ── KINETIC ──────────────────────────────────────────────────────────── */

/**
 * A word that SLAMS in — overshoots hard, then settles.
 *
 * Deliberately a different spring from the house one: damping 9 against the
 * house 20, so it arrives with force instead of confidence. Used on single
 * words, never on a sentence — the whole point is that one word is louder
 * than everything around it.
 */
export const Slam: React.FC<{
  at: number
  children: React.ReactNode
  /** How big it starts. 1.6 means it flies in from 60% oversized. */
  from?: number
  style?: React.CSSProperties
}> = ({ at, children, from = 1.6, style }) => {
  const frame = useCurrentFrame()
  const s = clamp(spring({ frame: frame - at, fps: FPS, config: { damping: 9, stiffness: 200, mass: 0.7 } }), 0, 1.2)
  const scale = from + (1 - from) * s
  return (
    <span style={{
      display: 'inline-block',
      transform: `scale(${scale})`,
      opacity: clamp(s * 3, 0, 1),
      ...style,
    }}>{children}</span>
  )
}

/**
 * THE WHOLE FRAME KICKS on an impact.
 *
 * Six frames, decaying. Large enough to feel in the body and short enough
 * that it never reads as a wobble — a long shake looks like a broken camera,
 * a short one looks like weight landing.
 */
export const Impact: React.FC<{ at: number; amount?: number; children: React.ReactNode }> = ({ at, amount = 14, children }) => {
  const frame = useCurrentFrame()
  const t = frame - at
  const decay = clamp(1 - t / 6, 0, 1)
  const on = t >= 0 && t < 6
  const x = on ? Math.sin(t * 2.9) * amount * decay : 0
  const y = on ? Math.cos(t * 3.7) * amount * 0.6 * decay : 0
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px)` }}>{children}</AbsoluteFill>
}

/**
 * A single-frame white blow-out on the beat.
 *
 * One frame at full, two fading. Any longer and it stops being a hit and
 * starts being a transition; this is meant to be felt more than seen.
 */
export const Flash: React.FC<{ at: number; color?: string; peak?: number }> = ({ at, color = '#FFFFFF', peak = 0.85 }) => {
  const frame = useCurrentFrame()
  const t = frame - at
  if (t < 0 || t > 3) return null
  const o = t === 0 ? peak : peak * clamp(1 - t / 3, 0, 1)
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: 'none' }} />
}

/**
 * A WHIP PAN between two states — the cut that hides the cut.
 *
 * Blurs and slides out, then in from the other side. Because the middle is a
 * heavy motion blur, the eye cannot tell that the content swapped, so two
 * unrelated scenes feel like one continuous camera move.
 */
export const Whip: React.FC<{
  at: number
  /** Total frames. 8 is a snap; 12 is a move. */
  dur?: number
  dir?: 'left' | 'right'
  children: React.ReactNode
}> = ({ at, dur = 8, dir = 'left', children }) => {
  const frame = useCurrentFrame()
  const t = clamp((frame - at) / dur, 0, 1)
  const sign = dir === 'left' ? -1 : 1
  /* Out and back: the midpoint is where the content is unreadable anyway. */
  const away = Math.sin(t * Math.PI)
  return (
    <AbsoluteFill style={{
      transform: `translateX(${sign * away * 420}px)`,
      filter: `blur(${away * 26}px)`,
    }}>{children}</AbsoluteFill>
  )
}

/**
 * Type that arrives one word at a time, each one landing on a beat.
 *
 * Different from a typewriter: whole WORDS appear, so the line stays readable
 * the entire way through and each arrival can be synced to the kick.
 */
export const WordsOnBeat: React.FC<{
  text: string
  /** Frame of the first word. */
  at: number
  /** Frames between words — feed it the beat spacing, not a guess. */
  every: number
  style?: React.CSSProperties
  accent?: string
  /** Which words get the accent color, by index. */
  accentAt?: number[]
}> = ({ text, at, every, style, accent, accentAt = [] }) => {
  const frame = useCurrentFrame()
  const words = text.split(' ')
  /*
   * THE LINE IS CENTERED FROM FRAME ONE, NOT ONCE IT IS FULL.
   *
   * A word that has not arrived yet is still laid out — opacity 0, full
   * width — so the finished line's width is known immediately and a centered
   * parent centers THAT, rather than centering however much has appeared so
   * far. The first render grew left-to-right and the whole line slid right
   * under the viewer as each word landed, which reads as a layout fault
   * rather than an effect.
   *
   * `block` matters: an inline span is only as wide as its content, which is
   * what defeated the parent's textAlign in the first place.
   */
  return (
    <span style={{ display: 'block', ...style }}>
      {words.map((w, i) => {
        const t = at + i * every
        const s = clamp(spring({ frame: frame - t, fps: FPS, config: { damping: 11, stiffness: 190, mass: 0.7 } }), 0, 1.15)
        return (
          <span key={i} style={{
            display: 'inline-block',
            /*
             * THE LINE MUST NOT GROW AS IT BUILDS.
             *
             * Every word holds its own space from frame one and only its
             * OPACITY changes — so a centered line stays centered instead of
             * sliding left to right as each word lands. The first render had
             * the words appearing one at a time in a line that visibly
             * shifted under them, which reads as a layout bug, not a effect.
             *
             * Scale is applied without affecting layout for the same reason:
             * an inline-block's transform does not reflow its neighbours.
             */
            transform: `translateY(${(1 - s) * 26}px) scale(${0.86 + 0.14 * s})`,
            opacity: clamp(s * 2.4, 0, 1),
            /* No trailing space on the last word — it offsets a centered line
               by half a space, which is visible at 62px. */
            marginRight: i === words.length - 1 ? 0 : '0.28em',
            color: accent && accentAt.includes(i) ? accent : undefined,
          }}>{w}</span>
        )
      })}
    </span>
  )
}

/* ── CINEMATIC ────────────────────────────────────────────────────────── */

/**
 * DEPTH, by moving layers at different speeds.
 *
 * `depth` 0 is the far background and 1 is right against the lens. Far things
 * move slowly and stay slightly blurred; near things move fast and sharpen.
 * This is the cheapest convincing 3D in a 2D renderer.
 */
export const Parallax: React.FC<{
  hold: number
  depth: number
  /** How far the whole rig travels over the beat, in pixels at depth 1. */
  travel?: number
  dir?: 'in' | 'out'
  children: React.ReactNode
}> = ({ hold, depth, travel = 90, dir = 'in', children }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, Math.max(1, hold)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad),
  })
  const sign = dir === 'in' ? 1 : -1
  const move = sign * t * travel * depth
  const scale = 1 + sign * t * 0.06 * depth
  /* Far layers never come fully sharp — that is what sells the distance. */
  const blur = (1 - depth) * 3.5
  return (
    <AbsoluteFill style={{
      transform: `translateY(${-move}px) scale(${scale})`,
      filter: blur > 0.15 ? `blur(${blur}px)` : undefined,
    }}>{children}</AbsoluteFill>
  )
}

/**
 * A FOCUS RACK — the frame resolves from soft to sharp.
 *
 * Opening a beat out of focus buys a real moment of anticipation before the
 * content is readable, which is most of what makes a title sequence feel
 * expensive. Kept under 14 frames so it never feels like a slow load.
 */
export const FocusIn: React.FC<{ at?: number; dur?: number; from?: number; children: React.ReactNode }> = ({ at = 0, dur = 12, from = 18, children }) => {
  const frame = useCurrentFrame()
  const t = clamp((frame - at) / dur, 0, 1)
  const eased = Easing.out(Easing.cubic)(t)
  return (
    <AbsoluteFill style={{
      filter: eased < 0.99 ? `blur(${from * (1 - eased)}px)` : undefined,
      transform: `scale(${1.06 - 0.06 * eased})`,
    }}>{children}</AbsoluteFill>
  )
}

/**
 * A slow band of light crossing the frame.
 *
 * Not the SettleSweep, which marks the end of a beat — this runs the whole
 * length underneath everything and just keeps the picture alive.
 */
export const LightRay: React.FC<{ hold: number; color?: string; angle?: number }> = ({ hold, color = 'rgba(255,255,255,0.16)', angle = 18 }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, Math.max(1, hold)], [-0.4, 1.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', top: '-40%', bottom: '-40%',
        left: `${t * 100}%`, width: 420,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        transform: `rotate(${angle}deg)`,
        filter: 'blur(24px)',
      }} />
    </AbsoluteFill>
  )
}

/**
 * A soft vignette, so the middle of the frame carries the eye.
 *
 * Every cinematic beat gets one. It is the difference between "a slide with a
 * dark background" and "a shot".
 */
export const Vignette: React.FC<{ amount?: number }> = ({ amount = 0.5 }) => (
  <AbsoluteFill style={{
    background: `radial-gradient(ellipse at 50% 45%, transparent 38%, rgba(0,0,0,${amount}) 100%)`,
    pointerEvents: 'none',
  }} />
)

/* ── DATA ─────────────────────────────────────────────────────────────── */

/**
 * PARTICLES THAT GATHER INTO A SHAPE.
 *
 * They start scattered and converge on their targets, which reads as many
 * separate things becoming one — the literal claim the product makes. Seeded
 * through Remotion's `random` so every render is identical; Math.random here
 * would make the frames disagree with each other and strobe.
 */
export const Swarm: React.FC<{
  at: number
  /** Where each dot ends up, in frame coordinates. */
  targets: { x: number; y: number }[]
  color?: string
  size?: number
  /** Frames for the whole gather. */
  dur?: number
}> = ({ at, targets, color = '#C4603F', size = 9, dur = 26 }) => {
  const frame = useCurrentFrame()
  return (
    <>
      {targets.map((p, i) => {
        const seed = `swarm-${i}`
        const sx = random(seed + 'x') * 1920
        const sy = random(seed + 'y') * 1080
        /* Staggered so they do not all land on the same frame. */
        const start = at + (random(seed + 'd') * dur * 0.5)
        const t = clamp((frame - start) / dur, 0, 1)
        const e = Easing.out(Easing.cubic)(t)
        return (
          <div key={i} style={{
            position: 'absolute',
            left: sx + (p.x - sx) * e,
            top: sy + (p.y - sy) * e,
            width: size, height: size, borderRadius: '50%',
            background: color,
            opacity: clamp(t * 2, 0, 1) * (0.45 + 0.55 * e),
          }} />
        )
      })}
    </>
  )
}

/**
 * A bar chart that draws itself, bar by bar.
 *
 * Each bar grows from the baseline on its own beat, so the chart assembles in
 * time with the music rather than all at once.
 */
export const GrowBars: React.FC<{
  at: number
  /** 0-1 heights. */
  values: number[]
  every?: number
  color?: string
  height?: number
  width?: number
  gap?: number
}> = ({ at, values, every = 4, color = '#8FA97E', height = 260, width = 54, gap = 18 }) => {
  const frame = useCurrentFrame()
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, height }}>
      {values.map((v, i) => {
        const s = ease(frame, at + i * every)
        return (
          <div key={i} style={{
            width, height: height * v * clamp(s, 0, 1),
            background: color, borderRadius: 8,
            opacity: clamp(s * 2, 0, 1),
          }} />
        )
      })}
    </div>
  )
}

/**
 * A ring that fills to a percentage, with the number counting alongside it.
 *
 * Reads as a live gauge rather than a decorated statistic, which is the
 * difference between "a number on a slide" and "a system reporting".
 */
export const Dial: React.FC<{
  at: number
  to: number
  suffix?: string
  color?: string
  track?: string
  size?: number
  dur?: number
}> = ({ at, to, suffix = '%', color = '#C4603F', track = 'rgba(0,0,0,0.08)', size = 240, dur = 30 }) => {
  const frame = useCurrentFrame()
  const t = clamp((frame - at) / dur, 0, 1)
  const e = Easing.out(Easing.cubic)(t)
  const r = size / 2 - 14
  const circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={16} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={16}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - e * (to / 100))} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: size * 0.26, color,
        /* Descenders on % clip against a tight line box — see the house rule. */
        lineHeight: 1.25, paddingBottom: 4,
      }}>{Math.round(to * e)}{suffix}</div>
    </div>
  )
}
