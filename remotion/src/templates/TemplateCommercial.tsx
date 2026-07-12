import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { z } from 'zod'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { loadFont as loadBaloo } from '@remotion/google-fonts/Baloo2'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import { CountUp, StreakWipe, Bokeh, Alive, sustained, SettleSweep, LogoBug } from '../lib/pizzazz'
import { makeMusicDuck, type VoWindow } from '../lib/audio'
import { MusicBed } from '../lib/musicbed'
import { Intro, type IntroStyle } from '../lib/intros'

const { fontFamily: GROTESK } = loadSpaceGrotesk()
const { fontFamily: INTER } = loadInter()
const { fontFamily: MONO } = loadJetBrains()
const { fontFamily: FRAUNCES } = loadFraunces()
const { fontFamily: ARCHIVO } = loadArchivoBlack()
const { fontFamily: BALOO } = loadBaloo()
const { fontFamily: PLAYFAIR } = loadPlayfair()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30
const s = (sec: number) => Math.round(sec * FPS)

/* ============================================================================
 * TemplateCommercial — the SPEC-DRIVEN engine. ONE composition renders ANY of the
 * styles we built, for ANY brand, from props: a `styleId` picks the visual
 * language (fonts / intro / motion feel / display treatment), `brand` gives the
 * palette + logo, and `beats[]` (a rich kind-vocabulary) drives the content.
 * The director outputs this props JSON; the VPS renders it.
 * ==========================================================================*/

// ---- STYLE PRESETS: each styleId maps to fonts, intro, and display feel ----
type StyleId = 'fintech' | 'luxury' | 'tech' | 'upbeat' | 'emerald' | 'redblueprint' | 'data' | 'playful' | 'casino' | 'clean'
type StylePreset = { display: string; body: string; mono: string; intro: IntroStyle; upper: boolean; heavy: boolean }
const STYLES: Record<StyleId, StylePreset> = {
  fintech:      { display: GROTESK, body: INTER, mono: MONO, intro: 'terminal',  upper: false, heavy: true },
  luxury:       { display: FRAUNCES, body: INTER, mono: MONO, intro: 'signature', upper: false, heavy: false },
  tech:         { display: GROTESK, body: INTER, mono: MONO, intro: 'assembly',  upper: false, heavy: true },
  upbeat:       { display: ARCHIVO, body: INTER, mono: MONO, intro: 'ignition',  upper: true,  heavy: true },
  emerald:      { display: GROTESK, body: INTER, mono: MONO, intro: 'terminal',  upper: false, heavy: true },
  redblueprint: { display: GROTESK, body: INTER, mono: MONO, intro: 'assembly',  upper: false, heavy: true },
  data:         { display: GROTESK, body: INTER, mono: MONO, intro: 'terminal',  upper: false, heavy: true },
  playful:      { display: BALOO,   body: INTER, mono: MONO, intro: 'pop',       upper: false, heavy: true },
  casino:       { display: ARCHIVO, body: PLAYFAIR, mono: MONO, intro: 'ignition', upper: true, heavy: true },
  clean:        { display: GROTESK, body: INTER, mono: MONO, intro: 'signature', upper: false, heavy: false },
}

