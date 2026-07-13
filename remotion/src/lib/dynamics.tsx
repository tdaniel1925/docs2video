import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'

/* ============================================================================
 * DYNAMICS — the advanced motion toolkit. Reusable, composable, per-brand.
 * The director picks techniques by personality:
 *   tech/premium → Particles      fintech/data → DataScene
 *   any/cinematic → Parallax3D, MorphCut, SpeedRamp
 *   bold/social  → PhysicsWord, BeatWord
 *
 * Four families:
 *   1. CAMERA & SPACE   Parallax3D, MorphCut, WhipCut, SpeedRamp
 *   2. PARTICLES        ParticleLogo, ParticleField
 *   3. DATA-AS-SPECTACLE  LiquidCounter, GrowBars, ChartRoad, Cursor
 *   4. PHYSICS TYPE     PhysicsWord, BeatWord, ShatterWord
 * All pure + frame-driven. Colors/tokens passed in per brand.
 * ==========================================================================*/

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
// tiny deterministic PRNG so particles are stable across renders
const rng = (i: number, seed = 1) => { const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x) }

/* ===================== 1. CAMERA & SPACE ================================== */

// Parallax3D — wrap layered children; each `depth` (0=far … 1=near) moves and
// scales differently as the camera "pushes in", faking real 3D dolly depth.
export const Parallax3D: React.FC<{ push?: number; children: React.ReactNode }> = ({ push = 1, children }) => {
  const frame = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' }) * push
  return <AbsoluteFill>{React.Children.map(children, (c) => c)}<PushCtx.Provider value={p}>{null}</PushCtx.Provider></AbsoluteFill>
}
const PushCtx = React.createContext(0)
export const Layer: React.FC<{ depth: number; drift?: [number, number]; children: React.ReactNode }> =
({ depth, drift = [0, 0], children }) => {
  const frame = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const scale = 1 + p * (0.08 + depth * 0.35)          // near layers scale more
  const dx = drift[0] * p * (0.4 + depth), dy = drift[1] * p * (0.4 + depth)
  const blur = (1 - depth) * (1 - p) * 2               // far layers soften slightly
  return <AbsoluteFill style={{ transform: `scale(${scale}) translate(${dx}%, ${dy}%)`, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>
}

// MorphCut — cross-morph two elements around a midpoint with a pinch/squash so
// motion carries through the cut (a document → a play button, a coin → a clock).
export const MorphCut: React.FC<{ at: number; dur?: number; from: React.ReactNode; to: React.ReactNode }> =
({ at, dur = 16, from, to }) => {
  const frame = useCurrentFrame()
  const e = Easing.inOut(Easing.cubic)(clamp((frame - at) / dur, 0, 1))
  const pinch = 1 - Math.sin(clamp((frame - at) / dur, 0, 1) * Math.PI) * 0.16
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: 1 - e, transform: `scale(${pinch}) scale(${1 - e * 0.35}) rotate(${e * -20}deg)`, filter: `blur(${e * 5}px)` }}>{from}</AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: e, transform: `scale(${pinch}) scale(${0.65 + e * 0.35}) rotate(${(1 - e) * 20}deg)`, filter: `blur(${(1 - e) * 5}px)` }}>{to}</AbsoluteFill>
    </AbsoluteFill>
  )
}

// SpeedRamp — slow-mo hold then whip into the next beat (scale/blur proxy).
export const SpeedRamp: React.FC<{ rampAt: number; whip?: number; dir?: [number, number]; children: React.ReactNode }> =
({ rampAt, whip = 8, dir = [-10, 0], children }) => {
  const frame = useCurrentFrame()
  const e = Easing.in(Easing.cubic)(clamp((frame - rampAt) / whip, 0, 1))
  return <AbsoluteFill style={{ transform: `translate(${dir[0] * e}%, ${dir[1] * e}%) scale(${1 + e * 0.08})`, filter: `blur(${e * 14}px)` }}>{children}</AbsoluteFill>
}

/* ===================== 2. PARTICLES ====================================== */

