import React from 'react'
import {
  AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from 'remotion'
import APEX from '../public/apex-torn/durations.json'

/* ============================================================================
 * APEX AFFINITY GROUP — ~2.5min brand/recruiting film. Cinematic corporate
 * PHOTOGRAPHIC style in the Apex palette (navy blue + red + white), matching
 * the site's patriotic corporate look. Full-bleed Gemini photo scenes with
 * Ken-Burns + navy/red caption bars + star accents, real Apex logo pinned
 * top-right the WHOLE video + big-logo intro + end card. Grounded in
 * reachtheapex.net (two paths: insurance + AI, $0 start, uncapped income).
 * ==========================================================================*/

const FPS = 30
const NAVY = '#1e3a70'
const NAVY_D = '#132649'
const RED = '#c0272d'
const WHITE = '#ffffff'
const CREAMWHITE = '#f4f6fb'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const S = (sec: number) => Math.round(sec * FPS)

type Caption = { kicker?: string; head: string; accent?: string }
const CAPTIONS: Caption[] = [
  { kicker: 'The Choice', head: 'You Don’t Have To Pick A Lane.' },
  { kicker: 'Apex Affinity Group', head: 'Two Proven Paths To Real Income.', accent: 'Two Proven Paths' },
  { kicker: 'Path One', head: 'A Real Insurance Career.' },
  { kicker: 'Trusted Coverage', head: 'Protect Families. Own Your Book.' },
  { kicker: 'Path Two', head: 'An Unfair Advantage.' },
  { kicker: 'SmartViewz', head: 'Ask Your Whole Book Anything.' },
  { kicker: 'Docs2Video', head: 'Any Document → A Video That Sells.' },
  { kicker: 'One Of A Kind', head: 'A Tech Stack Built For Agents.' },
  { kicker: 'Training Included', head: 'Licensed Or Brand New — You Start Here.' },
  { kicker: 'No Barrier', head: '$0 To Start. No Catch.', accent: '$0 To Start.' },
  { kicker: 'Uncapped', head: 'Earn On Every Policy You Place.' },
  { kicker: 'Build A Team', head: 'Two Income Streams. One Team.' },
  { kicker: 'The Difference', head: 'The Tools To Actually Win.' },
  { kicker: 'Room For Everyone', head: 'There’s A Place For You Here.' },
  { kicker: '', head: 'Two Paths. One Opportunity.', accent: 'One Opportunity.' },
  { finale: true } as any,
]

const vignetteGrad = `radial-gradient(120% 120% at 50% 40%, transparent 45%, rgba(10,16,30,0.55))`

/* ============================ CINEMATIC EFFECTS =========================== */

// Drifting bokeh light orbs — soft glowing circles floating across every scene.
// Deterministic (seeded by index) so renders are reproducible.
const ORB_SEED = [
  { x: 12, y: 30, r: 220, spd: 0.11, amp: 8, col: '90,140,220', o: 0.16 },
  { x: 78, y: 22, r: 160, spd: 0.08, amp: 12, col: '220,90,100', o: 0.13 },
  { x: 60, y: 70, r: 260, spd: 0.06, amp: 10, col: '120,170,255', o: 0.12 },
  { x: 30, y: 78, r: 140, spd: 0.13, amp: 14, col: '255,150,150', o: 0.1 },
  { x: 88, y: 62, r: 190, spd: 0.09, amp: 9, col: '150,190,255', o: 0.12 },
]
const LightOrbs: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      {ORB_SEED.map((o, i) => {
        const dx = Math.sin(f * o.spd * 0.05 + i) * o.amp
        const dy = Math.cos(f * o.spd * 0.04 + i * 1.7) * o.amp
        const pulse = 0.85 + Math.sin(f * 0.03 + i) * 0.15
        return (
          <div key={i} style={{
            position: 'absolute', left: `${o.x + dx}%`, top: `${o.y + dy}%`,
            width: o.r, height: o.r, marginLeft: -o.r / 2, marginTop: -o.r / 2, borderRadius: '50%',
            background: `radial-gradient(circle, rgba(${o.col},${o.o * pulse}) 0%, transparent 70%)`,
            filter: 'blur(8px)',
          }} />
        )
      })}
    </AbsoluteFill>
  )
}

