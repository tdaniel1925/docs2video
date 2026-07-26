import React from 'react'
import {
  AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, spring, Easing,
} from 'remotion'
import JORDYN_AUDIO from '../public/jordyn-long/durations.json'

/* ============================================================================
 * JORDYN — long-form (~2.5min) product film. Flat-editorial style matching
 * jordyn.app. 16 beats grounded in the source code: problem → difference →
 * how it works → what it does (briefing, pipeline, drafts, automations, phone,
 * 500+ apps) → ROI → close. Site marketing claims 1:1; illustrative ROI.
 * ==========================================================================*/

const FPS = 30
const CREAM = '#faf9f5'
const INK = '#3f3a33'
const SOFT = '#7a6d5c'
const RUST = '#c4623f'
const SAGE = '#8faa72'
const GOLD = '#c78a2a'
const FONT = 'Archivo, Inter, system-ui, sans-serif'

const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
const Grain: React.FC = () => <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, mixBlendMode: 'multiply', opacity: 0.04 }} />

const FlatScene: React.FC<{ i: number; push?: number; focusX?: number; focusY?: number }> =
({ i, push = 0.06, focusX = 50, focusY = 50 }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: EASE.expoOut })
  const scale = 1.03 + p * push
  const tx = (50 - focusX) * p * 0.1, ty = (50 - focusY) * p * 0.1
  const drift = Math.sin(f * 0.04) * 3
  return (
    <AbsoluteFill style={{ background: CREAM, overflow: 'hidden' }}>
      <Img src={staticFile(`jordyn-long/f-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${tx}%, ${ty + drift * 0.05}%)` }} />
    </AbsoluteFill>
  )
}

const Bottom: React.FC<{ children: React.ReactNode; pb?: number }> = ({ children, pb = 96 }) => (
  <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: pb }}>{children}</AbsoluteFill>
)
const Card: React.FC<{ children: React.ReactNode; at?: number; align?: 'center' | 'flex-start' }> =
({ children, at = 4, align = 'center' }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 16, stiffness: 130 } })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, gap: 12, background: 'rgba(250,249,245,0.92)', borderRadius: 26, padding: '34px 54px', boxShadow: '0 20px 60px rgba(150,110,80,0.22)', border: '1px solid rgba(200,150,110,0.2)', transform: `translateY(${(1 - s) * 30}px)`, opacity: clamp(s), backdropFilter: 'blur(6px)', maxWidth: 1400 }}>{children}</div>
  )
}
const H: React.FC<{ children: React.ReactNode; accent?: React.ReactNode; size?: number; at?: number }> =
({ children, accent, size = 72, at = 4 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 16, stiffness: 140 } })
  return <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.05, color: INK, textAlign: 'center', letterSpacing: '-0.025em', transform: `translateY(${(1 - s) * 20}px)`, opacity: clamp(s) }}>{children}{accent && <> <span style={{ color: RUST }}>{accent}</span></>}</div>
}
const Sub: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 32 }) =>
  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: size, color: SOFT, textAlign: 'center' }}>{children}</div>

