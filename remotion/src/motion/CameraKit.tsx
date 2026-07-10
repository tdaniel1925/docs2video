import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing, Img, staticFile } from 'remotion'
import { EASE } from './MotionKit'

/**
 * CameraKit — the missing Hollywood ingredient: the camera never stops moving
 * WITHIN a shot. A screenshot is rendered larger than frame and the "camera"
 * travels across it (push-in to a region, pan, pull-back), with MOTION BLUR on
 * fast moves. Plus typewriter + fast-word-pan text effects.
 */

// A screenshot that the camera LIVES INSIDE — it enters, then continuously
// travels toward `focus` regions defined as keyframes over the shot's length.
// focus points are {x,y} in 0..1 of the image; scale is the zoom at that point.
export type CamKey = { at: number; x: number; y: number; scale: number }

export const CameraShot: React.FC<{
  src: string
  enterAt: number
  keys: CamKey[]           // camera path across the image
  width?: number           // render width of the (oversized) image
  entrance?: 'depth' | 'flip' | 'rise'
}> = ({ src, enterAt, keys, width = 2100, entrance = 'depth' }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const t = frame - enterAt

  // entrance
  const s = spring({ frame: t, fps, config: { damping: 16, stiffness: 110, mass: 0.9, overshootClamping: false } })
  let enterTf = '', enterOp = interpolate(t, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (entrance === 'depth') enterTf = `perspective(1800px) translateZ(${(1 - s) * -900}px) rotateY(${(1 - s) * 18}deg)`
  else if (entrance === 'flip') enterTf = `perspective(1600px) rotateY(${(1 - s) * -80}deg)`
  else enterTf = `translateY(${(1 - s) * 260}px)`

  // camera path — piecewise-eased between keyframes; velocity drives motion blur
  const cam = sampleCam(keys, t)
  const camPrev = sampleCam(keys, t - 1)

  // NEVER-STOP RULE: after the last keyframe the path returns a frozen value.
  // Layer a perpetual slow drift + Ken-Burns push on TOP so the camera is
  // always moving (a real operator never holds a dead frame). The drift is
  // gentle (sub-perceptual as jitter, but kills the "sits there" feeling).
  const lastAt = keys[keys.length - 1].at
  const settled = Math.max(0, t - lastAt)            // frames since arrival
  const driftX = Math.sin(settled * 0.018) * 0.010   // slow lateral glide
  const driftY = Math.cos(settled * 0.014) * 0.008
  const kenBurns = settled > 0 ? settled * 0.00045 : 0 // continuous slow push-in

  const camX = cam.x + driftX
  const camY = cam.y + driftY
  const zoom = cam.scale + kenBurns

  // Also account for zoom velocity (a fast push-in smears too), not just pan.
  const zoomPrev = camPrev.scale + (Math.max(0, (t - 1) - lastAt) > 0 ? Math.max(0, (t - 1) - lastAt) * 0.00045 : 0)
  const vx = (camX - camPrev.x), vy = (camY - camPrev.y)
  const panSpeed = Math.hypot(vx, vy) * 1000
  const zoomSpeed = Math.abs(zoom - zoomPrev) * 200
  const speed = panSpeed + zoomSpeed
  // Motion blur ONLY on a true whip. Frame-review showed editorial pans read as
  // "smeary" — a slow, deliberate camera move must stay SHARP. High dead-zone
  // (18), small multiplier, hard cap 5. Most moves now render crisp.
  const blur = speed < 18 ? 0 : Math.min(5, (speed - 18) * 0.12)
  // image is `width` wide, aspect ~1.56 → height
  const imgH = width / 1.5609
  const frameW = 1920, frameH = 1080
  const scaledW = width * zoom, scaledH = imgH * zoom
  const tx = frameW / 2 - camX * scaledW
  const ty = frameH / 2 - camY * scaledH

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: enterOp, transform: enterTf, transformOrigin: 'center' }}>
      <div style={{
        position: 'absolute', width, height: imgH,
        transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, transformOrigin: '0 0',
        filter: blur > 0.5 ? `blur(${blur}px)` : 'none',
        borderRadius: 14, overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
      }}>
        <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
      </div>
    </div>
  )
}

// ── content-aware framing ──
// An anchor box (0..1 of the image) → the camera x,y,scale that CENTERS and
// FILLS it to `coverage` (0.55 = element fills ~55% of frame width). Because
// this is computed from the REAL measured box, the camera always lands on the
// actual element — no guessed coordinates.
export type AnchorBox = { x: number; y: number; w: number; h: number }
export function frameAnchor(box: AnchorBox, coverage = 0.6, imgAspect = 1.5609): CamKey {
  // image is imgAspect wide vs tall; frame is 16:9 (1.7778)
  const frameAspect = 16 / 9
  // element width in image-fraction → scale so it occupies `coverage` of frame
  // scale is the image zoom; element image-width * scale should ≈ coverage
  const targetScaleByW = coverage / Math.max(0.04, box.w)
  const targetScaleByH = (coverage * frameAspect / imgAspect) / Math.max(0.04, box.h)
  const scale = clampNum(Math.min(targetScaleByW, targetScaleByH), 1.05, 2.6)
  return { at: 0, x: box.x, y: box.y, scale }
}
const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function sampleCam(keys: CamKey[], t: number): { x: number; y: number; scale: number } {
  if (t <= keys[0].at) return keys[0]
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].at) {
      const a = keys[i - 1], b = keys[i]
      const p = EASE.expoOut(interpolate(t, [a.at, b.at], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, scale: a.scale + (b.scale - a.scale) * p }
    }
  }
  return keys[keys.length - 1]
}

// ── TYPEWRITER: text types out char by char with a blinking cursor ──
export const Typewriter: React.FC<{ text: string; at: number; cps?: number; size: number; color: string; family: string }> =
({ text, at, cps = 30, size, color, family }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const t = Math.max(0, frame - at)
  const n = Math.floor((t / fps) * cps)
  const shown = text.slice(0, n)
  const done = n >= text.length
  const blink = Math.floor((frame / fps) * 2) % 2 === 0
  return (
    <span style={{ fontFamily: family, fontWeight: 800, fontSize: size, color, letterSpacing: '-0.01em', whiteSpace: 'nowrap', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
      {shown}<span style={{ opacity: done ? (blink ? 1 : 0) : 1, color, marginLeft: 2 }}>|</span>
    </span>
  )
}

// ── FAST WORD PAN: a big word whips across horizontally, motion-blurred, and
//    slams to a stop. Direction alternates so a stack of them reads dynamic. ──
export const WordPan: React.FC<{ text: string; at: number; size: number; color: string; family: string; dir?: 1 | -1; settleX?: number }> =
({ text, at, size, color, family, dir = 1, settleX = 0 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const t = frame - at
  const p = EASE.expoOut(interpolate(t, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
  const x = (1 - p) * dir * 1400 + settleX
  const vel = Math.abs((1 - p) * dir * 1400 - ((1 - EASE.expoOut(interpolate(t - 1, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))) * dir * 1400))
  const blur = Math.min(20, vel * 0.09)
  return (
    <div style={{
      fontFamily: family, fontWeight: 800, fontSize: size, color, letterSpacing: '-0.02em', whiteSpace: 'nowrap',
      transform: `translateX(${x}px)`, opacity: interpolate(t, [0, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      filter: blur > 0.5 ? `blur(${blur}px)` : 'none', textShadow: '0 2px 24px rgba(0,0,0,0.55)',
    }}>{text}</div>
  )
}
