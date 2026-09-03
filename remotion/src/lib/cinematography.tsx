import React from 'react'
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { staticFile } from './asset'

/* ============================================================================
 * CINEMATOGRAPHY — the "impressive movement" layer. Turns a series of polished
 * scenes into ONE flowing, cinematic journey. Four families:
 *
 *   1. VirtualCamera / CamMove  — a continuous camera that flows across the WHOLE
 *      video (push, pan, punch-in, pull-back), never resetting at scene cuts.
 *   2. DepthStage / Depth       — pervasive multi-layer parallax; fg/mid/bg always
 *      moving at different rates so every frame has 3D life.
 *   3. WeightyEntry             — physics with overshoot, settle, secondary motion
 *      and a lagging shadow — things fly in with momentum, not politely.
 *   4. FlowThrough / ZoomInto   — connected transitions: push THROUGH into the next
 *      scene, or zoom INTO a detail that becomes the next frame.
 *
 * All pure + frame-driven. Compose freely.
 * ==========================================================================*/

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ---------------- 1. VIRTUAL CAMERA ---------------------------------------
 * A camera "move" is a keyframed transform over an absolute frame range. Wrap
 * a whole scene (or the whole video) — the transform is CONTINUOUS, so a slow
 * drift that spans multiple scenes never resets. Compose several CamMoves in a
 * stack for arrive→hold→leave choreography.
 */
export type CamKey = { at: number; x?: number; y?: number; scale?: number; rot?: number }
export const CamMove: React.FC<{ keys: CamKey[]; children: React.ReactNode; ease?: (t: number) => number }> =
({ keys, children, ease = Easing.inOut(Easing.cubic) }) => {
  const frame = useCurrentFrame()
  const times = keys.map((k) => k.at)
  const lerp = (field: keyof CamKey, dflt: number) =>
    interpolate(frame, times, keys.map((k) => (k[field] ?? dflt) as number), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const x = lerp('x', 0), y = lerp('y', 0), scale = lerp('scale', 1), rot = lerp('rot', 0)
  return <AbsoluteFill style={{ transform: `scale(${scale}) translate(${x}%, ${y}%) rotate(${rot}deg)`, transformOrigin: '50% 50%' }}>{children}</AbsoluteFill>
}

// A perpetual, gentle "handheld" camera breath so the frame is NEVER dead still.
// Layer this at the top of any scene/video. Very subtle by default.
export const CamBreath: React.FC<{ intensity?: number; children: React.ReactNode }> = ({ intensity = 1, children }) => {
  const frame = useCurrentFrame()
  const x = Math.sin(frame * 0.021) * 0.35 * intensity + Math.sin(frame * 0.053) * 0.15 * intensity
  const y = Math.cos(frame * 0.017) * 0.28 * intensity + Math.cos(frame * 0.061) * 0.12 * intensity
  const rot = Math.sin(frame * 0.013) * 0.12 * intensity
  const scale = 1 + Math.sin(frame * 0.011) * 0.004 * intensity
  return <AbsoluteFill style={{ transform: `scale(${scale}) translate(${x}%, ${y}%) rotate(${rot}deg)`, transformOrigin: '50% 50%' }}>{children}</AbsoluteFill>
}

// A content-reactive camera PUNCH: quick zoom-in on a beat (e.g. a stat drop),
// then ease back. `at` = frame of the punch.
export const CamPunch: React.FC<{ at: number; amount?: number; children: React.ReactNode }> = ({ at, amount = 0.06, children }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - at) / 3, 0, 1)
  const back = clamp((frame - at - 3) / 14, 0, 1)
  const scale = 1 + amount * p * (1 - back)
  return <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: '50% 50%' }}>{children}</AbsoluteFill>
}

/* ---------------- 2. DEPTH STAGE (pervasive parallax) --------------------
 * DepthStage provides a continuous "camera travel" value to its DepthLayer
 * children. Each layer moves/scales by its depth (0=far, 1=near) so the whole
 * scene has constant 3D life. Give the stage a `travel` (how far the camera
 * moves over the scene) and optional perpetual drift.
 */
const TravelCtx = React.createContext(0)
export const DepthStage: React.FC<{ travelX?: number; travelY?: number; push?: number; children: React.ReactNode }> =
({ travelX = 0, travelY = 0, push = 0.12, children }) => {
  const frame = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  return <TravelCtx.Provider value={p}>{children}<PushHolder travelX={travelX} travelY={travelY} push={push} p={p} /></TravelCtx.Provider>
}
const PushHolder: React.FC<{ travelX: number; travelY: number; push: number; p: number }> = () => null