// Anamorphic lens flare — a horizontal streak + a bright core that slowly sweeps.
// Intensity is driven per-scene (stronger on hero/stat/intro/end beats).
const LensFlare: React.FC<{ intensity?: number; y?: number }> = ({ intensity = 1, y = 34 }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const x = 12 + p * 76 // sweeps left → right across the scene
  const twinkle = 0.7 + Math.sin(f * 0.12) * 0.3
  const op = intensity * twinkle
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      {/* horizontal anamorphic streak */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, height: 3, background: `linear-gradient(90deg, transparent, rgba(150,190,255,${0.5 * op}) ${x - 10}%, rgba(255,255,255,${0.85 * op}) ${x}%, rgba(150,190,255,${0.5 * op}) ${x + 10}%, transparent)`, filter: 'blur(2px)' }} />
      {/* bright core */}
      <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,255,255,${0.7 * op}), rgba(150,190,255,${0.3 * op}) 40%, transparent 70%)`, filter: 'blur(3px)' }} />
      {/* soft red counter-flare (Apex accent) */}
      <div style={{ position: 'absolute', left: `${100 - x}%`, top: `${100 - y}%`, width: 80, height: 80, marginLeft: -40, marginTop: -40, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,120,120,${0.28 * op}), transparent 70%)`, filter: 'blur(6px)' }} />
    </AbsoluteFill>
  )
}

// Fine floating dust/particles catching the light — adds depth + life.
const DUST = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 100, r: 1.5 + (i % 3), spd: 0.3 + (i % 5) * 0.15, ph: i }))
const Particles: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      {DUST.map((d, i) => {
        const yy = (d.y - (f * d.spd * 0.06) % 100 + 100) % 100
        const xx = d.x + Math.sin(f * 0.02 + d.ph) * 2
        const tw = 0.3 + Math.abs(Math.sin(f * 0.05 + d.ph)) * 0.5
        return <div key={i} style={{ position: 'absolute', left: `${xx}%`, top: `${yy}%`, width: d.r, height: d.r, borderRadius: '50%', background: `rgba(200,220,255,${tw})`, filter: 'blur(0.5px)' }} />
      })}
    </AbsoluteFill>
  )
}

// full-bleed photographic scene with STRONGER Ken-Burns + gentle breathing drift
// (more movement), a navy grade, and the cinematic effect layers.
const Scene: React.FC<{ i: number; push?: number; fx?: number; fy?: number; flare?: number }> = ({ i, push = 0.14, fx = 50, fy = 48, flare = 0.5 }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const scale = 1.08 + p * push
  const tx = (50 - fx) * p * 0.26, ty = (50 - fy) * p * 0.26
  // gentle continuous breathing so the frame is never fully static
  const breatheS = Math.sin(f * 0.02) * 0.006
  const breatheX = Math.sin(f * 0.015) * 0.3
  return (
    <AbsoluteFill style={{ background: NAVY_D, overflow: 'hidden' }}>
      <Img src={staticFile(`apex-torn/f-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale + breatheS}) translate(${tx + breatheX}%, ${ty}%)` }} />
      {/* PAPER look: no lens flare/orbs (wrong for paper). A soft paper grain +
          a gentle darken at the bottom so captions read. */}
      <PaperGrain />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 55%, rgba(19,38,73,0.55))` }} />
    </AbsoluteFill>
  )
}

// paper fiber grain overlay
const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
const PaperGrain: React.FC = () => { const f = useCurrentFrame(); return <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${(f * 4) % 180}px ${(f * 7) % 180}px`, mixBlendMode: 'multiply', opacity: 0.05 }} /> }

