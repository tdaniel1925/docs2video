import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence, Img, staticFile, spring, Audio } from 'remotion'
import { MusicBed } from './lib/musicbed'
import { makeMusicDuck, type VoWindow } from './lib/audio'
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton'
import { loadFont as loadBarlow } from '@remotion/google-fonts/BarlowCondensed'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

/* ============================================================================
 * TREATMENT B — "KINETIC TYPE". Type IS the visual. No calm centered layouts.
 * Words SLAM in at massive scale, overlap, run off the frame edges, rotate, and
 * reflow to the beat. Extreme scale contrast (a 40px word next to a 460px word).
 * Aggressive, loud, motion-driven — the opposite compositional world from the
 * editorial treatment, SAME Apex message.
 * ==========================================================================*/

const { fontFamily: ANTON } = loadAnton()
const { fontFamily: BARLOW } = loadBarlow()
const { fontFamily: INTER } = loadInter()
const FPS = 30
const NAVY = '#0c1b36', RED = '#d81f27', CREAM = '#f4f1ea', WHITE = '#ffffff'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const ASSET = 'c-apexTORN'

// a word that SLAMS in (overshoot scale) from a direction, huge
const Slam: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; from?: 'l' | 'r' | 'd' | 'u' | 'z' }> = ({ at, children, style, from = 'z' }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 200 } })
  const p = clamp(s, 0, 1.08)
  let tf = ''
  if (from === 'z') tf = `scale(${0.4 + p * 0.6})`
  else if (from === 'l') tf = `translateX(${(1 - p) * -700}px)`
  else if (from === 'r') tf = `translateX(${(1 - p) * 700}px)`
  else if (from === 'd') tf = `translateY(${(1 - p) * 500}px)`
  else if (from === 'u') tf = `translateY(${(1 - p) * -500}px)`
  if (frame < at) return null
  return <div style={{ transform: tf, ...style }}>{children}</div>
}

// a strip of a word repeated + scrolling across the frame (kinetic texture)
const Ticker: React.FC<{ word: string; y: number; speed: number; color: string; size: number; op?: number }> = ({ word, y, speed, color, size, op = 1 }) => {
  const frame = useCurrentFrame()
  const x = ((frame * speed) % 600) * -1
  return (
    <div style={{ position: 'absolute', top: y, left: 0, right: 0, whiteSpace: 'nowrap', overflow: 'hidden', opacity: op }}>
      <div style={{ display: 'inline-block', transform: `translateX(${x}px)`, fontFamily: ANTON, fontSize: size, color, letterSpacing: '0.04em' }}>
        {`${word}   ·   `.repeat(20)}
      </div>
    </div>
  )
}

// ---- B1: the hook. "YOUR BOOK" enormous, off the top edge; "finally talking BACK"
// stacked at wild scale contrast below. Words overlap the frame edges.
const B1: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: 'hidden' }}>
      <Ticker word="INSURANCE PROS" y={30} speed={2.4} color="rgba(255,255,255,0.05)" size={120} />
      {/* YOUR — small, top-left */}
      <Slam at={4} from="l" style={{ position: 'absolute', top: 150, left: 90, fontFamily: BARLOW, fontWeight: 700, fontSize: 90, color: RED, letterSpacing: '0.02em' }}>YOUR</Slam>
      {/* BOOK — MASSIVE, bleeding off both sides */}
      <Slam at={10} from="z" style={{ position: 'absolute', top: 190, left: -30, fontFamily: ANTON, fontSize: 440, color: CREAM, lineHeight: 0.8, letterSpacing: '-0.03em' }}>BOOK</Slam>
      {/* finally talking — mid, small italic-ish */}
      <Slam at={26} from="r" style={{ position: 'absolute', top: 640, right: 110, fontFamily: BARLOW, fontWeight: 500, fontStyle: 'italic', fontSize: 84, color: '#9db6e8' }}>finally talking</Slam>
      {/* BACK. — huge, bottom, red, overshoot */}
      <Slam at={34} from="d" style={{ position: 'absolute', bottom: 40, left: 80, fontFamily: ANTON, fontSize: 300, color: RED, lineHeight: 0.8 }}>BACK.</Slam>
    </AbsoluteFill>
  )
}

// ---- B2: product. "SMARTVIEWZ" torn across the frame at an angle, logo slammed
// over it, "ask your book ANYTHING" running vertically up the right edge.
const B2: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 20, fps, config: { damping: 13, stiffness: 150 } })
  return (
    <AbsoluteFill style={{ background: RED, overflow: 'hidden' }}>
      <Ticker word="SMARTVIEWZ" y={420} speed={-3} color="rgba(255,255,255,0.09)" size={260} />
      {/* logo slammed center-left */}
      <div style={{ position: 'absolute', top: 380, left: 90, transform: `scale(${clamp(pop, 0, 1.05)})`, transformOrigin: 'left center' }}>
        <Img src={staticFile(`${ASSET}/logo.png`)} style={{ width: 620, height: 'auto', display: 'block', filter: 'brightness(0) invert(1)' }} />
      </div>
      {/* ANYTHING running UP the right edge, rotated */}
      <Slam at={30} from="u" style={{ position: 'absolute', top: 540, right: 60, transform: 'rotate(-90deg)', transformOrigin: 'right top', fontFamily: ANTON, fontSize: 200, color: NAVY, whiteSpace: 'nowrap' }}>ANYTHING</Slam>
      {/* ask your book — top-left kicker */}
      <Slam at={8} from="l" style={{ position: 'absolute', top: 120, left: 90, fontFamily: BARLOW, fontWeight: 700, fontSize: 72, color: CREAM, letterSpacing: '0.04em' }}>ASK YOUR BOOK</Slam>
    </AbsoluteFill>
  )
}

