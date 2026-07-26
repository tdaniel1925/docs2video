import React from 'react'
import {
  AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from 'remotion'
import JORDYN_AUDIO from '../public/jordyn-paper/durations.json'

/* ============================================================================
 * JORDYN — "PAPER" cut. A warm cutout-paper / paper-craft animated ad following
 * a recurring flat character (Sam). Gemini paper-craft scenes, animated with
 * paper-life motion (gentle float/breathe + Ken-Burns), paper-slide/flip scene
 * transitions, torn-paper caption cards, and paper grain. Reuses the Rachel VO +
 * ElevenLabs music. Differentiation story: you operate other AI, Jordyn operates
 * for you.
 * ==========================================================================*/

const FPS = 30
const CREAM = '#faf9f5'
const INK = '#4a3f35'
const RUST = '#c4623f'
const RUST_D = '#a94e30'
const GOLD_D = '#c78a2a'
const SAGE_D = '#6f8c58'
const PAPER = '#f3ede0'
const FONT = 'Archivo, Inter, system-ui, sans-serif'

const EASE = {
  expoOut: Easing.bezier(0.16, 1, 0.3, 1),
  backOut: Easing.bezier(0.34, 1.56, 0.64, 1),
  paper: Easing.bezier(0.5, 1.3, 0.4, 1), // bouncy paper settle
}
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/* paper grain overlay — a faint fiber texture over everything for cohesion */
const grainSVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`
)
const Grain: React.FC = () => {
  const f = useCurrentFrame()
  return <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${(f * 5) % 180}px ${(f * 9) % 180}px`, mixBlendMode: 'multiply', opacity: 0.06 }} />
}

/* the paper scene image, alive: slow Ken-Burns + a gentle breathing float so a
 * still illustration never feels frozen (paper "settling" in a breeze). */