// ---- PROPS SCHEMA ----
export const commercialSchema = z.object({
  styleId: z.enum(['fintech', 'luxury', 'tech', 'upbeat', 'emerald', 'redblueprint', 'data', 'playful', 'casino', 'clean']),
  brand: z.object({
    bg: z.string(), bg2: z.string(), panel: z.string(),
    accent: z.string(), accentHi: z.string(), accent2: z.string().optional(),
    cream: z.string(), mute: z.string(), white: z.string(),
  }),
  logo: z.string().optional(),                 // logo image path (in assetDir), else wordmark text
  wordmark: z.object({ pre: z.string(), post: z.string() }).optional(),
  logoLetter: z.string().optional(),
  assetDir: z.string(),
  music: z.object({ file: z.string(), frames: z.number() }),
  introFrames: z.number().default(90),
  duck: z.object({ loud: z.number(), duck: z.number() }).default({ loud: 0.2, duck: 0.08 }),
  bug: z.boolean().default(true),
  beats: z.array(z.object({
    dur: z.number(), vo: z.string().optional(),
    kind: z.enum(['shot', 'meet', 'stats', 'grid', 'chat', 'quote', 'split', 'cta', 'brand']),
    img: z.string().optional(), dim: z.number().optional(),
    kicker: z.string().optional(), pre: z.string().optional(), hot: z.string().optional(), post: z.string().optional(), sub: z.string().optional(),
    size: z.number().optional(),
    stats: z.array(z.object({ value: z.number(), prefix: z.string().optional(), suffix: z.string().optional(), label: z.string(), decimals: z.number().optional() })).optional(),
    items: z.array(z.object({ icon: z.string().optional(), title: z.string(), desc: z.string().optional() })).optional(),
    chat: z.object({ q: z.string(), a: z.string() }).optional(),
    split: z.object({ leftLabel: z.string(), leftSub: z.string(), rightLabel: z.string(), rightSub: z.string(), both: z.string().optional() }).optional(),
    cta: z.object({ headline: z.string(), button: z.string(), url: z.string() }).optional(),
  })),
})
export type CommercialProps = z.infer<typeof commercialSchema>

export function commercialDuration(p: CommercialProps): number {
  let t = p.introFrames
  for (const b of p.beats) t += s(b.dur)
  return t + 6
}

// ================= shared pieces (read style + brand) =======================
const Ctx = React.createContext<{ p: CommercialProps; st: StylePreset }>(null as any)
const use = () => React.useContext(Ctx)

