import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import apexGrid from '../public/apex/beatgrid.json'
import { CountUp, Bar, StreakWipe, Morph, Bokeh, HeroFlash } from './lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'
import { Intro, pickIntro } from './lib/intros'

const { fontFamily: SANS } = loadArchivo()
const { fontFamily: BLACK } = loadArchivoBlack()
const { fontFamily: BODY } = loadInter()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * APEX AFFINITY GROUP — an upbeat, high-energy recruitment ad, $10k-agency grade.
 *
 * BRAND (extracted live from reachtheapex.net): navy #0a2540 / #101d33, electric
 * blue #0d6efd, gold #ffc107, white. Real APEX star-mark logo (transparent PNG)
 * used BOLDLY — animated star reveal, corner bug, big brand stamp on the CTA.
 * Real carrier logos (Mutual of Omaha, NLG, Corebridge…) shown as proof.
 *
 * STORY (their real pitch, "Two Paths. One Opportunity."):
 *   1  "Most companies make you pick a lane."
 *   2  "Apex built two."                                    ← the hook / logo hit
 *   3  "Insurance career. Cutting-edge AI. Or both."        ← the two paths
 *   4  "The only insurance company with an AI tech stack built to help you win."
 *   5  "SmartViewz + Docs2Video."                           ← the products
 *   6  "A-rated carriers. Training. $0 to start. No cap."   ← proof stats
 *   7  "Two paths. One opportunity. Room for everyone."
 *   8  "Apex Affinity Group. Reach your apex."              ← logo + CTA
 *
 * STYLE — bright & KINETIC (opposite of the AI CEO luxury piece): fast punchy
 * cuts locked to a 120 BPM grid, energetic scale-pops, blue/gold motion accents,
 * dynamic angled type. Upbeat and motivating.
 * ==========================================================================*/

// REAL Apex Affinity Group brand (from style.css): red #cc2027 + dark slate blue
// #1e3a72. (The earlier navy/gold were Bootstrap defaults — wrong.) Names kept so
// usages don't change. Two-tone = RED (primary) + STEEL-BLUE (contrast partner):
//   GOLD → brand red  |  BLUE/BLUE_HI → steel-blue  (matches the red+slate brand)
const NAVY = '#0e1c3a', NAVY2 = '#1e3a72'          // dark slate-blue backgrounds
const GOLD = '#cc2027'                              // brand RED (primary accent)
const BLUE = '#2f5aa8', BLUE_HI = '#5b8ad6'        // steel-blue (the contrast partner)
const WHITE = '#ffffff', ICE = '#dbe4f5'

