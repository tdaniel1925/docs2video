import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, continueRender, delayRender } from 'remotion'
import { z } from 'zod'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono'
import { CountUp, StreakWipe, Bokeh, Alive, sustained, SettleSweep } from '../lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from '../lib/audio'
import { MusicBed } from '../lib/musicbed'
import { Intro } from '../lib/intros'

const { fontFamily: DISPLAY } = loadSpaceGrotesk()
const { fontFamily: BODY } = loadInter()
const { fontFamily: MONO } = loadJetBrains()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * TemplateFintech — a FULLY PARAMETERIZED fintech-SaaS commercial template. Takes
 * everything as PROPS (brand colors, logo, wordmark, per-beat copy + assets, VO,
 * music, beat-grid) so the SAME composition renders ANY brand from --props. This
 * is the first step toward VPS auto-generation: director outputs the props, the
 * VPS renders this template. No hardcoded brand.
 * ==========================================================================*/

// ---- the props schema (also drives Remotion Studio + validates VPS payloads) ----
export const fintechSchema = z.object({
  brand: z.object({
    bg: z.string(), bg2: z.string(), panel: z.string(),
    accent: z.string(), accentHi: z.string(),
    cyan: z.string().optional(), green: z.string().optional(),
    cream: z.string(), mute: z.string(), white: z.string(),
  }),
  wordmark: z.object({ pre: z.string(), post: z.string() }),   // "Smart" + "Viewz"
  logoLetter: z.string(),                                       // the tile letter e.g. "S"
  assetDir: z.string(),                                         // staticFile subfolder e.g. "smartviewz"
  music: z.object({ file: z.string(), frames: z.number() }),
  beats: z.array(z.object({
    dur: z.number(),                 // seconds
    vo: z.string().optional(),       // vo filename (no ext) e.g. "sv-1"
    kind: z.enum(['shot', 'meet', 'stats', 'chat', 'cta']),
    img: z.string().optional(),      // image filename for 'shot'
    kicker: z.string().optional(),
    pre: z.string().optional(), hot: z.string().optional(), post: z.string().optional(),
    sub: z.string().optional(),
    stats: z.array(z.object({ value: z.number(), prefix: z.string().optional(), suffix: z.string().optional(), label: z.string(), decimals: z.number().optional() })).optional(),
    chat: z.object({ q: z.string(), a: z.string() }).optional(),
    cta: z.object({ headline: z.string(), button: z.string(), url: z.string() }).optional(),
  })),
  introFrames: z.number().default(90),
  duck: z.object({ loud: z.number(), duck: z.number() }).default({ loud: 0.2, duck: 0.08 }),
})
export type FintechProps = z.infer<typeof fintechSchema>

const s = (sec: number) => Math.round(sec * FPS)

