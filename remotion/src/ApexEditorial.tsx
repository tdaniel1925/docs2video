import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence, Img, staticFile, spring, Audio } from 'remotion'
import { MusicBed } from './lib/musicbed'
import { makeMusicDuck, type VoWindow } from './lib/audio'
import { loadFont as loadDMSerif } from '@remotion/google-fonts/DMSerifDisplay'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'

/* ============================================================================
 * TREATMENT A — "EDITORIAL / OFF-CENTER". A magazine spread in motion.
 * Design language: NOTHING centered. Text hard-anchored to edges + corners.
 * Huge negative space. Oversized numerals + rules that bleed off-frame. A thin
 * baseline grid. Slow, confident, print-inspired. The composition itself is the
 * point — every beat places its elements in a DIFFERENT part of the frame.
 * (Apex message: your book of business, finally talking back.)
 * ==========================================================================*/

const { fontFamily: SERIF } = loadDMSerif()
const { fontFamily: BODY } = loadInter()
const { fontFamily: GROT } = loadArchivo()
const FPS = 30
const NAVY = '#0e1f3d', NAVY2 = '#14294f', CREAM = '#f4f1ea', RED = '#d81f27', INK = '#0a1424'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const ASSET = 'c-apexTORN'

// a thin editorial baseline grid + margin rules (persistent chrome, very faint)
const Grid: React.FC<{ on?: string }> = ({ on = 'rgba(255,255,255,0.06)' }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {/* left + right margin rules */}
    <div style={{ position: 'absolute', left: 120, top: 0, bottom: 0, width: 1, background: on }} />
    <div style={{ position: 'absolute', right: 120, top: 0, bottom: 0, width: 1, background: on }} />
    {/* top + bottom rules */}
    <div style={{ position: 'absolute', top: 90, left: 0, right: 0, height: 1, background: on }} />
    <div style={{ position: 'absolute', bottom: 90, left: 0, right: 0, height: 1, background: on }} />
  </AbsoluteFill>
)

// running header/footer chrome — page furniture, not centered content
const Chrome: React.FC<{ idx: string; total?: string; tag?: string }> = ({ idx, total = '05', tag = 'APEX AFFINITY' }) => (
  <>
    <div style={{ position: 'absolute', top: 54, left: 130, fontFamily: BODY, fontSize: 18, letterSpacing: '0.34em', color: CREAM, opacity: 0.65, textTransform: 'uppercase' }}>{tag}</div>
    <div style={{ position: 'absolute', top: 54, right: 130, fontFamily: BODY, fontSize: 18, letterSpacing: '0.28em', color: RED, textTransform: 'uppercase' }}>{idx} / {total}</div>
    <div style={{ position: 'absolute', bottom: 50, left: 130, fontFamily: BODY, fontSize: 15, letterSpacing: '0.24em', color: CREAM, opacity: 0.5, textTransform: 'uppercase' }}>SmartViewz</div>
    <div style={{ position: 'absolute', bottom: 50, right: 130, fontFamily: BODY, fontSize: 15, letterSpacing: '0.24em', color: CREAM, opacity: 0.5, textTransform: 'uppercase' }}>reachtheapex.net</div>
  </>
)

// word-by-word rise (editorial headlines set in a big serif, entering line by line)
const Rise: React.FC<{ at: number; children: React.ReactNode; dy?: number; dur?: number }> = ({ at, children, dy = 40, dur = 16 }) => {
  const f = useCurrentFrame() - at
  const o = clamp(f / dur, 0, 1)
  const y = interpolate(o, [0, 1], [dy, 0], { easing: Easing.out(Easing.cubic) })
  return <div style={{ opacity: o, transform: `translateY(${y}px)` }}>{children}</div>
}

// a giant numeral that bleeds off the frame edge (print-poster device)
const BleedNumber: React.FC<{ n: string; at: number; side: 'l' | 'r'; y: number }> = ({ n, at, side, y }) => {
  const frame = useCurrentFrame()
  const o = clamp((frame - at) / 20, 0, 1)
  const drift = interpolate(frame - at, [0, 120], [0, side === 'l' ? -30 : 30], { extrapolateRight: 'clamp' })
  return (
    <div style={{
      position: 'absolute', top: y, [side === 'l' ? 'left' : 'right']: -80, opacity: o * 0.14,
      fontFamily: GROT, fontWeight: 900, fontSize: 720, lineHeight: 0.7, color: CREAM,
      transform: `translateX(${drift}px)`, letterSpacing: '-0.04em',
    }}>{n}</div>
  )
}