// ParticleLogo — N particles scatter/converge to reveal the child (logo/word).
// mode 'in' = assemble by `at`; 'out' = scatter after `at`. Particles are the
// brand color; the child fades in as they lock.
export const ParticleLogo: React.FC<{ color: string; count?: number; at?: number; span?: number; mode?: 'in' | 'out'; children: React.ReactNode }> =
({ color, count = 90, at = 0, span = 26, mode = 'in', children }) => {
  const frame = useCurrentFrame()
  const t = clamp((frame - at) / span, 0, 1)
  const e = mode === 'in' ? Easing.out(Easing.cubic)(t) : Easing.in(Easing.cubic)(t)
  const conv = mode === 'in' ? 1 - e : e   // 1 = scattered, 0 = converged
  const dots = Array.from({ length: count }, (_, i) => {
    const ang = rng(i, 3) * Math.PI * 2
    const dist = conv * (150 + rng(i, 7) * 620)
    const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist
    const size = 3 + rng(i, 11) * 9
    const o = (mode === 'in' ? clamp(1 - e * 0.7, 0, 1) : clamp(1 - e, 0, 1)) * (0.4 + rng(i, 5) * 0.6)
    return <div key={i} style={{ position: 'absolute', width: size, height: size, borderRadius: size, background: color, transform: `translate(${x}px, ${y}px)`, opacity: o, boxShadow: `0 0 ${size * 1.6}px ${color}` }} />
  })
  const logoO = mode === 'in' ? clamp((e - 0.55) / 0.45, 0, 1) : clamp(1 - e * 1.3, 0, 1)
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      {dots}
      <div style={{ opacity: logoO, transform: `scale(${0.94 + logoO * 0.06})` }}>{children}</div>
    </AbsoluteFill>
  )
}

// ParticleField — ambient drifting particles (embers/data-bits/dust) behind a scene.
export const ParticleField: React.FC<{ color: string; count?: number; speed?: number; kind?: 'dust' | 'ember' | 'data' }> =
({ color, count = 40, speed = 1, kind = 'dust' }) => {
  const frame = useCurrentFrame()
  const dots = Array.from({ length: count }, (_, i) => {
    const x = rng(i, 2) * 100
    const baseY = rng(i, 4) * 100
    const y = ((baseY - frame * (0.02 + rng(i, 6) * 0.04) * speed) % 100 + 100) % 100
    const size = kind === 'data' ? 2 + rng(i, 9) * 3 : 1.5 + rng(i, 9) * (kind === 'ember' ? 4 : 2.5)
    const tw = 0.15 + Math.abs(Math.sin(frame * 0.05 + i)) * 0.5
    const shape = kind === 'data' ? 2 : '50%'
    return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: shape as any, background: color, opacity: tw, filter: kind === 'dust' ? 'blur(0.5px)' : undefined, boxShadow: `0 0 ${size * 2}px ${color}${kind === 'ember' ? '' : 'aa'}` }} />
  })
  return <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}>{dots}</AbsoluteFill>
}

/* ===================== 3. DATA-AS-SPECTACLE ============================== */

// LiquidCounter — a big number that "fills" with rising liquid as it counts up.
export const LiquidCounter: React.FC<{ to: number; prefix?: string; suffix?: string; color: string; size?: number; startAt?: number; dur?: number; font: string }> =
({ to, prefix = '', suffix = '', color, size = 200, startAt = 0, dur = 30, font }) => {
  const frame = useCurrentFrame()
  const t = clamp((frame - startAt) / dur, 0, 1)
  const eased = Easing.out(Easing.cubic)(t)
  const val = Math.round(to * eased).toLocaleString('en-US')
  const wave = Math.sin(frame * 0.2) * 3
  const fillTop = 100 - eased * 100
  return (
    <div style={{ position: 'relative', fontFamily: font, fontWeight: 800, fontSize: size, lineHeight: 1.15, paddingBottom: '0.06em' }}>
      <div style={{ color: `${color}33` }}>{prefix}{val}{suffix}</div>
      {/* liquid fill clipped to the text */}
      <div style={{ position: 'absolute', inset: 0, color, clipPath: `polygon(0 ${fillTop + wave}%, 100% ${fillTop - wave}%, 100% 100%, 0 100%)`, textShadow: `0 0 30px ${color}66` }}>{prefix}{val}{suffix}</div>
    </div>
  )
}

// GrowBars — bars that grow up into a "skyline". Optionally the tallest keeps a value label.
export const GrowBars: React.FC<{ values: number[]; color: string; color2?: string; w?: number; h?: number; startAt?: number }> =
({ values, color, color2, w = 900, h = 380, startAt = 0 }) => {
  const frame = useCurrentFrame()
  const max = Math.max(...values)
  const bw = w / values.length
  return (
    <div style={{ position: 'relative', width: w, height: h, display: 'flex', alignItems: 'flex-end', gap: bw * 0.18 }}>
      {values.map((v, i) => {
        const at = startAt + i * 3
        const g = interpolate(frame, [at, at + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.4)) })
        const bh = (v / max) * h * clamp(g, 0, 1)
        const c = color2 && i % 2 ? color2 : color
        return <div key={i} style={{ width: bw * 0.82, height: bh, background: `linear-gradient(180deg, ${c}, ${c}66)`, borderRadius: `${bw * 0.1}px ${bw * 0.1}px 0 0`, boxShadow: `0 0 20px ${c}44` }} />
      })}
    </div>
  )
}