export const DepthLayer: React.FC<{ depth: number; float?: number; children: React.ReactNode }> =
({ depth, float = 1, children }) => {
  const p = React.useContext(TravelCtx)
  const frame = useCurrentFrame()
  // near layers scale + move more with camera travel; far layers barely
  const scale = 1 + p * (0.04 + depth * 0.4)
  const camX = p * (depth - 0.4) * -18, camY = p * (depth - 0.4) * 8
  // perpetual float, larger for nearer layers
  const fx = Math.sin(frame * 0.02 + depth * 6) * (0.4 + depth * 1.6) * float
  const fy = Math.cos(frame * 0.016 + depth * 4) * (0.3 + depth * 1.2) * float
  const blur = (1 - depth) * 1.5   // far layers soften slightly
  return (
    <AbsoluteFill style={{ transform: `scale(${scale}) translate(${camX + fx}px, ${camY + fy}px)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  )
}

/* ---------------- 3. WEIGHTY ENTRY (physics + follow-through) ------------
 * An element flies in with momentum, OVERSHOOTS, settles, with secondary
 * wobble and a shadow that LAGS behind. `from` = direction it flies from.
 */
export const WeightyEntry: React.FC<{
  at?: number; from?: 'bottom' | 'top' | 'left' | 'right' | 'scale'; distance?: number
  shadow?: boolean; children: React.ReactNode
}> = ({ at = 0, from = 'bottom', distance = 400, shadow = true, children }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  // low damping = overshoot + settle
  const s = spring({ frame: frame - at, fps, config: { damping: 9, stiffness: 130, mass: 1.15 } })
  const p = clamp(s, 0, 1.2)   // allow >1 for overshoot read
  const off = (1 - Math.min(p, 1)) * distance + (p > 1 ? -(p - 1) * distance * 0.12 : 0)
  const dirs: Record<string, [number, number]> = { bottom: [0, off], top: [0, -off], left: [-off, 0], right: [off, 0], scale: [0, 0] }
  const [dx, dy] = dirs[from]
  const scl = from === 'scale' ? 0.6 + Math.min(p, 1) * 0.4 + (p > 1 ? (p - 1) * 0.06 : 0) : 1
  // secondary wobble after landing
  const settled = frame > at + 8
  const wob = settled ? Math.sin((frame - at) * 0.5) * (1 - clamp((frame - at - 8) / 20, 0, 1)) * 1.2 : 0
  // lagging shadow (follows a few frames behind)
  const sLag = spring({ frame: frame - at - 3, fps, config: { damping: 11, stiffness: 110, mass: 1.2 } })
  const sp = clamp(sLag, 0, 1)
  const sOff = (1 - sp) * distance
  const [sdx, sdy] = { bottom: [0, sOff], top: [0, -sOff], left: [-sOff, 0], right: [sOff, 0], scale: [0, 0] }[from] as [number, number]
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {shadow && (
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${sdx}px, ${sdy}px) scale(${scl})`, opacity: sp * 0.25, filter: 'blur(18px)', background: 'rgba(0,0,0,0.6)', borderRadius: 20, zIndex: -1 }} />
      )}
      <div style={{ transform: `translate(${dx + wob}px, ${dy}px) scale(${scl}) rotate(${wob * 0.3}deg)`, opacity: clamp(p * 2, 0, 1) }}>{children}</div>
    </div>
  )
}

/* ---------------- 4. FLOW TRANSITIONS (connected scenes) -----------------
 * FlowThrough: the scene scales UP and fades as if the camera pushes THROUGH it
 * into the next (place at the END of a scene). ZoomInto: the scene scales up
 * toward a focal point (place at end) so a detail "becomes" the next frame.
 */