// navy/red lower-third caption bar with a red star accent + kicker
const Star: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = RED }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
    <path d="M12 1.6l2.9 6.5 7.1.6-5.4 4.7 1.7 6.9L12 17.9 5.7 20.3l1.7-6.9L2 8.7l7.1-.6z" fill={color} />
  </svg>
)
const CaptionBar: React.FC<{ c: Caption; at?: number }> = ({ c, at = 6 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 18, stiffness: 130 } })
  const kick = interpolate(f - at, [4, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const headParts = c.accent && c.head.includes(c.accent)
    ? <>{c.head.replace(c.accent, '')}<span style={{ color: '#ff8a8a' }}>{c.accent}</span></>
    : c.head
  // torn-paper caption card (navy paper with torn top/bottom edges + red kicker)
  const torn = 'polygon(0% 7%, 5% 2%, 11% 8%, 17% 2%, 24% 8%, 31% 2%, 38% 8%, 45% 2%, 52% 8%, 59% 2%, 66% 8%, 73% 2%, 80% 8%, 87% 2%, 94% 8%, 100% 3%, 100% 92%, 95% 98%, 88% 91%, 81% 98%, 74% 91%, 67% 98%, 60% 91%, 53% 98%, 46% 91%, 39% 98%, 32% 91%, 25% 98%, 18% 91%, 11% 98%, 5% 91%, 0% 96%)'
  const rot = interpolate(s, [0, 1], [-2.4, -1])
  return (
    <div style={{ position: 'absolute', left: 80, bottom: 120, maxWidth: 1500, transform: `translateY(${(1 - s) * 44}px) rotate(${rot}deg)`, opacity: clamp(s) }}>
      <div style={{ background: NAVY, clipPath: torn, padding: '30px 56px 34px', boxShadow: '0 18px 44px rgba(0,0,0,0.5)' }}>
        {c.kicker ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, opacity: kick }}>
            <Star size={20} />
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', color: '#ff9d9d', textTransform: 'uppercase' }}>{c.kicker}</div>
          </div>
        ) : null}
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 74, lineHeight: 1.03, color: WHITE, letterSpacing: '-0.02em' }}>{headParts}</div>
      </div>
    </div>
  )
}

// stat callout variant (for $0 / uncapped etc.) — big number center
const StatScene: React.FC<{ big: string; label: string }> = ({ big, label }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 6, fps, config: { damping: 15, stiffness: 140 } })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      {/* navy radial scrim so the big stat always reads over any photo */}
      <AbsoluteFill style={{ background: `radial-gradient(50% 50% at 50% 48%, rgba(19,38,73,0.82), transparent 70%)` }} />
      <div style={{ transform: `scale(${0.8 + clamp(s) * 0.2})`, opacity: clamp(s), textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 260, lineHeight: 0.9, color: WHITE, letterSpacing: '-0.04em', textShadow: '0 6px 50px rgba(0,0,0,0.85)' }}>{big}</div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, letterSpacing: '0.14em', color: '#ff9d9d', textTransform: 'uppercase', marginTop: 10, textShadow: '0 3px 20px rgba(0,0,0,0.8)' }}>{label}</div>
      </div>
    </AbsoluteFill>
  )
}

/* ---- CHART SCENE: a code-drawn cream torn-paper PANEL holding an animated
   income-growth line + a live ticking number. AI paper = texture only; the
   readable panel is drawn in code at a KNOWN spot (per the readability rule). */
