import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence, Img, staticFile, spring, Audio } from 'remotion'
import { MusicBed } from './lib/musicbed'
import { makeMusicDuck, type VoWindow } from './lib/audio'
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat'

/* ============================================================================
 * ApexFlat — a FRIENDLY FLAT-VECTOR INFOGRAPHIC ad (ref: youtube vlpqx_YBwYk).
 * Style identifiers: flat 2D vector icons (no footage), high-contrast BOLD+THIN
 * all-caps geometric sans, a deep BURGUNDY → WHITE color shift, smooth ease-out
 * slide/scale motion, shape-mask zoom transitions, a tilting 2.5D calendar.
 * Cheerful, low-pressure, corporate-approachable. Apex message, adapted palette.
 * ==========================================================================*/

const { fontFamily: MONT } = loadMontserrat()
const FPS = 30
const BURG = '#5a1626', BURG2 = '#7a1f33', CREAM = '#fbf6ef', WHITE = '#ffffff', SLATE = '#33404f'
const ORANGE = '#f6a13c', SKY = '#57b6e6', GOLD = '#e8b94a', RED = '#d81f27', NAVY = '#16305e'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const ease = Easing.out(Easing.cubic)
const LOGO = 'c-apexTORN'

// ---- motion helpers (smooth ease-out, the whole language of this style) ----
const slideUp = (f: number, at: number, dist = 60, dur = 16) => {
  const p = clamp((f - at) / dur, 0, 1); const e = ease(p)
  return { opacity: p, transform: `translateY(${(1 - e) * dist}px)` }
}
const scaleIn = (f: number, at: number, from = 0.7, dur = 16) => {
  const p = clamp((f - at) / dur, 0, 1); const e = ease(p)
  return { opacity: p, transform: `scale(${from + e * (1 - from)})` }
}
// high-contrast headline: THIN word + BOLD word stacked (the signature type device)
const HL: React.FC<{ thin?: string; bold: string; color: string; size?: number; at: number; center?: boolean }> = ({ thin, bold, color, size = 96, at, center = true }) => {
  const f = useCurrentFrame()
  return (
    <div style={{ textAlign: center ? 'center' : 'left', ...slideUp(f, at, 40) }}>
      {thin && <div style={{ fontFamily: MONT, fontWeight: 300, fontSize: size * 0.5, letterSpacing: '0.24em', color, textTransform: 'uppercase' }}>{thin}</div>}
      <div style={{ fontFamily: MONT, fontWeight: 800, fontSize: size, letterSpacing: '0.02em', color, textTransform: 'uppercase', lineHeight: 1.0, marginTop: thin ? 10 : 0 }}>{bold}</div>
    </div>
  )
}

// ---- FLAT VECTOR ICONS (simple, friendly, generic) ----
const IconDocs: React.FC<{ c1?: string; c2?: string }> = ({ c1 = CREAM, c2 = ORANGE }) => (
  <svg viewBox="0 0 200 200" width="100%" height="100%">
    <rect x="40" y="30" width="110" height="140" rx="10" fill={c1} />
    <rect x="55" y="20" width="110" height="140" rx="10" fill={c2} />
    <rect x="72" y="45" width="76" height="10" rx="5" fill={c1} />
    <rect x="72" y="68" width="76" height="10" rx="5" fill={c1} opacity={0.85} />
    <rect x="72" y="91" width="54" height="10" rx="5" fill={c1} opacity={0.7} />
    <rect x="72" y="114" width="66" height="10" rx="5" fill={c1} opacity={0.55} />
  </svg>
)
const IconChat: React.FC<{ c1?: string; c2?: string }> = ({ c1 = SKY, c2 = CREAM }) => (
  <svg viewBox="0 0 200 200" width="100%" height="100%">
    <path d="M30 40 h140 a12 12 0 0 1 12 12 v70 a12 12 0 0 1 -12 12 h-90 l-30 26 v-26 h-20 a12 12 0 0 1 -12 -12 v-70 a12 12 0 0 1 12 -12 z" fill={c1} />
    <circle cx="70" cy="87" r="9" fill={c2} /><circle cx="100" cy="87" r="9" fill={c2} /><circle cx="130" cy="87" r="9" fill={c2} />
  </svg>
)
const IconShield: React.FC<{ c1?: string; c2?: string }> = ({ c1 = GOLD, c2 = BURG }) => (
  <svg viewBox="0 0 200 200" width="100%" height="100%">
    <path d="M100 20 L165 45 V105 C165 150 100 180 100 180 C100 180 35 150 35 105 V45 Z" fill={c1} />
    <path d="M72 100 l20 22 l40 -46" fill="none" stroke={c2} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconChart: React.FC = () => (
  <svg viewBox="0 0 200 200" width="100%" height="100%">
    <rect x="34" y="120" width="30" height="50" rx="6" fill={SKY} />
    <rect x="76" y="90" width="30" height="80" rx="6" fill={ORANGE} />
    <rect x="118" y="60" width="30" height="110" rx="6" fill={GOLD} />
    <rect x="160" y="34" width="30" height="136" rx="6" fill={RED} />
  </svg>
)

// wraps an icon so it scales/slides in with the ease-out feel
const IconBox: React.FC<{ at: number; size: number; x?: number; y?: number; children: React.ReactNode; dur?: number }> = ({ at, size, children, dur = 18 }) => {
  const f = useCurrentFrame()
  return <div style={{ width: size, height: size, ...scaleIn(f, at, 0.5, dur) }}>{children}</div>
}

// SCENE TRANSITION: a gentle fade-in at the START of each scene. Because each
// scene sits in its own Sequence and the whole comp has a solid base bg, fading
// the scene in from opacity 0 cross-dissolves cleanly into the previous one with
// NO solid-color flash frame. (The old circle-Wipe blew the frame to a solid
// color at the sequence boundary → the 44→249 white flash framecheck caught.)
const FADE = 10
const SceneFade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame()
  const o = clamp(f / FADE, 0, 1)
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
}

