import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, Easing, Sequence } from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

/**
 * ONE SCENE, BUILT PROPERLY — the test piece.
 *
 * Three rounds of "add some effects to the existing slides" landed at C-, and
 * the note was exactly right: elements moved around, a few colour screens.
 * That is decoration. This is an attempt at the actual craft, and it is worth
 * naming what was missing, because none of it is an effect:
 *
 *   1. A CAMERA. Every beat so far was a flat plane seen head-on, with things
 *      fading in on it. Here there is a single continuous camera move through
 *      a 3D space — it pushes in, cranes down, and settles. Nothing "appears";
 *      the camera ARRIVES at things.
 *
 *   2. PERSISTENCE. Elements do not fade out and get replaced. The invoice
 *      that is raised is the same object that gets sent, chased and paid — it
 *      travels, rotates and lands. One object with a life, not four states.
 *
 *   3. TYPE IN THE WORLD. The words sit on the same 3D plane as everything
 *      else, so they move WITH the camera. Type that ignores the camera is a
 *      caption over a video; type that obeys it is part of the shot.
 *
 *   4. ANTICIPATION. Every move overshoots slightly against its direction
 *      before it goes — the tiny wind-up that makes motion read as physical
 *      rather than interpolated.
 *
 * 6 seconds, 180 frames, at the same 127.8 BPM as the film (14.1 frames a
 * beat) so it can drop straight in if it works.
 */

const { fontFamily: F } = loadInter()
export const PROOF_FPS = 30
export const PROOF_FRAMES = 180

const CLAY = '#B5563A'
const SAGE = '#8FA98B'
const INK = '#2B2320'
const CREAM = '#F7F1E8'
const WHITE = '#ffffff'
const BEAT = 14.1

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const R = (n: string) => staticFile(`showcase/jordyn-hire/${n}`)

/** The house spring, with a real wind-up before it moves. */
const s = (frame: number, at: number, damping = 16, stiffness = 140) =>
  clamp(spring({ frame: frame - at, fps: PROOF_FPS, config: { damping, stiffness, mass: 0.9 } }), 0, 1.12)

/**
 * ANTICIPATION — 3 frames of moving the WRONG way before moving the right
 * way. It is the single clearest difference between animation and
 * interpolation, and it is what every one of my previous passes was missing.
 */
const anticipate = (frame: number, at: number) => {
  const t = frame - at
  if (t < 0) return 0
  if (t < 3) return -0.12 * Math.sin((t / 3) * Math.PI)
  return clamp(s(frame, at + 3), 0, 1.12)
}

/**
 * THE CAMERA — one continuous move through the whole beat.
 *
 * Returns a CSS transform for a 3D stage. Everything in the scene lives
 * inside this, at its own Z, so parallax is real rather than faked by moving
 * layers at different speeds.
 */
const useCamera = (frame: number) => {
  /* push in, crane down, settle — three moves blended into one path */
  /* A push you can feel and still read through: 150px over six seconds. */
  const push = interpolate(frame, [0, 90, 180], [-60, 60, 150], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  })
  const craneY = interpolate(frame, [0, 90, 180], [-18, 4, 16], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  })
  const yaw = interpolate(frame, [0, 90, 180], [5, 0.5, -3], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad),
  })
  const pitch = interpolate(frame, [0, 180], [2.5, -1], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad),
  })
  return `translateZ(${push}px) translateY(${craneY}px) rotateY(${yaw}deg) rotateX(${pitch}deg)`
}

/** A card that lives at a depth in the stage, and therefore moves with the camera. */
const Card: React.FC<{
  x: number; y: number; z: number
  w: number
  at: number
  rot?: number
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ x, y, z, w, at, rot = 0, children, style }) => {
  const frame = useCurrentFrame()
  const a = anticipate(frame, at)
  const k = clamp(a, 0, 1)
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w,
      transform: `translate(-50%, -50%) translateZ(${z}px) rotate(${rot}deg) scale(${0.82 + 0.18 * a})`,
      opacity: clamp(k * 2.6, 0, 1),
      transformStyle: 'preserve-3d',
      background: WHITE, borderRadius: 20,
      boxShadow: `0 ${30 + z * 0.1}px ${70 + z * 0.2}px rgba(43,35,32,0.22)`,
      ...style,
    }}>{children}</div>
  )
}

