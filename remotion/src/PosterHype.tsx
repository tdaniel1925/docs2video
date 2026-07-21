import React from 'react'
import { AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random } from 'remotion'
import D from '../public/posterhype/durations.json'

/* ============================================================================
 * POSTER HYPE — Apex recruiting hype in HOPE-poster / political-pop-art style.
 * Palette: teal / crimson / cream / navy. Bold flat posterized faces grid +
 * big hard-color-block panels with heavy flat type. Rachel VO + hype music.
 * ==========================================================================*/
const FPS = 30
const TEAL = '#2f6f74', RED = '#c0313a', CREAM = '#efe6d2', NAVY = '#26303f', INK = '#1c2430'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const S = (sec: number) => Math.round(sec * FPS)
const vo: number[] = (D as any).vo || []
const lines: string[] = (D as any).lines || []
const NFACES = 15

/* halftone dot overlay for print feel */
const dots = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><circle cx='1.5' cy='1.5' r='1' fill='black'/></svg>`)
const Halftone: React.FC<{ o?: number }> = ({ o = 0.06 }) => <AbsoluteFill style={{ backgroundImage: `url("data:image/svg+xml,${dots}")`, backgroundSize: '6px 6px', opacity: o, mixBlendMode: 'multiply', pointerEvents: 'none' }} />

/* the face grid backdrop — 6 cols, tiles drift slowly, tinted to palette */
const FaceGrid: React.FC<{ dim?: number }> = ({ dim = 1 }) => {
  const f = useCurrentFrame()
  const cols = 6, rows = 4
  const cells: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const idx = (r * cols + c) % NFACES
    const seed = r * cols + c
    const inAt = 4 + seed * 1.4
    const p = interpolate(f - inAt, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
    const drift = Math.sin((f + seed * 40) * 0.02) * 4
    cells.push(
      <div key={seed} style={{ position: 'relative', overflow: 'hidden', background: (r + c) % 2 ? RED : TEAL, opacity: clamp(p) * dim, transform: `translateY(${(1 - p) * 30 + drift}px) scale(${0.9 + clamp(p) * 0.1})` }}>
        <Img src={staticFile(`posterhype/face-${idx}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'luminosity', opacity: 0.92 }} />
        <AbsoluteFill style={{ background: (r + c) % 2 ? `${RED}55` : `${TEAL}55`, mixBlendMode: 'multiply' }} />
      </div>
    )
  }
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <div style={{ position: 'absolute', inset: -20, display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: `repeat(${rows},1fr)`, gap: 6 }}>{cells}</div>
      <Halftone o={0.05} />
    </AbsoluteFill>
  )
}

/* bold poster panel: hard diagonal color split + heavy flat headline */
const TORN = 'polygon(0 0,100% 0,100% 100%,0 100%)'
const PosterPanel: React.FC<{ head: string; accent?: string; kicker?: string; split?: 'red' | 'teal' | 'navy' }> = ({ head, accent, kicker, split = 'red' }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 3, fps, config: { damping: 18, stiffness: 150 } })
  const bg = split === 'red' ? RED : split === 'teal' ? TEAL : NAVY
  const bar = split === 'red' ? TEAL : split === 'teal' ? RED : RED
  const headEl = accent && head.includes(accent)
    ? <>{head.replace(accent, '')}<span style={{ color: CREAM, background: bar, padding: '0 14px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } as any}>{accent}</span></>
    : head
  return (
    <AbsoluteFill style={{ background: bg }}>
      {/* diagonal cream block */}
      <div style={{ position: 'absolute', inset: 0, background: CREAM, clipPath: 'polygon(0 100%, 100% 40%, 100% 100%)', opacity: 0.14 }} />
      <Halftone o={0.08} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', padding: '0 120px' }}>
        <div style={{ transform: `translateX(${(1 - s) * -60}px)`, opacity: clamp(s), maxWidth: 1500 }}>
          {kicker ? <div style={{ display: 'inline-block', background: CREAM, color: INK, fontFamily: FONT, fontWeight: 900, fontSize: 30, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '8px 20px', marginBottom: 26 }}>{kicker}</div> : null}
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 108, lineHeight: 1.0, color: CREAM, letterSpacing: '-0.02em', textTransform: 'uppercase', textShadow: '4px 4px 0 rgba(0,0,0,0.25)' }}>{headEl}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* caption strip over the face grid (for grid beats) */
const GridCaption: React.FC<{ head: string; accent?: string }> = ({ head, accent }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 3, fps, config: { damping: 20, stiffness: 150 } })
  const headEl = accent && head.includes(accent) ? <>{head.replace(accent, '')}<span style={{ color: CREAM, background: RED, padding: '0 12px' }}>{accent}</span></> : head
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90 }}>
      <div style={{ background: NAVY, padding: '22px 46px', transform: `translateY(${(1 - s) * 30}px)`, opacity: clamp(s), boxShadow: '0 14px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 60, color: CREAM, textTransform: 'uppercase', letterSpacing: '-0.01em', textAlign: 'center' }}>{headEl}</div>
      </div>
    </AbsoluteFill>
  )
}

