import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, Img } from 'remotion'
import { staticFile } from './asset'

/* ============================================================================
 * PIZZAZZ TOOLKIT — the A-grade motion + polish layer, reusable across videos.
 *   · CountUp        — a number that animates up from zero
 *   · Bar            — a bar/meter that fills
 *   · StreakWipe     — a light-streak transition between shots (on the beat)
 *   · SpeedRamp      — wraps a shot: slow-hold then whip (via scale/blur proxy)
 *   · Morph          — cross-morph between two elements (shape flows into shape)
 *   · DepthText      — headline composited BEHIND a cut-out subject (occlusion)
 *   · Bokeh          — drifting foreground bokeh / atmosphere
 *   · HeroFlash      — a choreographed impact burst for the "hero moment"
 *   · Alive          — wraps a beat so it NEVER freezes (drift + breathe + float)
 *   · sustained()    — spread reveal timings across a beat (no front-loading)
 *   · SettleSweep    — a late accent that sweeps settled content (fills a hold)
 * All are pure, deterministic, and frame-driven. Colors passed in per-brand.
 *
 * A→A++ RULE — NOTHING ON SCREEN IS EVER FROZEN. Every beat must have continuous
 * subtle motion for its WHOLE duration. Wrap content in <Alive> and spread
 * reveals with sustained() so a long hold still feels energetic, not draggy.
 * ==========================================================================*/

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// ---- Alive: wrap any beat's content so it keeps living the whole duration.
// Applies a slow parallax drift + breathing scale + tiny float — imperceptible
// per-frame but it means the frame is NEVER static. Use on every beat.
export const Alive: React.FC<{ intensity?: number; children: React.ReactNode }> = ({ intensity = 1, children }) => {
  const frame = useCurrentFrame()
  const dx = Math.sin(frame * 0.012) * 0.5 * intensity
  const dy = Math.cos(frame * 0.009) * 0.4 * intensity
  const breathe = 1 + Math.sin(frame * 0.02) * 0.004 * intensity
  return (
    <AbsoluteFill style={{ transform: `translate(${dx}%, ${dy}%) scale(${breathe})` }}>
      {children}
    </AbsoluteFill>
  )
}

// ---- sustained: given an item index, total count, and the beat's hold length
// (frames), return the frame at which that item should reveal — spread across
// ~70% of the beat so new motion keeps happening instead of finishing in 1.5s.
// Leaves a head (startPad) and a tail so the last reveal isn't cut off.
export const sustained = (index: number, count: number, holdFrames: number, startPad = 6): number => {
  const usable = Math.max(0, holdFrames - startPad - 20)   // reserve tail
  if (count <= 1) return startPad
  return Math.round(startPad + (usable * index) / (count - 1) * 0.85)
}

// ---- SettleSweep: a soft light sweep that crosses the frame LATE in a beat —
// use to add a fresh motion event during the tail of a long hold so it doesn't
// die. Give it the beat's hold length; it fires around 65% through.
export const SettleSweep: React.FC<{ color: string; hold: number }> = ({ color, hold }) => {
  const frame = useCurrentFrame()
  const at = Math.round(hold * 0.62)
  const p = clamp((frame - at) / 22, 0, 1)
  const x = interpolate(p, [0, 1], [-40, 140])
  const o = interpolate(p, [0, 0.3, 1], [0, 0.28, 0])
  if (p <= 0 || p >= 1) return null
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', overflow: 'hidden', opacity: o }}>
      <div style={{ position: 'absolute', top: '-20%', left: `${x}%`, width: '45%', height: '140%', background: `linear-gradient(100deg, transparent, ${color}, transparent)`, transform: 'skewX(-14deg)', filter: 'blur(30px)' }} />
    </AbsoluteFill>
  )
}

