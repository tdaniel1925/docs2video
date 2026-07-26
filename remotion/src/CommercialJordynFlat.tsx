import React from 'react'
import {
  AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from 'remotion'
import JORDYN_AUDIO from '../public/jordyn-flat/durations.json'

/* ============================================================================
 * JORDYN — "FLAT" cut. Matches the jordyn.app illustration system: soft muted
 * flat editorial vector scenes (Gemini), warm cream/terracotta/sage, subtle
 * grain, generous space. Captions styled as the site's rounded pill chips.
 * Same differentiation story + Rachel VO + music.
 * ==========================================================================*/

const FPS = 30
const CREAM = '#faf9f5'
const INK = '#3f3a33'
const RUST = '#c4623f'
const TAN = '#d8a07a'
const SAGE = '#9fb488'
const GOLD = '#c78a2a'
const FONT = 'Archivo, Inter, system-ui, sans-serif'

const EASE = {
  expoOut: Easing.bezier(0.16, 1, 0.3, 1),
  backOut: Easing.bezier(0.34, 1.56, 0.64, 1),
}
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

const grainSVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`
)
const Grain: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, mixBlendMode: 'multiply', opacity: 0.04 }} />
)

// flat scene image, gently alive (soft push + micro drift; no heavy motion — the
// style is calm/premium, so keep it subtle)
const FlatScene: React.FC<{ i: number; push?: number; focusX?: number; focusY?: number }> =
({ i, push = 0.06, focusX = 50, focusY = 50 }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const scale = 1.03 + p * push
  const tx = (50 - focusX) * p * 0.1, ty = (50 - focusY) * p * 0.1
  const drift = Math.sin(f * 0.04) * 3
  return (
    <AbsoluteFill style={{ background: CREAM, overflow: 'hidden' }}>
      <Img src={staticFile(`jordyn-flat/f-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${tx}%, ${ty + drift * 0.05}%)` }} />
    </AbsoluteFill>
  )
}

// SITE-STYLE pill chip: fully rounded, solid, with a leading dot (like the
// "NEW — Jordyn answers your phone" / "Pick your industry" chips on jordyn.app)
const Pill: React.FC<{ children: React.ReactNode; at?: number; tone?: 'rust' | 'soft'; big?: boolean }> =
({ children, at = 6, tone = 'rust', big = false }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 150 } })
  const bg = tone === 'rust' ? RUST : '#f0e4d8'
  const fg = tone === 'rust' ? '#fff' : RUST
  const dot = tone === 'rust' ? '#fff' : RUST
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 14,
      background: bg, borderRadius: 999, padding: big ? '20px 40px' : '16px 32px',
      transform: `translateY(${(1 - s) * 30}px) scale(${0.94 + clamp(s) * 0.06})`, opacity: clamp(s),
      boxShadow: tone === 'rust' ? `0 12px 34px ${RUST}44` : '0 8px 24px rgba(150,110,80,0.2)',
    }}>
      <div style={{ width: big ? 12 : 10, height: big ? 12 : 10, borderRadius: '50%', background: dot }} />
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: big ? 40 : 30, color: fg, letterSpacing: '-0.01em' }}>{children}</div>
    </div>
  )
}

// big flat headline (site uses a bold charcoal + rust-accent display type)
const Headline: React.FC<{ children: React.ReactNode; accent?: React.ReactNode; at?: number; size?: number }> =
({ children, accent, at = 4, size = 84 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 16, stiffness: 140 } })
  return (
    <div style={{
      fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.06, color: INK, textAlign: 'center',
      letterSpacing: '-0.025em', transform: `translateY(${(1 - s) * 26}px)`, opacity: clamp(s),
    }}>{children}{accent && <> <span style={{ color: RUST }}>{accent}</span></>}</div>
  )
}

// a soft cream card behind text (rounded, like the site's illustration frames)
const Card: React.FC<{ children: React.ReactNode; at?: number; align?: 'center' | 'flex-start' }> =
({ children, at = 4, align = 'center' }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 16, stiffness: 130 } })
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: align, gap: 16,
      background: 'rgba(250,249,245,0.9)', borderRadius: 26, padding: '38px 56px',
      boxShadow: '0 20px 60px rgba(150,110,80,0.22)', border: '1px solid rgba(200,150,110,0.2)',
      transform: `translateY(${(1 - s) * 30}px)`, opacity: clamp(s), backdropFilter: 'blur(6px)',
    }}>{children}</div>
  )
}

const Row: React.FC<{ text: string; at: number; kind: 'x' | 'check'; accent?: string }> =
({ text, at, kind, accent = RUST }) => {
  const f = useCurrentFrame()
  const p = interpolate(f - at, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
  const bg = kind === 'x' ? '#b8503c' : accent
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: clamp(p), transform: `translateX(${(1 - p) * -30}px)` }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 22, color: '#fff' }}>{kind === 'x' ? '✕' : '✓'}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 42, color: INK }}>{text}</div>
    </div>
  )
}

/* ============================ SCENES ====================================== */
// captions sit LOW so they never cover the character's face (upper/center).

const Bottom: React.FC<{ children: React.ReactNode; pb?: number }> = ({ children, pb = 90 }) => (
  <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: pb }}>{children}</AbsoluteFill>
)

const S0: React.FC = () => (
  <AbsoluteFill><FlatScene i={0} focusY={44} />
    <Bottom><Card at={8}><Headline at={8} size={72}>Buried by 9am.</Headline>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 32, color: '#7a6d5c' }}>Every other AI leaves you here.</div></Card></Bottom>
  </AbsoluteFill>
)
const S1: React.FC = () => (
  <AbsoluteFill><FlatScene i={1} focusX={44} />
    <Bottom><Card at={6} align="flex-start">
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: INK, marginBottom: 4 }}>So you do the work:</div>
      <Row text="You prompt it" at={14} kind="x" />
      <Row text="You train it" at={22} kind="x" />
      <Row text="You babysit it" at={30} kind="x" />
    </Card></Bottom>
  </AbsoluteFill>
)
const S2: React.FC = () => (
  <AbsoluteFill><FlatScene i={2} push={0.09} />
    <Bottom><Card at={8}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Img src={staticFile('jordyn-flat/logo.png')} style={{ height: 62, width: 'auto' }} />
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 58, color: INK }}>is different.</div>
      </div>
    </Card></Bottom>
  </AbsoluteFill>
)
const S3: React.FC = () => (
  <AbsoluteFill><FlatScene i={3} />
    <Bottom><Pill at={8} tone="rust" big>Fluent on day one</Pill></Bottom>
  </AbsoluteFill>
)
const S4: React.FC = () => (
  <AbsoluteFill><FlatScene i={4} focusX={44} />
    <Bottom><Card at={8}><Headline at={8} size={62}>Then it learns you.</Headline>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: '#7a6d5c' }}>Your clients, your deals, your voice.</div></Card></Bottom>
  </AbsoluteFill>
)
const S5: React.FC = () => (
  <AbsoluteFill><FlatScene i={5} focusX={54} focusY={40} />
    <Bottom><Card at={8}><Headline at={8} accent="It just works." size={64}>No prompting.</Headline></Card></Bottom>
  </AbsoluteFill>
)
const S6: React.FC = () => (
  <AbsoluteFill><FlatScene i={6} focusY={46} />
    <Bottom pb={100}><Pill at={8} tone="rust" big>NEW — it answers your phone</Pill></Bottom>
  </AbsoluteFill>
)
const S7: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 8, fps, config: { damping: 14, stiffness: 140 } })
  const tag = interpolate(f, [26, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const url = interpolate(f, [42, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill><FlatScene i={7} focusY={42} push={0.05} />
      <Bottom pb={100}>
        <div style={{ transform: `translateY(${(1 - s) * 40}px) scale(${0.9 + clamp(s) * 0.1})`, opacity: clamp(s), background: CREAM, borderRadius: 26, padding: '32px 58px', boxShadow: '0 22px 60px rgba(150,110,80,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Img src={staticFile('jordyn-flat/logo.png')} style={{ height: 76, width: 'auto' }} />
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK, opacity: tag, textAlign: 'center' }}>Not a tool you operate. <span style={{ color: RUST }}>An assistant that works.</span></div>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 38, color: RUST, opacity: url }}>jordyn.app</div>
        </div>
      </Bottom>
    </AbsoluteFill>
  )
}

/* ============================ TIMELINE ==================================== */
const S = (sec: number) => Math.round(sec * FPS)
const COMPS = [S0, S1, S2, S3, S4, S5, S6, S7]
const PAD = 0.75
const XF = 0.4
const FALLBACK = [4.6, 4.4, 3.4, 4.0, 4.2, 5.2, 3.2, 5.0]
const vo: number[] = (JORDYN_AUDIO && (JORDYN_AUDIO as any).vo) || FALLBACK
const SEG = COMPS.map((c, i) => ({ c, d: (vo[i] || FALLBACK[i]) + PAD }))
const _sumD = SEG.reduce((a, s) => a + s.d, 0)
export const JORDYN_FLAT_FRAMES = Math.round((_sumD - (SEG.length - 1) * XF) * FPS)

// soft cross-dissolve (the flat style calls for calm, not sliding)
const Dissolve: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame(); const xf = S(XF)
  const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill>
}

export const CommercialJordynFlat: React.FC = () => {
  let cursor = 0
  const starts = SEG.map((seg, i) => { const from = S(cursor); cursor += seg.d - (i < SEG.length - 1 ? XF : 0); return from })
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      <Audio src={staticFile('jordyn-flat/music.mp3')} volume={0.4} />
      {SEG.map((seg, i) => {
        const Comp = seg.c
        const durF = S(seg.d)
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <Dissolve dur={durF}><Comp /></Dissolve>
            <Grain />
            <Sequence from={Math.round(0.18 * FPS)}>
              <Audio src={staticFile(`jordyn-flat/vo-${i}.mp3`)} volume={1} />
            </Sequence>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