// ---- energetic image cell: fast punch-in scale-pop + brand-graded + blue glow.
const Shot: React.FC<{ src: string; folder?: 'apex' | 'apex/gen'; dur: number; focus?: string; kb?: number }> =
({ src, folder = 'apex/gen', dur, focus = '50% 45%', kb = 1.14 }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 200 } })
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = (0.98 + pop * 0.04) * (1 + (kb - 1) * p)
  // parallax drift for depth + gentle lens breathing
  const dx = -1.4 * p, dy = 0.7 * p
  const breathe = Math.sin(frame * 0.05) * 0.004
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: NAVY }}>
      <Img src={staticFile(`${folder}/${src}`)} style={{ width: '116%', height: '116%', position: 'absolute', left: '-8%', top: '-8%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc + breathe}) translate(${dx}%, ${dy}%)`, filter: 'brightness(0.96) contrast(1.08) saturate(1.16)' }} />
      {/* brand grade — navy shadows, cool highlights */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${NAVY}55, transparent 28%, transparent 60%, ${NAVY}dd)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(90% 90% at 20% 15%, ${BLUE}22, transparent 45%)`, mixBlendMode: 'screen' }} />
      {/* movement + atmosphere on every shot */}
      <LightLeak />
    </AbsoluteFill>
  )
}

// ---- bold kinetic headline — heavy uppercase, punches in on the beat, with a
// gold or blue key phrase. slight upward angle energy. one consistent system.
const Kinetic: React.FC<{ pre?: string; hot?: string; post?: string; color?: string; size?: number; hold: number; kicker?: string }> =
({ pre = '', hot = '', post = '', color = GOLD, size = 96, hold, kicker }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 220 } })
  const outA = Math.max(10, hold - 8), outB = Math.max(outA + 1, hold)
  const o = interpolate(frame, [0, 6, outA, outB], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const kO = interpolate(frame, [2, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: o, transform: `scale(${0.86 + pop * 0.14})`, textAlign: 'center', maxWidth: 1560, padding: '0 80px' }}>
        {kicker && <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 26, letterSpacing: '0.32em', textTransform: 'uppercase', color: GOLD, marginBottom: 22, opacity: kO }}>{kicker}</div>}
        <div style={{ fontFamily: BLACK, fontSize: size, lineHeight: 0.98, textTransform: 'uppercase', color: WHITE, letterSpacing: '-0.01em', textShadow: '0 6px 34px rgba(0,0,0,0.55)' }}>
          {pre}{hot && <span style={{ color }}>{hot}</span>}{post}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// diagonal blue/gold energy sweep — motion accent between cuts
const Sweep: React.FC<{ color?: string }> = ({ color = BLUE }) => {
  const frame = useCurrentFrame()
  const x = interpolate(frame, [0, 12], [-120, 120], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const o = interpolate(frame, [0, 4, 12], [0, 0.5, 0], { extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ pointerEvents: 'none', opacity: o, mixBlendMode: 'screen' }}>
    <div style={{ position: 'absolute', top: 0, left: `${x}%`, width: '40%', height: '100%', background: `linear-gradient(105deg, transparent, ${color}, transparent)`, transform: 'skewX(-12deg)', filter: 'blur(8px)' }} />
  </AbsoluteFill>
}

// the APEX logo, revealed boldly — scales + settles with a gold flash on the star
const LogoReveal: React.FC<{ big?: boolean }> = ({ big = false }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 150 } })
  const glow = interpolate(frame, [4, 14, 26], [0, 1, 0.4], { extrapolateRight: 'clamp' })
  const w = big ? 760 : 460
  return (
    <div style={{ transform: `scale(${0.7 + pop * 0.3})`, filter: `drop-shadow(0 0 ${20 * glow}px ${GOLD}) drop-shadow(0 8px 24px rgba(0,0,0,0.5))` }}>
      <Img src={staticFile('apex/logo-white.png')} style={{ width: w, height: 'auto', display: 'block' }} />
    </div>
  )
}

// small persistent corner logo bug
const LogoBug: React.FC = () => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [8, 20], [0, 0.82], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <div style={{ position: 'absolute', top: 44, left: 56, opacity: o }}>
    <Img src={staticFile('apex/logo-white.png')} style={{ width: 148, height: 'auto' }} />
  </div>
}

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode; bug?: boolean }

// NEW gap-filling structure — every product explained on its own beat.
// VO durations: 1:2.74 2:1.63 3:6.04 4:6.36 5:10.40 6:6.27 7:7.01 8:3.72 9:3.72
const BEATS: Beat[] = [
  // 1 — the setup
  { dur: s(2.74 + 0.2), vo: 'ax-1', el: <><Shot src="success.png" dur={s(3.0)} kb={1.13} />
      <Kinetic pre="Most companies make you " hot="pick a lane." color={GOLD} size={84} hold={s(2.74 + 0.2)} /></> },
  // 2 — THE HOOK + logo hit (full name "Apex Affinity Group built two" = 2.37s)
  { dur: s(2.37 + 0.8), vo: 'ax-2', el: <ApexBuiltTwo hold={s(2.37 + 0.8)} /> },
  // 3 — the two paths
  { dur: s(6.04 + 0.2), vo: 'ax-3', bug: true, el: <TwoPaths hold={s(6.04 + 0.2)} /> },
  // 4 — the differentiator
  { dur: s(6.36 + 0.2), vo: 'ax-4', bug: true, el: <><Shot src="agent-win.png" dur={s(6.6)} kb={1.13} />
      <Kinetic kicker="THE ONLY ONE OF ITS KIND" pre="An AI tech stack built to help you " hot="win more clients." color={GOLD} size={64} hold={s(6.36 + 0.2)} /></> },
  // 5 — SMARTVIEWZ explained (what it is + why it matters)
  { dur: s(10.40 + 0.2), vo: 'ax-5', bug: true, el: <ProductBeat hold={s(10.40 + 0.2)}
      name="SmartViewz" color={GOLD} img="ai-tech.png" focus="55% 42%"
      what="AI software that runs your whole insurance business" how="Ask your entire book of business anything — answers in seconds." /> },
  // 6 — DOCS2VIDEO explained
  { dur: s(6.27 + 0.2), vo: 'ax-6', bug: true, el: <ProductBeat hold={s(6.27 + 0.2)}
      name="Docs2Video" color={BLUE_HI} img="docs2video.png" focus="50% 45%"
      what="Turns any document into a branded video" how="A video that sells for you — 24/7." /> },
  // 7 — proof stats + carriers (now enlarged)
  { dur: s(7.01 + 0.2), vo: 'ax-7', bug: true, el: <Proof hold={s(7.01 + 0.2)} /> },
  // 8 — the rallying line
  { dur: s(3.72 + 0.3), vo: 'ax-8', el: <><Shot src="handshake.png" dur={s(4.1)} kb={1.13} />
      <Kinetic pre="Two paths. One opportunity. " hot="Room for everyone." color={BLUE_HI} size={68} hold={s(3.72 + 0.3)} /></> },
  // 9 — logo + centered CTA
  { dur: s(3.72 + 1.8), vo: 'ax-9', el: <CTACard hold={s(3.72 + 1.8)} /> },
]

// a product explained on its own beat — big name, WHAT it is, HOW it helps.
function ProductBeat({ hold, name, color, img, focus, what, how }: { hold: number; name: string; color: string; img: string; focus: string; what: string; how: string }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 190 } })
  const whatO = interpolate(frame, [14, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const whatY = interpolate(frame, [14, 28], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const howO = interpolate(frame, [34, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const howY = interpolate(frame, [34, 48], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Shot src={img} dur={hold} kb={1.12} focus={focus} />
      <AbsoluteFill style={{ background: `linear-gradient(90deg, ${NAVY}f0 0%, ${NAVY}cc 42%, transparent 78%)` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-start', flexDirection: 'column', paddingLeft: 120, maxWidth: 1150 }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24, letterSpacing: '0.3em', textTransform: 'uppercase', color, marginBottom: 14, opacity: clamp((frame - 4) / 8, 0, 1) }}>Your AI Advantage</div>
        <div style={{ fontFamily: BLACK, fontSize: 118, color: WHITE, textTransform: 'uppercase', lineHeight: 0.95, transform: `scale(${0.8 + pop * 0.2})`, transformOrigin: 'left', textShadow: `0 0 40px ${color}66` }}>{name}</div>
        <div style={{ width: 130, height: 4, background: color, margin: '22px 0', boxShadow: `0 0 16px ${color}`, transform: `scaleX(${clamp((frame - 8) / 12, 0, 1)})`, transformOrigin: 'left' }} />
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 42, color: WHITE, opacity: whatO, transform: `translateY(${whatY}px)`, lineHeight: 1.1 }}>{what}</div>
        <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 32, color: ICE, opacity: howO, transform: `translateY(${howY}px)`, marginTop: 16, lineHeight: 1.2 }}>{how}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function ApexBuiltTwo({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 200 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${NAVY2}, ${NAVY})` }}>
      <Rays />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
        <div style={{ transform: `scale(${0.7 + pop * 0.3})` }}><LogoReveal /></div>
        <div style={{ fontFamily: BLACK, fontSize: 128, textTransform: 'uppercase', color: WHITE, opacity: clamp((frame - 10) / 8, 0, 1), textShadow: `0 0 40px ${BLUE}66` }}>
          Built <span style={{ color: GOLD }}>Two.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function TwoPaths({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const lIn = interpolate(frame, [4, 18], [-100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const rIn = interpolate(frame, [10, 24], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const orO = interpolate(frame, [24, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const bothO = interpolate(frame, [hold - 40, hold - 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const Path = ({ label, sub, color, tx }: any) => (
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', transform: `translateX(${tx}px)`, gap: 8 }}>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24, letterSpacing: '0.3em', color, textTransform: 'uppercase' }}>{sub}</div>
      <div style={{ fontFamily: BLACK, fontSize: 92, color: WHITE, textTransform: 'uppercase', textShadow: `0 0 34px ${color}55` }}>{label}</div>
    </div>
  )
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY2})` }}>
      <Rays />
      <AbsoluteFill style={{ flexDirection: 'row' }}>
        <Path label="Insurance" sub="Path One" color={GOLD} tx={lIn} />
        <div style={{ width: 3, height: '54%', alignSelf: 'center', background: `linear-gradient(180deg, transparent, ${BLUE}, transparent)`, boxShadow: `0 0 20px ${BLUE}` }} />
        <Path label="AI Tools" sub="Path Two" color={BLUE_HI} tx={rIn} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: BLACK, fontSize: 46, color: GOLD, opacity: orO, transform: 'translateY(-2px)', textShadow: `0 0 30px ${NAVY}` }}>OR</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90 }}>
        <div style={{ fontFamily: BLACK, fontSize: 60, color: WHITE, textTransform: 'uppercase', opacity: bothO }}>…or <span style={{ color: GOLD }}>both.</span></div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function Products({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const items = [
    ['SmartViewz', 'Ask your entire book of business — anything.', GOLD],
    ['Docs2Video', 'Turn any document into a video that sells.', BLUE_HI],
  ]
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Shot src="ai-tech.png" dur={hold} kb={1.1} focus="60% 40%" />
      <AbsoluteFill style={{ background: `${NAVY}c8` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 40 }}>
        {items.map(([name, desc, color], i) => {
          const at = 10 + i * 24
          const o = interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          const x = interpolate(frame, [at, at + 14], [-60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          return (
            <div key={i} style={{ opacity: o, transform: `translateX(${x}px)`, textAlign: 'center' }}>
              <div style={{ fontFamily: BLACK, fontSize: 88, color: color as string, textTransform: 'uppercase', textShadow: `0 0 34px ${color}55` }}>{name}</div>
              <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 34, color: ICE, marginTop: 8 }}>{desc}</div>
            </div>
          )
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function Proof({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  // stats now ANIMATE: count-ups where it makes sense, a filling bar for training
  const stats: { render: (at: number) => React.ReactNode; label: string; color: string; bar?: number }[] = [
    { label: 'Rated Carriers', color: GOLD, render: () => <>A<span style={{ fontSize: 84 }}>+</span></> },
    { label: 'To Start', color: BLUE_HI, render: (at) => <>$<CountUp to={0} startAt={at} dur={1} /></> },
    { label: 'Training', color: GOLD, bar: 100, render: (at) => <><CountUp to={100} startAt={at} dur={24} />%</> },
    { label: 'No Cap', color: BLUE_HI, render: () => <>∞</> },
  ]
  const carriers = ['moo', 'nlg', 'corebridge', 'north-american', 'columbus', 'fg']
  const labelO = interpolate(frame, [hold - 74, hold - 62], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${NAVY2}, ${NAVY})` }}>
      <Rays />
      <LightLeak />
      <Bokeh color={GOLD} count={8} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 46 }}>
        <div style={{ display: 'flex', gap: 76, alignItems: 'flex-start' }}>
          {stats.map((st, i) => {
            const at = 6 + i * 8
            const pop = interpolate(frame, [at, at + 10], [0.5, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) })
            const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            return (
              <div key={i} style={{ textAlign: 'center', opacity: o, transform: `scale(${pop})`, minWidth: 240 }}>
                <div style={{ fontFamily: BLACK, fontSize: 112, color: st.color, textShadow: `0 0 34px ${st.color}55`, lineHeight: 1 }}>{st.render(at)}</div>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24, color: WHITE, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 10 }}>{st.label}</div>
                {st.bar !== undefined && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}><Bar pct={st.bar} startAt={at} color={st.color} w={200} h={10} /></div>}
              </div>
            )
          })}
        </div>
        {/* carrier trust wall — ENLARGED, staggered spotlight scale-in on bigger chips */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 22, letterSpacing: '0.34em', textTransform: 'uppercase', color: GOLD, opacity: labelO }}>Write For Carriers Your Clients Trust</div>
          <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
            {carriers.map((c, i) => {
              const at = hold - 62 + i * 6
              const pop = interpolate(frame, [at, at + 10], [0.4, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) })
              const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
              // moving highlight sweeps across the featured logo
              const featured = Math.floor((frame / 10) % carriers.length) === i
              return (
                <div key={i} style={{ background: WHITE, borderRadius: 10, padding: '22px 30px', height: 96, display: 'flex', alignItems: 'center', opacity: o, transform: `scale(${pop * (featured ? 1.08 : 1)})`, boxShadow: featured ? `0 0 26px ${GOLD}, 0 6px 20px rgba(0,0,0,0.4)` : '0 6px 20px rgba(0,0,0,0.35)', transition: 'none' }}>
                  <Img src={staticFile(`apex/carriers/${c}.png`)} style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
                </div>
              )
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function CTACard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const logoUp = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 130 } })
  const cta = interpolate(frame, [26, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const btn = spring({ frame: frame - 44, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [62, 74], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  // gentle button pulse to draw the eye
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 130% at 50% 42%, ${NAVY2}, ${NAVY})` }}>
      <Rays />
      <LightLeak />
      {/* everything on ONE centered column axis */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 0 }}>
        <div style={{ transform: `scale(${0.62 + logoUp * 0.38})`, filter: `drop-shadow(0 0 34px ${GOLD}66)`, display: 'flex', justifyContent: 'center' }}>
          <Img src={staticFile('apex/logo-white.png')} style={{ width: 700, height: 'auto', display: 'block' }} />
        </div>
        <div style={{ fontFamily: BLACK, fontSize: 56, color: GOLD, textTransform: 'uppercase', marginTop: 24, opacity: cta, textShadow: `0 0 30px ${GOLD}44`, textAlign: 'center' }}>Reach Your Apex.</div>
        {/* centered button, alone on its line */}
        <div style={{ marginTop: 40, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${BLUE_HI}, ${BLUE})`, color: WHITE, fontFamily: SANS, fontWeight: 800, fontSize: 34, letterSpacing: '0.08em', padding: '22px 60px', borderRadius: 10, textTransform: 'uppercase', boxShadow: `0 0 30px ${BLUE}88, 0 10px 30px rgba(0,0,0,0.4)`, textAlign: 'center' }}>Get Started — Free</div>
        </div>
        {/* url on its own centered line below the button */}
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 30, color: ICE, letterSpacing: '0.1em', marginTop: 26, opacity: url, textAlign: 'center' }}>reachtheapex.net</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---- animated LIGHT LEAK — warm diagonal streak that drifts + breathes,
// plus a soft lens flare. Adds the organic movement + atmosphere. ----
const LightLeak: React.FC = () => {
  const frame = useCurrentFrame()
  const x = 20 + Math.sin(frame * 0.02) * 12
  const o1 = 0.1 + Math.sin(frame * 0.03) * 0.05
  const o2 = 0.08 + Math.cos(frame * 0.025) * 0.04
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', left: `${x}%`, width: '30%', height: '140%', background: `linear-gradient(110deg, transparent, ${GOLD}, transparent)`, transform: 'skewX(-14deg)', filter: 'blur(50px)', opacity: o1 }} />
      <div style={{ position: 'absolute', top: '-10%', right: '8%', width: '26%', height: '130%', background: `linear-gradient(70deg, transparent, ${BLUE_HI}, transparent)`, transform: 'skewX(12deg)', filter: 'blur(56px)', opacity: o2 }} />
      {/* soft top-right lens flare */}
      <div style={{ position: 'absolute', top: '8%', right: '12%', width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${GOLD}55, transparent 65%)`, filter: 'blur(10px)', opacity: 0.5 + Math.sin(frame * 0.05) * 0.2 }} />
    </AbsoluteFill>
  )
}

// upbeat light rays / bokeh energy behind the graphic beats
const Rays: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: 14 }, (_, i) => {
        const r = ((i * 9301 + 49297) % 233280) / 233280
        const x = r * 100, y = (((i * 4021) % 233280) / 233280) * 100
        const drift = Math.sin(frame * 0.03 + i) * 8
        const size = 4 + r * 10
        return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${(y + drift + 100) % 100}%`, width: size, height: size, borderRadius: '50%', background: i % 3 === 0 ? GOLD : BLUE_HI, opacity: 0.14 + Math.abs(Math.sin(frame * 0.04 + i)) * 0.14, filter: 'blur(2px)' }} />
      })}
    </AbsoluteFill>
  )
}