const Wordmark: React.FC<{ size?: number }> = ({ size = 90 }) => {
  const { p, st } = use(); const b = p.brand
  if (p.logo) return <Img src={staticFile(`${p.assetDir}/${p.logo}`)} style={{ width: size * 4.5, height: 'auto', display: 'block', filter: `drop-shadow(0 0 20px ${b.accent}44)` }} />
  const wm = p.wordmark || { pre: 'Brand', post: '' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      {p.logoLetter && <div style={{ width: size, height: size, borderRadius: size * 0.19, background: `linear-gradient(135deg, ${b.accentHi}, ${b.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: st.display, fontWeight: 700, fontSize: size * 0.6, color: b.bg }}>{p.logoLetter}</div>}
      <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 500, fontSize: size * 0.8, letterSpacing: '-0.01em', color: b.white, textTransform: st.upper ? 'uppercase' : 'none' }}>{wm.pre}<span style={{ color: b.accent }}>{wm.post}</span></div>
    </div>
  )
}

const Shot: React.FC<{ src: string; dur: number; dim?: number }> = ({ src, dur, dim = 1 }) => {
  const { p } = use(); const frame = useCurrentFrame(); const b = p.brand
  const prog = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: b.bg }}>
      <Img src={staticFile(`${p.assetDir}/${src}`)} style={{ width: '114%', height: '114%', position: 'absolute', left: '-7%', top: '-7%', objectFit: 'cover', transform: `scale(${1.04 + 0.1 * prog}) translate(${-1.2 * prog}%, ${0.6 * prog}%)`, filter: `brightness(${0.82 * dim}) contrast(1.1) saturate(1.04)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${b.bg}88, transparent 28%, transparent 55%, ${b.bg}f2)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(70% 70% at 78% 18%, ${b.accent}16, transparent 45%)`, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  )
}

const Head: React.FC<{ kicker?: string; pre?: string; hot?: string; post?: string; sub?: string; hold: number; size?: number }> =
({ kicker, pre = '', hot = '', post = '', sub, hold, size = 64 }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  const o = interpolate(frame, [0, 8, hold - 10, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 14], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const rule = clamp((frame - 8) / 14, 0, 1)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: st.mono, fontWeight: 600, fontSize: 20, letterSpacing: '0.28em', textTransform: 'uppercase', color: b.accent, marginBottom: 18 }}>{kicker}</div>}
        <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 500, fontSize: size, color: b.cream, lineHeight: st.upper ? 1.0 : 1.14, paddingBottom: '0.04em', letterSpacing: '-0.01em', textTransform: st.upper ? 'uppercase' : 'none', textShadow: '0 4px 30px rgba(0,0,0,0.9)' }}>
          {pre}{hot && <span style={{ color: b.accentHi, textShadow: `0 0 22px ${b.accent}55` }}>{hot}</span>}{post}
        </div>
        {sub && <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: size * 0.4, color: b.mute, marginTop: 14 }}>{sub}</div>}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}><div style={{ width: 130 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, boxShadow: `0 0 12px ${b.accent}` }} /></div>
      </div>
    </AbsoluteFill>
  )
}

// ---- beat renderers ----
const MeetBeat: React.FC<{ hold: number; sub?: string }> = ({ hold, sub }) => {
  const { p } = use(); const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = p.brand
  const pop = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 140 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
        <div style={{ transform: `scale(${0.72 + clamp(pop, 0, 1) * 0.28})` }}><Wordmark size={100} /></div>
        {sub && <div style={{ fontFamily: use().st.body, fontWeight: 500, fontSize: 34, color: b.mute, opacity: clamp((frame - 14) / 8, 0, 1) }}>{sub}</div>}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const StatsBeat: React.FC<{ hold: number; stats: NonNullable<CommercialProps['beats'][number]['stats']>; kicker?: string; pre?: string; hot?: string }> =
({ hold, stats, kicker, pre, hot }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 30%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 76 }}>
          {stats.map((sc, i) => {
            const at = 6 + i * 8
            const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 190 } })
            return (
              <div key={i} style={{ textAlign: 'center', transform: `scale(${clamp(pop, 0, 1)})` }}>
                <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 128, color: i % 2 ? (b.accent2 || b.accentHi) : b.accentHi, lineHeight: 1.15, paddingBottom: '0.04em', textShadow: `0 0 30px ${b.accent}44` }}>
                  <CountUp to={sc.value} prefix={sc.prefix || ''} suffix={sc.suffix || ''} decimals={sc.decimals} startAt={at} dur={22} />
                </div>
                <div style={{ fontFamily: st.body, fontWeight: 600, fontSize: 24, color: b.mute, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6 }}>{sc.label}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      <Head kicker={kicker} pre={pre} hot={hot} hold={hold} size={46} />
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

const GridBeat: React.FC<{ hold: number; items: NonNullable<CommercialProps['beats'][number]['items']>; kicker?: string; hot?: string }> =
({ hold, items, kicker, hot }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 36%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: items.length > 3 ? '1fr 1fr' : '1fr', gap: 22 }}>
            {items.map((it, i) => {
              const at = sustained(i, items.length, hold, 8)
              const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 190 } })
              return (
                <div key={i} style={{ transform: `scale(${clamp(pop, 0, 1)})`, background: b.panel, border: `1px solid ${b.accent}44`, borderRadius: 16, padding: '24px 40px', display: 'flex', alignItems: 'center', gap: 20, width: 560 }}>
                  {it.icon && <div style={{ fontSize: 50 }}>{it.icon}</div>}
                  <div>
                    <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 38, color: b.white }}>{it.title}</div>
                    {it.desc && <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: 22, color: b.mute, marginTop: 4 }}>{it.desc}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </AbsoluteFill>
      </Alive>
      {(kicker || hot) && <Head kicker={kicker} hot={hot} hold={hold} size={44} />}
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

const ChatBeat: React.FC<{ hold: number; chat: { q: string; a: string } }> = ({ hold, chat }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  const qS = Math.floor(clamp((frame - 6) / 20, 0, 1) * chat.q.length)
  const aS = Math.floor(clamp((frame - 34) / 40, 0, 1) * chat.a.length)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${b.bg2}, ${b.bg})` }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontFamily: st.mono, fontSize: 19, letterSpacing: '0.24em', textTransform: 'uppercase', color: b.accent, marginBottom: 12 }}>{'// Ask anything'}</div>
        <div style={{ background: b.panel, border: `1px solid ${b.mute}44`, borderRadius: 14, padding: 24, width: 1000, alignSelf: 'flex-end', marginRight: '18%' }}>
          <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: 30, color: b.cream }}>{chat.q.slice(0, qS)}{qS < chat.q.length && frame < 30 ? '▋' : ''}</div>
        </div>
        {frame > 32 && (
          <div style={{ background: b.panel, border: `1px solid ${b.accent}44`, borderRadius: 14, padding: 24, width: 1000, alignSelf: 'flex-start', marginLeft: '18%', boxShadow: `0 0 26px ${b.accent}18` }}>
            <div style={{ fontFamily: st.body, fontWeight: 500, fontSize: 30, color: b.cream, lineHeight: 1.35 }}>{chat.a.slice(0, aS)}{aS < chat.a.length ? '▋' : ''}</div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const QuoteBeat: React.FC<{ hold: number; pre?: string; hot?: string; post?: string; sub?: string; size?: number }> = ({ hold, pre, hot, post, sub, size = 78 }) => {
  const { p, st } = use(); const b = p.brand
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big />
      <Alive intensity={0.5}><AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 140px' }}>
        <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, fontSize: size, color: b.cream, textAlign: 'center', lineHeight: 1.12, paddingBottom: '0.04em', textTransform: st.upper ? 'uppercase' : 'none' }}>
          {pre}{hot && <span style={{ color: b.accentHi }}>{hot}</span>}{post}
        </div>
      </AbsoluteFill></Alive>
    </AbsoluteFill>
  )
}