export const FlowThrough: React.FC<{ startAt: number; dur?: number; children: React.ReactNode }> =
({ startAt, dur = 14, children }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - startAt) / dur, 0, 1)
  const e = Easing.in(Easing.cubic)(p)
  return <AbsoluteFill style={{ transform: `scale(${1 + e * 1.4})`, opacity: 1 - e, filter: `blur(${e * 8}px)` }}>{children}</AbsoluteFill>
}
export const ZoomInto: React.FC<{ startAt: number; focal?: [number, number]; dur?: number; children: React.ReactNode }> =
({ startAt, focal = [50, 50], dur = 16, children }) => {
  const frame = useCurrentFrame()
  const e = Easing.in(Easing.cubic)(clamp((frame - startAt) / dur, 0, 1))
  return <AbsoluteFill style={{ transform: `scale(${1 + e * 3})`, transformOrigin: `${focal[0]}% ${focal[1]}%`, opacity: 1 - e * 0.6 }}>{children}</AbsoluteFill>
}
// The incoming scene emerging FROM depth (pair with FlowThrough on the outgoing).
// Scales children IN PLACE. Must NOT use AbsoluteFill — content inside a flex
// layout (e.g. chat bubbles, grid cards) would break out of the flow and jam to
// the top-left corner (the chat-beat bug). A plain wrapper preserves layout.
export const EmergeFromDepth: React.FC<{ dur?: number; children: React.ReactNode }> = ({ dur = 14, children }) => {
  const frame = useCurrentFrame()
  const e = Easing.out(Easing.cubic)(clamp(frame / dur, 0, 1))
  return <div style={{ transform: `scale(${0.6 + e * 0.4})`, opacity: e, filter: `blur(${(1 - e) * 6}px)` }}>{children}</div>
}

/* ---------------- 5. LIVING STILL ("still becomes video") ----------------
 * Makes ONE generated still feel like a moving VIDEO scene — the technique from
 * cinematic explainer channels. No AI video needed: a still is made "alive" by
 * (a) a slow parallax push, (b) a subtle depth-warp, and (c) ATMOSPHERIC LIVE
 * OVERLAYS (fog, dust, light-rays, embers) blended on top so pixels change every
 * frame — the brain reads it as video. Add a cinematic grade + vignette to bind.
 *
 *   <LivingStill src="x.png" atmos="dust" grade="warm" dur={SCENE_FRAMES} />
 */
type Atmos = 'dust' | 'fog' | 'embers' | 'rays' | 'snow' | 'none'
type Grade = 'warm' | 'cool' | 'gritty' | 'clean'

const GRADES: Record<Grade, string> = {
  warm: 'brightness(0.92) contrast(1.12) saturate(1.08) sepia(0.12)',
  cool: 'brightness(0.9) contrast(1.14) saturate(1.05) hue-rotate(-8deg)',
  gritty: 'brightness(0.8) contrast(1.3) saturate(0.7)',
  clean: 'brightness(0.98) contrast(1.05) saturate(1.04)',
}

export const LivingStill: React.FC<{
  src: string; dur: number; atmos?: Atmos; grade?: Grade; focus?: string
  push?: number; drift?: [number, number]; children?: React.ReactNode
}> = ({ src, dur, atmos = 'dust', grade = 'warm', focus = '50% 45%', push = 0.14, drift = [-1.5, 0.8], children }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const scale = 1.04 + push * p
  const dx = drift[0] * p, dy = drift[1] * p
  // subtle depth-warp: a barely-perceptible perspective shift over time
  const warp = Math.sin(frame * 0.02) * 0.15
  const gradeF = GRADES[grade]
  const tint = grade === 'warm' ? '#ff9a3c' : grade === 'cool' ? '#3ca7ff' : grade === 'gritty' ? '#c8a06a' : '#ffffff'
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      {/* the still, pushed + drifting + warped */}
      <AbsoluteFill style={{ transform: `perspective(1600px) rotateY(${warp}deg)` }}>
        <Img src={staticFile(src)} style={{ width: '116%', height: '116%', position: 'absolute', left: '-8%', top: '-8%', objectFit: 'cover', objectPosition: focus, transform: `scale(${scale}) translate(${dx}%, ${dy}%)`, filter: gradeF }} />
      </AbsoluteFill>
      {/* ATMOSPHERE — the magic that makes a still read as video */}
      <Atmosphere kind={atmos} tint={tint} />
      {/* cinematic bind: vignette + a slow drifting light-leak */}
      <LightLeakSlow tint={tint} />
      <AbsoluteFill style={{ background: 'radial-gradient(125% 125% at 50% 45%, transparent 42%, rgba(0,0,0,0.72))', pointerEvents: 'none' }} />
      {children}
    </AbsoluteFill>
  )
}

