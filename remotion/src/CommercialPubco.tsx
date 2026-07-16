import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono'
import pubcoGrid from '../public/pubco/beatgrid.json'
import { CountUp, StreakWipe, Bokeh, HeroFlash } from './lib/pizzazz'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'

const { fontFamily: GROTESK } = loadSpaceGrotesk()   // techy geometric display
const { fontFamily: BODY } = loadInter()
const { fontFamily: MONO } = loadJetBrains()          // terminal/data mono
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * PUBCOZONE — an autonomous, content-driven commercial. The system read all 5
 * pages of pubcozone.com and MADE the creative calls:
 *   · THEME: noise/hype/manipulation → truth/signal (from the filings).
 *   · AUDIENCE: lead with the INVESTOR story ("you're not the exit liquidity")
 *     — the emotional, viral, free top-of-funnel — with one turn revealing the
 *     company side exists. (Two-sided product; a 45s ad leads with one.)
 *   · LOOK: emerald-on-black FINTECH / Bloomberg-terminal aesthetic — the site's
 *     own brand colors (#10b981/#34d399 on #0f172a/#04060c). A third distinct
 *     style vs. the gold-luxury (AI CEO) and upbeat-recruitment (Apex) pieces.
 *   · PIZZAZZ: the product is literally about FLAGGING claims → animated
 *     SUPPORTED / CONTRADICTED stamps + a manipulation-radar sweep + count-ups.
 * ==========================================================================*/

const BG = '#04070d', BG2 = '#0b1220', PANEL = '#0f1b2e'
const EM = '#10b981', EM_HI = '#34d399', EM_DEEP = '#047857'
const RED = '#ef4444', AMBER = '#f59e0b'
const WHITE = '#eef4f2', MUTE = '#8aa0a8'

// ---- terminal/scanline overlay — the fintech texture on every frame ----
const Scanlines: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.5, background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.18) 3px, transparent 4px)' }} />
)
const Grid: React.FC = () => {
  const frame = useCurrentFrame()
  const y = (frame * 0.3) % 60
  return <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.12, backgroundImage: `linear-gradient(${EM}44 1px, transparent 1px), linear-gradient(90deg, ${EM}44 1px, transparent 1px)`, backgroundSize: '60px 60px', backgroundPosition: `0 ${y}px` }} />
}

// ---- image cell, emerald-graded, with parallax push ----
const Shot: React.FC<{ src: string; dur: number; focus?: string; kb?: number; dim?: number; chaos?: boolean }> =
({ src, dur, focus = '50% 45%', kb = 1.14, dim = 1, chaos = false }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = 1.04 + (kb - 1) * p
  const jitter = chaos ? Math.sin(frame * 1.7) * 2 + Math.cos(frame * 2.3) * 1.5 : 0
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: BG }}>
      <Img src={staticFile(`pubco/gen/${src}`)} style={{ width: '114%', height: '114%', position: 'absolute', left: '-7%', top: '-7%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc}) translateX(${jitter}px)`, filter: `brightness(${(chaos ? 0.7 : 0.82) * dim}) contrast(1.15) saturate(${chaos ? 1.3 : 1.1}) hue-rotate(${chaos ? -8 : 0}deg)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG}88, transparent 30%, transparent 55%, ${BG}f0)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(90% 90% at 50% 40%, transparent 45%, ${BG}dd)` }} />
      {chaos && <AbsoluteFill style={{ background: `linear-gradient(120deg, ${RED}18, transparent 40%, ${AMBER}12)`, mixBlendMode: 'screen' }} />}
    </AbsoluteFill>
  )
}