const CHART_GRAIN = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
const ChartScene: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  // illustrative "your income" growth (indexed), rises with a couple of dips
  const SERIES = [10, 14, 12, 19, 24, 22, 31, 38, 44, 52, 49, 63, 71, 80]
  const MINV = 0, MAXV = 90
  const PANEL = { x: 230, y: 165, w: 1460, h: 720 }
  const PLOT = { x: PANEL.x + 90, y: PANEL.y + 250, w: PANEL.w - 320, h: PANEL.h - 350 }
  const px = (i: number) => PLOT.x + (i / (SERIES.length - 1)) * PLOT.w
  const py = (v: number) => PLOT.y + PLOT.h - ((v - MINV) / (MAXV - MINV)) * PLOT.h
  const panelS = spring({ frame: f - 2, fps, config: { damping: 16, stiffness: 120 } })
  const draw = interpolate(f, [14, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const shown = 1 + draw * (SERIES.length - 1); const whole = Math.floor(shown)
  let d = `M ${px(0)} ${py(SERIES[0])}`
  for (let i = 1; i <= Math.min(whole, SERIES.length - 1); i++) d += ` L ${px(i)} ${py(SERIES[i])}`
  let tx = px(Math.min(whole, SERIES.length - 1)), ty = py(SERIES[Math.min(whole, SERIES.length - 1)])
  if (whole < SERIES.length - 1) { const fr = shown - whole; tx = px(whole) + (px(whole + 1) - px(whole)) * fr; ty = py(SERIES[whole]) + (py(SERIES[whole + 1]) - py(SERIES[whole])) * fr; d += ` L ${tx} ${ty}` }
  const GREEN = '#2f7d4f', CREAM = '#f4efe4'
  const TORN = 'polygon(1% 3%,7% 1%,14% 4%,21% 1%,29% 3%,37% 0%,45% 3%,53% 1%,61% 4%,69% 1%,77% 3%,85% 0%,93% 3%,99% 1%,100% 7%,99% 16%,100% 28%,99% 42%,100% 56%,99% 70%,100% 82%,99% 92%,94% 99%,85% 97%,76% 100%,66% 97%,56% 100%,46% 97%,36% 100%,26% 97%,16% 100%,8% 98%,2% 99%,0% 93%,1% 80%,0% 66%,1% 52%,0% 38%,1% 24%,0% 12%)'
  return (
    <AbsoluteFill>
      {/* code panel */}
      <div style={{ position: 'absolute', left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, transform: `translateY(${(1 - panelS) * 30}px) rotate(-0.6deg)`, opacity: Math.min(1, panelS) }}>
        <div style={{ position: 'absolute', inset: -8, background: 'rgba(0,0,0,0.4)', clipPath: TORN, filter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${CREAM}, #ece5d6)`, clipPath: TORN, overflow: 'hidden' }}>
          <AbsoluteFill style={{ backgroundImage: `url("data:image/svg+xml,${CHART_GRAIN}")`, backgroundPosition: `${(f * 3) % 180}px ${(f * 5) % 180}px`, mixBlendMode: 'multiply', opacity: 0.08 }} />
        </div>
      </div>
      {/* axes */}
      <div style={{ position: 'absolute', left: PLOT.x, top: PLOT.y + PLOT.h + 4, width: PLOT.w, height: 4, background: NAVY, opacity: 0.4, borderRadius: 2 }} />
      {/* line */}
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: 'absolute' }}>
        <defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity="0.26" /><stop offset="100%" stopColor={GREEN} stopOpacity="0" /></linearGradient></defs>
        <path d={`${d} L ${tx} ${PLOT.y + PLOT.h} L ${px(0)} ${PLOT.y + PLOT.h} Z`} fill="url(#cf)" />
        <path d={d} fill="none" stroke={GREEN} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))' }} />
        <circle cx={tx} cy={ty} r={12} fill="#fff" stroke={GREEN} strokeWidth={6} />
      </svg>
      {/* title tag */}
      <div style={{ position: 'absolute', left: PANEL.x + 70, top: PANEL.y + 58, background: NAVY, padding: '11px 24px', boxShadow: '0 8px 20px rgba(0,0,0,0.35)', transform: 'rotate(-1deg)' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 26, color: '#fff', letterSpacing: '0.03em' }}>YOUR INCOME · ILLUSTRATIVE</div>
      </div>
      {/* live number (dark ink on cream) */}
      <div style={{ position: 'absolute', right: 1920 - (PANEL.x + PANEL.w) + 80, top: PANEL.y + 52, textAlign: 'right' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 42, color: '#7a6a4a', letterSpacing: '0.02em', marginBottom: -6 }}>NO CEILING</div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 96, color: GREEN, letterSpacing: '-0.02em' }}>▲</div>
      </div>
    </AbsoluteFill>
  )
}

/* ---- persistent corner logo (top-right, whole video) ---- */
const CornerLogo: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame()
  const inO = interpolate(f, [from, from + S(0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [to - S(0.5), to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', top: 40, right: 50, opacity: Math.min(inO, outO) }}>
      <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '10px 18px', boxShadow: '0 6px 22px rgba(0,0,0,0.35)' }}>
        <Img src={staticFile('apex-torn/logo.png')} style={{ height: 40, display: 'block' }} />
      </div>
    </div>
  )
}

/* ---- intro (big logo) ---- */
const IntroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 13, stiffness: 130 } })
  const tag = interpolate(f, [26, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const out = interpolate(f, [INTRO - S(0.5), INTRO], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const shine = Math.sin(f * 0.04) * 40
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30, background: `radial-gradient(120% 100% at 50% 40%, ${NAVY}, ${NAVY_D})`, opacity: out }}>
      <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: `${RED}22`, filter: 'blur(80px)', top: 120 + shine, left: '30%' }} />
      <LightOrbs />
      <Particles />
      <LensFlare intensity={0.8} y={30} />
      <div style={{ background: WHITE, borderRadius: 16, padding: '40px 64px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', transform: `translateY(${(1 - s) * 40}px) scale(${0.82 + clamp(s) * 0.18})`, opacity: clamp(s) }}>
        <Img src={staticFile('apex-torn/logo.png')} style={{ height: 160, display: 'block' }} />
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, color: WHITE, opacity: tag, transform: `translateY(${(1 - tag) * 16}px)`, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Star size={30} /> Two Paths. One Opportunity. <Star size={30} />
      </div>
    </AbsoluteFill>
  )
}