// atmospheric particle/fog overlays (screen-blended) — the "live" ingredient
const Atmosphere: React.FC<{ kind: Atmos; tint: string }> = ({ kind, tint }) => {
  const frame = useCurrentFrame()
  if (kind === 'none') return null
  if (kind === 'fog') {
    const x1 = (frame * 0.3) % 140 - 20, x2 = 120 - (frame * 0.22) % 140
    return (
      <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity: 0.22 }}>
        <div style={{ position: 'absolute', top: '20%', left: `${x1}%`, width: '70%', height: '80%', background: `radial-gradient(closest-side, ${tint}, transparent)`, filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', top: '0%', left: `${x2}%`, width: '60%', height: '70%', background: `radial-gradient(closest-side, #ffffff, transparent)`, filter: 'blur(90px)', opacity: 0.5 }} />
      </AbsoluteFill>
    )
  }
  if (kind === 'rays') {
    const rot = -20 + Math.sin(frame * 0.014) * 2
    return (
      <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity: 0.14 + Math.sin(frame * 0.03) * 0.03 }}>
        <div style={{ position: 'absolute', top: '-30%', right: '4%', width: '60%', height: '150%', transform: `rotate(${rot}deg)`, background: `repeating-linear-gradient(90deg, transparent 0, ${tint}55 2px, transparent 7px, transparent 46px)`, filter: 'blur(7px)', maskImage: 'linear-gradient(160deg, black, transparent 72%)', WebkitMaskImage: 'linear-gradient(160deg, black, transparent 72%)' }} />
      </AbsoluteFill>
    )
  }
  // CINEMATIC BOKEH — soft out-of-focus orbs with depth, not hard dots. Two
  // layers: big blurry FOREGROUND bokeh (drifting, very soft) + a few sharper
  // mid-depth motes. Radial-gradient fill + heavy blur = real lens bokeh, so it
  // reads as atmosphere-in-the-3D-space, not noise on the glass.
  const col = kind === 'embers' ? '255,150,70' : kind === 'snow' ? '255,255,255' : tint.startsWith('#')
    ? `${parseInt(tint.slice(1, 3), 16)},${parseInt(tint.slice(3, 5), 16)},${parseInt(tint.slice(5, 7), 16)}` : '255,200,140'
  const rise = kind === 'embers' ? -1 : kind === 'snow' ? 0.5 : -0.35
  // big soft foreground bokeh (few, large, very blurred, slow)
  const fg = Array.from({ length: 8 }, (_, i) => {
    const r = ((i * 9301 + 49297) % 233280) / 233280
    const r2 = ((i * 4021 + 7919) % 233280) / 233280
    const x = (r * 120 - 10) + Math.sin(frame * 0.008 + i) * 3
    const y = ((r2 * 120 - 10 + frame * (0.012 + r * 0.02) * rise) % 130 + 130) % 130 - 15
    const size = 70 + r2 * 150
    const o = 0.05 + Math.abs(Math.sin(frame * 0.015 + i * 1.4)) * 0.09
    return <div key={'f' + i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, rgba(${col},0.9) 0%, rgba(${col},0.3) 40%, transparent 70%)`, opacity: o, filter: `blur(${8 + r2 * 10}px)` }} />
  })
  // sharper mid-depth motes (more, smaller, gentle glow, medium speed)
  const mid = Array.from({ length: kind === 'snow' ? 22 : 16 }, (_, i) => {
    const r = ((i * 6151 + 33013) % 233280) / 233280
    const r2 = ((i * 2749 + 9013) % 233280) / 233280
    const x = (r * 100) + Math.sin(frame * 0.02 + i) * (kind === 'snow' ? 4 : 1.5)
    const y = ((r2 * 100 + frame * (0.025 + r * 0.04) * rise) % 100 + 100) % 100
    const size = (kind === 'snow' ? 5 : 3) + r2 * (kind === 'snow' ? 6 : 5)
    const tw = 0.15 + Math.abs(Math.sin(frame * 0.06 + i * 0.7)) * 0.4
    return <div key={'m' + i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, rgba(${col},1) 0%, rgba(${col},0.4) 55%, transparent 75%)`, opacity: tw, filter: `blur(${1 + r * 1.5}px)`, boxShadow: `0 0 ${size * 2.5}px rgba(${col},0.5)` }} />
  })
  return <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>{fg}{mid}</AbsoluteFill>
}

// a slow drifting warm/cool light-leak that breathes — cinematic glue
const LightLeakSlow: React.FC<{ tint: string }> = ({ tint }) => {
  const frame = useCurrentFrame()
  const x = 15 + Math.sin(frame * 0.012) * 14
  const o = 0.1 + Math.sin(frame * 0.02) * 0.05
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-15%', left: `${x}%`, width: '35%', height: '130%', background: `linear-gradient(110deg, transparent, ${tint}, transparent)`, transform: 'skewX(-14deg)', filter: 'blur(60px)', opacity: o }} />
    </AbsoluteFill>
  )
}