const PaperScene: React.FC<{ i: number; push?: number; focusX?: number; focusY?: number }> =
({ i, push = 0.08, focusX = 50, focusY = 50 }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const scale = 1.04 + p * push
  const tx = (50 - focusX) * p * 0.12, ty = (50 - focusY) * p * 0.12
  const floatY = Math.sin(f * 0.05) * 5
  const floatR = Math.sin(f * 0.035) * 0.25
  return (
    <AbsoluteFill style={{ background: CREAM, overflow: 'hidden' }}>
      <Img src={staticFile(`jordyn-paper/p-${i}.png`)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${tx}%, ${ty + floatY * 0.1}%) rotate(${floatR}deg)` }} />
      {/* very soft warm vignette to seat the paper in frame */}
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 220px rgba(150,120,80,0.18)' }} />
    </AbsoluteFill>
  )
}

/* torn-paper caption card that pops in with a paper bounce, bottom of frame */
const TornCaption: React.FC<{ children: React.ReactNode; at?: number; tone?: 'rust' | 'cream'; sub?: string }> =
({ children, at = 6, tone = 'cream', sub }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 150, mass: 0.7 } })
  const rot = interpolate(s, [0, 1], [-3, -1.2])
  const bg = tone === 'rust' ? RUST : CREAM
  const fg = tone === 'rust' ? '#fff' : INK
  // torn top+bottom edge via clip-path zigzag
  const torn = 'polygon(0% 8%, 4% 3%, 9% 9%, 14% 2%, 20% 8%, 26% 3%, 32% 9%, 38% 3%, 44% 8%, 50% 3%, 56% 9%, 62% 3%, 68% 8%, 74% 3%, 80% 9%, 86% 3%, 92% 8%, 97% 3%, 100% 9%, 100% 91%, 96% 97%, 91% 91%, 85% 98%, 79% 91%, 73% 97%, 67% 91%, 61% 97%, 55% 91%, 49% 97%, 43% 91%, 37% 97%, 31% 91%, 25% 97%, 19% 91%, 13% 97%, 8% 91%, 3% 97%, 0% 91%)'
  return (
    <div style={{
      position: 'absolute', bottom: 96, left: '50%',
      transform: `translateX(-50%) translateY(${(1 - s) * 60}px) rotate(${rot}deg) scale(${0.9 + clamp(s) * 0.1})`,
      opacity: clamp(s),
    }}>
      <div style={{ background: bg, clipPath: torn, padding: '30px 62px', boxShadow: '0 16px 40px rgba(120,90,60,0.35)' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 58, color: fg, textAlign: 'center', letterSpacing: '-0.01em', lineHeight: 1.05 }}>{children}</div>
        {sub && <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: tone === 'rust' ? 'rgba(255,255,255,0.9)' : '#7a6d5c', textAlign: 'center', marginTop: 8 }}>{sub}</div>}
      </div>
    </div>
  )
}

/* small red ✕ / green ✓ paper tag rows for the 'you do the work' beat */
const TagRow: React.FC<{ text: string; at: number; kind: 'x' | 'check'; accent?: string }> =
({ text, at, kind, accent = RUST }) => {
  const f = useCurrentFrame()
  const p = interpolate(f - at, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.paper })
  const bg = kind === 'x' ? '#b04a3a' : accent
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: clamp(p), transform: `translateX(${(1 - p) * -36}px) rotate(${interpolate(p, [0, 1], [-2, -0.6])}deg)` }}>
      <div style={{ width: 40, height: 40, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 22, color: '#fff', boxShadow: '0 4px 12px rgba(120,80,50,0.35)' }}>{kind === 'x' ? '✕' : '✓'}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>{text}</div>
    </div>
  )
}

// a soft dark paper strip behind the tag rows so white text reads on any scene
const TagStack: React.FC<{ children: React.ReactNode; at?: number }> = ({ children, at = 4 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 14, stiffness: 130 } })
  return (
    <div style={{ position: 'absolute', bottom: 90, left: '50%', transform: `translateX(-50%) translateY(${(1 - s) * 40}px)`, opacity: clamp(s), background: 'rgba(60,44,32,0.82)', borderRadius: 16, padding: '26px 44px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 16px 44px rgba(0,0,0,0.4)' }}>
      {children}
    </div>
  )
}

/* ============================ SCENES ====================================== */

const S0: React.FC = () => (   // buried in email
  <AbsoluteFill>
    <PaperScene i={0} focusY={44} push={0.1} />
    <TornCaption at={10} tone="rust" sub="Every other AI leaves you here.">Buried by 9am.</TornCaption>
  </AbsoluteFill>
)
const S1: React.FC = () => (   // blank box + you-do-the-work
  <AbsoluteFill>
    <PaperScene i={1} focusX={44} />
    <TagStack at={6}>
      <TagRow text="You prompt it" at={12} kind="x" />
      <TagRow text="You train it" at={22} kind="x" />
      <TagRow text="You babysit it" at={32} kind="x" />
    </TagStack>
  </AbsoluteFill>
)
const S2: React.FC = () => (   // the turn — Jordyn appears
  <AbsoluteFill>
    <PaperScene i={2} focusY={46} push={0.12} />
    <TornCaption at={8} tone="cream" sub="An assistant that already gets it.">Jordyn is different.</TornCaption>
  </AbsoluteFill>
)
const S3: React.FC = () => (   // arrives fluent
  <AbsoluteFill>
    <PaperScene i={3} />
    <TornCaption at={8} tone="rust">Fluent on day one.</TornCaption>
  </AbsoluteFill>
)
const S4: React.FC = () => (   // learns you
  <AbsoluteFill>
    <PaperScene i={4} focusX={44} />
    <TornCaption at={8} tone="cream" sub="Your clients, your deals, your voice.">Then it learns you.</TornCaption>
  </AbsoluteFill>
)
const S5: React.FC = () => (   // it just works
  <AbsoluteFill>
    <PaperScene i={5} focusX={40} />
    <TornCaption at={8} tone="rust">No prompting. It just works.</TornCaption>
  </AbsoluteFill>
)
const S6: React.FC = () => (   // answers the phone
  <AbsoluteFill>
    <PaperScene i={6} focusY={46} push={0.1} />
    <TornCaption at={8} tone="cream" sub="And makes your calls.">It answers your phone.</TornCaption>
  </AbsoluteFill>
)
const S7: React.FC = () => {   // finale + logo
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 8, fps, config: { damping: 13, stiffness: 140 } })
  const tag = interpolate(f, [26, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const url = interpolate(f, [40, 56], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill>
      <PaperScene i={7} focusY={40} push={0.06} />
      {/* logo on a soft cream paper card, lower-center where the scene left room */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 120 }}>
        <div style={{ transform: `translateY(${(1 - s) * 50}px) scale(${0.85 + clamp(s) * 0.15}) rotate(${interpolate(s, [0, 1], [-2, -0.8])}deg)`, opacity: clamp(s), background: CREAM, borderRadius: 18, padding: '30px 54px', boxShadow: '0 20px 50px rgba(120,90,60,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Img src={staticFile('jordyn-paper/logo.png')} style={{ height: 80, width: 'auto' }} />
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK, opacity: tag, textAlign: 'center' }}>Not a tool you operate. <span style={{ color: RUST }}>An assistant that works.</span></div>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 38, color: RUST, opacity: url }}>jordyn.app</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ============================ TIMELINE ==================================== */
const S = (sec: number) => Math.round(sec * FPS)
const COMPS = [S0, S1, S2, S3, S4, S5, S6, S7]
const PAD = 0.75
const XF = 0.45
const FALLBACK = [4.6, 4.4, 3.4, 4.0, 4.2, 5.2, 3.2, 5.0]
const vo: number[] = (JORDYN_AUDIO && (JORDYN_AUDIO as any).vo) || FALLBACK
const SEG = COMPS.map((c, i) => ({ c, d: (vo[i] || FALLBACK[i]) + PAD }))
const _sumD = SEG.reduce((a, s) => a + s.d, 0)
export const JORDYN_PAPER_FRAMES = Math.round((_sumD - (SEG.length - 1) * XF) * FPS)

// paper-slide transition: the outgoing scene slides + tilts away like a sheet of
// paper being pulled off, revealing the next underneath.
const PaperWipe: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame(); const xf = S(XF)
  const inP = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const outP = interpolate(f, [dur - xf, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const inTx = (1 - inP) * 8            // slide in from right slightly
  const inRot = (1 - inP) * 2.5
  const outTx = -outP * 12              // slide/tilt off to the left
  const outRot = -outP * 4
  const outFade = 1 - outP
  return (
    <AbsoluteFill style={{ transform: `translateX(${inTx + outTx}%) rotate(${inRot + outRot}deg)`, opacity: Math.min(inP, outFade), transformOrigin: 'center' }}>
      {children}
    </AbsoluteFill>
  )
}

export const CommercialJordynPaper: React.FC = () => {
  let cursor = 0
  const starts = SEG.map((seg, i) => { const from = S(cursor); cursor += seg.d - (i < SEG.length - 1 ? XF : 0); return from })
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Audio src={staticFile('jordyn-paper/music.mp3')} volume={0.4} />
      {SEG.map((seg, i) => {
        const Comp = seg.c
        const durF = S(seg.d)
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <PaperWipe dur={durF}><Comp /></PaperWipe>
            <Grain />
            <Sequence from={Math.round(0.18 * FPS)}>
              <Audio src={staticFile(`jordyn-paper/vo-${i}.mp3`)} volume={1} />
            </Sequence>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