const SplitBeat: React.FC<{ hold: number; split: NonNullable<CommercialProps['beats'][number]['split']> }> = ({ hold, split }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const b = p.brand
  const lIn = interpolate(frame, [4, 18], [-100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const rIn = interpolate(frame, [10, 24], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const bothO = split.both ? interpolate(frame, [hold - 40, hold - 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
  const Side = ({ label, sub, color, tx }: any) => (
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', transform: `translateX(${tx}px)`, gap: 8 }}>
      <div style={{ fontFamily: st.body, fontWeight: 800, fontSize: 24, letterSpacing: '0.3em', color, textTransform: 'uppercase' }}>{sub}</div>
      <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 92, color: b.white, textTransform: 'uppercase', textShadow: `0 0 34px ${color}55` }}>{label}</div>
    </div>
  )
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${b.bg}, ${b.bg2})` }}>
      <AbsoluteFill style={{ flexDirection: 'row' }}>
        <Side label={split.leftLabel} sub={split.leftSub} color={b.accentHi} tx={lIn} />
        <div style={{ width: 3, height: '54%', alignSelf: 'center', background: `linear-gradient(180deg, transparent, ${b.accent}, transparent)`, boxShadow: `0 0 20px ${b.accent}` }} />
        <Side label={split.rightLabel} sub={split.rightSub} color={b.accent2 || b.accentHi} tx={rIn} />
      </AbsoluteFill>
      {split.both && <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90 }}>
        <div style={{ fontFamily: st.display, fontWeight: 700, fontSize: 60, color: b.white, textTransform: 'uppercase', opacity: bothO }}>{split.both}</div>
      </AbsoluteFill>}
    </AbsoluteFill>
  )
}

const CTABeat: React.FC<{ hold: number; cta: { headline: string; button: string; url: string } }> = ({ hold, cta }) => {
  const { p, st } = use(); const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = p.brand
  const up = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 130 } })
  const line = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const btn = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [58, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${0.74 + clamp(up, 0, 1) * 0.26})` }}><Wordmark size={104} /></div>
        <div style={{ width: 380 * line, height: 2, background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, marginTop: 28, boxShadow: `0 0 14px ${b.accent}` }} />
        <div style={{ fontFamily: st.display, fontWeight: st.heavy ? 700 : 600, fontSize: 52, color: b.cream, marginTop: 26, textAlign: 'center', opacity: clamp(line, 0, 1), textTransform: st.upper ? 'uppercase' : 'none' }}>{cta.headline}</div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${b.accentHi}, ${b.accent})`, color: b.bg, fontFamily: st.display, fontWeight: 700, fontSize: 32, padding: '20px 54px', borderRadius: 12, boxShadow: `0 0 30px ${b.accent}66`, textTransform: st.upper ? 'uppercase' : 'none' }}>{cta.button}</div>
        </div>
        <div style={{ fontFamily: st.mono, fontWeight: 500, fontSize: 26, color: b.mute, letterSpacing: '0.08em', marginTop: 24, opacity: url }}>{cta.url}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const renderBeat = (be: CommercialProps['beats'][number], hold: number) => {
  switch (be.kind) {
    case 'shot': return <><Shot src={be.img || 'chaos.png'} dur={hold} dim={be.dim} /><Head kicker={be.kicker} pre={be.pre} hot={be.hot} post={be.post} sub={be.sub} hold={hold} size={be.size} /></>
    case 'meet': return <MeetBeat hold={hold} sub={be.sub} />
    case 'stats': return <StatsBeat hold={hold} stats={be.stats || []} kicker={be.kicker} pre={be.pre} hot={be.hot} />
    case 'grid': return <GridBeat hold={hold} items={be.items || []} kicker={be.kicker} hot={be.hot} />
    case 'chat': return <ChatBeat hold={hold} chat={be.chat || { q: '', a: '' }} />
    case 'quote': return <QuoteBeat hold={hold} pre={be.pre} hot={be.hot} post={be.post} sub={be.sub} size={be.size} />
    case 'split': return <SplitBeat hold={hold} split={be.split || { leftLabel: '', leftSub: '', rightLabel: '', rightSub: '' }} />
    case 'brand': return <MeetBeat hold={hold} sub={be.sub} />
    case 'cta': return <CTABeat hold={hold} cta={be.cta || { headline: '', button: '', url: '' }} />
  }
}

export const TemplateCommercial: React.FC<CommercialProps> = (p) => {
  const st = STYLES[p.styleId as StyleId]
  const b = p.brand
  const INTRO = p.introFrames
  const starts: number[] = []; { let t = INTRO; for (const be of p.beats) { starts.push(t); t += s(be.dur) } }
  const total = commercialDuration(p)
  const durs = p.beats.map((be) => s(be.dur))
  const voWin = p.beats.map((be, i) => be.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: p.duck.loud, duck: p.duck.duck, ramp: 18, fadeInEnd: 14, fadeOutStart: total - 20, fadeOutEnd: total - 4 })
  return (
    <Ctx.Provider value={{ p, st }}>
      <AbsoluteFill style={{ background: b.bg }}>
        <Sequence from={0} durationInFrames={INTRO + 2}>
          <Intro style={st.intro} dur={INTRO} tokens={{ bg: b.bg, bg2: b.bg2, accent: b.accent, accentHi: b.accentHi }} render={<Wordmark size={120} />} />
        </Sequence>
        {p.beats.map((be, i) => (
          <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
            {renderBeat(be, durs[i])}
            {p.bug && i > 0 && i < p.beats.length - 1 && (p.logo ? <LogoBug src={`${p.assetDir}/${p.logo}`} width={150} /> : <LogoBug name={(p.wordmark?.pre || '') + (p.wordmark?.post || '')} color={b.white} fontFamily={st.display} />)}
            {i > 0 && <StreakWipe color={b.accent} dir={i % 2 ? 1 : -1} dur={12} />}
          </Sequence>
        ))}
        <MusicBed src={`${p.assetDir}/${p.music.file}`} musicFrames={p.music.frames} volume={musicDuck} />
        {p.beats.map((be, i) => be.vo ? (
          <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`${p.assetDir}/${be.vo}.mp3`)} volume={1.0} /></Sequence>
        ) : null)}
      </AbsoluteFill>
    </Ctx.Provider>
  )
}