// ---- pieces (all read colors from props.brand) ----
const Wordmark: React.FC<{ p: FintechProps; size?: number }> = ({ p, size = 90 }) => {
  const b = p.brand
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ width: size, height: size, borderRadius: size * 0.19, background: `linear-gradient(135deg, ${b.accentHi}, ${b.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.6, color: b.bg, boxShadow: `0 0 30px ${b.accent}55` }}>{p.logoLetter}</div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size * 0.72, letterSpacing: '-0.01em', color: b.white }}>{p.wordmark.pre}<span style={{ color: b.accent }}>{p.wordmark.post}</span></div>
    </div>
  )
}

const Shot: React.FC<{ p: FintechProps; src: string; dur: number; dim?: number }> = ({ p, src, dur, dim = 1 }) => {
  const frame = useCurrentFrame()
  const prog = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = 1.04 + 0.09 * prog
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: p.brand.bg }}>
      <Img src={staticFile(`${p.assetDir}/${src}`)} style={{ width: '114%', height: '114%', position: 'absolute', left: '-7%', top: '-7%', objectFit: 'cover', transform: `scale(${sc}) translate(${-1.2 * prog}%, ${0.6 * prog}%)`, filter: `brightness(${0.82 * dim}) contrast(1.1) saturate(1.02)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${p.brand.bg}88, transparent 28%, transparent 55%, ${p.brand.bg}f2)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(70% 70% at 78% 18%, ${p.brand.accent}16, transparent 45%)`, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  )
}

const Head: React.FC<{ p: FintechProps; kicker?: string; pre?: string; hot?: string; post?: string; sub?: string; hold: number; size?: number }> =
({ p, kicker, pre = '', hot = '', post = '', sub, hold, size = 62 }) => {
  const frame = useCurrentFrame(); const b = p.brand
  const o = interpolate(frame, [0, 8, hold - 10, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 14], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const rule = clamp((frame - 8) / 14, 0, 1)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 19, letterSpacing: '0.28em', textTransform: 'uppercase', color: b.accent, marginBottom: 18 }}>{kicker}</div>}
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: size, color: b.cream, lineHeight: 1.14, paddingBottom: '0.04em', letterSpacing: '-0.01em', textShadow: '0 4px 30px rgba(0,0,0,0.9)' }}>
          {pre}{hot && <span style={{ color: b.accentHi, textShadow: `0 0 22px ${b.accent}55` }}>{hot}</span>}{post}
        </div>
        {sub && <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: size * 0.42, color: b.mute, marginTop: 14 }}>{sub}</div>}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
          <div style={{ width: 130 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, boxShadow: `0 0 12px ${b.accent}` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

const StatsBeat: React.FC<{ p: FintechProps; hold: number; stats: NonNullable<FintechProps['beats'][number]['stats']>; kicker?: string; pre?: string; hot?: string }> =
({ p, hold, stats, kicker, pre, hot }) => {
  const frame = useCurrentFrame(); const b = p.brand
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 30%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={5} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 80 }}>
          {stats.map((st, i) => {
            const at = 6 + i * 8
            const pop = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 190 } })
            return (
              <div key={i} style={{ textAlign: 'center', transform: `scale(${clamp(pop, 0, 1)})` }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 130, color: i % 2 ? (b.cyan || b.accentHi) : b.accentHi, lineHeight: 1.15, paddingBottom: '0.04em', textShadow: `0 0 30px ${b.accent}44` }}>
                  <CountUp to={st.value} prefix={st.prefix || ''} suffix={st.suffix || ''} decimals={st.decimals} startAt={at} dur={22} />
                </div>
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 24, color: b.mute, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 6 }}>{st.label}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      <Head p={p} kicker={kicker} pre={pre} hot={hot} hold={hold} size={48} />
      <SettleSweep color={b.accent} hold={hold} />
    </AbsoluteFill>
  )
}

const ChatBeat: React.FC<{ p: FintechProps; hold: number; chat: { q: string; a: string } }> = ({ p, hold, chat }) => {
  const frame = useCurrentFrame(); const b = p.brand
  const qShown = Math.floor(clamp((frame - 6) / 20, 0, 1) * chat.q.length)
  const aShown = Math.floor(clamp((frame - 34) / 40, 0, 1) * chat.a.length)
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${b.bg2}, ${b.bg})` }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: '0.24em', textTransform: 'uppercase', color: b.accent, marginBottom: 12 }}>{'// Ask anything'}</div>
        <div style={{ background: b.panel, border: `1px solid ${b.mute}44`, borderRadius: 14, padding: 24, width: 1000, alignSelf: 'flex-end', marginRight: '18%' }}>
          <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 30, color: b.cream }}>{chat.q.slice(0, qShown)}{qShown < chat.q.length && frame < 30 ? '▋' : ''}</div>
        </div>
        {frame > 32 && (
          <div style={{ background: b.panel, border: `1px solid ${b.accent}44`, borderRadius: 14, padding: 24, width: 1000, alignSelf: 'flex-start', marginLeft: '18%', boxShadow: `0 0 26px ${b.accent}18` }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: `linear-gradient(135deg, ${b.accentHi}, ${b.accent})`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 700, color: b.bg, fontSize: 22 }}>{p.logoLetter}</div>
              <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 30, color: b.cream, lineHeight: 1.35 }}>{chat.a.slice(0, aShown)}{aShown < chat.a.length ? '▋' : ''}</div>
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const MeetBeat: React.FC<{ p: FintechProps; hold: number; sub?: string }> = ({ p, hold, sub }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = p.brand
  const pop = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 140 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
        <div style={{ transform: `scale(${0.72 + clamp(pop, 0, 1) * 0.28})` }}><Wordmark p={p} size={100} /></div>
        {sub && <div style={{ fontFamily: BODY, fontWeight: 500, fontSize: 34, color: b.mute, opacity: clamp((frame - 14) / 8, 0, 1) }}>{sub}</div>}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const CTABeat: React.FC<{ p: FintechProps; hold: number; cta: { headline: string; button: string; url: string } }> = ({ p, hold, cta }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const b = p.brand
  const up = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 130 } })
  const line = interpolate(frame, [22, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const btn = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [58, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${b.bg2}, ${b.bg})` }}>
      <Bokeh color={b.accent} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${0.74 + clamp(up, 0, 1) * 0.26})` }}><Wordmark p={p} size={104} /></div>
        <div style={{ width: 380 * line, height: 2, background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)`, marginTop: 28, boxShadow: `0 0 14px ${b.accent}` }} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 52, color: b.cream, marginTop: 26, textAlign: 'center', opacity: clamp(line, 0, 1) }}>{cta.headline}</div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${b.accentHi}, ${b.accent})`, color: b.bg, fontFamily: DISPLAY, fontWeight: 700, fontSize: 32, padding: '20px 54px', borderRadius: 12, boxShadow: `0 0 30px ${b.accent}66` }}>{cta.button}</div>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 26, color: b.mute, letterSpacing: '0.08em', marginTop: 24, opacity: url }}>{cta.url}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// map a beat's kind → element
