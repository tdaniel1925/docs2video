import React from 'react'
import { Img, staticFile, useCurrentFrame, interpolate, spring, Easing, AbsoluteFill } from 'remotion'

/**
 * THE PRODUCT, SHOWN RATHER THAN DESCRIBED.
 *
 * The film ran on eight illustrations and read as a slide deck. The Restylez
 * film it was meant to match runs on 25 real product screenshots — actual
 * flyers, real before-and-afters, one beat with twelve on screen at once. That
 * is the whole difference, and three rounds of motion work could not close it:
 * nobody can judge an illustration of an inbox, and everybody can judge a real
 * one.
 *
 * These helpers exist to put real captures on screen the way that film does —
 * big, moving, overlapping, and often several at once.
 */

const FPS = 30
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const R = (n: string) => staticFile(`showcase/jordyn-hire/real/${n}`)

const pop = (frame: number, at: number, damping = 14) =>
  clamp(spring({ frame: frame - at, fps: FPS, config: { damping, stiffness: 150, mass: 0.85 } }), 0, 1.15)

/**
 * A REAL SCREEN, FILLING THE FRAME.
 *
 * `width` is a fraction of the 1920 stage, and the default is deliberately
 * large: the old beats topped out at a 480px illustration — 25% of frame —
 * which is the size of a slide illustration, not of a shot. A product screen
 * at 70-100% reads as "here is the thing", which is the entire point.
 */
export const Screen: React.FC<{
  src: string
  at: number
  /** Fraction of frame width. 1 is full bleed. */
  width?: number
  x?: number
  y?: number
  rot?: number
  /** A slow drift so the shot is never still. */
  drift?: number
  /** Crop to the top of the image — chat screens have dead space below. */
  crop?: number
  z?: number
  dim?: number
}> = ({ src, at, width = 0.78, x = 960, y = 540, rot = 0, drift = 0, crop = 1, z = 0, dim = 0 }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, at)
  const k = clamp(p, 0, 1)
  const w = 1920 * width
  const float = drift ? Math.sin((frame + at * 7) * 0.028) * drift : 0
  return (
    <div style={{
      position: 'absolute', left: x, top: y + float, width: w,
      transform: `translate(-50%, -50%) translateZ(${z}px) rotate(${rot}deg) scale(${0.88 + 0.12 * k})`,
      opacity: clamp(p * 2.4, 0, 1),
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 40px 90px rgba(43,35,32,0.28), 0 6px 18px rgba(43,35,32,0.14)',
      /* A real 16:9 capture is mostly empty below the conversation. Cropping
         to the live part is what lets it be shown large. */
      aspectRatio: crop < 1 ? `${1920} / ${Math.round(1080 * crop)}` : undefined,
    }}>
      <Img src={R(src)} style={{ width: '100%', display: 'block' }} />
      {dim > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(43,35,32,${dim})` }} />}
    </div>
  )
}

/**
 * A HIGHLIGHT THAT POINTS AT SOMETHING REAL.
 *
 * A product screenshot is only evidence if the viewer knows where to look. A
 * box drawn around the sentence that matters does in one frame what a caption
 * needs three seconds to do.
 */
export const Spot: React.FC<{
  at: number
  x: number; y: number; w: number; h: number
  color?: string
  label?: string
  /** Put the label under the box — for a target near the top of frame, where
      a label above would be clipped by the screen edge. */
  below?: boolean
}> = ({ at, x, y, w, h, color = '#B5563A', label, below = false }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, at, 12)
  const k = clamp(p, 0, 1)
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      border: `4px solid ${color}`, borderRadius: 10,
      /* NO full-screen dim: inside a Scene it spills over the headline and
         the ground and washes the whole frame. The box is the pointer. */
      boxShadow: `0 0 26px ${color}44`,
      opacity: clamp(p * 2, 0, 1),
      transform: `scale(${1.06 - 0.06 * k})`,
    }}>
      {label && (
        <div style={{
          position: 'absolute', left: -4, ...(below ? { top: h + 10 } : { top: -46 }),
          background: color, color: '#fff', borderRadius: 8,
          padding: '6px 14px', fontWeight: 800, fontSize: 22, whiteSpace: 'nowrap',
          opacity: clamp(pop(frame, at + 5) * 2, 0, 1),
        }}>{label}</div>
      )}
    </div>
  )
}

/**
 * ONE SCREEN BECOMING ANOTHER, IN PLACE.
 *
 * The single most persuasive thing the Restylez film does: the "after" is not
 * a second card, it is the before image with the after clip-pathed over it,
 * wiping with a lit edge. The viewer watches the change HAPPEN to a specific
 * artifact. A deck fundamentally cannot do this — it can only put two pictures
 * side by side and let you infer.
 */
export const Swap: React.FC<{
  before: string
  after: string
  at: number
  /** Frames the wipe takes. */
  dur?: number
  width?: number
  x?: number
  y?: number
  tint?: string
}> = ({ before, after, at, dur = 24, width = 0.72, x = 960, y = 540, tint = '#8FA98B' }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, at - 6)
  const t = clamp((frame - at) / dur, 0, 1)
  const e = Easing.inOut(Easing.cubic)(t)
  const w = 1920 * width
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w,
      transform: `translate(-50%, -50%) scale(${0.9 + 0.1 * clamp(p, 0, 1)})`,
      opacity: clamp(p * 2.4, 0, 1),
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 40px 90px rgba(43,35,32,0.28)',
    }}>
      <Img src={R(before)} style={{ width: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 ${(1 - e) * 100}% 0)` }}>
        <Img src={R(after)} style={{ width: '100%', display: 'block' }} />
      </div>
      {/* the lit edge — what makes it read as a transformation rather than a fade */}
      {t > 0 && t < 1 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: `${e * 100}%`,
          height: 6, background: tint, boxShadow: `0 0 26px ${tint}`,
        }} />
      )}
    </div>
  )
}