/* ---- end card ---- */
const EndScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 140 } })
  const tag = interpolate(f, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const cta = interpolate(f, [34, 54], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26, background: `radial-gradient(120% 100% at 50% 40%, ${NAVY}, ${NAVY_D})` }}>
      <LightOrbs />
      <Particles />
      <LensFlare intensity={0.7} y={28} />
      <div style={{ background: WHITE, borderRadius: 14, padding: '32px 56px', boxShadow: '0 24px 70px rgba(0,0,0,0.5)', transform: `translateY(${(1 - s) * 34}px) scale(${0.86 + clamp(s) * 0.14})`, opacity: clamp(s), position: 'relative' }}>
        <Img src={staticFile('apex-torn/logo.png')} style={{ height: 120, display: 'block' }} />
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 52, color: WHITE, opacity: tag, transform: `translateY(${(1 - tag) * 16}px)`, textAlign: 'center' }}>
        Two Paths. <span style={{ color: '#ff8a8a' }}>One Opportunity.</span>
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 46, color: WHITE, opacity: cta, transform: `translateY(${(1 - cta) * 14}px)`, letterSpacing: '0.01em' }}>reachtheapex.net</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: '#b9c6e4', opacity: cta }}>$0 To Start · A-Rated Carriers · Training Included</div>
    </AbsoluteFill>
  )
}

/* ============================ TIMELINE ==================================== */
const vo: number[] = (APEX && (APEX as any).vo) || new Array(16).fill(7)
const PAD = 0.6, XF = 0.4
const INTRO = S(3.2), END = S(4.5), INTRO_XF = S(0.5), END_XF = S(0.5)
const segD = vo.map((d) => (d || 7) + PAD)
const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
export const APEX_TORN_FRAMES = INTRO - INTRO_XF + bodyFrames + END - END_XF

// which beats show a big stat instead of a caption bar
const STATS: Record<number, { big: string; label: string }> = {
  9: { big: '$0', label: 'to start' },
  10: { big: '∞', label: 'income ceiling' },
}
const FOCUS = [{}, {}, { fy: 55 }, {}, {}, {}, {}, {}, {}, {}, {}, {}, { fy: 40 }, {}, {}, { fy: 42, push: 0.06 }]

const Dissolve: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame(); const xf = S(XF)
  const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill>
}

export const CommercialApexTornPaper: React.FC = () => {
  const bodyStart = INTRO - INTRO_XF
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  const endStart = bodyStart + bodyFrames - END_XF
  const total = APEX_TORN_FRAMES
  return (
    <AbsoluteFill style={{ background: NAVY_D }}>
      {/* Pre-mastered audio (scripts/master-audio.mjs): one continuous VO track +
          a sidechain-DUCKED music bed that dips whenever the VO speaks, so the
          voice is ALWAYS on top and the music never swells over it. Both at 1.0. */}
      <Audio src={staticFile('apex-torn/musicDucked.mp3')} volume={1} />
      <Audio src={staticFile('apex-torn/voMaster.mp3')} volume={1} />
      <Sequence from={0} durationInFrames={INTRO}><IntroScreen /></Sequence>
      {segD.map((d, i) => {
        const fo: any = FOCUS[i] || {}; const durF = S(d); const stat = STATS[i]; const cap = CAPTIONS[i] as any
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <Dissolve dur={durF}>
              <AbsoluteFill>
                <Scene i={i} push={fo.push} fx={fo.fx} fy={fo.fy} flare={stat ? 1.1 : (i === 0 || i === 12 || i === 15) ? 0.9 : 0.45} />
                {/* beat 10 = the DATA scene: a code-drawn income-growth chart on
                    a readable cream paper panel (over the paper backdrop). */}
                {i === 10 ? <ChartScene /> : stat ? <StatScene big={stat.big} label={stat.label} /> : cap && !cap.finale ? <CaptionBar c={cap} /> : null}
              </AbsoluteFill>
            </Dissolve>
            {/* VO now lives in the pre-mastered voMaster track (see top) */}
          </Sequence>
        )
      })}
      <Sequence from={endStart} durationInFrames={END}><EndScreen /></Sequence>
      <CornerLogo from={bodyStart} to={endStart + S(0.3)} />
    </AbsoluteFill>
  )
}
