import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { CountUp, Alive, SettleSweep } from './lib/pizzazz'
import { AGENT_DISCLAIMER } from './lib/compliance'
import { makeMusicDuck, type VoWindow } from './lib/audio'

const { fontFamily: SERIF } = loadFraunces()
const { fontFamily: SANS } = loadInter()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * IllustrationSummary — a WARM CLIENT VIDEO the agent sends, summarizing a life
 * insurance illustration (from cl_pdf.pdf, prepared by an advisor for a client).
 *
 * This is NOT a commercial — it's a trusted advisor explaining a plan. Tone:
 * calm, personal, reassuring, plain-English. Style: soft navy + warm gold,
 * gentle motion, human. Figures are drawn from the illustration.
 *
 * COMPLIANCE (see lib/compliance.ts — the SYSTEM rule): this is a GENERIC
 * benefits summary. It NEVER names the carrier or the branded product/type, so
 * the carrier can't be claimed as the source — it's the AGENT's summary. It
 * points the client to the full illustration doc below, and the disclaimer is
 * agent-attributed. Also: growth/income figures are NON-GUARANTEED values —
 * each is flagged on-screen with * and a dedicated disclaimer beat closes it.
 * ==========================================================================*/

const NAVY = '#0e1b2e', NAVY2 = '#12253d', INK = '#0a1420'
const GOLD = '#c9a24b', GOLD_HI = '#e8c874', TEAL = '#4a9d9d'
const CREAM = '#f4f1ea', MUTE = '#9fb0c0'