/**
 * SEVERAL REAL SCREENS AT ONCE, THEN RECEDING.
 *
 * Restylez's strongest beat puts twelve real artifacts on screen together and
 * then slides the whole grid back as a chart rises over it. Quantity is the
 * argument: one screenshot is a claim, eight is a product.
 */
export const Wall: React.FC<{
  srcs: string[]
  at: number
  /** Frames between each arrival. */
  every?: number
  /** 0-1: how far the wall has receded. Drive this from a later beat event. */
  recede?: number
}> = ({ srcs, at, every = 5, recede = 0 }) => {
  const frame = useCurrentFrame()
  const cols = 4
  return (
    <>
      {srcs.map((src, i) => {
        const r = Math.floor(i / cols), c = i % cols
        const p = pop(frame, at + i * every, 13)
        const k = clamp(p, 0, 1)
        const x = 300 + c * 460
        const y = 320 + r * 330
        return (
          <div key={src + i} style={{
            position: 'absolute', left: x - recede * 60, top: y + recede * 30,
            width: 420,
            transform: `translate(-50%, -50%) scale(${(0.7 + 0.3 * k) * (1 - recede * 0.1)}) rotate(${(i % 3 - 1) * 1.6}deg)`,
            opacity: clamp(p * 2.2, 0, 1) * (1 - recede * 0.55),
            borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 24px 54px rgba(43,35,32,0.24)',
          }}>
            <Img src={R(src)} style={{ width: '100%', display: 'block' }} />
          </div>
        )
      })}
    </>
  )
}

/**
 * A PUSH INTO A DETAIL OF A REAL SCREEN.
 *
 * Scales and offsets the image so a specific region fills the frame. This is
 * how a screenshot becomes several shots — a wide establishing view and then
 * the one line that proves the point, without ever cutting away.
 */
export const PushTo: React.FC<{
  src: string
  at: number
  /** The region to end on, in 1920x1080 coordinates. */
  to: { x: number; y: number; scale: number }
  dur?: number
  from?: number
}> = ({ src, at, to, dur = 40, from = 0.86 }) => {
  const frame = useCurrentFrame()
  const t = clamp((frame - at) / dur, 0, 1)
  const e = Easing.inOut(Easing.cubic)(t)
  const scale = from + (to.scale - from) * e
  const dx = (960 - to.x) * e
  const dy = (540 - to.y) * e
  const p = pop(frame, at - 4)
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: clamp(p * 2.4, 0, 1) }}>
      <div style={{
        position: 'absolute', left: 960, top: 540, width: 1920,
        transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${scale})`,
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 40px 90px rgba(43,35,32,0.28)',
      }}>
        <Img src={R(src)} style={{ width: '100%', display: 'block' }} />
      </div>
    </AbsoluteFill>
  )
}
