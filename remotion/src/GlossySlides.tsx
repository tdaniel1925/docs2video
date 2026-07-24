import React from 'react'
import { AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import D from '../public/glossy/durations.json'

/* ============================================================================
 * GLOSSY 3D SLIDES — Docs2Video-style premium infographic, in JORDYN's warm
 * palette (terracotta + cream). Gemini glossy-3D hero scene on the right; big
 * two-tone headline + glass fact-chips drawn in CODE on the left (crisp text).
 * ==========================================================================*/
const FPS = 30
const RUST = '#c0603f', RUST_D = '#9e4a2e', CREAM = '#f6efe3', WHITE = '#fff', INK = '#3a2a20', DEEP = '#2a1c14'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const S = (sec: number) => Math.round(sec * FPS)
const vo: number[] = (D as any).vo || []
const beats: { head: string; hi?: string; chips?: { icon: string; text: string }[] }[] = (D as any).beats || []

// fact chips per beat (icon + 2-line text). Kept short/punchy.
const CHIPS: Record<number, { icon: string; text: string }[]> = {
  0: [{ icon: '🧠', text: 'Built for your\nindustry.' }, { icon: '⚡', text: 'Ready on\nday one.' }],
  1: [{ icon: '🎯', text: 'No prompt\nengineering.' }, { icon: '📈', text: 'Knows your\nclients.' }],
  2: [{ icon: '✉️', text: 'Reads & sorts\nyour inbox.' }, { icon: '📞', text: 'Answers your\nphone.' }],
  3: [{ icon: '✍️', text: 'Drafted in\nyour voice.' }, { icon: '✅', text: 'Nothing sends\nwithout your OK.' }],
  4: [{ icon: '☀️', text: 'What needs\nyou, first.' }, { icon: '🔔', text: 'Nothing\nslips.' }],
  5: [{ icon: '⏱️', text: '~8 hours back\nevery week.' }, { icon: '💸', text: '≈ $2,000 in\ntime saved.' }],
  6: [{ icon: '🚀', text: '$149 / month.' }, { icon: '🤝', text: 'Your future\nassistant, today.' }],
}

/* subtle animated warm gradient base (behind the Gemini scene, in case of edges) */
const Bg: React.FC = () => <AbsoluteFill style={{ background: `linear-gradient(120deg, ${CREAM} 0%, #f0e2d2 45%, #e8cdb8 100%)` }} />

const GlossChip: React.FC<{ icon: string; text: string; at: number }> = ({ icon, text, at }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 18, stiffness: 150 } })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(192,96,63,0.25)', borderRadius: 14, padding: '18px 26px', boxShadow: '0 10px 30px rgba(120,60,30,0.15), inset 0 1px 0 rgba(255,255,255,0.8)', backdropFilter: 'blur(6px)', transform: `translateX(${(1 - clamp(s)) * -50}px)`, opacity: clamp(s), maxWidth: 560 }}>
      <div style={{ flexShrink: 0, width: 66, height: 66, borderRadius: '50%', background: `linear-gradient(145deg, ${RUST}, ${RUST_D})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: '0 6px 16px rgba(158,74,46,0.4), inset 0 2px 4px rgba(255,255,255,0.35)' }}>{icon}</div>
      <div style={{ width: 2, alignSelf: 'stretch', background: 'rgba(192,96,63,0.35)', margin: '4px 0' }} />
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 34, color: INK, lineHeight: 1.15, whiteSpace: 'pre-line' }}>{text}</div>
    </div>
  )
}

const Slide: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig()
  const b = beats[i] || { head: '' }
  const chips = CHIPS[i] || []
  // hero (Gemini) slow parallax float
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const heroScale = 1.04 + p * 0.06
  const heroY = Math.sin(f * 0.04) * 8
  // headline slam
  const hs = spring({ frame: f - 2, fps, config: { damping: 16, stiffness: 150 } })
  const head = b.head; const hi = b.hi
  const headEl = hi && head.includes(hi) ? <>{head.replace(hi, '')}<span style={{ color: RUST }}>{hi}</span></> : head
  return (
    <AbsoluteFill>
      <Bg />
      {/* Gemini glossy hero fills frame; left is clear per prompt */}
      <AbsoluteFill style={{ transform: `scale(${heroScale}) translateY(${heroY}px)` }}>
        <Img src={staticFile(`glossy/f-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      {/* left readability wash so text always pops */}
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(246,239,227,0.92) 0%, rgba(246,239,227,0.72) 34%, transparent 55%)' }} />
      {/* LEFT column: headline + chips */}
      <div style={{ position: 'absolute', left: 90, top: 130, width: 900 }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 96, lineHeight: 0.98, color: DEEP, letterSpacing: '-0.02em', transform: `translateY(${(1 - clamp(hs)) * 30}px)`, opacity: clamp(hs), textShadow: '0 2px 0 rgba(255,255,255,0.6)' }}>{headEl}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 56 }}>
          {chips.map((c, k) => <GlossChip key={k} icon={c.icon} text={c.text} at={14 + k * 8} />)}
        </div>
      </div>
    </AbsoluteFill>
  )
}