const CornerLogo: React.FC = () => { const f = useCurrentFrame(); const o = interpolate(f, [8, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <div style={{ position: 'absolute', top: 40, right: 50, opacity: o }}><div style={{ background: CREAM, padding: '10px 18px', boxShadow: '0 6px 22px rgba(0,0,0,0.4)' }}><Img src={staticFile('posterhype/logo.png')} style={{ height: 40, display: 'block' }} /></div></div> }

/* per-beat plan: which are grid (with caption) vs full poster panel */
type Beat = { kind: 'grid' | 'poster'; head: string; accent?: string; kicker?: string; split?: 'red' | 'teal' | 'navy' }
const BEATS: Beat[] = [
  { kind: 'grid', head: 'Not A Company. A Movement.', accent: 'A Movement.' },                          // 0
  { kind: 'grid', head: 'Everyday People. Building Bigger.', accent: 'Building Bigger.' },               // 1
  { kind: 'poster', kicker: 'Two Ways To Earn', head: 'One Mission.', accent: 'One Mission.', split: 'red' },   // 2
  { kind: 'poster', kicker: 'You + Apex', head: 'Tools. Training. Team.', accent: 'Team.', split: 'teal' },      // 3
  { kind: 'poster', head: 'No Ceilings. No Limits.', accent: 'No Limits.', split: 'navy' },              // 4
  { kind: 'grid', head: 'Are You Ready?', accent: 'Ready?' },                                            // 5
  { kind: 'poster', kicker: 'This Is Apex', head: 'Join The Movement.', accent: 'The Movement.', split: 'red' }, // 6
]

const PAD = 0.45, XF = 0.35
const INTRO = S(2.6), OUTRO = S(3.0)
const segD = vo.map((d) => (d || 6) + PAD)
const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
export const POSTER_FRAMES = INTRO + bodyFrames + OUTRO

const Cut: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => { const f = useCurrentFrame(); const xf = S(XF); const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill> }

const IntroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 2, fps, config: { damping: 14, stiffness: 150 } })
  return (
    <AbsoluteFill>
      <FaceGrid dim={0.5} />
      <AbsoluteFill style={{ background: `${NAVY}aa` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: CREAM, padding: '30px 56px', transform: `scale(${0.8 + clamp(s) * 0.2})`, opacity: clamp(s), boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}><Img src={staticFile('posterhype/logo.png')} style={{ height: 130, display: 'block' }} /></div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
const OutroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 3, fps, config: { damping: 16, stiffness: 150 } })
  const url = interpolate(f, [22, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ background: RED }}>
      <div style={{ position: 'absolute', inset: 0, background: TEAL, clipPath: 'polygon(0 0,100% 0,100% 45%,0 65%)' }} />
      <Halftone o={0.08} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
        <div style={{ background: CREAM, padding: '26px 50px', transform: `scale(${0.85 + clamp(s) * 0.15})`, opacity: clamp(s), boxShadow: '0 18px 50px rgba(0,0,0,0.5)' }}><Img src={staticFile('posterhype/logo.png')} style={{ height: 120, display: 'block' }} /></div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 46, color: CREAM, letterSpacing: '0.04em', opacity: url }}>reachtheapex.net</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

export const PosterHype: React.FC = () => {
  const bodyStart = INTRO
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  const outroStart = bodyStart + bodyFrames
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Audio src={staticFile('posterhype/musicDucked.mp3')} volume={1} />
      <Audio src={staticFile('posterhype/voMaster.mp3')} volume={1} />
      <Sequence from={0} durationInFrames={INTRO}><IntroScreen /></Sequence>
      {segD.map((d, i) => { const durF = S(d); const b = BEATS[i] || BEATS[BEATS.length - 1]; return (
        <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
          <Cut dur={durF}>
            {b.kind === 'poster'
              ? <PosterPanel head={b.head} accent={b.accent} kicker={b.kicker} split={b.split} />
              : <AbsoluteFill><FaceGrid /><AbsoluteFill style={{ background: `${NAVY}44` }} /><GridCaption head={b.head} accent={b.accent} /></AbsoluteFill>}
          </Cut>
        </Sequence>
      ) })}
      <Sequence from={outroStart} durationInFrames={OUTRO}><OutroScreen /></Sequence>
      <CornerLogo />
    </AbsoluteFill>
  )
}
