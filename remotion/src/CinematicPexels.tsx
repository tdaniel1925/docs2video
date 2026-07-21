import React from 'react'
import { AbsoluteFill, Sequence, Audio, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random } from 'remotion'
import D from '../public/cine2/durations.json'

/* ============================================================================
 * CINEMATIC — REAL PEXELS FOOTAGE + tasteful VFX polish.
 * Plays real stock clips (public/pexels/f-N.mp4) with a cinematic grade, subtle
 * push, grain, letterbox, soft light, kinetic titles, motion transitions, and the
 * Apex Affinity Group logo reveal. Reuses cine2 VO + music (mastered into pexels/).
 * ==========================================================================*/
const FPS = 30
const GOLD = '#ffb54a', WARM = '#ff7a3c', CREAM = '#f4efe4', WHITE = '#fff'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), inOut: Easing.bezier(0.7, 0, 0.3, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const S = (sec: number) => Math.round(sec * FPS)
const vo: number[] = (D as any).vo || []

const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
const Grain: React.FC<{ o?: number }> = ({ o = 0.06 }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${(f * 11) % 200}px ${(f * 23) % 200}px`, opacity: o, mixBlendMode: 'overlay', pointerEvents: 'none' }} /> }
const Vignette: React.FC = () => <AbsoluteFill style={{ background: 'radial-gradient(120% 95% at 50% 45%, transparent 50%, rgba(0,0,0,0.62) 100%)', pointerEvents: 'none' }} />
const Letterbox: React.FC<{ open?: number }> = ({ open = 1 }) => { const h = 88 * open; return <><div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h, background: '#000' }} /><div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: h, background: '#000' }} /></> }
const SoftLight: React.FC<{ x?: number; y?: number }> = ({ x = 78, y = 22 }) => { const f = useCurrentFrame(); const pulse = 0.4 + Math.sin(f * 0.06) * 0.12; return <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 900, height: 900, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${GOLD}44 0%, ${WARM}18 32%, transparent 62%)`, mixBlendMode: 'screen', opacity: pulse, filter: 'blur(10px)', pointerEvents: 'none' }} /> }
const Dust: React.FC<{ n?: number }> = ({ n = 20 }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>{new Array(n).fill(0).map((_, i) => { const sx = random(`x${i}`) * 100; const sp = 0.05 + random(`s${i}`) * 0.14; const sz = 1 + random(`z${i}`) * 3; const y = (100 - ((f * sp + random(`o${i}`) * 100) % 108)); const dx = Math.sin((f + i * 30) * 0.02) * 2; const op = 0.12 + random(`a${i}`) * 0.3; return <div key={i} style={{ position: 'absolute', left: `${sx + dx}%`, top: `${y}%`, width: sz, height: sz, borderRadius: '50%', background: GOLD, boxShadow: `0 0 ${sz * 3}px ${GOLD}`, opacity: op }} /> })}</AbsoluteFill> }

