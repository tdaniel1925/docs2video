import React from 'react'
import { AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random } from 'remotion'
import D from '../public/cinematic/durations.json'

/* ============================================================================
 * CINEMATIC VFX TRAILER — impressive, high-energy Apex hype (~60s).
 * AI photographic backdrops + heavy CODE VFX: speed-ramp Ken-Burns, glitch /
 * RGB-split hits, god-rays, lens flares, embers/particles, bloom, grain,
 * chromatic aberration, vignette, letterbox, kinetic slam type, screen shake.
 * ==========================================================================*/
const FPS = 30
const RED = '#ff2b45', BLUE = '#3fa9ff', NAVY = '#0a1020', CREAM = '#f2ede0', WHITE = '#fff'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1), inOut: Easing.bezier(0.65, 0, 0.35, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const S = (sec: number) => Math.round(sec * FPS)
const vo: number[] = (D as any).vo || []

/* ---------- reusable VFX layers ---------- */
const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.6'/></svg>`)
const Grain: React.FC<{ o?: number }> = ({ o = 0.09 }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${(f * 13) % 200}px ${(f * 29) % 200}px`, opacity: o, mixBlendMode: 'overlay', pointerEvents: 'none' }} /> }
const Vignette: React.FC = () => <AbsoluteFill style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(0,0,0,0.75) 100%)', pointerEvents: 'none' }} />
const Letterbox: React.FC<{ open?: number }> = ({ open = 1 }) => { const h = 90 * open; return <><div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h, background: '#000' }} /><div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: h, background: '#000' }} /></> }
const Rays: React.FC<{ color?: string; x?: number }> = ({ color = BLUE, x = 50 }) => { const f = useCurrentFrame(); const sway = Math.sin(f * 0.02) * 6; return <AbsoluteFill style={{ background: `conic-gradient(from ${90 + sway}deg at ${x}% -10%, transparent 0deg, ${color}22 8deg, transparent 16deg, ${color}18 26deg, transparent 34deg, ${color}22 46deg, transparent 54deg)`, mixBlendMode: 'screen', opacity: 0.7, pointerEvents: 'none' }} /> }
const Flare: React.FC<{ x?: number; y?: number; color?: string }> = ({ x = 70, y = 30, color = RED }) => { const f = useCurrentFrame(); const pulse = 0.6 + Math.sin(f * 0.15) * 0.25; return <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 500, height: 500, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${color}cc 0%, ${color}44 18%, transparent 55%)`, mixBlendMode: 'screen', opacity: pulse, filter: 'blur(2px)', pointerEvents: 'none' }} /> }
const Embers: React.FC<{ n?: number; color?: string }> = ({ n = 40, color = RED }) => {
  const f = useCurrentFrame()
  return <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>{new Array(n).fill(0).map((_, i) => { const sx = random(`x${i}`) * 100; const speed = 0.15 + random(`s${i}`) * 0.5; const sz = 2 + random(`z${i}`) * 5; const y = (100 - ((f * speed + random(`o${i}`) * 100) % 110)); const drift = Math.sin((f + i * 20) * 0.04) * 3; const op = 0.3 + random(`a${i}`) * 0.6; return <div key={i} style={{ position: 'absolute', left: `${sx + drift}%`, top: `${y}%`, width: sz, height: sz, borderRadius: '50%', background: color, boxShadow: `0 0 ${sz * 3}px ${color}`, opacity: op }} /> })}</AbsoluteFill>
}
/* chromatic aberration + glitch: renders the child 3x in R/G/B offset; glitch spikes offset on hits */
const Chroma: React.FC<{ amt?: number; glitch?: number; children: React.ReactNode }> = ({ amt = 3, glitch = 0, children }) => {
  const off = amt + glitch * 18
  const jitter = glitch > 0.5 ? (random(`g${Math.round(glitch * 100)}`) - 0.5) * 12 : 0
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${-off + jitter}px)`, mixBlendMode: 'screen', filter: 'saturate(2)', opacity: 0.9 }}><AbsoluteFill style={{ background: RED, mixBlendMode: 'multiply' }} />{children}</AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateX(${off - jitter}px)`, mixBlendMode: 'screen', filter: 'saturate(2)', opacity: 0.9 }}><AbsoluteFill style={{ background: BLUE, mixBlendMode: 'multiply' }} />{children}</AbsoluteFill>
      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ---------- cinematic shot: speed-ramp Ken-Burns over a photo, graded ---------- */