// ---- B3: the answer. A huge "12" fills the frame; words orbit it.
const B3: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const num = spring({ frame: frame - 8, fps, config: { damping: 14, stiffness: 120 } })
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: 'hidden' }}>
      <Slam at={4} from="u" style={{ position: 'absolute', top: 90, left: 90, fontFamily: BARLOW, fontWeight: 700, fontSize: 70, color: RED }}>YOU ASKED WHO’S LAPSING.</Slam>
      {/* giant 12 */}
      <div style={{ position: 'absolute', top: 60, left: '50%', transform: `translateX(-50%) scale(${clamp(num, 0, 1.05)})`, fontFamily: ANTON, fontSize: 900, color: CREAM, lineHeight: 0.8, letterSpacing: '-0.04em' }}>12</div>
      {/* POLICIES — over the number, bottom */}
      <Slam at={22} from="d" style={{ position: 'absolute', bottom: 210, left: '50%', transform: 'translateX(-50%)', fontFamily: ANTON, fontSize: 190, color: RED }}>POLICIES</Slam>
      {/* small orbiters */}
      <Slam at={34} from="l" style={{ position: 'absolute', bottom: 120, left: 100, fontFamily: BARLOW, fontWeight: 600, fontSize: 46, color: '#9db6e8' }}>at risk this month</Slam>
      <Slam at={40} from="r" style={{ position: 'absolute', bottom: 120, right: 100, fontFamily: BARLOW, fontWeight: 600, fontSize: 46, color: '#9db6e8' }}>+ cross-sells on 5</Slam>
    </AbsoluteFill>
  )
}

// ---- B4: rapid-fire list — each capability SLAMS full-frame, one after another,
// replacing the last. Kinetic "cuts" not a static grid.
const B4: React.FC = () => {
  const frame = useCurrentFrame()
  const items = ['SPOT LAPSES', 'FIND CROSS-SELLS', 'CATCH RISK', 'ZERO WAITING']
  const per = 30
  const idx = Math.min(items.length - 1, Math.floor(frame / per))
  const local = frame - idx * per
  const s = clamp(local / 8, 0, 1)
  const align = idx % 2 === 0 ? 'flex-start' : 'flex-end'
  return (
    <AbsoluteFill style={{ background: idx % 2 ? RED : NAVY, overflow: 'hidden', justifyContent: 'center', alignItems: align, padding: '0 90px' }}>
      <Ticker word="NEVER MISS" y={idx % 2 ? 120 : 820} speed={4} color="rgba(255,255,255,0.08)" size={180} />
      <div style={{ transform: `scale(${0.7 + s * 0.3}) translateX(${(1 - s) * (idx % 2 ? 200 : -200)}px)`, opacity: s, fontFamily: ANTON, fontSize: 240, color: idx % 2 ? NAVY : RED, lineHeight: 0.85, textAlign: idx % 2 ? 'right' : 'left', letterSpacing: '-0.02em' }}>
        {items[idx]}
      </div>
    </AbsoluteFill>
  )
}

// ---- B5: CTA — "REACH THE APEX" explodes in, logo drops, button slams.
const B5: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const btn = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 180 } })
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
      <Ticker word="REACH THE APEX" y={80} speed={-3.5} color="rgba(216,31,39,0.14)" size={200} />
      <Ticker word="REACH THE APEX" y={820} speed={3.5} color="rgba(216,31,39,0.14)" size={200} />
      <Slam at={4} from="l" style={{ fontFamily: ANTON, fontSize: 300, color: CREAM, lineHeight: 0.82 }}>REACH</Slam>
      <Slam at={12} from="r" style={{ fontFamily: ANTON, fontSize: 300, color: RED, lineHeight: 0.82, marginTop: -30 }}>THE APEX</Slam>
      <div style={{ transform: `scale(${clamp(btn, 0, 1)})`, marginTop: 40, background: CREAM, color: NAVY, fontFamily: BARLOW, fontWeight: 700, fontSize: 42, padding: '20px 60px', letterSpacing: '0.04em' }}>GET SMARTVIEWZ — reachtheapex.net</div>
    </AbsoluteFill>
  )
}

const VO_SEC = [3.07, 4.50, 5.85, 5.25, 4.23]
const DUR = VO_SEC.map((d) => Math.round((d + 1.2) * FPS))
const BEATS = [B1, B2, B3, B4, B5]
const MUSIC_FRAMES = Math.round(29.99 * FPS)
export const APEX_KINETIC_FRAMES = DUR.reduce((a, b) => a + b, 0)

export const ApexKinetic: React.FC = () => {
  const starts: number[] = []; { let t = 0; for (const d of DUR) { starts.push(t); t += d } }
  const total = APEX_KINETIC_FRAMES
  const voWin: VoWindow[] = starts.map((st, i) => ({ start: st, end: st + Math.round(VO_SEC[i] * FPS) }))
  const duck = makeMusicDuck(voWin, total, { loud: 0.26, duck: 0.1, ramp: 12, fadeInEnd: 8, fadeOutStart: total - 18, fadeOutEnd: total - 3 })
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {BEATS.map((B, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={DUR[i]}><B /></Sequence>
      ))}
      {starts.map((st, i) => (
        <Sequence key={'vo' + i} from={st + 4}><Audio src={staticFile(`c-apex3/vo-${i + 1}.mp3`)} /></Sequence>
      ))}
      <MusicBed src="c-apex3/music.mp3" musicFrames={MUSIC_FRAMES} volume={duck} />
    </AbsoluteFill>
  )
}