// ---- the fintech headline — mono/grotesk, emerald key phrase, terminal feel ----
const Head: React.FC<{ pre?: string; hot?: string; post?: string; color?: string; size?: number; hold: number; kicker?: string; mono?: boolean }> =
({ pre = '', hot = '', post = '', color = EM_HI, size = 74, hold, kicker, mono = false }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 8, hold - 10, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 14], [18, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const kO = interpolate(frame, [2, 10], [0, 1], { extrapolateRight: 'clamp' })
  const rule = clamp((frame - 8) / 14, 0, 1)
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 20, letterSpacing: '0.3em', textTransform: 'uppercase', color: EM, marginBottom: 20, opacity: kO }}>{'// '}{kicker}</div>}
        <div style={{ fontFamily: mono ? MONO : GROTESK, fontWeight: 700, fontSize: size, color: WHITE, lineHeight: 1.12, letterSpacing: '-0.01em', textShadow: '0 4px 30px rgba(0,0,0,0.9)' }}>
          {pre}{hot && <span style={{ color, textShadow: `0 0 24px ${color}66` }}>{hot}</span>}{post}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <div style={{ width: 130 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${EM}, transparent)`, boxShadow: `0 0 12px ${EM}` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ---- the SIGNATURE motif: a claim getting stamped SUPPORTED / CONTRADICTED,
// checked against a filing. This IS the product — animated as a live check. ----
const ClaimCheck: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const claims = [
    { text: '"They have no cash."', verdict: 'CONTRADICTED', color: RED, cite: '10-Q · $48M cash on hand' },
    { text: '"Insiders are dumping."', verdict: 'CONTRADICTED', color: RED, cite: 'Form 4 · net insider BUYING' },
    { text: '"Going bankrupt."', verdict: 'CONTRADICTED', color: RED, cite: 'no going-concern flag' },
  ]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 35%, ${BG2}, ${BG})` }}>
      <Grid />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
        {claims.map((c, i) => {
          const at = 10 + i * 26
          const cardO = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          const x = interpolate(frame, [at, at + 12], [-40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          const stampAt = at + 12
          const stamp = spring({ frame: frame - stampAt, fps, config: { damping: 10, stiffness: 220 } })
          const stampO = interpolate(frame, [stampAt, stampAt + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: cardO, transform: `translateX(${x}px)`, background: PANEL, border: `1px solid ${EM}22`, borderRadius: 12, padding: '20px 30px', width: 1020 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 34, color: WHITE }}>{c.text}</div>
                <div style={{ fontFamily: MONO, fontSize: 19, color: MUTE, marginTop: 6 }}>{'checked → '}{c.cite}</div>
              </div>
              <div style={{ transform: `scale(${clamp(stamp, 0, 1.15)}) rotate(-6deg)`, opacity: stampO, border: `3px solid ${c.color}`, color: c.color, fontFamily: GROTESK, fontWeight: 700, fontSize: 26, letterSpacing: '0.08em', padding: '8px 18px', borderRadius: 8, textShadow: `0 0 14px ${c.color}66`, boxShadow: `0 0 20px ${c.color}33` }}>{c.verdict}</div>
            </div>
          )
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---- manipulation radar sweep — pings light up as the beam passes ----
const Radar: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const ang = (frame * 5) % 360
  const pings = [[30, 40], [65, 30], [50, 70], [72, 60], [40, 55]]
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, ${BG2}, ${BG})` }}>
      <Grid />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 560, height: 560 }}>
          {[1, 2, 3].map((r) => <div key={r} style={{ position: 'absolute', inset: `${r * 70}px`, border: `1px solid ${EM}33`, borderRadius: '50%' }} />)}
          {/* sweep */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from ${ang}deg, ${EM}55, transparent 40deg)` }} />
          {pings.map(([x, y], i) => {
            const pa = (ang - (i * 60)) % 360
            const lit = pa > 0 && pa < 50
            return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 16, height: 16, borderRadius: '50%', background: lit ? RED : `${RED}44`, boxShadow: lit ? `0 0 20px ${RED}` : 'none', transition: 'none' }} />
          })}
        </div>
      </AbsoluteFill>
      <Head kicker="Manipulation Radar" pre="Spot the pump " hot="before you're burned." color={AMBER} size={58} hold={hold} />
    </AbsoluteFill>
  )
}

