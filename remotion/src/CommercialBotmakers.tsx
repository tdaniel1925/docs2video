import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono'
import bmGrid from '../public/botmakers/beatgrid.json'
import { StreakWipe, Bokeh, Alive, sustained, SettleSweep, LogoBug } from './lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'
import { Intro, pickIntro } from './lib/intros'
import { Layer, ParticleLogo, ParticleField, LiquidCounter, GrowBars, ChartRoad, MorphCut } from './lib/dynamics'

const { fontFamily: DISPLAY } = loadSpaceGrotesk()
const { fontFamily: BODY } = loadInter()
const { fontFamily: MONO } = loadJetBrains()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * BOTMAKERS.AI — the ADVANCED-DYNAMICS showcase commercial.
 *   · WHAT: enterprise AI dev firm — "Enterprise AI, Custom Built." Custom
 *     AI-powered software, automation, predictive analytics. Backed by public
 *     BioQuest (BQST). Serves every industry. 50+ projects.
 *   · THEME: build the AI that transforms enterprises. Bold, tech, confident.
 *   · LOOK: electric-green (#03ff00) on dark navy (#033457)/near-black — a matrix/
 *     terminal-meets-premium tech aesthetic. 8th distinct style.
 *   · INTRO: personality=tech → 'assembly' (logo builds from green particles).
 *   · ADVANCED DYNAMICS (the star): ParticleLogo assembly, 3D Parallax push,
 *     LiquidCounter + GrowBars + ChartRoad for the results, ParticleField data-
 *     bits throughout, a MorphCut on the reframe.
 * ==========================================================================*/

const BG = '#050a10', BG2 = '#0a1626', NAVY = '#033457', PANEL = '#0d1a2e', LINE = '#15304a'
const GREEN = '#03ff00', GREEN_HI = '#7dff7a', GREEN_DEEP = '#00b800'
const WHITE = '#f0f5f2', MUTE = '#8a9bb0', CYAN = '#22d3ee'

const Logo: React.FC<{ w?: number }> = ({ w = 520 }) => (
  <Img src={staticFile('botmakers/logo.png')} style={{ width: w, height: 'auto', display: 'block', filter: `drop-shadow(0 0 24px ${GREEN}44)` }} />
)

const Shot: React.FC<{ src: string; dur: number; focus?: string; kb?: number; dim?: number }> =
({ src, dur, focus = '50% 45%', kb = 1.13, dim = 1 }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = 1.04 + (kb - 1) * p
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: BG }}>
      <Img src={staticFile(`botmakers/gen/${src}`)} style={{ width: '114%', height: '114%', position: 'absolute', left: '-7%', top: '-7%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc}) translate(${-1.2 * p}%, ${0.6 * p}%)`, filter: `brightness(${0.8 * dim}) contrast(1.12) saturate(1.06)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG}88, transparent 28%, transparent 55%, ${BG}f2)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(95% 95% at 50% 40%, transparent 45%, ${BG}dd)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(70% 70% at 78% 18%, ${GREEN}14, transparent 45%)`, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  )
}

const Head: React.FC<{ pre?: string; hot?: string; post?: string; size?: number; hold: number; kicker?: string }> =
({ pre = '', hot = '', post = '', size = 66, hold, kicker }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 8, hold - 10, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 14], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const kO = interpolate(frame, [2, 10], [0, 1], { extrapolateRight: 'clamp' })
  const rule = clamp((frame - 8) / 14, 0, 1)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 19, letterSpacing: '0.28em', textTransform: 'uppercase', color: GREEN, marginBottom: 18, opacity: kO }}>{'> '}{kicker}</div>}
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size, color: WHITE, lineHeight: 1.14, paddingBottom: '0.04em', letterSpacing: '-0.01em', textShadow: '0 4px 30px rgba(0,0,0,0.9)' }}>
          {pre}{hot && <span style={{ color: GREEN_HI, textShadow: `0 0 24px ${GREEN}88` }}>{hot}</span>}{post}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
          <div style={{ width: 130 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`, boxShadow: `0 0 12px ${GREEN}` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode }
// VO: 1:4.92 2:2.55 3:6.97 4:6.87 5:6.04 6:7.57 7:5.25 8:4.55 9:1.67
const BEATS: Beat[] = [
  // 1 — the problem (chaos) + data-bits
  { dur: s(4.92 + 0.2), vo: 'bm-1', el: <><Shot src="chaos.png" dur={s(5.12)} kb={1.14} dim={0.9} /><ParticleField color={GREEN} count={20} kind="data" />
      <Head pre="Manual work. Disconnected tools. " hot="Wasted hours." size={58} hold={s(4.92 + 0.2)} /></> },
  // 2 — the reframe (MORPH: chaos → intelligence)
  { dur: s(2.55 + 0.9), vo: 'bm-2', el: <ReframeBeat hold={s(2.55 + 0.9)} /> },
  // 3 — what we build (the build image + parallax)
  { dur: s(6.97 + 0.2), vo: 'bm-3', el: <BuildBeat hold={s(6.97 + 0.2)} /> },
  // 4 — capabilities
  { dur: s(6.87 + 0.2), vo: 'bm-4', el: <Capabilities hold={s(6.87 + 0.2)} /> },
  // 5 — industries (3D parallax push)
  { dur: s(6.04 + 0.2), vo: 'bm-5', el: <IndustriesBeat hold={s(6.04 + 0.2)} /> },
  // 6 — THE RESULTS — data-as-spectacle hero
  { dur: s(7.57 + 0.2), vo: 'bm-6', el: <ResultsBeat hold={s(7.57 + 0.2)} /> },
  // 7 — backed by a public company (trust)
  { dur: s(5.25 + 0.2), vo: 'bm-7', el: <TrustBeat hold={s(5.25 + 0.2)} /> },
  // 8 — brand
  { dur: s(4.55 + 0.3), vo: 'bm-8', el: <BrandBeat hold={s(4.55 + 0.3)} /> },
  // 9 — CTA
  { dur: s(1.67 + 1.8), vo: 'bm-9', el: <CTACard hold={s(1.67 + 1.8)} /> },
]

function ReframeBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${BG2}, ${BG})` }}>
      <ParticleField color={GREEN} count={26} kind="data" />
      {/* the word "chaos" morphs into "intelligence" */}
      <MorphCut at={8} dur={18}
        from={<div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 92, color: MUTE }}>chaos?</div>}
        to={<div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 100, color: GREEN_HI, textShadow: `0 0 40px ${GREEN}` }}>intelligence.</div>} />
      <Head pre="What if it ran on " size={44} hold={hold} />
    </AbsoluteFill>
  )
}