// ---- CountUp: animate a numeric value from 0 → target with an eased curve.
// SYSTEM RULE: all numbers are formatted with thousands separators (commas), and
// currency values (prefix "$") always show 2 decimals unless `decimals` is set
// explicitly. So 355829 → "$355,829" and 46667 → "$46,667". This applies to
// EVERY video via this shared component — never hand-format currency inline.
export const CountUp: React.FC<{
  to: number; from?: number; dur?: number; prefix?: string; suffix?: string
  decimals?: number; style?: React.CSSProperties; startAt?: number
}> = ({ to, from = 0, dur = 26, prefix = '', suffix = '', decimals, style, startAt = 0 }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame - startAt, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const v = from + (to - from) * t
  // decimals default: currency keeps whole dollars for big round figures unless
  // the target itself has cents; non-currency defaults to 0.
  const dec = decimals ?? (Number.isInteger(to) ? 0 : 2)
  const formatted = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  return <span style={style}>{prefix}{formatted}{suffix}</span>
}

// ---- Bar: a meter that fills left→right, with an optional glow head.
export const Bar: React.FC<{ pct: number; dur?: number; startAt?: number; color: string; track?: string; w?: number; h?: number }> =
({ pct, dur = 24, startAt = 0, color, track = 'rgba(255,255,255,0.12)', w = 420, h = 12 }) => {
  const frame = useCurrentFrame()
  const fill = interpolate(frame - startAt, [0, dur], [0, pct / 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return (
    <div style={{ width: w, height: h, borderRadius: h, background: track, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width: `${fill * 100}%`, height: '100%', borderRadius: h, background: `linear-gradient(90deg, ${color}aa, ${color})`, boxShadow: `0 0 16px ${color}` }} />
    </div>
  )
}

// ---- StreakWipe: a bright diagonal light-streak sweeps across, covering the
// cut. Place at a shot boundary (first ~10 frames of the incoming shot).
export const StreakWipe: React.FC<{ color: string; dir?: 1 | -1; dur?: number }> = ({ color, dir = 1, dur = 12 }) => {
  const frame = useCurrentFrame()
  const x = interpolate(frame, [0, dur], [dir > 0 ? -140 : 140, dir > 0 ? 140 : -140], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const o = interpolate(frame, [0, dur * 0.3, dur], [0, 0.85, 0], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', overflow: 'hidden', opacity: o }}>
      <div style={{ position: 'absolute', top: '-20%', left: `${x}%`, width: '55%', height: '140%', background: `linear-gradient(100deg, transparent, ${color}, #ffffff, ${color}, transparent)`, transform: 'skewX(-14deg)', filter: 'blur(10px)' }} />
    </AbsoluteFill>
  )
}

// ---- SpeedRamp: wraps content and applies a "slow-hold → whip" feel using a
// motion-blur + scale proxy (real playbackRate ramps are unreliable on stills).
// rampAt = frame where the whip starts; content should be a full-bleed layer.
export const SpeedRamp: React.FC<{ rampAt: number; whip?: number; dir?: [number, number]; children: React.ReactNode }> =
({ rampAt, whip = 8, dir = [-8, 0], children }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - rampAt) / whip, 0, 1)
  const eased = Easing.in(Easing.cubic)(p)
  const [dx, dy] = dir
  const blur = eased * 12
  return (
    <AbsoluteFill style={{ transform: `translate(${dx * eased}%, ${dy * eased}%) scale(${1 + eased * 0.06})`, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  )
}

// ---- Morph: cross-fade + scale-morph from A to B around a midpoint. Give it
// two absolutely-positioned children [from, to]; it blends them with a squash.
export const Morph: React.FC<{ at: number; dur?: number; from: React.ReactNode; to: React.ReactNode }> =
({ at, dur = 16, from, to }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - at) / dur, 0, 1)
  const e = Easing.inOut(Easing.cubic)(p)
  const squash = 1 - Math.sin(p * Math.PI) * 0.12   // pinch at the midpoint
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <AbsoluteFill style={{ opacity: 1 - e, transform: `scale(${squash}) scale(${1 - e * 0.3})`, filter: `blur(${e * 6}px)`, justifyContent: 'center', alignItems: 'center' }}>{from}</AbsoluteFill>
      <AbsoluteFill style={{ opacity: e, transform: `scale(${squash}) scale(${0.7 + e * 0.3})`, filter: `blur(${(1 - e) * 6}px)`, justifyContent: 'center', alignItems: 'center' }}>{to}</AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---- DepthText: a headline placed BEHIND a foreground subject cut-out, so the
// subject occludes the type (real depth). Pass the subject as a transparent PNG
// (or the same photo — the mask arg lets you supply a pre-cut foreground layer).
export const DepthText: React.FC<{ text: string; subject: string; fg?: string; color: string; size?: number; font: string; y?: number }> =
({ text, subject, fg, color, size = 200, font, y = 0 }) => {
  return (
    <AbsoluteFill>
      {/* the type, sitting behind */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: font, fontWeight: 900, fontSize: size, color, textTransform: 'uppercase', transform: `translateY(${y}px)`, letterSpacing: '-0.02em', opacity: 0.9 }}>{text}</div>
      </AbsoluteFill>
      {/* foreground subject layer occludes it (use a pre-cut PNG if provided) */}
      <AbsoluteFill>
        <Img src={staticFile(fg || subject)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---- Bokeh: drifting soft foreground orbs — depth + atmosphere.
export const Bokeh: React.FC<{ color: string; count?: number; big?: boolean }> = ({ color, count = 12, big = false }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => {
        const r = ((i * 9301 + 49297) % 233280) / 233280
        const r2 = ((i * 4021 + 7919) % 233280) / 233280
        const x = (r * 110 - 5 + Math.sin(frame * 0.01 + i) * 3)
        const y = ((r2 * 110 - frame * (0.01 + r * 0.02)) % 110 + 110) % 110 - 5
        const size = (big ? 60 : 20) + r2 * (big ? 120 : 40)
        const o = 0.06 + Math.abs(Math.sin(frame * 0.02 + i)) * 0.1
        return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, ${color}, transparent 65%)`, opacity: o, filter: `blur(${big ? 8 : 3}px)` }} />
      })}
    </AbsoluteFill>
  )
}

// ---- HeroFlash: a choreographed impact — radial burst + shockwave ring, for
// the single "hero moment" per video. Fire at the beat you want to punctuate.
export const HeroFlash: React.FC<{ color: string; at?: number }> = ({ color, at = 0 }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - at) / 20, 0, 1)
  const ring = interpolate(p, [0, 1], [0, 2.4])
  const ringO = interpolate(p, [0, 0.15, 1], [0, 0.7, 0])
  const flash = interpolate(p, [0, 0.1, 0.4], [0, 0.5, 0], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', justifyContent: 'center', alignItems: 'center', mixBlendMode: 'screen' }}>
      <AbsoluteFill style={{ background: color, opacity: flash }} />
      <div style={{ width: 400, height: 400, borderRadius: '50%', border: `4px solid ${color}`, transform: `scale(${ring})`, opacity: ringO, boxShadow: `0 0 40px ${color}` }} />
    </AbsoluteFill>
  )
}

// ---- LogoBug: a persistent brand mark in the UPPER-LEFT during the main body of
// EVERY video (system rule). Pass a logo image `src` (staticFile path). If there
// is NO logo, pass `name` (company or presenter) and it renders as text instead.
// Fades in, holds, always subtle (never competes with the content).
export const LogoBug: React.FC<{
  src?: string; name?: string; color?: string; width?: number; fontFamily?: string; opacity?: number
}> = ({ src, name, color = '#ffffff', width = 150, fontFamily, opacity = 0.85 }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [8, 22], [0, opacity], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  // TOP-RIGHT corner: beat content (kickers, headlines, chat bubbles, the diagonal
  // split cell) is almost always anchored top-LEFT or centered — the top-left is
  // where collisions happen (chat beat, split variant, jordyn). The top-right is
  // reliably empty across all beats, so parking the logo there eliminates the
  // whole collision class systemically instead of patching per beat.
  return (
    <div style={{ position: 'absolute', top: 46, right: 58, opacity: o, zIndex: 50, textAlign: 'right' }}>
      {src
        ? <Img src={staticFile(src)} style={{ width, height: 'auto', display: 'block', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
        : <div style={{ fontFamily, fontWeight: 700, fontSize: 30, color, letterSpacing: '0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>{name}</div>}
    </div>
  )
}