const Shot: React.FC<{ i: number; kind: number }> = ({ i, kind }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  // speed ramp: ease-in-out push so motion accelerates then settles (cinematic)
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.inOut })
  const dir = kind % 4
  const zoomIn = dir < 2
  const scale = zoomIn ? 1.08 + p * 0.28 : 1.36 - p * 0.26
  const panX = (dir === 0 ? 1 : dir === 1 ? -1 : dir === 2 ? 1 : -1) * p * 6
  const panY = (dir % 2 === 0 ? -1 : 1) * p * 4
  const grade = kind % 2 === 0 ? RED : BLUE
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Img src={staticFile(`cinematic/f-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${panX}%, ${panY}%)`, filter: 'contrast(1.15) saturate(1.15) brightness(0.82)' }} />
      {/* color grade wash */}
      <AbsoluteFill style={{ background: `linear-gradient(120deg, ${grade}22, transparent 55%, rgba(10,16,32,0.6))`, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,16,32,0.4), transparent 30%, transparent 65%, rgba(10,16,32,0.85))' }} />
    </AbsoluteFill>
  )
}

/* ---------- kinetic slam-in title ---------- */
const Slam: React.FC<{ text: string; accent?: string; big?: boolean }> = ({ text, accent, big }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f, fps, config: { damping: 12, stiffness: 260, mass: 0.7 } })
  const blur = interpolate(f, [0, 6], [16, 0], { extrapolateRight: 'clamp' })
  const size = big ? 150 : 96
  const el = accent && text.includes(accent)
    ? <>{text.replace(accent, '')}<span style={{ color: RED }}>{accent}</span></>
    : text
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 0.98, color: WHITE, textTransform: 'uppercase', letterSpacing: '-0.02em', textAlign: 'center', transform: `scale(${0.7 + clamp(s) * 0.3})`, opacity: clamp(s), filter: `blur(${blur}px)`, textShadow: '0 0 30px rgba(63,169,255,0.5), 0 8px 40px rgba(0,0,0,0.7)' }}>{el}</div>
    </AbsoluteFill>
  )
}

/* ---------- timeline ---------- */
const PAD = 0.35, XF = 0.28
const INTRO = S(2.2), OUTRO = S(3.6)
const segD = vo.map((d) => (d || 5) + PAD)
const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
export const CINE_FRAMES = INTRO + bodyFrames + OUTRO

// screen-shake amount that spikes at the start of each beat + on the finale
const shakeAt = (f: number, localStart: number) => { const since = f - localStart; if (since < 0 || since > 8) return 0; return (1 - since / 8) * 6 }

