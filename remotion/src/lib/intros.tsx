import React from 'react'
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'

/* ============================================================================
 * INTRO LIBRARY — cinematic logo-reveal intros, one per "personality". The
 * DIRECTOR picks the style that matches the video (like it picks palette/story):
 *
 *   Ignition   → high-energy (casino, sports, bold)       light-burst + shockwave
 *   Assembly   → tech / engineering (SaaS, dev, AI)        logo builds from shards
 *   Signature  → luxury / premium (finance, executive)     elegant draw + shimmer
 *   Terminal   → data / fintech (analytics, trading)       boots up from code
 *   Pop        → fun / playful (games, consumer)           bouncy squash reveal
 *
 * Visual + SOUND DESIGN only (no VO). Each takes brand TOKENS so it's consistent
 * as a system but bespoke per brand. `render` is your logo (a React node — a
 * wordmark, an <Img>, whatever the video already uses).
 *
 * Usage in a video:
 *   const INTRO = s(3.0)   // ~90 frames
 *   <Sequence from={0} durationInFrames={INTRO}>
 *     <Assembly tokens={{...}} render={<Wordmark/>} dur={INTRO} />
 *   </Sequence>
 *   // then shift all your beats by INTRO frames.
 * ==========================================================================*/

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export type IntroTokens = {
  bg: string          // base background (near-black)
  bg2?: string        // secondary bg for gradient
  accent: string      // primary brand accent
  accentHi?: string   // bright accent
  particle?: string   // particle/shard color (defaults to accent)
}
export type IntroStyle = 'ignition' | 'assembly' | 'signature' | 'terminal' | 'pop'
type IntroProps = { tokens: IntroTokens; render: React.ReactNode; dur: number }

// Director mapping: video personality → intro style.
export function pickIntro(personality: 'luxury' | 'tech' | 'data' | 'playful' | 'bold' | 'warm'): IntroStyle {
  switch (personality) {
    case 'bold': return 'ignition'
    case 'tech': return 'assembly'
    case 'luxury': return 'signature'
    case 'warm': return 'signature'
    case 'data': return 'terminal'
    case 'playful': return 'pop'
    default: return 'assembly'
  }
}