// ---- data readout row (price/cash/insiders/short) — mono terminal panels ----
const DataPanel: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const rows = [
    { k: 'PRICE', v: 4.12, pre: '$', dec: 2, c: EM_HI },
    { k: 'CASH RUNWAY', v: 18, suf: ' mo', c: EM_HI },
    { k: 'INSIDER BUYS', v: 7, pre: '+', c: EM },
    { k: 'SHORT INTEREST', v: 22, suf: '%', c: AMBER },
  ]
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${BG2}, ${BG})` }}>
      <Grid />
      <Bokeh color={EM} count={7} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 34 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          {rows.map((r, i) => {
            const at = 6 + i * 8
            const o = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            const y = interpolate(frame, [at, at + 10], [22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
            return (
              <div key={i} style={{ opacity: o, transform: `translateY(${y}px)`, background: PANEL, border: `1px solid ${r.c}33`, borderRadius: 12, padding: '26px 32px', minWidth: 260, textAlign: 'left', boxShadow: `0 0 24px ${r.c}18` }}>
                <div style={{ fontFamily: MONO, fontSize: 18, color: MUTE, letterSpacing: '0.14em' }}>{r.k}</div>
                <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 62, color: r.c, marginTop: 6, textShadow: `0 0 20px ${r.c}44` }}>
                  <CountUp to={r.v} startAt={at} dur={22} prefix={r.pre || ''} suffix={r.suf || ''} decimals={r.dec || 0} />
                </div>
              </div>
            )
          })}
        </div>
        <Head pre="The real story — " hot="not the hype." color={EM_HI} size={56} hold={hold} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// wordmark: "Pubco" emerald + "Zone" white, mono dot — matches the site
const Wordmark: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: size, letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline' }}>
    <span style={{ color: EM_HI, textShadow: `0 0 30px ${EM}66` }}>Pubco</span>
    <span style={{ color: WHITE }}>Zone</span>
    <span style={{ color: EM, marginLeft: 2 }}>.</span>
  </div>
)

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode }
// VO dur: 1:4.41 2:3.76 3:1.58 4:6.22 5:4.46 6:5.57 7:6.64 8:5.94 9:5.11
const BEATS: Beat[] = [
  // cold open — noise/chaos
  { dur: s(1.2), el: <Shot src="noise.png" dur={s(1.2)} chaos kb={1.1} /> },
  // 1 — the problem: every board sounds the same (hype)
  { dur: s(4.41 + 0.2), vo: 'pz-1', el: <><Shot src="noise.png" dur={s(4.6)} chaos kb={1.14} />
      <Head pre="Every stock board is the same. " hot="Pumpers, bashers, hype." color={RED} size={58} hold={s(4.41 + 0.2)} /></> },
  // 2 — the gut punch: you're the exit liquidity
  { dur: s(3.76 + 0.3), vo: 'pz-2', el: <><Shot src="trap.png" dur={s(4.1)} kb={1.12} dim={0.95} />
      <Head pre="You're the " hot="exit liquidity." color={RED} size={92} hold={s(3.76 + 0.3)} /></> },
  // 3 — the turn: PubcoZone is different (wordmark)
  { dur: s(1.58 + 1.0), vo: 'pz-3', el: <TurnCard hold={s(1.58 + 1.0)} /> },
  // 4 — truth-check the board (the claim-check motif)
  { dur: s(6.22 + 0.2), vo: 'pz-4', el: <ClaimCheck hold={s(6.22 + 0.2)} /> },
  // 5 — supported/contradicted/unverifiable, with receipts
  { dur: s(4.46 + 0.2), vo: 'pz-5', el: <><Shot src="scan.png" dur={s(4.7)} kb={1.13} />
      <Head kicker="Claims get receipts" pre="Supported. Contradicted. " hot="Unverifiable." color={EM_HI} size={58} hold={s(4.46 + 0.2)} mono /></> },
  // 6 — manipulation radar + plain english
  { dur: s(5.57 + 0.2), vo: 'pz-6', el: <Radar hold={s(5.57 + 0.2)} /> },
  // 7 — the data (price/cash/insiders/short)
  { dur: s(6.64 + 0.2), vo: 'pz-7', el: <DataPanel hold={s(6.64 + 0.2)} /> },
  // 8 — the other side: companies answer on the record
  { dur: s(5.94 + 0.2), vo: 'pz-8', el: <><Shot src="confident.png" dur={s(6.1)} kb={1.12} />
      <Head kicker="Both sides. On the record." pre="Now companies " hot="answer back." color={EM_HI} size={64} hold={s(5.94 + 0.2)} /></> },
  // 9 — CTA
  { dur: s(5.11 + 1.4), vo: 'pz-9', el: <CTACard hold={s(5.11 + 1.4)} /> },
]

function TurnCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 170 } })
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 45%, ${BG2}, ${BG})` }}>
      <Grid />
      <HeroFlash color={EM} at={2} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
        <div style={{ transform: `scale(${0.7 + clamp(pop, 0, 1) * 0.3})` }}><Wordmark size={128} /></div>
        <div style={{ fontFamily: MONO, fontSize: 30, color: MUTE, letterSpacing: '0.16em', opacity: clamp((frame - 12) / 8, 0, 1) }}>is different.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function CTACard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const up = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 130 } })
  const line = interpolate(frame, [20, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const btn = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [58, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 42%, ${BG2}, ${BG})` }}>
      <Grid />
      <Bokeh color={EM} count={6} big />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${0.72 + clamp(up, 0, 1) * 0.28})` }}><Wordmark size={124} /></div>
        <div style={{ width: 360 * line, height: 2, background: `linear-gradient(90deg, transparent, ${EM}, transparent)`, marginTop: 26, boxShadow: `0 0 14px ${EM}` }} />
        <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 46, color: WHITE, marginTop: 26, textAlign: 'center', opacity: clamp(line, 0, 1) }}>Research any stock — <span style={{ color: EM_HI }}>free.</span></div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${EM_HI}, ${EM_DEEP})`, color: BG, fontFamily: GROTESK, fontWeight: 700, fontSize: 32, letterSpacing: '0.04em', padding: '20px 54px', borderRadius: 10, boxShadow: `0 0 30px ${EM}88`, textAlign: 'center' }}>Look Up Any Ticker</div>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 28, color: MUTE, letterSpacing: '0.08em', marginTop: 26, opacity: url }}>pubcozone.com</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---- beat-lock to the 120 BPM grid ----
const rawStarts: number[] = []; { let t = 0; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const B_STARTS = beatLock(rawStarts, gridToFrames((pubcoGrid as any).beats, FPS), Math.round(0.2 * FPS))
export const pubcoDuration = B_STARTS[B_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const CommercialPubco: React.FC = () => {
  const starts = B_STARTS
  const durs = durationsFromStarts(starts, pubcoDuration - 6)
  const total = pubcoDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.2, duck: 0.08, ramp: 18, fadeInEnd: 14 })
  return (
    <AbsoluteFill style={{ background: BG }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el}
          <Scanlines />
          {i > 0 && <StreakWipe color={i <= 2 ? RED : EM_HI} dir={i % 2 ? 1 : -1} dur={12} />}
        </Sequence>
      ))}
      <MusicBed src="pubco/music.mp3" musicFrames={1259} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`pubco/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
      {/* sound design — glitchy whooshes on cuts, impact on the turn */}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.26} /></Sequence>
      ))}
      <Sequence from={starts[3]} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.42} /></Sequence>
    </AbsoluteFill>
  )
}