// ---- BEAT 1: cover. Headline jammed to the BOTTOM-LEFT, giant number bleeding
// top-right, everything else empty. A magazine cover.
const B1: React.FC = () => (
  <AbsoluteFill style={{ background: NAVY }}>
    <Grid />
    <BleedNumber n="1" at={6} side="r" y={-120} />
    <Chrome idx="01" tag="FOR INSURANCE PROS" />
    <div style={{ position: 'absolute', left: 130, bottom: 150, width: 1100 }}>
      <Rise at={8}><div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, letterSpacing: '0.3em', color: RED, textTransform: 'uppercase', marginBottom: 22 }}>The book of business, reimagined</div></Rise>
      <Rise at={16} dy={54}><div style={{ fontFamily: SERIF, fontSize: 150, lineHeight: 0.98, color: CREAM }}>Your book,</div></Rise>
      <Rise at={26} dy={54}><div style={{ fontFamily: SERIF, fontSize: 150, lineHeight: 0.98, color: CREAM, fontStyle: 'italic' }}>finally talking back.</div></Rise>
    </div>
  </AbsoluteFill>
)

// ---- BEAT 2: product intro. Logo pinned TOP-RIGHT (not center), a single line
// of serif on the far LEFT edge running vertically-ish, big empty middle.
const B2: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 6, fps, config: { damping: 15, stiffness: 120 } })
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      <Grid on="rgba(10,20,36,0.07)" />
      {/* chrome inverted for the light page */}
      <div style={{ position: 'absolute', top: 54, left: 130, fontFamily: BODY, fontSize: 18, letterSpacing: '0.34em', color: INK, opacity: 0.55, textTransform: 'uppercase' }}>APEX AFFINITY</div>
      <div style={{ position: 'absolute', top: 54, right: 130, fontFamily: BODY, fontSize: 18, letterSpacing: '0.28em', color: RED, textTransform: 'uppercase' }}>02 / 05</div>
      {/* logo top-right region on a navy chip */}
      <div style={{ position: 'absolute', top: 150, right: 130, background: NAVY, padding: '34px 46px', borderRadius: 4, transform: `scale(${clamp(pop, 0, 1)})`, transformOrigin: 'top right' }}>
        <Img src={staticFile(`${ASSET}/logo.png`)} style={{ width: 360, height: 'auto', display: 'block' }} />
      </div>
      {/* big statement bottom-left, red rule above it bleeding left */}
      <div style={{ position: 'absolute', left: -60, bottom: 300, width: 520, height: 10, background: RED, opacity: clamp((frame - 20) / 12, 0, 1) }} />
      <div style={{ position: 'absolute', left: 130, bottom: 150, width: 1000 }}>
        <Rise at={22}><div style={{ fontFamily: SERIF, fontSize: 128, lineHeight: 0.98, color: INK }}>Ask your book</div></Rise>
        <Rise at={32}><div style={{ fontFamily: SERIF, fontSize: 128, lineHeight: 0.98, color: RED, fontStyle: 'italic' }}>anything.</div></Rise>
      </div>
    </AbsoluteFill>
  )
}

// ---- BEAT 3: the "conversation" — a question set top-right, the answer set
// bottom-left, connected by a long thin diagonal-ish rule. Deliberate imbalance.
const B3: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: NAVY2 }}>
      <Grid />
      <Chrome idx="03" tag="JUST ASK" />
      {/* the question — top-right, smaller, quiet */}
      <div style={{ position: 'absolute', top: 200, right: 130, width: 720, textAlign: 'right' }}>
        <Rise at={8}><div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, letterSpacing: '0.2em', color: RED, textTransform: 'uppercase', marginBottom: 16 }}>You ask</div></Rise>
        <Rise at={14}><div style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 1.05, color: CREAM, fontStyle: 'italic' }}>“Who’s about<br />to lapse?”</div></Rise>
      </div>
      {/* long connector rule */}
      <div style={{ position: 'absolute', top: 380, left: 200, width: interpolate(frame - 30, [0, 24], [0, 1180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), height: 2, background: RED, transform: 'rotate(14deg)', transformOrigin: 'left center' }} />
      {/* the answer — bottom-left, BIG, confident */}
      <div style={{ position: 'absolute', left: 130, bottom: 160, width: 1200 }}>
        <Rise at={44}><div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, letterSpacing: '0.2em', color: '#8fb4ff', textTransform: 'uppercase', marginBottom: 18 }}>SmartViewz answers</div></Rise>
        <Rise at={50} dy={50}><div style={{ fontFamily: SERIF, fontSize: 120, lineHeight: 0.98, color: CREAM }}>12 policies. <span style={{ color: RED }}>This month.</span></div></Rise>
        <Rise at={60}><div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 30, color: '#c9d6f0', marginTop: 18 }}>Plus cross-sells on five of them.</div></Rise>
      </div>
    </AbsoluteFill>
  )
}