export const ProofScene: React.FC = () => {
  const frame = useCurrentFrame()
  const cam = useCamera(frame)

  /*
   * THE INVOICE IS ONE OBJECT WITH A LIFE.
   *
   * Raised at beat 1, sent at beat 2, chased at 3, paid at 4 — and it is the
   * SAME card the whole way, travelling across the stage and turning as it
   * goes. Previous versions faded four separate rows in, which is a list, not
   * a story.
   */
  const raiseAt = Math.round(BEAT * 0.6)
  const sendAt = Math.round(BEAT * 2.4)
  const chaseAt = Math.round(BEAT * 4.6)
  const paidAt = Math.round(BEAT * 7.0)

  const travel = (from: number[], to: number[], at: number, dur = 22) => {
    const t = clamp((frame - at) / dur, 0, 1)
    const e = Easing.inOut(Easing.cubic)(t)
    return [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]
  }

  /* its path across the stage, leg by leg */
  let ix = 1060, iy = 430, irot = -6, iz = 0
  if (frame >= sendAt) { const [a, b] = travel([1060, 430], [1140, 400], sendAt); ix = a; iy = b; irot = -3; iz = 30 }
  if (frame >= chaseAt) { const [a, b] = travel([1140, 400], [1200, 430], chaseAt); ix = a; iy = b; irot = 1; iz = 60 }
  if (frame >= paidAt) { const [a, b] = travel([1200, 430], [1230, 415], paidAt); ix = a; iy = b; irot = 4; iz = 90 }

  const paid = clamp(s(frame, paidAt + 10, 10, 200), 0, 1.12)

  /* the stamp lands and the whole stage kicks with it */
  const kick = frame >= paidAt + 12 && frame < paidAt + 18
    ? Math.sin((frame - paidAt - 12) * 2.6) * 9 * (1 - (frame - paidAt - 12) / 6)
    : 0

  return (
    <AbsoluteFill style={{ background: `linear-gradient(155deg, ${CREAM} 0%, #ECDFCE 100%)`, fontFamily: F, overflow: 'hidden' }}>
      {/* THE STAGE. Perspective is what makes the camera a camera rather than
          a zoom — without it every move is just a scale. */}
      <AbsoluteFill style={{
        perspective: 1400,
        perspectiveOrigin: '50% 42%',
        transform: `translateX(${kick}px)`,
      }}>
        <AbsoluteFill style={{ transformStyle: 'preserve-3d', transform: cam }}>

          {/* the desk plane, laid flat in 3D — the floor everything sits on */}
          <div style={{
            position: 'absolute', left: '50%', top: 980, width: 3200, height: 1400,
            transform: 'translateX(-50%) rotateX(78deg) translateZ(-260px)',
            background: 'linear-gradient(180deg, rgba(181,86,58,0.10), transparent 60%)',
          }} />

          {/* her illustration, deep in the back, catching the camera push */}
          <div style={{
            position: 'absolute', left: 480, top: 430,
            transform: `translate(-50%, -50%) translateZ(-320px) rotate(-4deg) scale(${0.9 + 0.1 * clamp(s(frame, 2), 0, 1)})`,
            opacity: clamp(s(frame, 2) * 2, 0, 1),
          }}>
            <Img src={R('illo-invoice.png')} style={{ width: 470, display: 'block', borderRadius: 22, boxShadow: '0 40px 90px rgba(43,35,32,0.24)' }} />
          </div>

          {/* THE INVOICE — one card, four stations */}
          <div style={{
            position: 'absolute', left: ix, top: iy, width: 420,
            transform: `translate(-50%, -50%) translateZ(${iz}px) rotate(${irot}deg) scale(${0.8 + 0.2 * clamp(anticipate(frame, raiseAt), 0, 1)})`,
            opacity: clamp(anticipate(frame, raiseAt) * 2.6, 0, 1),
            transformStyle: 'preserve-3d',
            background: WHITE, borderRadius: 18, padding: '26px 30px',
            boxShadow: '0 34px 80px rgba(43,35,32,0.26)',
          }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: '#A99C91', letterSpacing: '0.14em' }}>INVOICE</div>
            <div style={{ fontWeight: 900, fontSize: 58, color: INK, marginTop: 8, letterSpacing: '-0.03em', lineHeight: 1.2 }}>$4,200</div>
            <div style={{ height: 3, background: '#EFE7DC', margin: '18px 0' }} />
            {['Raised', 'Sent', 'Chased on day 7'].map((t, i) => {
              const at = [raiseAt, sendAt, chaseAt][i] + 6
              const on = clamp(s(frame, at), 0, 1)
              return (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, opacity: clamp(on * 2, 0, 1) }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, border: `3px solid ${SAGE}`,
                    background: on > 0.5 ? SAGE : 'transparent',
                    transform: `scale(${0.6 + 0.4 * on})`,
                  }} />
                  <div style={{ fontWeight: 700, fontSize: 24, color: '#55483F' }}>{t}</div>
                </div>
              )
            })}
            {/* PAID lands on the card itself, not beside it */}
            <div style={{
              position: 'absolute', right: -44, bottom: -26,
              transform: `rotate(-12deg) scale(${2.0 - 1.0 * clamp(paid, 0, 1)})`,
              opacity: clamp(paid * 2.4, 0, 1),
              border: `6px solid ${SAGE}`, color: SAGE, borderRadius: 10,
              padding: '8px 22px', background: '#ffffffee',
              fontWeight: 900, fontSize: 38, letterSpacing: '0.08em',
            }}>PAID</div>
          </div>

          {/* THE TYPE LIVES IN THE SCENE. It sits on its own plane at a depth,
              so the camera move carries it — a caption would not move at all,
              which is what gives the game away. */}
          <div style={{
            position: 'absolute', left: 960, top: 830, width: 1460,
            transform: 'translate(-50%, -50%) translateZ(60px)',
            textAlign: 'center',
          }}>
            <div style={{
              fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase', color: CLAY,
              opacity: clamp(s(frame, 6) * 2, 0, 1),
              marginBottom: 10,
            }}>Stripe invoicing, built in</div>
            <div style={{ fontWeight: 900, fontSize: 60, color: INK, letterSpacing: '-0.03em', lineHeight: 1.08 }}>
              {'Writes, chases, files —'.split(' ').map((w, i) => {
                const on = clamp(s(frame, 10 + i * 4, 12, 190), 0, 1.12)
                return (
                  <span key={i} style={{
                    display: 'inline-block', marginRight: '0.26em',
                    transform: `translateY(${(1 - clamp(on, 0, 1)) * 30}px) scale(${0.9 + 0.1 * on})`,
                    opacity: clamp(on * 2.4, 0, 1),
                  }}>{w}</span>
                )
              })}
              <span style={{
                color: CLAY, display: 'inline-block',
                transform: `translateY(${(1 - clamp(s(frame, 26), 0, 1)) * 30}px)`,
                opacity: clamp(s(frame, 26) * 2.4, 0, 1),
              }}>on your letterhead.</span>
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* a single frame of light as PAID lands — felt, not seen */}
      {frame >= paidAt + 12 && frame <= paidAt + 14 && (
        <AbsoluteFill style={{ background: WHITE, opacity: frame === paidAt + 12 ? 0.5 : 0.2 }} />
      )}
    </AbsoluteFill>
  )
}
