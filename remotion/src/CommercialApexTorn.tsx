import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate, Easing, Sequence, Audio, Img, staticFile, spring, useVideoConfig } from 'remotion'
import { MusicBed } from './lib/musicbed'
import { makeMusicDuck, type VoWindow } from './lib/audio'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

/* ============================================================================
 * CommercialApexTorn — a FULL Apex commercial in the TORN-PAPER / collage style.
 *
 * ARCHITECTURE (fixed): each beat renders as a full-duration CARD in its own
 * layer. The TEARS are SEPARATE overlay sequences on top, timed to the moment
 * between two beats — an outgoing card is clipped by a ragged edge that rips up
 * to reveal the incoming card beneath. This is what makes the rip actually
 * VISIBLE (the old version painted the next card over the tear).
 * ==========================================================================*/

const { fontFamily: DISPLAY } = loadArchivoBlack()
const { fontFamily: SCRIPT } = loadFraunces()
const { fontFamily: BODY } = loadInter()
const FPS = 30
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const ASSET = 'c-apexTORN'
const NAVY = '#152a52', RED = '#d81f27', CREAM = '#f3ede2', INK = '#141414'
const MUSIC_FRAMES = 1684

// ragged tear edge y-offsets across the width (deterministic jag). Reused by
// clip paths and the edge highlight so the top/bottom halves share one rip line.
const rand = (i: number) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x) }
const SEGS = 34
function jagAt(i: number): number { return (rand(i) - 0.5) * 60 + Math.sin(i * 1.7) * 16 }
// open polyline of the ragged edge centered on yPx
function edgePolyline(yPx: number, w = 1920): string {
  const pts: string[] = [`M 0 ${yPx.toFixed(1)}`]
  for (let i = 1; i <= SEGS; i++) pts.push(`L ${((i / SEGS) * w).toFixed(1)} ${(yPx + jagAt(i)).toFixed(1)}`)
  return pts.join(' ')
}
// clip path for the TOP half (everything above the ragged line)
function topClip(yPx: number, w = 1920): string { return `${edgePolyline(yPx, w)} L ${w} 0 L 0 0 Z` }
// clip path for the BOTTOM half (everything below the ragged line)
function bottomClip(yPx: number, w = 1920, h = 1080): string { return `${edgePolyline(yPx, w)} L ${w} ${h} L 0 ${h} Z` }

const paperTexture = 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%22220%22><filter id=%22p%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.045 0.09%22 numOctaves=%223%22 seed=%224%22/><feColorMatrix type=%22matrix%22 values=%220 0 0 0 0.9  0 0 0 0 0.88  0 0 0 0 0.82  0 0 0 0.05 0%22/></filter><rect width=%22220%22 height=%22220%22 filter=%22url(%23p%22)%22/></svg>")'
// halftone dot pattern — fine, tight, EVEN dots (a subtle tint, not a chunky grid).
// small solid dot with a hard edge so it stays crisp; low opacity so it reads as texture.
const halftone = (dot: string) => `radial-gradient(circle, ${dot} 1.6px, transparent 1.7px)`