// ---- BEAT 4: the "index" — a list set as an editorial contents page. Numbers
// far LEFT, items indented, a huge bleed number behind. Left-aligned by design.
const B4: React.FC = () => {
  const frame = useCurrentFrame()
  const items = ['Spot lapsing policies', 'Surface every cross-sell', 'Catch compliance risk', 'No waiting on reports']
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Grid />
      <BleedNumber n="4" at={6} side="r" y={200} />
      <Chrome idx="04" tag="YOUR EDGE" />
      <div style={{ position: 'absolute', left: 130, top: 210, fontFamily: SERIF, fontSize: 92, color: CREAM }}>
        <Rise at={8}>Never miss<span style={{ color: RED }}>.</span></Rise>
      </div>
      <div style={{ position: 'absolute', left: 130, top: 400, width: 1200 }}>
        {items.map((it, i) => {
          const on = clamp((frame - (24 + i * 10)) / 12, 0, 1)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 40, opacity: on, transform: `translateY(${(1 - on) * 20}px)`, marginBottom: 22, borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: 20 }}>
              <div style={{ fontFamily: GROT, fontWeight: 900, fontSize: 38, color: RED, width: 70 }}>0{i + 1}</div>
              <div style={{ fontFamily: SERIF, fontSize: 58, color: CREAM }}>{it}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ---- BEAT 5: CTA — the back cover. Logo bottom-RIGHT, statement top-LEFT,
// a red block bleeding off the bottom edge. Still nothing centered.
const B5: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 40, fps, config: { damping: 14, stiffness: 130 } })
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Grid />
      <div style={{ position: 'absolute', top: 54, left: 130, fontFamily: BODY, fontSize: 18, letterSpacing: '0.34em', color: CREAM, opacity: 0.6, textTransform: 'uppercase' }}>APEX AFFINITY</div>
      <div style={{ position: 'absolute', top: 54, right: 130, fontFamily: BODY, fontSize: 18, letterSpacing: '0.28em', color: RED }}>05 / 05</div>
      {/* statement top-left */}
      <div style={{ position: 'absolute', left: 130, top: 200, width: 1200 }}>
        <Rise at={8}><div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, letterSpacing: '0.3em', color: RED, textTransform: 'uppercase', marginBottom: 22 }}>Stop guessing. Start knowing.</div></Rise>
        <Rise at={16} dy={54}><div style={{ fontFamily: SERIF, fontSize: 150, lineHeight: 0.96, color: CREAM }}>Reach</div></Rise>
        <Rise at={26} dy={54}><div style={{ fontFamily: SERIF, fontSize: 150, lineHeight: 0.96, color: RED, fontStyle: 'italic' }}>the Apex.</div></Rise>
      </div>
      {/* red block bleeding off the bottom */}
      <div style={{ position: 'absolute', right: 130, bottom: -60, width: 620, height: interpolate(frame - 30, [0, 18], [0, 300], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), background: RED }} />
      {/* logo bottom-right, over the red */}
      <div style={{ position: 'absolute', right: 175, bottom: 90, transform: `scale(${clamp(pop, 0, 1)})`, transformOrigin: 'bottom right' }}>
        <Img src={staticFile(`${ASSET}/logo.png`)} style={{ width: 420, height: 'auto', display: 'block' }} />
      </div>
      <div style={{ position: 'absolute', left: 130, bottom: 60, fontFamily: BODY, fontWeight: 600, fontSize: 26, color: CREAM, opacity: clamp((frame - 50) / 12, 0, 1) }}>reachtheapex.net · free to join</div>
    </AbsoluteFill>
  )
}

// beat durations = VO length + hold (so each beat breathes past its line)
const VO_SEC = [3.07, 4.50, 5.85, 5.25, 4.23]
const DUR = VO_SEC.map((d) => Math.round((d + 1.4) * FPS))
const BEATS = [B1, B2, B3, B4, B5]
const MUSIC_FRAMES = Math.round(29.99 * FPS)
export const APEX_EDITORIAL_FRAMES = DUR.reduce((a, b) => a + b, 0)

export const ApexEditorial: React.FC = () => {
  const starts: number[] = []; { let t = 0; for (const d of DUR) { starts.push(t); t += d } }
  const total = APEX_EDITORIAL_FRAMES
  const voWin: VoWindow[] = starts.map((st, i) => ({ start: st, end: st + Math.round(VO_SEC[i] * FPS) }))
  const duck = makeMusicDuck(voWin, total, { loud: 0.22, duck: 0.09, ramp: 14, fadeInEnd: 10, fadeOutStart: total - 20, fadeOutEnd: total - 3 })
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {BEATS.map((B, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={DUR[i]}><B /></Sequence>
      ))}
      {starts.map((st, i) => (
        <Sequence key={'vo' + i} from={st + 6}><Audio src={staticFile(`c-apex3/vo-${i + 1}.mp3`)} /></Sequence>
      ))}
      <MusicBed src="c-apex3/music.mp3" musicFrames={MUSIC_FRAMES} volume={duck} />
    </AbsoluteFill>
  )
}