// ---- SCENES ----

// S1: HOOK — burgundy. Big thin/bold statement, flat docs icon sliding in.
const S1: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: BURG, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: 90, ...scaleIn(f, 4, 0.6) }}><div style={{ width: 200, height: 200 }}><IconDocs /></div></div>
      <div style={{ marginTop: 180 }}>
        <HL thin="For insurance pros" bold={'Your book of business'} color={CREAM} size={92} at={14} />
        <div style={{ ...slideUp(f, 30, 40), marginTop: 14, textAlign: 'center' }}>
          <span style={{ fontFamily: MONT, fontWeight: 300, fontSize: 88, color: CREAM, textTransform: 'uppercase' }}>is </span>
          <span style={{ fontFamily: MONT, fontWeight: 800, fontSize: 88, color: ORANGE, textTransform: 'uppercase' }}>invisible.</span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

// S2: PROBLEM→SOLUTION — the burgundy→WHITE shift happens here. Chat icon, product.
const S2: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: f - 40, fps, config: { damping: 14, stiffness: 130 } })
  return (
    <AbsoluteFill style={{ background: BURG2 }}>
      {/* white panel slides up to reveal the shift */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: interpolate(f, [10, 26], [0, 1080], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease }), background: WHITE }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <IconBox at={22} size={210}><IconChat c1={SKY} c2={WHITE} /></IconBox>
        <div style={{ marginTop: 30 }}><HL thin="Meet" bold="SmartViewz" color={SLATE} size={104} at={30} /></div>
        <div style={{ ...slideUp(f, 44, 30), marginTop: 12, fontFamily: MONT, fontWeight: 300, fontSize: 42, color: SLATE, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Ask your book anything</div>
        {/* logo chip */}
        <div style={{ marginTop: 40, transform: `scale(${clamp(pop, 0, 1)})`, background: NAVY, padding: '18px 30px', borderRadius: 10 }}>
          <Img src={staticFile(`${LOGO}/logo.png`)} style={{ width: 280, height: 'auto', display: 'block' }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// S3: VALUE — white. The data answer, chart grows, tilting calendar, big number.
const S3: React.FC = () => {
  const f = useCurrentFrame()
  const tilt = interpolate(f, [10, 30], [-18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  return (
    <AbsoluteFill style={{ background: WHITE }}>
      {/* question chip top */}
      <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center', ...slideUp(f, 4, 30) }}>
        <span style={{ fontFamily: MONT, fontWeight: 700, fontSize: 46, color: SLATE }}>“Who’s about to lapse?”</span>
      </div>
      {/* tilting 2.5D calendar left */}
      <div style={{ position: 'absolute', left: 180, top: 320, width: 320, height: 320, transformStyle: 'preserve-3d', transform: `perspective(900px) rotateY(${tilt}deg)`, ...scaleIn(f, 8, 0.7) }}>
        <svg viewBox="0 0 200 200" width="100%" height="100%">
          <rect x="20" y="30" width="160" height="150" rx="14" fill={CREAM} stroke={SLATE} strokeWidth="4" />
          <rect x="20" y="30" width="160" height="42" rx="14" fill={RED} />
          <rect x="52" y="18" width="16" height="30" rx="8" fill={SLATE} /><rect x="132" y="18" width="16" height="30" rx="8" fill={SLATE} />
          <text x="100" y="140" fontFamily={MONT} fontWeight="800" fontSize="70" fill={RED} textAnchor="middle">12</text>
        </svg>
      </div>
      {/* growing chart right */}
      <div style={{ position: 'absolute', right: 200, top: 330, width: 360, height: 300, ...scaleIn(f, 20, 0.6) }}><IconChart /></div>
      {/* big number + label */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 150, textAlign: 'center', ...slideUp(f, 40, 40) }}>
        <span style={{ fontFamily: MONT, fontWeight: 300, fontSize: 64, color: SLATE, textTransform: 'uppercase' }}>Spot </span>
        <span style={{ fontFamily: MONT, fontWeight: 800, fontSize: 64, color: RED, textTransform: 'uppercase' }}>12 at-risk policies</span>
        <span style={{ fontFamily: MONT, fontWeight: 300, fontSize: 64, color: SLATE, textTransform: 'uppercase' }}> instantly</span>
      </div>
    </AbsoluteFill>
  )
}

// S4: VALUE PROP — burgundy again. 3 flat icon+label cards slide in.
const S4: React.FC = () => {
  const f = useCurrentFrame()
  const cards = [
    { icon: <IconChart />, label: 'Every lapse' },
    { icon: <IconChat c1={SKY} c2={BURG} />, label: 'Every cross-sell' },
    { icon: <IconShield />, label: 'Every risk' },
  ]
  return (
    <AbsoluteFill style={{ background: BURG }}>
      <div style={{ position: 'absolute', top: 110, left: 0, right: 0, textAlign: 'center' }}>
        <HL thin="Your edge" bold="Never miss a thing" color={CREAM} size={80} at={4} />
      </div>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 90, marginTop: 60 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ textAlign: 'center', ...scaleIn(f, 24 + i * 12, 0.6) }}>
            <div style={{ width: 200, height: 200, background: '#ffffff14', borderRadius: 24, padding: 30, boxSizing: 'border-box' }}>{c.icon}</div>
            <div style={{ marginTop: 22, fontFamily: MONT, fontWeight: 700, fontSize: 34, color: CREAM, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// S5: BRAND OUTRO / CTA — navy. Logo scales in, bold/thin CTA, underline draw.
const S5: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: f - 8, fps, config: { damping: 13, stiffness: 140 } })
  const uw = clamp((f - 40) / 14, 0, 1)
  return (
    <AbsoluteFill style={{ background: NAVY, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `scale(${clamp(pop, 0, 1)})`, marginBottom: 40 }}>
        <Img src={staticFile(`${LOGO}/logo.png`)} style={{ width: 460, height: 'auto' }} />
      </div>
      <HL thin="Stop guessing." bold="Start knowing." color={CREAM} size={92} at={20} />
      <div style={{ position: 'relative', marginTop: 44, fontFamily: MONT, fontWeight: 700, fontSize: 40, color: CREAM, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        reachtheapex.net
        <div style={{ position: 'absolute', left: 0, bottom: -14, height: 8, width: `${uw * 100}%`, background: GOLD, borderRadius: 4 }} />
      </div>
    </AbsoluteFill>
  )
}

const VO_SEC = [3.07, 4.50, 5.85, 5.25, 4.23]
const DUR = VO_SEC.map((d) => Math.round((d + 1.6) * FPS))
const BEATS = [S1, S2, S3, S4, S5]
const MUSIC_FRAMES = Math.round(29.99 * FPS)
export const APEX_FLAT_FRAMES = DUR.reduce((a, b) => a + b, 0)

export const ApexFlat: React.FC = () => {
  const starts: number[] = []; { let t = 0; for (const d of DUR) { starts.push(t); t += d } }
  const total = APEX_FLAT_FRAMES
  const voWin: VoWindow[] = starts.map((st, i) => ({ start: st, end: st + Math.round(VO_SEC[i] * FPS) }))
  const duck = makeMusicDuck(voWin, total, { loud: 0.28, duck: 0.12, ramp: 14, fadeInEnd: 10, fadeOutStart: total - 20, fadeOutEnd: total - 3 })
  return (
    <AbsoluteFill style={{ background: BURG }}>
      {BEATS.map((B, i) => {
        // Overlap each scene FADE frames into the next so the incoming scene
        // (wrapped in SceneFade, opacity 0→1) cross-dissolves OVER the still-
        // visible previous scene — no solid-color flash. Last scene isn't extended.
        const isLast = i === BEATS.length - 1
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={DUR[i] + (isLast ? 0 : FADE)}>
            <SceneFade><B /></SceneFade>
          </Sequence>
        )
      })}
      {starts.map((st, i) => (
        <Sequence key={'vo' + i} from={st + 8}><Audio src={staticFile(`c-apex3/vo-${i + 1}.mp3`)} /></Sequence>
      ))}
      <MusicBed src="c-apexFLAT/music.mp3" musicFrames={MUSIC_FRAMES} volume={duck} />
    </AbsoluteFill>
  )
}