const CornerLogo: React.FC = () => { const f = useCurrentFrame(); const o = interpolate(f, [8, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <div style={{ position: 'absolute', top: 44, right: 54, opacity: o }}><div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 12, padding: '12px 22px', boxShadow: '0 8px 24px rgba(120,60,30,0.25)' }}><Img src={staticFile('glossy/logo.png')} style={{ height: 46, display: 'block' }} /></div></div> }

const PAD = 0.5, XF = 0.4
const INTRO = S(2.4), OUTRO = S(3.4)
const segD = vo.map((d) => (d || 6) + PAD)
const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
export const GLOSSY_FRAMES = INTRO + bodyFrames + OUTRO

const Cut: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => { const f = useCurrentFrame(); const xf = S(XF); const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill> }

const IntroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = spring({ frame: f - 3, fps, config: { damping: 14, stiffness: 150 } })
  const tag = interpolate(f, [16, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 28 }}>
      <Bg />
      <div style={{ background: WHITE, borderRadius: 16, padding: '34px 60px', boxShadow: '0 24px 60px rgba(120,60,30,0.28)', transform: `scale(${0.82 + clamp(s) * 0.18})`, opacity: clamp(s) }}><Img src={staticFile('glossy/logo.png')} style={{ height: 130, display: 'block' }} /></div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, color: DEEP, opacity: tag, textAlign: 'center', maxWidth: 1400 }}>The A.I. Assistant With A <span style={{ color: RUST }}>Brain For Your Business.</span></div>
    </AbsoluteFill>
  )
}
const OutroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = spring({ frame: f - 3, fps, config: { damping: 15, stiffness: 150 } })
  const url = interpolate(f, [24, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
      <Bg />
      <div style={{ background: WHITE, borderRadius: 16, padding: '30px 56px', boxShadow: '0 24px 60px rgba(120,60,30,0.28)', transform: `scale(${0.85 + clamp(s) * 0.15})`, opacity: clamp(s) }}><Img src={staticFile('glossy/logo.png')} style={{ height: 120, display: 'block' }} /></div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 52, color: DEEP, opacity: url }}>Try Jordyn <span style={{ color: RUST }}>Today.</span></div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: RUST_D, letterSpacing: '0.04em', opacity: url }}>jordyn.app</div>
    </AbsoluteFill>
  )
}

export const GlossySlides: React.FC = () => {
  const bodyStart = INTRO
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  const outroStart = bodyStart + bodyFrames
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      <Audio src={staticFile('glossy/musicDucked.mp3')} volume={1} />
      <Audio src={staticFile('glossy/voMaster.mp3')} volume={1} />
      <Sequence from={0} durationInFrames={INTRO}><IntroScreen /></Sequence>
      {segD.map((d, i) => { const durF = S(d); return (
        <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}><Cut dur={durF}><Slide i={i} /></Cut></Sequence>
      ) })}
      <Sequence from={outroStart} durationInFrames={OUTRO}><OutroScreen /></Sequence>
      <CornerLogo />
    </AbsoluteFill>
  )
}