/* real clip with subtle push + cinematic grade */
const Clip: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.inOut })
  const zoomIn = i % 2 === 0
  const scale = zoomIn ? 1.04 + p * 0.12 : 1.16 - p * 0.1
  const streak = interpolate(f, [0, 5], [10, 0], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <OffthreadVideo src={staticFile(`pexels/f-${i}.mp4`)} muted playbackRate={1} startFrom={0} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: `contrast(1.12) saturate(1.1) brightness(0.92) blur(${streak * 0.1}px)` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(120deg, ${GOLD}14, transparent 52%, rgba(10,16,24,0.5))`, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,8,6,0.3), transparent 30%, transparent 64%, rgba(10,8,6,0.85))' }} />
    </AbsoluteFill>
  )
}

const Slam: React.FC<{ text: string; accent?: string; big?: boolean }> = ({ text, accent, big }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f, fps, config: { damping: 13, stiffness: 240, mass: 0.8 } })
  const blur = interpolate(f, [0, 6], [14, 0], { extrapolateRight: 'clamp' })
  const drift = interpolate(f, [0, 60], [0, -12], { extrapolateRight: 'clamp' })
  const size = big ? 140 : 88
  const el = accent && text.includes(accent) ? <>{text.replace(accent, '')}<span style={{ color: GOLD }}>{accent}</span></> : text
  return <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 90px' }}><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 0.98, color: WHITE, textTransform: 'uppercase', letterSpacing: '-0.02em', textAlign: 'center', transform: `scale(${0.82 + clamp(s) * 0.18}) translateY(${drift}px)`, opacity: clamp(s), filter: `blur(${blur}px)`, textShadow: '0 0 26px rgba(0,0,0,0.75), 0 10px 40px rgba(0,0,0,0.6)' }}>{el}</div></AbsoluteFill>
}

const LogoReveal: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 12, stiffness: 130, mass: 0.9 } })
  const depth = interpolate(f, [0, 40], [1.25, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const sweep = interpolate(f, [10, 30], [-160, 260], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const bloom = 0.4 + Math.sin(f * 0.09) * 0.25
  const ring = interpolate(f, [6, 26], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const ringO = interpolate(f, [6, 26], [0.8, 0], { extrapolateRight: 'clamp' })
  const nameIn = interpolate(f, [22, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const tagIn = interpolate(f, [34, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ background: '#0a0705', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
      <SoftLight x={50} y={42} /><Dust n={34} />
      <div style={{ position: 'absolute', top: '42%', left: '50%', width: 200, height: 200, borderRadius: '50%', border: `4px solid ${GOLD}`, transform: `translate(-50%,-50%) scale(${1 + ring * 6})`, opacity: ringO, filter: 'blur(1px)' }} />
      <div style={{ position: 'relative', transform: `scale(${(0.7 + clamp(s) * 0.3) * depth})`, opacity: clamp(s), filter: `drop-shadow(0 0 ${34 + bloom * 60}px rgba(255,181,74,0.55))` }}>
        <div style={{ position: 'relative', background: CREAM, borderRadius: 6, padding: '34px 62px', overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,0.7)' }}>
          <Img src={staticFile('pexels/logo.png')} style={{ height: 150, display: 'block' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sweep}%`, width: '55%', background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.85), transparent)', transform: 'skewX(-18deg)', mixBlendMode: 'screen' }} />
        </div>
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 62, color: WHITE, letterSpacing: '0.02em', textTransform: 'uppercase', opacity: nameIn, transform: `translateY(${(1 - nameIn) * 16}px)`, textShadow: '0 0 26px rgba(255,181,74,0.5)' }}>Apex Affinity Group</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 34, color: GOLD, letterSpacing: '0.28em', textTransform: 'uppercase', opacity: tagIn }}>Rise Together</div>
      <Grain o={0.08} /><Vignette /><Letterbox />
    </AbsoluteFill>
  )
}

const PAD = 0.3, XF = 0.22
const INTRO = S(1.8), OUTRO = S(4.4)
const segD = vo.map((d) => (d || 5) + PAD)
const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
export const PEXELS_FRAMES = INTRO + bodyFrames + OUTRO
const NCLIPS = 9

const Cut: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame(); const xf = S(XF)
  const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const streak = Math.max(interpolate(f, [0, xf], [1, 0], { extrapolateRight: 'clamp' }), interpolate(f, [dur - xf, dur], [0, 1], { extrapolateLeft: 'clamp' }))
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO), filter: `blur(${streak * 4}px)`, transform: `scale(${1 + streak * 0.025})` }}>{children}</AbsoluteFill>
}
const Intro: React.FC = () => { const f = useCurrentFrame(); const lb = interpolate(f, [0, 14], [1.5, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut }); return <AbsoluteFill style={{ background: '#000' }}><SoftLight x={50} y={40} /><Dust n={18} /><Grain o={0.09} /><Vignette /><Letterbox open={lb} /></AbsoluteFill> }

const TITLES: Record<number, { t: string; accent?: string; big?: boolean }> = {
  2: { t: 'Bet On Yourself.', accent: 'Yourself.' },
  4: { t: 'Real Tools. Real Team.', accent: 'Real Team.' },
  6: { t: 'Ordinary People. Extraordinary Results.', accent: 'Extraordinary Results.' },
  7: { t: "Don't Wait. Build.", accent: 'Build.', big: true },
}

export const CinematicPexels: React.FC = () => {
  const f = useCurrentFrame()
  const bodyStart = INTRO
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  const outroStart = bodyStart + bodyFrames
  let shake = 0
  starts.forEach((st) => { const d = f - st; if (d >= 0 && d < 6) shake = Math.max(shake, (1 - d / 6) * 4) })
  const sx = Math.sin(f * 1.9) * shake, sy = Math.cos(f * 2.3) * shake
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Audio src={staticFile('pexels/musicDucked.mp3')} volume={1} />
      <Audio src={staticFile('pexels/voMaster.mp3')} volume={1} />
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        <Sequence from={0} durationInFrames={INTRO}><Intro /></Sequence>
        {segD.map((d, i) => { const durF = S(d); const title = TITLES[i]; const clip = i % NCLIPS; return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <Cut dur={durF}>
              <Clip i={clip} />
              <SoftLight x={i % 2 ? 74 : 26} y={24} />
              <Dust n={14} />
              {title ? <Slam text={title.t} accent={title.accent} big={title.big} /> : null}
              <Grain /><Vignette /><Letterbox />
            </Cut>
          </Sequence>
        ) })}
        <Sequence from={outroStart} durationInFrames={OUTRO}><LogoReveal /></Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