const renderBeat = (p: FintechProps, beat: FintechProps['beats'][number], hold: number) => {
  switch (beat.kind) {
    case 'shot': return <><Shot p={p} src={beat.img || 'chaos.png'} dur={hold} /><Head p={p} kicker={beat.kicker} pre={beat.pre} hot={beat.hot} post={beat.post} sub={beat.sub} hold={hold} /></>
    case 'meet': return <MeetBeat p={p} hold={hold} sub={beat.sub} />
    case 'stats': return <StatsBeat p={p} hold={hold} stats={beat.stats || []} kicker={beat.kicker} pre={beat.pre} hot={beat.hot} />
    case 'chat': return <ChatBeat p={p} hold={hold} chat={beat.chat || { q: '', a: '' }} />
    case 'cta': return <CTABeat p={p} hold={hold} cta={beat.cta || { headline: '', button: '', url: '' }} />
  }
}

// compute duration from props (used by calculateMetadata on the VPS)
export function fintechDuration(p: FintechProps): number {
  const INTRO = p.introFrames
  let t = INTRO
  for (const b of p.beats) t += s(b.dur)
  return t + 6
}

export const TemplateFintech: React.FC<FintechProps> = (p) => {
  const b = p.brand
  const INTRO = p.introFrames
  const rawStarts: number[] = []; { let t = INTRO; for (const be of p.beats) { rawStarts.push(t); t += s(be.dur) } }
  const starts = rawStarts   // beat-lock optional; keep simple + deterministic for template
  const total = fintechDuration(p)
  const durs = p.beats.map((be) => s(be.dur))
  const voWin = p.beats.map((be, i) => be.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: p.duck.loud, duck: p.duck.duck, ramp: 18, fadeInEnd: 14, fadeOutStart: total - 20, fadeOutEnd: total - 4 })
  return (
    <AbsoluteFill style={{ background: b.bg }}>
      <Sequence from={0} durationInFrames={INTRO + 2}>
        <Intro style="terminal" dur={INTRO} tokens={{ bg: b.bg, bg2: b.bg2, accent: b.accent, accentHi: b.accentHi }} render={<Wordmark p={p} size={120} />} />
      </Sequence>
      {p.beats.map((be, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {renderBeat(p, be, durs[i])}
          {i > 0 && <StreakWipe color={b.accent} dir={i % 2 ? 1 : -1} dur={12} />}
        </Sequence>
      ))}
      <MusicBed src={`${p.assetDir}/${p.music.file}`} musicFrames={p.music.frames} volume={musicDuck} />
      {p.beats.map((be, i) => be.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`${p.assetDir}/${be.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
    </AbsoluteFill>
  )
}