// floating vector graphics (dots/crosses/triangles) that drift with parallax — like the ref
const Floaters: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame()
  const shapes = [
    { x: 160, y: 200, s: 42, k: 'cross', sp: 0.18, ph: 0 },
    { x: 1680, y: 300, s: 58, k: 'tri', sp: 0.12, ph: 2 },
    { x: 1740, y: 820, s: 34, k: 'dot', sp: 0.22, ph: 1 },
    { x: 240, y: 880, s: 50, k: 'ring', sp: 0.15, ph: 4 },
    { x: 980, y: 130, s: 30, k: 'dot', sp: 0.2, ph: 3 },
    { x: 120, y: 540, s: 46, k: 'tri', sp: 0.1, ph: 5 },
  ]
  return <AbsoluteFill style={{ opacity: 0.5 }}>
    {shapes.map((sh, i) => {
      const dx = Math.sin(frame * 0.012 * (1 + sh.sp) + sh.ph) * 22
      const dy = Math.cos(frame * 0.01 * (1 + sh.sp) + sh.ph) * 18
      const rot = Math.sin(frame * 0.008 + sh.ph) * 20
      const st: React.CSSProperties = { position: 'absolute', left: sh.x, top: sh.y, width: sh.s, height: sh.s, transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)` }
      if (sh.k === 'dot') return <div key={i} style={{ ...st, borderRadius: '50%', background: color }} />
      if (sh.k === 'ring') return <div key={i} style={{ ...st, borderRadius: '50%', border: `5px solid ${color}` }} />
      if (sh.k === 'tri') return <div key={i} style={{ ...st, width: 0, height: 0, borderLeft: `${sh.s / 2}px solid transparent`, borderRight: `${sh.s / 2}px solid transparent`, borderBottom: `${sh.s}px solid ${color}` }} />
      // cross
      return <div key={i} style={st}>
        <div style={{ position: 'absolute', top: '42%', width: '100%', height: '16%', background: color }} />
        <div style={{ position: 'absolute', left: '42%', width: '16%', height: '100%', background: color }} />
      </div>
    })}
  </AbsoluteFill>
}

// a full-frame paper card: grain + halftone dots + drifting tiled wordmark + floaters
const Card: React.FC<{ bg: string; fg: string; children: React.ReactNode }> = ({ bg, fg, children }) => {
  const frame = useCurrentFrame()
  const drift = (frame * 0.35) % 200
  // fine even dots, low opacity — NO blend mode (blend was causing the grey bottom vignette)
  const dotColor = fg === CREAM ? 'rgba(255,255,255,0.5)' : 'rgba(20,20,20,0.14)'
  return (
    <AbsoluteFill style={{ background: bg, overflow: 'hidden' }}>
      {/* drifting tiled wordmark (behind everything, very faint) */}
      <AbsoluteFill style={{ display: 'flex', flexWrap: 'wrap', overflow: 'hidden', opacity: 0.045, alignContent: 'center', transform: `translateX(${-drift}px)` }}>
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} style={{ fontFamily: DISPLAY, fontSize: 130, color: fg, textTransform: 'uppercase', whiteSpace: 'nowrap', width: '120%', textAlign: i % 2 ? 'right' : 'left', lineHeight: 1.15 }}>APEX AFFINITY · APEX AFFINITY</div>
        ))}
      </AbsoluteFill>
      {/* fine even halftone dots — subtle tint, no blend mode */}
      <AbsoluteFill style={{ backgroundImage: halftone(dotColor), backgroundSize: '9px 9px' }} />
      {/* paper grain, gentle */}
      <AbsoluteFill style={{ backgroundImage: paperTexture, backgroundSize: '360px', mixBlendMode: 'multiply', opacity: 0.3 }} />
      <Floaters color={fg === CREAM ? 'rgba(255,255,255,0.85)' : RED} />
      {children}
    </AbsoluteFill>
  )
}

// ---------- the 7 beat cards. Each fills its OWN duration (no internal tear). ----------
// Layout rule to avoid the overlap bug: a card is EITHER a centered statement OR a
// top-kicker + centered-content block — never two centered layers stacked.

const B1 = () => {
  const frame = useCurrentFrame(); const o = clamp((frame - 4) / 10, 0, 1)
  const y = interpolate(clamp((frame - 4) / 14, 0, 1), [0, 1], [30, 0], { easing: Easing.out(Easing.cubic) })
  return <Card bg={CREAM} fg={INK}>
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 130px' }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center' }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 24, letterSpacing: '0.34em', color: RED, textTransform: 'uppercase', marginBottom: 18 }}>Insurance pros</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 128, color: INK, textTransform: 'uppercase', lineHeight: 0.92, letterSpacing: '-0.02em' }}>Your book just<br />learned to talk.</div>
      </div>
    </AbsoluteFill>
  </Card>
}
const B2 = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 130 } })
  return <Card bg={NAVY} fg={CREAM}>
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `scale(${0.82 + clamp(pop, 0, 1) * 0.18})` }}><Img src={staticFile(`${ASSET}/logo.png`)} style={{ width: 540, height: 'auto', filter: 'drop-shadow(0 0 26px rgba(0,0,0,0.4))' }} /></div>
      <div style={{ fontFamily: DISPLAY, fontSize: 78, color: CREAM, textTransform: 'uppercase', letterSpacing: '-0.01em', opacity: clamp((frame - 12) / 8, 0, 1) }}>SmartViewz</div>
      <div style={{ fontFamily: SCRIPT, fontStyle: 'italic', fontSize: 42, color: '#ffd0d2', opacity: clamp((frame - 18) / 8, 0, 1) }}>ask your book anything</div>
    </AbsoluteFill>
  </Card>
}
const B3 = () => {
  const frame = useCurrentFrame()
  const qO = clamp((frame - 8) / 10, 0, 1), aO = clamp((frame - 40) / 12, 0, 1)
  return <Card bg={RED} fg={CREAM}>
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 120 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 24, letterSpacing: '0.34em', color: '#ffd6d8', textTransform: 'uppercase' }}>Just ask</div>
    </AbsoluteFill>
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26, padding: '0 200px' }}>
      <div style={{ opacity: qO, transform: `translateX(${(1 - qO) * 40}px)`, alignSelf: 'flex-end', background: '#ffffff1a', border: '2px solid #ffffff45', borderRadius: 18, padding: '22px 34px', maxWidth: 1000 }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 38, color: CREAM }}>Who's about to lapse?</div>
      </div>
      <div style={{ opacity: aO, transform: `translateX(${(1 - aO) * -40}px)`, alignSelf: 'flex-start', background: CREAM, borderRadius: 18, padding: '22px 34px', maxWidth: 1200 }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: INK }}>12 policies at risk this month — with cross-sells on 5.</div>
      </div>
    </AbsoluteFill>
  </Card>
}
const B4 = () => {
  const frame = useCurrentFrame()
  const steps = [['Connect', 'Upload any CSV'], ['Ask', 'Plain-English questions'], ['Win', 'Open doors, close deals']]
  return <Card bg={CREAM} fg={INK}>
    {/* kicker top, steps centered — no overlapping headline */}
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 130 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 24, letterSpacing: '0.34em', color: RED, textTransform: 'uppercase' }}>How it works</div>
    </AbsoluteFill>
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 70, alignItems: 'flex-start' }}>
        {steps.map((sp, i) => {
          const on = clamp((frame - (16 + i * 12)) / 10, 0, 1)
          return <React.Fragment key={i}>
            <div style={{ textAlign: 'center', width: 340, opacity: on, transform: `translateY(${(1 - on) * 24}px)` }}>
              <div style={{ width: 88, height: 88, borderRadius: 46, background: RED, color: CREAM, fontFamily: DISPLAY, fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 6px 16px rgba(0,0,0,0.2)' }}>{i + 1}</div>
              <div style={{ fontFamily: DISPLAY, fontSize: 42, color: INK, textTransform: 'uppercase' }}>{sp[0]}</div>
              <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 22, color: '#555', marginTop: 8 }}>{sp[1]}</div>
            </div>
            {i < 2 && <div style={{ width: 44, height: 3, background: RED, marginTop: 42, opacity: clamp((frame - (24 + i * 12)) / 8, 0, 1) }} />}
          </React.Fragment>
        })}
      </div>
    </AbsoluteFill>
  </Card>
}
const B5 = () => {
  const frame = useCurrentFrame()
  const items = ['Spot lapsing policies', 'Surface cross-sells', 'Catch compliance risk', 'No waiting on reports']
  return <Card bg={NAVY} fg={CREAM}>
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 120 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 24, letterSpacing: '0.34em', color: '#ff9a9d', textTransform: 'uppercase', marginBottom: 12 }}>Your edge</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 72, color: CREAM, textTransform: 'uppercase' }}>Never miss.</div>
    </AbsoluteFill>
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 140 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {items.map((it, i) => {
          const on = clamp((frame - (16 + i * 8)) / 8, 0, 1)
          return <div key={i} style={{ opacity: on, transform: `translateX(${(1 - on) * (i % 2 ? 50 : -50)}px)`, background: '#ffffff14', border: '2px solid #ffffff2e', borderRadius: 12, padding: '20px 34px', fontFamily: DISPLAY, fontSize: 32, color: CREAM, width: 580, textTransform: 'uppercase' }}>{it}</div>
        })}
      </div>
    </AbsoluteFill>
  </Card>
}
const B6 = () => {
  const frame = useCurrentFrame()
  const lIn = interpolate(frame, [4, 18], [-120, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const rIn = interpolate(frame, [10, 24], [120, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return <Card bg={CREAM} fg={INK}>
    <AbsoluteFill style={{ flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6, transform: `translateX(${lIn}px)` }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.3em', color: '#999', textTransform: 'uppercase' }}>The old way</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 96, color: '#9a9a9a', textTransform: 'uppercase' }}>Guessing</div>
      </div>
      <div style={{ width: 4, height: '52%', alignSelf: 'center', background: RED }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6, transform: `translateX(${rIn}px)` }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: '0.3em', color: RED, textTransform: 'uppercase' }}>The Apex way</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 96, color: INK, textTransform: 'uppercase' }}>Knowing</div>
      </div>
    </AbsoluteFill>
  </Card>
}
const B7 = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 4, fps, config: { damping: 13, stiffness: 150 } })
  const btn = spring({ frame: frame - 30, fps, config: { damping: 12, stiffness: 170 } })
  return <Card bg={RED} fg={CREAM}>
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{ transform: `scale(${0.8 + clamp(pop, 0, 1) * 0.2})` }}><Img src={staticFile(`${ASSET}/logo.png`)} style={{ width: 440, height: 'auto' }} /></div>
      <div style={{ fontFamily: DISPLAY, fontSize: 60, color: CREAM, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.05 }}>Your unfair advantage<br />starts now.</div>
      <div style={{ transform: `scale(${clamp(btn, 0, 1)})`, marginTop: 8, background: CREAM, color: RED, fontFamily: DISPLAY, fontSize: 34, padding: '20px 56px', borderRadius: 12, textTransform: 'uppercase' }}>Get SmartViewz</div>
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: '#ffd6d8' }}>reachtheapex.net · free to join</div>
    </AbsoluteFill>
  </Card>
}

// ---------- TEAR OVERLAY: the outgoing page rips along a ragged HORIZONTAL line;
// the top half peels UP and the bottom half peels DOWN, opening a widening gap
// that reveals the incoming card beneath — a real "page tearing" (top+bottom
// motion), with white torn-paper edges + drop-shadow on both halves. ----------
const TearOverlay: React.FC<{ Out: React.FC; In: React.FC; dur: number }> = ({ Out, In, dur }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const yPx = 540                                   // rip line sits at mid-frame
  const topLift = interpolate(t, [0, 1], [0, -720], { easing: Easing.in(Easing.cubic) })     // top half flies up & out
  const botLift = interpolate(t, [0, 1], [0, 720], { easing: Easing.in(Easing.cubic) })       // bottom half flies down & out
  const topRot = interpolate(t, [0, 1], [0, -5])
  const botRot = interpolate(t, [0, 1], [0, 5])
  const topC = `path('${topClip(yPx)}')`
  const botC = `path('${bottomClip(yPx)}')`
  const edge = <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
    <path d={edgePolyline(yPx)} fill="none" stroke="#fffdf7" strokeWidth={7} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
  </svg>
  return (
    <AbsoluteFill>
      {/* incoming card revealed in the opening gap */}
      <In />
      {/* bottom half of the outgoing page — peels DOWN */}
      <AbsoluteFill style={{ clipPath: botC, WebkitClipPath: botC, transform: `translateY(${botLift}px) rotate(${botRot}deg)`, transformOrigin: 'bottom center', filter: 'drop-shadow(0 -18px 34px rgba(0,0,0,0.6))' }}>
        <Out />{edge}
      </AbsoluteFill>
      {/* top half of the outgoing page — peels UP */}
      <AbsoluteFill style={{ clipPath: topC, WebkitClipPath: topC, transform: `translateY(${topLift}px) rotate(${topRot}deg)`, transformOrigin: 'top center', filter: 'drop-shadow(0 18px 34px rgba(0,0,0,0.6))' }}>
        <Out />{edge}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const DUR = [7.6, 4.9, 8.2, 6.4, 9.8, 10.2, 5.5].map((d) => Math.round(d * FPS))
const CARDS: React.FC[] = [B1, B2, B3, B4, B5, B6, B7]
const TEAR_DUR = 22
export const APEX_TORN_FRAMES = DUR.reduce((a, b) => a + b, 0)

export const CommercialApexTorn: React.FC = () => {
  const starts: number[] = []; { let t = 0; for (const d of DUR) { starts.push(t); t += d } }
  const voWin: VoWindow[] = starts.map((st, i) => ({ start: st, end: st + DUR[i] }))
  const total = APEX_TORN_FRAMES
  const duck = makeMusicDuck(voWin, total, { loud: 0.22, duck: 0.08, ramp: 16, fadeInEnd: 12, fadeOutStart: total - 18, fadeOutEnd: total - 3 })
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {/* base card layer — each card holds its full beat, ending exactly when the tear starts */}
      {CARDS.map((C, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={DUR[i]}><C /></Sequence>
      ))}
      {/* tear overlays — a top layer over the seam that rips card i away to reveal i+1 */}
      {CARDS.slice(0, -1).map((Out, i) => (
        <Sequence key={'tear' + i} from={starts[i] + DUR[i] - TEAR_DUR} durationInFrames={TEAR_DUR + 2}>
          <TearOverlay Out={Out} In={CARDS[i + 1]} dur={TEAR_DUR} />
        </Sequence>
      ))}
      {/* real VO */}
      {starts.map((st, i) => (
        <Sequence key={'vo' + i} from={st}><Audio src={staticFile(`${ASSET}/c-apex-${i + 1}.mp3`)} volume={1} /></Sequence>
      ))}
      {/* real music */}
      <MusicBed src={`${ASSET}/music.mp3`} musicFrames={MUSIC_FRAMES} volume={duck} />
      {/* paper-tear SFX synced to each rip */}
      {starts.slice(0, -1).map((st, i) => (
        <Sequence key={'sfx' + i} from={starts[i] + DUR[i] - TEAR_DUR} durationInFrames={20}><Audio src={staticFile('sfx/paper-tear.wav')} volume={0.55} /></Sequence>
      ))}
    </AbsoluteFill>
  )
}