// ChartRoad — a line chart that draws, whose path the "camera" appears to travel.
export const ChartRoad: React.FC<{ points: number[]; color: string; w?: number; h?: number; startAt?: number; dur?: number }> =
({ points, color, w = 1400, h = 400, startAt = 0, dur = 40 }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - startAt) / dur, 0, 1)
  const shown = Math.max(2, Math.ceil(p * points.length))
  const max = Math.max(...points)
  const pts = points.slice(0, shown).map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / max) * h * 0.9 - 20}`)
  const headIdx = shown - 1
  const hx = (headIdx / (points.length - 1)) * w, hy = h - (points[headIdx] / max) * h * 0.9 - 20
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
      <circle cx={hx} cy={hy} r="9" fill="#fff" style={{ filter: `drop-shadow(0 0 14px ${color})` }} />
    </svg>
  )
}

// Cursor — an animated pointer that moves to a target and "clicks" (with ripple).
export const Cursor: React.FC<{ from: [number, number]; to: [number, number]; clickAt: number; color: string }> =
({ from, to, clickAt, color }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, clickAt], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const x = from[0] + (to[0] - from[0]) * p, y = from[1] + (to[1] - from[1]) * p
  const click = frame >= clickAt ? spring({ frame: frame - clickAt, fps: 30, config: { damping: 8, stiffness: 300 } }) : 0
  const ripple = clamp((frame - clickAt) / 16, 0, 1)
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {frame >= clickAt && ripple < 1 && <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 20, height: 20, marginLeft: -10, marginTop: -10, borderRadius: '50%', border: `2px solid ${color}`, transform: `scale(${1 + ripple * 4})`, opacity: 1 - ripple }} />}
      <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: `scale(${1 - clamp(click, 0, 1) * 0.2})` }}>
        <svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15 L12 22 L15 21 L12 14 L19 14 Z" fill="#fff" stroke={color} strokeWidth="1.5" /></svg>
      </div>
    </AbsoluteFill>
  )
}

/* ===================== 4. PHYSICS TYPE =================================== */

// PhysicsWord — a word DROPS in and bounces on landing (gravity + squash).
export const PhysicsWord: React.FC<{ text: string; color?: string; size?: number; at?: number; font: string }> =
({ text, color = '#fff', size = 120, at = 0, font }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const drop = spring({ frame: frame - at, fps, config: { damping: 9, stiffness: 140, mass: 1.1 } })
  const y = interpolate(clamp(drop, 0, 1), [0, 1], [-500, 0])
  const land = clamp((frame - at) / 14, 0, 1)
  const squash = land > 0.7 ? 1 + Math.sin((land - 0.7) / 0.3 * Math.PI) * 0.12 : 1
  return (
    <div style={{ fontFamily: font, fontWeight: 800, fontSize: size, color, textTransform: 'uppercase', transform: `translateY(${y}px) scale(${squash}, ${2 - squash})`, opacity: clamp(drop * 3, 0, 1), lineHeight: 1.1, paddingBottom: '0.06em', textShadow: '0 6px 0 rgba(0,0,0,0.2)' }}>{text}</div>
  )
}

// BeatWord — words appear one-by-one, each popping ON a beat frame (pass beats[]).
export const BeatWord: React.FC<{ words: string[]; beats: number[]; color?: string; hot?: string; hotColor?: string; size?: number; font: string }> =
({ words, beats, color = '#fff', hot, hotColor = '#fbbf24', size = 90, font }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `0 ${size * 0.28}px`, justifyContent: 'center', alignItems: 'center', maxWidth: 1500 }}>
      {words.map((w, i) => {
        const at = beats[i] ?? i * 8
        const pop = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 260 } })
        const isHot = hot && w.toLowerCase().includes(hot.toLowerCase())
        return <span key={i} style={{ fontFamily: font, fontWeight: 800, fontSize: size, color: isHot ? hotColor : color, textTransform: 'uppercase', transform: `scale(${clamp(pop, 0, 1.1)})`, opacity: clamp(pop * 3, 0, 1), lineHeight: 1.1, display: 'inline-block' }}>{w}</span>
      })}
    </div>
  )
}

// ShatterWord — a word holds, then shatters into fragments that fly apart.
export const ShatterWord: React.FC<{ text: string; color?: string; size?: number; shatterAt: number; font: string }> =
({ text, color = '#fff', size = 130, shatterAt, font }) => {
  const frame = useCurrentFrame()
  const chars = text.split('')
  const t = clamp((frame - shatterAt) / 20, 0, 1)
  return (
    <div style={{ display: 'flex' }}>
      {chars.map((ch, i) => {
        const ang = (rng(i, 13) - 0.5) * Math.PI
        const dist = t * (200 + rng(i, 17) * 300)
        return <span key={i} style={{ fontFamily: font, fontWeight: 800, fontSize: size, color, textTransform: 'uppercase', display: 'inline-block', transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + t * t * 200}px) rotate(${t * (rng(i, 19) - 0.5) * 720}deg)`, opacity: 1 - t }}>{ch === ' ' ? ' ' : ch}</span>
      })}
    </div>
  )
}