// soft warm photo — gentle push, warm grade, calm (not dramatic)
const Photo: React.FC<{ src: string; dur: number; focus?: string; dim?: number }> =
({ src, dur, focus = '50% 42%', dim = 1 }) => {
  const frame = useCurrentFrame()
  const sc = interpolate(frame, [0, dur], [1.05, 1.12], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: NAVY }}>
      <Img src={staticFile(`illustration/gen/${src}`)} style={{ width: '112%', height: '112%', position: 'absolute', left: '-6%', top: '-6%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc})`, filter: `brightness(${0.86 * dim}) contrast(1.02) saturate(1.02)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${NAVY}66, transparent 30%, transparent 52%, ${NAVY}f0)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(85% 85% at 60% 30%, ${GOLD}12, transparent 50%)`, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  )
}

// gentle solid backdrop for the number/data beats
const Panel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame * 0.02) * 6
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 120% at 50% 40%, ${NAVY2}, ${INK})` }}>
      <AbsoluteFill style={{ background: `radial-gradient(50% 40% at 70% ${20 + drift}%, ${GOLD}12, transparent 60%)` }} />
      {/* gentle life so the number beats never sit dead-static — LOW intensity to
          keep the calm, trustworthy advisor tone (not a bouncy commercial) */}
      <Alive intensity={0.4}>{children}</Alive>
    </AbsoluteFill>
  )
}

// a soft caption line — serif, calm fade + rise (no bounce, no pop)
const Caption: React.FC<{ pre?: string; gold?: string; post?: string; sub?: string; size?: number; hold: number; foot?: string }> =
({ pre = '', gold = '', post = '', sub, size = 56, hold, foot }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 12, hold - 12, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 18], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 130 }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1450 }}>
        <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: size, color: CREAM, lineHeight: 1.14, textShadow: '0 3px 24px rgba(0,0,0,0.8)' }}>
          {pre}{gold && <span style={{ color: GOLD_HI }}>{gold}</span>}{post}
        </div>
        {sub && <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: size * 0.34, color: MUTE, marginTop: 14 }}>{sub}</div>}
        {foot && <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 20, color: MUTE, marginTop: 18, opacity: 0.8, fontStyle: 'italic' }}>{foot}</div>}
      </div>
    </AbsoluteFill>
  )
}

// a big highlighted figure (with optional * non-guaranteed flag)
const Figure: React.FC<{ value: number; prefix?: string; suffix?: string; label: string; flag?: boolean; dur: number }> =
({ value, prefix = '$', suffix = '', label, flag = false, dur }) => {
  const frame = useCurrentFrame()
  const rule = clamp((frame - 12) / 16, 0, 1)
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      {/* lineHeight + vertical padding so descenders ($ y / tails) aren't clipped
          by the background-clip:text glyph box (system rule for gradient numbers) */}
      <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 190, lineHeight: 1.24, paddingBottom: '0.12em', color: 'transparent', backgroundImage: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', textShadow: `0 0 40px ${GOLD}33` }}>
        <CountUp to={value} prefix={prefix} suffix={suffix} dur={26} />{flag && <span style={{ fontSize: 60, color: GOLD, WebkitTextFillColor: GOLD, verticalAlign: 'super' }}>*</span>}
      </div>
      <div style={{ width: 160 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: 20 }} />
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 30, color: CREAM, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 22, opacity: clamp((frame - 14) / 8, 0, 1), textAlign: 'center' }}>{label}</div>
      {flag && <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 20, color: MUTE, marginTop: 16, fontStyle: 'italic', opacity: clamp((frame - 20) / 8, 0, 1) }}>* Non-guaranteed. Based on current illustration assumptions.</div>}
      {/* one soft, slow gold sweep in the tail of the long number hold */}
      <SettleSweep color={GOLD} hold={dur} />
    </AbsoluteFill>
  )
}

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode }
// COMPLIANT copy — NO carrier/product/type named; generic benefits summary.
// VO dur: 1:5.48 2:6.87 3:9.01 4:7.57 5:10.68 6:10.03 7:10.22 8:8.13 9:5.94 10:5.39
const BEATS: Beat[] = [
  // 1 — warm intro
  { dur: s(5.48 + 0.4), vo: 'il-1', el: <IntroCard hold={s(5.48 + 0.4)} /> },
  // 2 — what it is (GENERIC: "life insurance plan", no product type/carrier)
  { dur: s(6.87 + 0.3), vo: 'il-2', el: <><Photo src="family.png" dur={s(7.2)} />
      <Caption pre="A life insurance plan built to " gold="protect & grow" sub="Protect your family · grow your money" size={56} hold={s(6.87 + 0.3)} /></> },
  // 3 — protection (death benefit)
  { dur: s(9.01 + 0.3), vo: 'il-3', el: <Panel><Figure value={176204} label="Death Benefit — grows over time" dur={s(9.31)} /></Panel> },
  // 4 — growth mechanics (generic "market upside", not "S&P 500")
  { dur: s(7.57 + 0.3), vo: 'il-4', el: <><Photo src="growth.png" dur={s(7.87)} />
      <Caption pre="Market upside, with a " gold="0% floor" sub="A down market can't take your gains" size={56} hold={s(7.57 + 0.3)} /></> },
  // 5 — projected value (NON-GUARANTEED, flagged)
  { dur: s(10.68 + 0.3), vo: 'il-5', el: <Panel><Figure value={355829} label="Illustrated Policy Value" flag dur={s(10.98)} /></Panel> },
  // 6 — living benefits (the standout)
  { dur: s(10.03 + 0.3), vo: 'il-6', el: <><Photo src="shield.png" dur={s(10.33)} dim={0.95} />
      <Caption pre="Built-in " gold="living benefits" sub="Access your benefit early if serious illness strikes" size={56} hold={s(10.03 + 0.3)} foot="At no additional premium. Subject to policy terms." /></> },
  // 7 — retirement income (NON-GUARANTEED, flagged)
  { dur: s(10.22 + 0.3), vo: 'il-7', el: <Panel><Figure value={46667} suffix="/yr" label="Tax-Advantaged Retirement Income" flag dur={s(10.52)} /></Panel> },
  // 8 — reassurance (you do nothing)
  { dur: s(8.13 + 0.3), vo: 'il-8', el: <><Photo src="retire.png" dur={s(8.43)} />
      <Caption gold="It works quietly for you." sub="Just keep your plan funded — we handle the rest" size={62} hold={s(8.13 + 0.3)} /></> },
  // 9 — COMPLIANCE: this is a summary; details are in the illustration below
  { dur: s(5.94 + 0.3), vo: 'il-9', el: <SummaryNote hold={s(5.94 + 0.3)} /> },
  // 10 — the agent + agent-attributed disclaimer
  { dur: s(5.39 + 1.8), vo: 'il-10', el: <CloseCard hold={s(5.39 + 1.8)} /> },
]

// Beat 9 — makes clear this is a benefits SUMMARY and points to the real doc.
function SummaryNote({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 14, hold - 12, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 18], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const arrow = 6 + Math.sin(frame * 0.12) * 6   // gentle bob pointing "below"
  return (
    <Panel>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center', maxWidth: 1300 }}>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: '0.3em', textTransform: 'uppercase', color: GOLD, marginBottom: 20 }}>A Summary of Your Benefits</div>
          <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 52, color: CREAM, lineHeight: 1.2, paddingBottom: '0.06em' }}>
            The specific details are in your <span style={{ color: GOLD_HI }}>full illustration</span> —
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: MUTE, marginTop: 22, transform: `translateY(${arrow}px)` }}>just below this video ↓</div>
        </div>
      </AbsoluteFill>
    </Panel>
  )
}

function IntroCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const up = spring({ frame: frame - 4, fps, config: { damping: 20, stiffness: 70 } })
  const rule = clamp((frame - 18) / 18, 0, 1)
  return (
    <Panel>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.34em', textTransform: 'uppercase', color: GOLD, opacity: clamp((frame - 6) / 10, 0, 1), marginBottom: 20 }}>Your Plan Summary</div>
        <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 78, color: CREAM, textAlign: 'center', opacity: clamp(up, 0, 1), transform: `translateY(${(1 - clamp(up, 0, 1)) * 16}px)`, lineHeight: 1.1, maxWidth: 1300 }}>
          A quick look at the plan <span style={{ color: GOLD_HI }}>we built for you.</span>
        </div>
        <div style={{ width: 260 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: 30 }} />
      </AbsoluteFill>
    </Panel>
  )
}

function CloseCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const up = spring({ frame: frame - 2, fps, config: { damping: 20, stiffness: 80 } })
  const disc = interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <Panel>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 68, color: CREAM, opacity: clamp(up, 0, 1), transform: `translateY(${(1 - clamp(up, 0, 1)) * 14}px)` }}>Philip Resch</div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 30, color: GOLD_HI, letterSpacing: '0.1em', marginTop: 8, opacity: clamp(up, 0, 1) }}>Valor Financial Specialists</div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 26, color: MUTE, marginTop: 20, opacity: clamp((frame - 16) / 10, 0, 1) }}>Questions? I'm one call away — 860-402-8262</div>
        {/* compliance disclaimer — shared, agent-attributed, NO carrier/product */}
        <div style={{ maxWidth: 1200, marginTop: 46, opacity: disc, padding: '20px 30px', border: `1px solid ${MUTE}33`, borderRadius: 10, background: '#00000033' }}>
          <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 19, color: MUTE, lineHeight: 1.5, textAlign: 'center', fontStyle: 'italic' }}>
            {AGENT_DISCLAIMER}
          </div>
        </div>
      </AbsoluteFill>
    </Panel>
  )
}

export const illustrationDuration = BEATS.reduce((a, b) => a + b.dur, 0) + 6

export const IllustrationSummary: React.FC = () => {
  const starts: number[] = []; let t = 0
  for (const b of BEATS) { starts.push(t); t += b.dur }
  const total = illustrationDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + b.dur } : null).filter(Boolean) as VoWindow[]
  // very gentle bed — calm advisor video, music barely-there (shared plumbing)
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.16, duck: 0.07, ramp: 22, fadeInEnd: 20, fadeOutStart: total - 30, fadeOutEnd: total - 8 })
  return (
    <AbsoluteFill style={{ background: INK }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={b.dur + 8}>
          {b.el}
          <SoftFade dur={b.dur} />
        </Sequence>
      ))}
      <Audio src={staticFile('illustration/music.mp3')} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`illustration/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
    </AbsoluteFill>
  )
}

// gentle cross-fade through the ink base — calm, no hard cuts
const SoftFade: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame()
  const inA = 12, outA = Math.max(inA + 2, dur - 12), outB = Math.max(outA + 1, dur + 2)
  const o = interpolate(frame, [0, inA, outA, outB], [1, 0, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ background: INK, opacity: o, pointerEvents: 'none' }} />
}