// shared: a hold-then-handoff opacity so the logo is bright, then eases out as
// the video begins (the last ~10 frames cross into beat 1).
const outro = (frame: number, dur: number) =>
  interpolate(frame, [dur - 12, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

// ---------------------------------------------------------------- IGNITION ----
// black → a point of light pulses → BURST into the logo + shockwave ring + flare
export const Ignition: React.FC<IntroProps> = ({ tokens, render, dur }) => {
  const frame = useCurrentFrame()
  const burst = 18
  const pre = clamp(frame / burst, 0, 1)
  const point = interpolate(frame, [0, burst - 4, burst], [0, 0.4, 6], { extrapolateRight: 'clamp' })
  const flash = interpolate(frame, [burst - 2, burst, burst + 6], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const logoIn = spring({ frame: frame - burst, fps: 30, config: { damping: 11, stiffness: 160 } })
  const ring = interpolate(frame, [burst, burst + 22], [0, 3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const ringO = interpolate(frame, [burst, burst + 4, burst + 22], [0, 0.7, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const acc = tokens.accentHi || tokens.accent
  return (
    <AbsoluteFill style={{ background: tokens.bg, justifyContent: 'center', alignItems: 'center', opacity: outro(frame, dur) }}>
      {/* pre-burst pulsing point of light */}
      {frame < burst + 2 && <div style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', background: acc, transform: `scale(${point})`, boxShadow: `0 0 ${60 * pre}px ${30 * pre}px ${acc}`, opacity: 1 - flash }} />}
      {/* white flash on burst */}
      <AbsoluteFill style={{ background: '#fff', opacity: flash * 0.85 }} />
      {/* shockwave ring */}
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: `4px solid ${acc}`, transform: `scale(${ring})`, opacity: ringO, boxShadow: `0 0 40px ${acc}` }} />
      {/* the logo slams in */}
      {frame >= burst && (
        <div style={{ transform: `scale(${0.5 + clamp(logoIn, 0, 1) * 0.5})`, opacity: clamp(logoIn * 2, 0, 1), filter: `drop-shadow(0 0 ${30 * clamp(logoIn, 0, 1)}px ${acc}66)` }}>{render}</div>
      )}
      {/* lens flare streak */}
      <div style={{ position: 'absolute', width: '120%', height: 3, background: `linear-gradient(90deg, transparent, ${acc}, transparent)`, opacity: flash, filter: 'blur(2px)' }} />
      {/* SOUND: sub-drop on the burst + a whoosh into it */}
      <Sequence from={0} durationInFrames={20}><Audio src={staticFile('sfx/whoosh.wav')} volume={0.4} /></Sequence>
      <Sequence from={burst - 2} durationInFrames={40}><Audio src={staticFile('sfx/subdrop.wav')} volume={0.55} /></Sequence>
      <Sequence from={burst - 2} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.5} /></Sequence>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- ASSEMBLY ----
// particles/shards drift in from all sides and lock into the logo with an impact
export const Assembly: React.FC<IntroProps> = ({ tokens, render, dur }) => {
  const frame = useCurrentFrame()
  const lock = 26
  const p = clamp(frame / lock, 0, 1)
  const eased = Easing.out(Easing.cubic)(p)
  const settle = spring({ frame: frame - lock, fps: 30, config: { damping: 12, stiffness: 150 } })
  const acc = tokens.particle || tokens.accent
  const shards = Array.from({ length: 22 }, (_, i) => {
    const r = ((i * 9301 + 49297) % 233280) / 233280
    const r2 = ((i * 4021 + 7919) % 233280) / 233280
    const ang = r * Math.PI * 2
    const dist = (1 - eased) * (400 + r2 * 500)
    const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist
    const size = 8 + r2 * 20
    const rot = (1 - eased) * r * 360
    return <div key={i} style={{ position: 'absolute', width: size, height: size, borderRadius: size * 0.2, background: acc, opacity: (frame < lock ? 0.8 : 0.8 * (1 - clamp(settle, 0, 1))) * (0.5 + r2 * 0.5), transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`, boxShadow: `0 0 ${size}px ${acc}88` }} />
  })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, ${tokens.bg2 || tokens.bg}, ${tokens.bg})`, justifyContent: 'center', alignItems: 'center', opacity: outro(frame, dur) }}>
      {shards}
      {/* logo fades in as shards lock */}
      <div style={{ opacity: clamp((frame - lock + 6) / 10, 0, 1), transform: `scale(${0.9 + clamp(settle, 0, 1) * 0.1})`, filter: `drop-shadow(0 0 ${20 * clamp(settle, 0, 1)}px ${acc}55)` }}>{render}</div>
      {/* flash on lock */}
      <AbsoluteFill style={{ background: acc, opacity: interpolate(frame, [lock - 2, lock, lock + 8], [0, 0.25, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), mixBlendMode: 'screen' }} />
      {/* SOUND: riser into the lock + impact */}
      <Sequence from={0} durationInFrames={lock + 6}><Audio src={staticFile('sfx/riser.wav')} volume={0.35} /></Sequence>
      <Sequence from={lock - 2} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.45} /></Sequence>
    </AbsoluteFill>
  )
}

// --------------------------------------------------------------- SIGNATURE ----
// a spark traces / a gold sweep draws the logo on, then a shimmer settles
export const Signature: React.FC<IntroProps> = ({ tokens, render, dur }) => {
  const frame = useCurrentFrame()
  const draw = interpolate(frame, [6, 34], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const settle = interpolate(frame, [34, 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const shimmerX = interpolate(frame, [34, 60], [-30, 130], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const acc = tokens.accentHi || tokens.accent
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, ${tokens.bg2 || tokens.bg}, ${tokens.bg})`, justifyContent: 'center', alignItems: 'center', opacity: outro(frame, dur) }}>
      {/* logo revealed left→right by a clip mask (the "draw") */}
      <div style={{ position: 'relative', clipPath: `inset(0 ${100 - draw}% 0 0)`, opacity: clamp((frame - 4) / 6, 0, 1) }}>
        {render}
        {/* the drawing light-pen at the reveal edge */}
        {draw < 100 && <div style={{ position: 'absolute', top: '-10%', left: `${draw}%`, width: 4, height: '120%', background: acc, boxShadow: `0 0 24px 6px ${acc}`, opacity: 0.9 }} />}
      </div>
      {/* shimmer sweep after it draws */}
      {frame > 34 && (
        <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: `${shimmerX}%`, width: '25%', height: '100%', background: `linear-gradient(100deg, transparent, ${acc}, transparent)`, transform: 'skewX(-16deg)', filter: 'blur(12px)', opacity: 0.5 * (1 - settle * 0.4) }} />
        </AbsoluteFill>
      )}
      {/* SOUND: a soft riser + shimmer chime as it settles */}
      <Sequence from={4} durationInFrames={34}><Audio src={staticFile('sfx/riser.wav')} volume={0.24} /></Sequence>
      <Sequence from={32} durationInFrames={40}><Audio src={staticFile('sfx/shimmer.mp3')} volume={0.4} /></Sequence>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- TERMINAL ----
// scanlines + a "boot" sequence: the logo resolves out of flickering code
export const Terminal: React.FC<IntroProps> = ({ tokens, render, dur }) => {
  const frame = useCurrentFrame()
  const boot = 30
  const resolve = clamp((frame - 12) / 20, 0, 1)
  const acc = tokens.accentHi || tokens.accent
  // flickering "code" rows before resolve
  const rows = Array.from({ length: 14 }, (_, i) => {
    const seed = (i * 7 + 3) % 5
    const flick = frame < boot ? (Math.sin(frame * 0.6 + i * 1.3) > (0.2 + resolve) ? 0.5 : 0.05) : 0
    const w = 20 + ((i * 37) % 60)
    return <div key={i} style={{ height: 8, width: `${w}%`, background: acc, opacity: flick * (1 - resolve), marginBottom: 14, borderRadius: 2 }} />
  })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${tokens.bg2 || tokens.bg}, ${tokens.bg})`, justifyContent: 'center', alignItems: 'center', opacity: outro(frame, dur) }}>
      {/* boot code rows */}
      <div style={{ position: 'absolute', width: '55%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', opacity: 1 - resolve, fontFamily: 'monospace' }}>{rows}</div>
      {/* scanlines */}
      <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.35, background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.3) 3px, transparent 4px)' }} />
      {/* logo resolves + a scan bar passes */}
      <div style={{ opacity: resolve, transform: `scale(${0.96 + resolve * 0.04})`, filter: `drop-shadow(0 0 ${18 * resolve}px ${acc}55)` }}>{render}</div>
      <div style={{ position: 'absolute', top: `${interpolate(frame, [12, 34], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`, width: '70%', height: 2, background: acc, boxShadow: `0 0 16px ${acc}`, opacity: frame < 36 ? 0.8 : 0 }} />
      {/* SOUND: riser (boot) + a click/impact on resolve */}
      <Sequence from={0} durationInFrames={boot}><Audio src={staticFile('sfx/riser.wav')} volume={0.3} /></Sequence>
      <Sequence from={30} durationInFrames={26}><Audio src={staticFile('sfx/impact-soft.wav')} volume={0.4} /></Sequence>
    </AbsoluteFill>
  )
}

// --------------------------------------------------------------------- POP ----
// bouncy, playful: logo squashes/stretches in with a cheerful pop + confetti
export const Pop: React.FC<IntroProps> = ({ tokens, render, dur }) => {
  const frame = useCurrentFrame()
  const inAt = 8
  const pop = spring({ frame: frame - inAt, fps: 30, config: { damping: 8, stiffness: 170 } })
  const p = clamp(pop, 0, 1)
  // squash-and-stretch
  const t = frame < inAt + 6 ? (frame - inAt) / 6 : 0
  const sx = 1 + Math.sin(clamp(t, 0, 1) * Math.PI) * 0.15
  const sy = 1 - Math.sin(clamp(t, 0, 1) * Math.PI) * 0.15
  const acc = tokens.accentHi || tokens.accent
  const confetti = Array.from({ length: 18 }, (_, i) => {
    const r = ((i * 9301 + 49297) % 233280) / 233280
    const r2 = ((i * 4021) % 233280) / 233280
    const burstAt = inAt + 4
    const bp = clamp((frame - burstAt) / 24, 0, 1)
    const ang = r * Math.PI * 2
    const dist = bp * (200 + r2 * 300)
    const cols = [tokens.accent, tokens.accentHi || tokens.accent, '#4cc38a', '#378add', '#ec4899']
    return <div key={i} style={{ position: 'absolute', width: 14, height: 14, borderRadius: 4, background: cols[i % cols.length], transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + bp * bp * 100}px) rotate(${bp * 360 + i * 40}deg)`, opacity: (1 - bp) * 0.9 }} />
  })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${tokens.bg2 || tokens.bg}, ${tokens.bg})`, justifyContent: 'center', alignItems: 'center', opacity: outro(frame, dur) }}>
      {frame > inAt + 2 && confetti}
      <div style={{ transform: `scale(${0.3 + p * 0.7}) scale(${sx}, ${sy})`, opacity: clamp(p * 2, 0, 1) }}>{render}</div>
      {/* SOUND: a whoosh + cheerful pop */}
      <Sequence from={0} durationInFrames={14}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.35} /></Sequence>
      <Sequence from={inAt} durationInFrames={20}><Audio src={staticFile('sfx/impact-soft.wav')} volume={0.4} /></Sequence>
    </AbsoluteFill>
  )
}

// convenience: render the chosen style by name
export const Intro: React.FC<IntroProps & { style: IntroStyle }> = ({ style, ...p }) => {
  const map = { ignition: Ignition, assembly: Assembly, signature: Signature, terminal: Terminal, pop: Pop }
  const C = map[style]
  return <C {...p} />
}