const Cut: React.FC<{ dur: number; children: React.ReactNode; hard?: boolean }> = ({ dur, children, hard }) => {
  const f = useCurrentFrame(); const xf = S(XF)
  const inO = hard ? interpolate(f, [0, 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill>
}

const Intro: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const lb = interpolate(f, [0, 16], [1.4, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const flick = f < 20 ? (random(`fl${f}`) > 0.6 ? 0.4 : 1) : 1
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ opacity: flick }}><Rays color={BLUE} x={50} /><Flare x={50} y={30} color={BLUE} /></AbsoluteFill>
      <Grain o={0.12} /><Vignette /><Letterbox open={lb} />
    </AbsoluteFill>
  )
}
const Outro: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 150 } })
  const url = interpolate(f, [28, 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const glow = 0.5 + Math.sin(f * 0.1) * 0.3
  return (
    <AbsoluteFill style={{ background: '#05070d', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 28 }}>
      <Rays color={RED} x={50} /><Flare x={50} y={44} color={RED} /><Embers n={30} color={RED} />
      <div style={{ background: CREAM, padding: '30px 56px', borderRadius: 4, transform: `scale(${0.8 + clamp(s) * 0.2})`, opacity: clamp(s), boxShadow: `0 0 ${40 + glow * 60}px rgba(255,43,69,0.6), 0 20px 60px rgba(0,0,0,0.7)` }}><Img src={staticFile('cinematic/logo.png')} style={{ height: 130, display: 'block' }} /></div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 44, color: WHITE, letterSpacing: '0.1em', opacity: url, textShadow: '0 0 24px rgba(63,169,255,0.6)' }}>REACHTHEAPEX.NET</div>
      <Grain o={0.1} /><Vignette /><Letterbox />
    </AbsoluteFill>
  )
}

// per-beat title text (kinetic). null = no title (let the shot breathe)
const TITLES: Record<number, { t: string; accent?: string; big?: boolean }> = {
  2: { t: "You're Not Most People." , accent: 'Most People.' },
  3: { t: 'This Is Apex.', accent: 'Apex.', big: true },
  5: { t: 'Two Ways. One Mission.', accent: 'One Mission.' },
  7: { t: 'No Ceilings. No Limits.', accent: 'No Limits.' },
  8: { t: 'The Movement Is Apex.', accent: 'Apex.' },
  9: { t: 'Rise.', accent: 'Rise.', big: true },
}

export const Cinematic: React.FC = () => {
  const f = useCurrentFrame()
  const bodyStart = INTRO
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  const outroStart = bodyStart + bodyFrames
  // global screen shake: spikes at each beat start
  let shake = 0
  starts.forEach((st) => { shake += shakeAt(f, st) })
  const sx = Math.sin(f * 1.7) * shake, sy = Math.cos(f * 2.1) * shake
  // glitch envelope: quick spikes right at each cut
  let glitch = 0
  starts.forEach((st) => { const d = f - st; if (d >= 0 && d < 4) glitch = Math.max(glitch, 1 - d / 4) })

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Audio src={staticFile('cinematic/musicDucked.mp3')} volume={1} />
      <Audio src={staticFile('cinematic/voMaster.mp3')} volume={1} />
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        <Sequence from={0} durationInFrames={INTRO}><Intro /></Sequence>
        {segD.map((d, i) => {
          const durF = S(d); const title = TITLES[i]
          return (
            <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
              <Cut dur={durF} hard>
                <Chroma amt={2.2} glitch={glitch}>
                  <Shot i={i} kind={i} />
                </Chroma>
                {/* atmosphere on every shot */}
                <Rays color={i % 2 ? RED : BLUE} x={i % 2 ? 72 : 28} />
                <Flare x={i % 2 ? 74 : 26} y={30} color={i % 2 ? RED : BLUE} />
                <Embers n={22} color={i % 2 ? RED : BLUE} />
                {title ? <Slam text={title.t} accent={title.accent} big={title.big} /> : null}
                <Grain /><Vignette /><Letterbox />
              </Cut>
            </Sequence>
          )
        })}
        <Sequence from={outroStart} durationInFrames={OUTRO}><Outro /></Sequence>
      </AbsoluteFill>
      {/* full-frame white flash on the finale beat for a big hit */}
      <FinaleFlash at={starts[9] ?? outroStart} />
    </AbsoluteFill>
  )
}

const FinaleFlash: React.FC<{ at: number }> = ({ at }) => { const f = useCurrentFrame(); const o = interpolate(f - at, [0, 3, 12], [0.9, 0.5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return f >= at && f < at + 14 ? <AbsoluteFill style={{ background: WHITE, opacity: o, pointerEvents: 'none' }} /> : null }