const Pill: React.FC<{ children: React.ReactNode; at?: number; tone?: 'rust' | 'sage' | 'gold'; big?: boolean }> =
({ children, at = 6, tone = 'rust', big = false }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 150 } })
  const bg = tone === 'rust' ? RUST : tone === 'sage' ? SAGE : GOLD
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: bg, borderRadius: 999, padding: big ? '20px 40px' : '14px 30px', transform: `translateY(${(1 - s) * 26}px) scale(${0.94 + clamp(s) * 0.06})`, opacity: clamp(s), boxShadow: `0 12px 32px ${bg}44`, margin: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: big ? 38 : 28, color: '#fff' }}>{children}</div>
    </div>
  )
}
const FeatRow: React.FC<{ text: string; at: number; kind?: 'x' | 'check'; accent?: string }> =
({ text, at, kind = 'check', accent = RUST }) => {
  const f = useCurrentFrame()
  const p = interpolate(f - at, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut })
  const bg = kind === 'x' ? '#b8503c' : accent
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: clamp(p), transform: `translateX(${(1 - p) * -30}px)` }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 20, color: '#fff' }}>{kind === 'x' ? '✕' : '✓'}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: INK }}>{text}</div>
    </div>
  )
}
// big stat callout (illustrative ROI)
const Stat: React.FC<{ big: React.ReactNode; label: string; at?: number; accent?: string }> = ({ big, label, at = 4, accent = RUST }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 140 } })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${(1 - s) * 22}px) scale(${0.9 + clamp(s) * 0.1})`, opacity: clamp(s) }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 110, lineHeight: 1, color: accent, letterSpacing: '-0.03em' }}>{big}</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 28, color: SOFT, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{label}</div>
    </div>
  )
}
const CountUp: React.FC<{ to: number; prefix?: string; suffix?: string; at?: number; dur?: number }> = ({ to, prefix = '', suffix = '', at = 0, dur = 26 }) => {
  const f = useCurrentFrame(); const p = interpolate(f - at, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return <>{prefix}{Math.round(to * p).toLocaleString('en-US')}{suffix}</>
}
// small act-label eyebrow
const Eyebrow: React.FC<{ children: React.ReactNode; at?: number }> = ({ children, at = 2 }) => {
  const f = useCurrentFrame()
  const o = interpolate(f - at, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 24, letterSpacing: '0.2em', color: RUST, textTransform: 'uppercase', opacity: o, marginBottom: 4 }}>{children}</div>
}

/* ============================ SCENES (16) ================================= */
const S0 = () => <AbsoluteFill><FlatScene i={0} focusY={44} /><Bottom><Card at={8}><H at={8} size={64}>Behind before 9am.</H><Sub>Sixty emails deep, before the real work starts.</Sub></Card></Bottom></AbsoluteFill>
const S1 = () => <AbsoluteFill><FlatScene i={1} focusX={44} /><Bottom><Card at={6} align="flex-start"><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 38, color: INK, marginBottom: 2 }}>Other AI = a blank box.</div><FeatRow text="You prompt it" at={14} kind="x" /><FeatRow text="You train it" at={22} kind="x" /><FeatRow text="You babysit it" at={30} kind="x" /></Card></Bottom></AbsoluteFill>
const S2 = () => <AbsoluteFill><FlatScene i={2} push={0.09} /><Bottom><Card at={8}><div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><Img src={staticFile('jordyn-long/logo.png')} style={{ height: 58 }} /><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 50, color: INK }}>is different.</div></div><Sub size={30}>The AI assistant with a brain for your business.</Sub></Card></Bottom></AbsoluteFill>
const S3 = () => <AbsoluteFill><FlatScene i={3} /><Bottom><Card at={6}><Eyebrow at={6}>How it works · 1</Eyebrow><H at={10} size={58}>Tell it your industry.</H><Sub>Insurance, real estate, law, HVAC — the brain installs in seconds.</Sub></Card></Bottom></AbsoluteFill>
const S4 = () => <AbsoluteFill><FlatScene i={4} /><Bottom><Card at={8}><H at={8} size={56}>Already fluent.</H><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}><Pill at={16} tone="rust">The vocabulary</Pill><Pill at={24} tone="gold">The paperwork</Pill><Pill at={32} tone="sage">The deadlines</Pill></div></Card></Bottom></AbsoluteFill>
const S5 = () => <AbsoluteFill><FlatScene i={5} push={0.05} /><Bottom><Card at={6}><Eyebrow at={6}>How it works · 2</Eyebrow><H at={10} size={56}>Connect your inbox.</H><Sub>Gmail, Outlook, or Fastmail. Nothing stored. Revoke anytime.</Sub></Card></Bottom></AbsoluteFill>
const S6 = () => <AbsoluteFill><FlatScene i={6} focusX={44} /><Bottom><Card at={8}><H at={8} size={58}>Then it learns you.</H><Sub>Your clients, your deals, and the way you write.</Sub></Card></Bottom></AbsoluteFill>
const S7 = () => <AbsoluteFill><FlatScene i={7} focusX={40} /><Bottom><Card at={6}><Eyebrow at={6}>What it does</Eyebrow><H at={10} accent="one briefing." size={56}>Every morning,</H><Sub>Only what needs you — each with a next step.</Sub></Card></Bottom></AbsoluteFill>
const S8 = () => <AbsoluteFill><FlatScene i={8} /><Bottom><Card at={8}><H at={8} size={56}>A pipeline that builds itself.</H><Sub>Every deal, decision, and deadline — recorded from your email.</Sub></Card></Bottom></AbsoluteFill>
const S9 = () => <AbsoluteFill><FlatScene i={9} focusX={56} /><Bottom><Card at={8}><H at={8} size={54}>Drafts in your voice.</H><Sub>Replies, letters, PDFs on your letterhead. <span style={{ color: RUST, fontWeight: 800 }}>Nothing sends without your OK.</span></Sub></Card></Bottom></AbsoluteFill>
const S10 = () => <AbsoluteFill><FlatScene i={10} /><Bottom><Card at={8}><H at={8} size={52}>Automations in plain English.</H><Sub>“Whenever the Chen file emails, flag me.” <span style={{ color: RUST, fontWeight: 800 }}>Say it once — runs forever.</span></Sub></Card></Bottom></AbsoluteFill>
const S11 = () => <AbsoluteFill><FlatScene i={11} focusY={46} /><Bottom pb={104}><Card at={8}><Pill at={8} tone="rust" big>NEW — it answers your phone</Pill><Sub size={30}>A real local number. Or say “call Maria” — Jordyn dials.</Sub></Card></Bottom></AbsoluteFill>
const S12 = () => <AbsoluteFill><FlatScene i={12} /><Bottom><Card at={8}><div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 96, color: RUST, letterSpacing: '-0.03em' }}><CountUp to={500} at={10} />+</div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 52, color: INK }}>apps</div></div><Sub>Gmail · Calendar · Drive · Slack · HubSpot · Stripe · DocuSign</Sub></Card></Bottom></AbsoluteFill>
const S13 = () => <AbsoluteFill><FlatScene i={13} /><Bottom><Card at={6}><Eyebrow at={6}>The payoff</Eyebrow><div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}><Stat big={<><CountUp to={5} at={10} suffix="+" /></>} label="hours back / week" at={10} /></div><Sub size={26}>Illustrative — triage, follow-ups & pipeline, off your plate.</Sub></Card></Bottom></AbsoluteFill>
const S14 = () => <AbsoluteFill><FlatScene i={14} focusY={46} /><Bottom><Card at={8}><H at={8} size={54}>$149 a month.</H><Sub><span style={{ color: RUST, fontWeight: 800 }}>One closed deal covers years of it.</span> Deals stop dying in your inbox.</Sub></Card></Bottom></AbsoluteFill>
const S15 = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 8, fps, config: { damping: 14, stiffness: 140 } })
  const tag = interpolate(f, [26, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const url = interpolate(f, [42, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  return (
    <AbsoluteFill><FlatScene i={15} focusY={42} push={0.05} />
      <Bottom pb={100}>
        <div style={{ transform: `translateY(${(1 - s) * 40}px) scale(${0.9 + clamp(s) * 0.1})`, opacity: clamp(s), background: CREAM, borderRadius: 26, padding: '32px 58px', boxShadow: '0 22px 60px rgba(150,110,80,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Img src={staticFile('jordyn-long/logo.png')} style={{ height: 76 }} />
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK, opacity: tag, textAlign: 'center' }}>Not a tool you operate. <span style={{ color: RUST }}>An assistant that works.</span></div>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: RUST, opacity: url }}>jordyn.app <span style={{ color: SOFT, fontWeight: 700, fontSize: 28 }}>· free for 3 days</span></div>
        </div>
      </Bottom>
    </AbsoluteFill>
  )
}

/* ============================ TIMELINE ==================================== */
const S = (sec: number) => Math.round(sec * FPS)
const COMPS = [S0, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15]
const PAD = 0.85
const XF = 0.4
const vo: number[] = (JORDYN_AUDIO && (JORDYN_AUDIO as any).vo) || COMPS.map(() => 7)
const SEG = COMPS.map((c, i) => ({ c, d: (vo[i] || 7) + PAD }))
const _sumD = SEG.reduce((a, s) => a + s.d, 0)
const BODY_FRAMES = Math.round((_sumD - (SEG.length - 1) * XF) * FPS)

// intro + end screen durations
const INTRO = S(3.2)
const END = S(4.2)
const INTRO_XF = S(0.5) // intro overlaps into body
const END_XF = S(0.5)
export const JORDYN_LONG_FRAMES = INTRO - INTRO_XF + BODY_FRAMES + END - END_XF

const Dissolve: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame(); const xf = S(XF)
  const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill>
}

// soft flat blobs backdrop for intro/end (on-brand, no image needed)
const Blobs: React.FC = () => {
  const f = useCurrentFrame()
  const d = Math.sin(f * 0.02) * 14, d2 = Math.cos(f * 0.016) * 18
  return (
    <AbsoluteFill style={{ background: CREAM, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', background: `${SAGE}33`, filter: 'blur(60px)', top: -260 + d, left: -160 + d2 }} />
      <div style={{ position: 'absolute', width: 820, height: 820, borderRadius: '50%', background: `${RUST}22`, filter: 'blur(70px)', bottom: -260 - d, right: -140 - d2 }} />
      <div style={{ position: 'absolute', width: 620, height: 620, borderRadius: '50%', background: `${GOLD}22`, filter: 'blur(60px)', bottom: -180 + d2, left: 300 }} />
    </AbsoluteFill>
  )
}

// INTRO — big logo + tagline
const IntroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 13, stiffness: 130 } })
  const bar = interpolate(f, [22, 42], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const tag = interpolate(f, [30, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const out = interpolate(f, [INTRO - INTRO_XF, INTRO], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 28, opacity: out }}>
      <Blobs />
      <Grain />
      <Img src={staticFile('jordyn-long/logo.png')} style={{ height: 150, width: 'auto', transform: `translateY(${(1 - s) * 40}px) scale(${0.8 + clamp(s) * 0.2})`, opacity: clamp(s), filter: 'drop-shadow(0 8px 24px rgba(150,90,60,0.28))' }} />
      <div style={{ width: interpolate(bar, [0, 1], [0, 460]), height: 3, background: `linear-gradient(90deg, transparent, ${RUST}, transparent)` }} />
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, color: INK, opacity: tag, transform: `translateY(${(1 - tag) * 18}px)`, textAlign: 'center' }}>
        The AI assistant with a brain <br />for <span style={{ color: RUST }}>your business.</span>
      </div>
    </AbsoluteFill>
  )
}

// END — logo + url + trial
const EndScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 140 } })
  const tag = interpolate(f, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const url = interpolate(f, [34, 54], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const inO = interpolate(f, [0, END_XF], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24, opacity: inO }}>
      <Blobs />
      <Grain />
      <Img src={staticFile('jordyn-long/logo.png')} style={{ height: 130, width: 'auto', transform: `translateY(${(1 - s) * 34}px) scale(${0.85 + clamp(s) * 0.15})`, opacity: clamp(s), filter: 'drop-shadow(0 8px 24px rgba(150,90,60,0.28))' }} />
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: INK, opacity: tag, transform: `translateY(${(1 - tag) * 16}px)`, textAlign: 'center' }}>
        Not a tool you operate. <span style={{ color: RUST }}>An assistant that works.</span>
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 52, color: RUST, opacity: url, transform: `translateY(${(1 - url) * 14}px)` }}>
        jordyn.app
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: SOFT, opacity: url }}>free for 3 days · nothing sends without your OK</div>
    </AbsoluteFill>
  )
}

// persistent corner logo bug (top-right), fades in after intro, out before end
const CornerLogo: React.FC<{ total: number }> = ({ total }) => {
  const f = useCurrentFrame()
  const inO = interpolate(f, [INTRO - INTRO_XF, INTRO + S(0.4)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outO = interpolate(f, [total - END - S(0.2), total - END + END_XF], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const op = Math.min(inO, outO)
  return (
    <div style={{ position: 'absolute', top: 40, right: 48, opacity: op * 0.9, pointerEvents: 'none' }}>
      {/* soft cream chip so the logo reads over any scene */}
      <div style={{ background: 'rgba(250,249,245,0.82)', borderRadius: 12, padding: '10px 18px', boxShadow: '0 6px 20px rgba(150,110,80,0.22)', backdropFilter: 'blur(4px)' }}>
        <Img src={staticFile('jordyn-long/logo.png')} style={{ height: 34, width: 'auto', display: 'block' }} />
      </div>
    </div>
  )
}

export const CommercialJordynLong: React.FC = () => {
  const bodyStart = INTRO - INTRO_XF
  let cursor = 0
  const starts = SEG.map((seg, i) => { const from = S(cursor); cursor += seg.d - (i < SEG.length - 1 ? XF : 0); return bodyStart + from })
  const endStart = bodyStart + BODY_FRAMES - END_XF
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      {/* music runs across the whole film (intro → body → end) */}
      <Audio src={staticFile('jordyn-long/music.mp3')} volume={0.34} />

      {/* INTRO */}
      <Sequence from={0} durationInFrames={INTRO}><IntroScreen /></Sequence>

      {/* BODY — the 16 scenes */}
      {SEG.map((seg, i) => {
        const Comp = seg.c; const durF = S(seg.d)
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <Dissolve dur={durF}><Comp /></Dissolve>
            <Grain />
            <Sequence from={Math.round(0.2 * FPS)}><Audio src={staticFile(`jordyn-long/vo-${i}.mp3`)} volume={1} /></Sequence>
          </Sequence>
        )
      })}

      {/* END */}
      <Sequence from={endStart} durationInFrames={END}><EndScreen /></Sequence>

      {/* persistent top-right logo over everything */}
      <CornerLogo total={JORDYN_LONG_FRAMES} />
    </AbsoluteFill>
  )
}
