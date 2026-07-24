import React from 'react'
import { AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import D from '../public/jordyn2/durations.json'

/* ============================================================================
 * JORDYN — cinematic product promo built from the REAL jordyn.app visuals:
 * the actual product-UI dashboard (push-ins to real regions, browser frame) +
 * the real warm editorial illustrations (parallax). Jordyn cream/terracotta,
 * warm cinematic grade, kinetic terracotta titles, real site headlines.
 * ==========================================================================*/
const FPS = 30
const RUST = '#c0603f', RUST_D = '#9e4a2e', CREAM = '#f6efe3', CREAM_D = '#efe2d0', INK = '#3a2a20', DEEP = '#2a1c14', WHITE = '#fff'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), inOut: Easing.bezier(0.7, 0, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const S = (sec: number) => Math.round(sec * FPS)
const vo: number[] = (D as any).vo || []

/* warm base gradient */
const Bg: React.FC = () => { const f = useCurrentFrame(); const d = Math.sin(f * 0.02) * 2; return <AbsoluteFill style={{ background: `radial-gradient(120% 100% at ${50 + d}% 30%, ${CREAM} 0%, ${CREAM_D} 60%, #e8d6c2 100%)` }} /> }
const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
const Grain: React.FC<{ o?: number }> = ({ o = 0.04 }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${(f * 9) % 200}px ${(f * 17) % 200}px`, opacity: o, mixBlendMode: 'multiply', pointerEvents: 'none' }} /> }
const SoftGlow: React.FC = () => { const f = useCurrentFrame(); const p = 0.4 + Math.sin(f * 0.05) * 0.12; return <div style={{ position: 'absolute', top: '-15%', right: '-8%', width: 1000, height: 1000, background: `radial-gradient(circle, ${RUST}22, transparent 60%)`, mixBlendMode: 'screen', opacity: p, pointerEvents: 'none' }} /> }

/* the REAL product UI in a floating browser frame, pushing into a focus region */
const UIShot: React.FC<{ src: string; focus: { x: number; y: number; z: number }; startZ?: number }> = ({ src, focus, startZ = 1.0 }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.inOut })
  const z = startZ + (focus.z - startZ) * p
  // pan so focus point drifts to center
  const px = (50 - focus.x) * p * 0.9
  const py = (50 - focus.y) * p * 0.9
  const enter = spring({ frame: f, fps: FPS, config: { damping: 18, stiffness: 120 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: 1500, borderRadius: 16, overflow: 'hidden', boxShadow: '0 40px 100px rgba(90,50,30,0.35), 0 0 0 1px rgba(255,255,255,0.5)', transform: `translateY(${(1 - clamp(enter)) * 60}px) scale(${0.94 + clamp(enter) * 0.06})`, opacity: clamp(enter), background: WHITE }}>
        {/* browser chrome bar */}
        <div style={{ height: 44, background: '#efe6d8', display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px' }}>
          {['#e0705a', '#e8b84a', '#7fb46a'].map((c, i) => <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: c }} />)}
          <div style={{ marginLeft: 16, height: 22, flex: 1, maxWidth: 520, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 14px', fontFamily: FONT, fontSize: 15, color: '#9a8a78' }}>jordyn.app</div>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <Img src={staticFile(src)} style={{ width: '100%', display: 'block', transform: `scale(${z}) translate(${px}%, ${py}%)`, transformOrigin: `${focus.x}% ${focus.y}%` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

/* real illustration with parallax push */
const Illus: React.FC<{ src: string }> = ({ src }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.inOut })
  const enter = spring({ frame: f, fps: FPS, config: { damping: 18, stiffness: 120 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: 720, height: 720, borderRadius: 28, overflow: 'hidden', boxShadow: '0 40px 90px rgba(90,50,30,0.3)', transform: `scale(${(0.92 + clamp(enter) * 0.08) * (1.02 + p * 0.08)}) translateY(${Math.sin(f * 0.04) * 6}px)`, opacity: clamp(enter) }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </AbsoluteFill>
  )
}

/* kinetic caption — bottom-left, terracotta accent */
const Caption: React.FC<{ head: string; accent?: string }> = ({ head, accent }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 3, fps, config: { damping: 18, stiffness: 150 } })
  const el = accent && head.includes(accent) ? <>{head.replace(accent, '')}<span style={{ color: RUST }}>{accent}</span></> : head
  return (
    <div style={{ position: 'absolute', left: 90, bottom: 90, maxWidth: 1400, transform: `translateY(${(1 - clamp(s)) * 28}px)`, opacity: clamp(s) }}>
      <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.82)', borderRadius: 14, padding: '18px 32px', boxShadow: '0 14px 40px rgba(90,50,30,0.2)' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 60, color: DEEP, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{el}</div>
      </div>
    </div>
  )
}

const CornerLogo: React.FC = () => { const f = useCurrentFrame(); const o = interpolate(f, [8, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <div style={{ position: 'absolute', top: 42, right: 52, opacity: o }}><div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 12, padding: '11px 20px', boxShadow: '0 8px 24px rgba(120,60,30,0.22)' }}><Img src={staticFile('jordyn2/logo.png')} style={{ height: 42, display: 'block' }} /></div></div> }

/* per-beat plan. UI shots push into different regions of the real dashboard (img-0). */
type Beat = { kind: 'ui' | 'illus'; src: string; focus?: { x: number; y: number; z: number }; startZ?: number; cap?: { head: string; accent?: string } }
const BEATS: Beat[] = [
  { kind: 'illus', src: 'jordyn2/img-5.png', cap: { head: 'Any A.I. Can Check Your Email.', accent: 'Check Your Email.' } },        // 0
  { kind: 'ui', src: 'jordyn2/img-0.png', focus: { x: 50, y: 40, z: 1.0 }, startZ: 1.18, cap: { head: 'Jordyn Runs It.', accent: 'Runs It.' } }, // 1
  { kind: 'ui', src: 'jordyn2/img-0.png', focus: { x: 62, y: 22, z: 1.5 }, startZ: 1.1, cap: { head: 'Sweeps Your Inbox.', accent: 'Your Inbox.' } }, // 2 (chat top)
  { kind: 'ui', src: 'jordyn2/img-0.png', focus: { x: 60, y: 42, z: 1.55 }, startZ: 1.2, cap: { head: 'Knows What’s Pending.', accent: 'Pending.' } }, // 3 (case list)
  { kind: 'illus', src: 'jordyn2/img-6.png', cap: { head: 'Answers Your Phone.', accent: 'Your Phone.' } },                          // 4
  { kind: 'ui', src: 'jordyn2/img-0.png', focus: { x: 52, y: 62, z: 1.7 }, startZ: 1.3, cap: { head: 'Nothing Sends Without Your OK.', accent: 'Your OK.' } }, // 5 (buttons)
  { kind: 'illus', src: 'jordyn2/img-7.png', cap: { head: 'Knows Your Industry, Day One.', accent: 'Day One.' } },                   // 6
  { kind: 'ui', src: 'jordyn2/img-0.png', focus: { x: 14, y: 45, z: 1.35 }, startZ: 1.05, cap: { head: 'A Brain For Your Business.', accent: 'Your Business.' } }, // 7 (sidebar)
  { kind: 'illus', src: 'jordyn2/img-8.png', cap: { head: 'Start Free.', accent: 'Free.' } },                                       // 8
]

const PAD = 0.35, XF = 0.4
const INTRO = S(2.6), OUTRO = S(3.6)
const segD = vo.map((d) => (d || 5) + PAD)
const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
export const JORDYN2_FRAMES = INTRO + bodyFrames + OUTRO

const Cut: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => { const f = useCurrentFrame(); const xf = S(XF); const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill> }

const IntroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = spring({ frame: f - 3, fps, config: { damping: 14, stiffness: 150 } })
  const l1 = interpolate(f, [14, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const l2 = interpolate(f, [26, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
      <Bg /><SoftGlow />
      <div style={{ background: WHITE, borderRadius: 16, padding: '30px 56px', boxShadow: '0 24px 60px rgba(120,60,30,0.25)', transform: `scale(${0.82 + clamp(s) * 0.18})`, opacity: clamp(s) }}><Img src={staticFile('jordyn2/logo.png')} style={{ height: 120, display: 'block' }} /></div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 68, color: DEEP, textAlign: 'center', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
        <div style={{ opacity: l1, transform: `translateY(${(1 - l1) * 14}px)` }}>Any A.I. can check your email.</div>
        <div style={{ opacity: l2, transform: `translateY(${(1 - l2) * 14}px)` }}>Jordyn <span style={{ color: RUST }}>runs</span> it.</div>
      </div>
      <Grain />
    </AbsoluteFill>
  )
}
const OutroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = spring({ frame: f - 3, fps, config: { damping: 15, stiffness: 150 } })
  const url = interpolate(f, [24, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24 }}>
      <Bg /><SoftGlow />
      <div style={{ background: WHITE, borderRadius: 16, padding: '30px 56px', boxShadow: '0 24px 60px rgba(120,60,30,0.25)', transform: `scale(${0.85 + clamp(s) * 0.15})`, opacity: clamp(s) }}><Img src={staticFile('jordyn2/logo.png')} style={{ height: 116, display: 'block' }} /></div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 48, color: DEEP, opacity: url }}>The A.I. With A <span style={{ color: RUST }}>Brain For Your Business.</span></div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: RUST_D, letterSpacing: '0.03em', opacity: url }}>jordyn.app</div>
      <Grain />
    </AbsoluteFill>
  )
}

export const JordynReal: React.FC = () => {
  const bodyStart = INTRO
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  const outroStart = bodyStart + bodyFrames
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      <Audio src={staticFile('jordyn2/musicDucked.mp3')} volume={1} />
      <Audio src={staticFile('jordyn2/voMaster.mp3')} volume={1} />
      <Sequence from={0} durationInFrames={INTRO}><IntroScreen /></Sequence>
      {segD.map((d, i) => { const durF = S(d); const b = BEATS[i] || BEATS[BEATS.length - 1]; return (
        <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
          <Cut dur={durF}>
            <Bg /><SoftGlow />
            {b.kind === 'ui' ? <UIShot src={b.src} focus={b.focus!} startZ={b.startZ} /> : <Illus src={b.src} />}
            {b.cap ? <Caption head={b.cap.head} accent={b.cap.accent} /> : null}
            <Grain />
          </Cut>
        </Sequence>
      ) })}
      <Sequence from={outroStart} durationInFrames={OUTRO}><OutroScreen /></Sequence>
      <CornerLogo />
    </AbsoluteFill>
  )
}