function BuildBeat({ hold }: { hold: number }) {
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Shot src="build.png" dur={hold} kb={1.14} />
      <ParticleField color={GREEN} count={22} kind="data" speed={1.3} />
      <Head kicker="Custom, full-stack, AI-powered" pre="Software engineered around " hot="your business." size={54} hold={hold} />
    </AbsoluteFill>
  )
}

function Capabilities({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const caps = ['Intelligent Automation', 'Predictive Analytics', 'Full-Stack Systems', 'Enterprise AI']
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 38%, ${BG2}, ${BG})` }}>
      <ParticleField color={GREEN} count={18} kind="data" />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
          {caps.map((c, i) => {
            const at = sustained(i, caps.length, hold, 8)
            const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            const x = interpolate(frame, [at, at + 12], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: o, transform: `translateX(${x}px)`, background: PANEL, border: `1px solid ${GREEN}44`, borderRadius: 12, padding: '18px 40px', width: 900, boxShadow: `0 0 ${Math.abs(Math.sin(frame * 0.08 + i)) * 16}px ${GREEN}22` }}>
                <div style={{ fontFamily: MONO, fontSize: 22, color: GREEN }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 44, color: WHITE }}>{c}</div>
              </div>
            )
          })}
        </AbsoluteFill>
      </Alive>
      <SettleSweep color={GREEN} hold={hold} />
    </AbsoluteFill>
  )
}

function IndustriesBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const inds = ['Corporations', 'SMBs', 'Nonprofits', 'Government', 'Education', 'Athletics', 'Entertainment', 'Law Firms', 'Public Companies']
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      {/* far layer — giant faint word */}
      <Layer depth={0.1}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 420, color: '#0a1420' }}>EVERY</div>
        </AbsoluteFill>
      </Layer>
      <Layer depth={0.5}><ParticleField color={GREEN} count={22} kind="data" /></Layer>
      {/* near layer — the industry chips */}
      <Layer depth={1}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', maxWidth: 1400 }}>
            {inds.map((n, i) => {
              const at = 4 + i * 3
              const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 200 } })
              return <div key={i} style={{ transform: `scale(${clamp(pop, 0, 1)})`, background: PANEL, border: `1px solid ${GREEN}55`, borderRadius: 10, padding: '14px 26px', fontFamily: DISPLAY, fontWeight: 600, fontSize: 32, color: WHITE }}>{n}</div>
            })}
          </div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 56, color: GREEN_HI, marginTop: 20, opacity: clamp((frame - 30) / 10, 0, 1), textShadow: `0 0 30px ${GREEN}` }}>Every industry.</div>
        </AbsoluteFill>
      </Layer>
    </AbsoluteFill>
  )
}

// THE HERO — data as spectacle
function ResultsBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 25%, ${BG2}, ${BG})` }}>
      <ParticleField color={GREEN} count={16} kind="data" />
      <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontSize: 22, letterSpacing: '0.3em', textTransform: 'uppercase', color: GREEN, opacity: clamp((frame - 2) / 8, 0, 1) }}>{'> Results That Speak'}</div>
      {/* top row: liquid counter + two count metrics */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
        <div style={{ display: 'flex', gap: 90, alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'center' }}>
            <LiquidCounter to={50} suffix="+" prefix="" color={GREEN} size={130} startAt={6} dur={24} font={DISPLAY} />
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, color: MUTE, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>Enterprise Projects</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <LiquidCounter to={60} suffix="%" prefix="" color={CYAN} size={130} startAt={16} dur={24} font={DISPLAY} />
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, color: MUTE, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>Cost Reduction</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <LiquidCounter to={3} suffix="x" prefix="" color={GREEN} size={130} startAt={26} dur={20} font={DISPLAY} />
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, color: MUTE, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>Faster To Market</div>
          </div>
        </div>
        {/* growing bars + drawing chart underline the "up and to the right" story */}
        <GrowBars values={[38, 55, 48, 70, 82, 68, 100, 118]} color={GREEN} color2={CYAN} w={860} h={200} startAt={40} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0 }}>
        <ChartRoad points={[20, 32, 28, 46, 58, 50, 74, 88, 82, 112]} color={GREEN} w={1920} h={180} startAt={44} dur={40} />
      </div>
    </AbsoluteFill>
  )
}

function TrustBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const clients = ['d-miller', 'ihost-poker', 'colonial-stock', '3-mark']
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Shot src="enterprise.png" dur={hold} kb={1.1} dim={0.5} />
      <AbsoluteFill style={{ background: `${BG}bb` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24 }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '0.3em', textTransform: 'uppercase', color: GREEN, opacity: clamp((frame - 2) / 8, 0, 1) }}>{'> Backed by a public company'}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 64, color: WHITE, textAlign: 'center', opacity: clamp((frame - 8) / 10, 0, 1) }}>Enterprise stability. <span style={{ color: GREEN_HI }}>Publicly traded.</span></div>
        <div style={{ fontFamily: MONO, fontSize: 28, color: CYAN, letterSpacing: '0.1em', opacity: clamp((frame - 16) / 10, 0, 1) }}>NASDAQ: BQST</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10, opacity: clamp((frame - 26) / 10, 0, 1) }}>
          {clients.map((c, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '12px 18px', height: 60, display: 'flex', alignItems: 'center' }}>
              <Img src={staticFile(`botmakers/client-${c}.png`)} style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function BrandBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  // logo re-assembles from particles here too (callback to the intro)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, ${BG2}, ${BG})` }}>
      <ParticleLogo color={GREEN} count={80} at={2} span={22} mode="in">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <Logo w={560} />
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, color: WHITE }}>Enterprise AI, <span style={{ color: GREEN_HI }}>Custom Built.</span></div>
        </div>
      </ParticleLogo>
    </AbsoluteFill>
  )
}

function CTACard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const btn = spring({ frame: frame - 6, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [28, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.14) * 0.03
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${BG2}, ${BG})` }}>
      <ParticleField color={GREEN} count={20} kind="data" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24 }}>
        <Logo w={440} />
        <div style={{ marginTop: 10, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${GREEN_HI}, ${GREEN_DEEP})`, color: BG, fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, letterSpacing: '0.02em', padding: '20px 58px', borderRadius: 12, boxShadow: `0 0 34px ${GREEN}66`, textAlign: 'center' }}>Start Your Project</div>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 28, color: MUTE, letterSpacing: '0.08em', opacity: url }}>botmakers.ai</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---- intro + shared plumbing ----
const INTRO = Math.round(3.0 * FPS)
const INTRO_STYLE = pickIntro('tech')   // → 'assembly'
const rawStarts: number[] = []; { let t = INTRO; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const B_STARTS = beatLock(rawStarts, gridToFrames((bmGrid as any).beats, FPS).filter((g) => g >= INTRO), Math.round(0.2 * FPS))
export const botmakersDuration = B_STARTS[B_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const CommercialBotmakers: React.FC = () => {
  const starts = B_STARTS
  const durs = durationsFromStarts(starts, botmakersDuration - 6)
  const total = botmakersDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.2, duck: 0.08, ramp: 18, fadeInEnd: 14 })
  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* ASSEMBLY intro — the botmakers logo builds from green particles */}
      <Sequence from={0} durationInFrames={INTRO + 2}>
        <Intro style={INTRO_STYLE} dur={INTRO} tokens={{ bg: BG, bg2: BG2, accent: GREEN, accentHi: GREEN_HI, particle: GREEN }} render={<Logo w={560} />} />
      </Sequence>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el}
          {/* persistent logo bug, upper-left, during the MAIN BODY (skip the brand
              beat #7 and CTA #8 where the full logo is already the hero) */}
          {i < 7 && <LogoBug src="botmakers/logo.png" width={150} />}
          {i > 0 && <StreakWipe color={GREEN} dir={i % 2 ? 1 : -1} dur={12} />}
        </Sequence>
      ))}
      <MusicBed src="botmakers/music.mp3" musicFrames={1319} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`botmakers/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.24} /></Sequence>
      ))}
      <Sequence from={starts[5]} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.38} /></Sequence>
    </AbsoluteFill>
  )
}