// EPIC INTRO — Apex is a bold, upbeat recruitment brand → 'ignition' (light-burst
// explosion). Prepended; all beats offset by INTRO frames.
const INTRO = Math.round(2.8 * FPS)
const INTRO_STYLE = pickIntro('bold')

// ---- beat-lock to the 120 BPM grid (beat every 0.5s), offset by the intro ----
const rawStarts: number[] = []; { let t = INTRO; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const B_STARTS = beatLock(rawStarts, gridToFrames((apexGrid as any).beats, FPS).filter((g) => g >= INTRO), Math.round(0.22 * FPS))
export const apexDuration = B_STARTS[B_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const CommercialApex: React.FC = () => {
  const starts = B_STARTS
  const durs = durationsFromStarts(starts, apexDuration - 6)
  const total = apexDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.18, duck: 0.07, ramp: 18, fadeInEnd: 14 })   // bed well under the VO

  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {/* the epic cinematic intro — light-burst reveal of the Apex logo */}
      <Sequence from={0} durationInFrames={INTRO + 2}>
        <Intro style={INTRO_STYLE} dur={INTRO} tokens={{ bg: NAVY, bg2: NAVY2, accent: GOLD, accentHi: '#ff5268', particle: GOLD }}
          render={<Img src={staticFile('apex/logo-white.png')} style={{ width: 640, height: 'auto', display: 'block' }} />} />
      </Sequence>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el}
          {b.bug && <LogoBug />}
          {/* A-grade: a bright light-STREAK wipe covers each beat cut (on the beat) */}
          {i > 0 && <StreakWipe color={i % 2 ? GOLD : BLUE_HI} dir={i % 2 ? 1 : -1} dur={13} />}
          <Sweep color={i % 2 ? GOLD : BLUE} />
        </Sequence>
      ))}
      {/* HERO MOMENT — an impact burst on the "Apex built two" logo hit (beat 1) */}
      <Sequence from={starts[1] + 2} durationInFrames={30}><HeroFlash color={GOLD} at={0} /></Sequence>
      <MusicBed src="apex/music.mp3" musicFrames={1650} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`apex/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
      {/* sound design — punchy whooshes on cuts, impacts on the hits */}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.28} /></Sequence>
      ))}
      <Sequence from={starts[1]} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.4} /></Sequence>
      <Sequence from={starts[7] + 2} durationInFrames={40}><Audio src={staticFile('sfx/impact.wav')} volume={0.44} /></Sequence>
    </AbsoluteFill>
  )
}
