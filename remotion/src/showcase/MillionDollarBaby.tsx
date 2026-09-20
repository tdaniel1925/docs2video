import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadSerif } from '@remotion/google-fonts/DMSerifDisplay'
import vo from '../../public/showcase/mdb/vo.json'
import grid from '../../public/showcase/mdb/beatgrid.json'
import { Alive, sustained, SettleSweep, CountUp, StreakWipe } from '../lib/pizzazz'
import { FPS, s, clamp, pop, timeline, AudioBed, FadeOut, type BeatSpec } from './common'

/* ============================================================================
 * MILLION DOLLAR BABY — an index universal life illustration, told as motion
 * graphics instead of a slideshow.
 *   · LOOK: deep navy ground, warm gold for money, ice-white type. Trust, not
 *     hype — this is a regulated product, so nothing flashes or shouts.
 *   · MOTION: numbers count up, the timeline draws itself, the floor holds
 *     while the market line falls. Every claim is labelled "illustrated".
 *   · The compliance beat is deliberately calm and readable, not skipped past.
 * ==========================================================================*/
const { fontFamily: SANS } = loadInter()
const { fontFamily: SERIF } = loadSerif()
const NAVY = '#0b1b34', DEEP = '#07142a', GOLD = '#e8b768', ICE = '#eef4ff', MUTE = '#8fa3c4', GREEN = '#5fd39a', LINE = '#1d3357'
const D = (vo as { durations: number[] }).durations

/* ── shared furniture ───────────────────────────────────────────────────── */
const Ground: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = NAVY }) => (
  <AbsoluteFill style={{ background: bg, fontFamily: SANS, color: ICE, overflow: 'hidden' }}>{children}</AbsoluteFill>
)
/** A faint grid — the texture of a financial illustration, kept subtle. */
const Grid: React.FC<{ opacity?: number }> = ({ opacity = 0.16 }) => (
  <AbsoluteFill style={{ opacity, backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`, backgroundSize: '96px 96px' }} />
)
const Kicker: React.FC<{ at: number; text: string; color?: string }> = ({ at, text, color = GOLD }) => {
  const frame = useCurrentFrame(); const p = pop(frame, at, 14)
  return <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color, opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 14}px)` }}>{text}</div>
}
const Line: React.FC<{ at: number; children: React.ReactNode; size?: number; color?: string; weight?: number; font?: string; delay?: number }> =
({ at, children, size = 58, color = ICE, weight = 800, font = SANS }) => {
  const frame = useCurrentFrame(); const p = pop(frame, at, 15)
  return <div style={{ fontFamily: font, fontSize: size, fontWeight: weight, color, lineHeight: 1.1, letterSpacing: '-0.02em', opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 26}px)`, paddingBottom: '0.06em' }}>{children}</div>
}
/** Every figure in this piece is illustrated, never guaranteed — say so, always. */
const Illustrated: React.FC<{ at?: number }> = ({ at = 20 }) => {
  const frame = useCurrentFrame()
  return <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, textAlign: 'center', fontSize: 15, color: MUTE, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: clamp((frame - at) / 18, 0, 0.9) }}>Illustrated values · not guaranteed</div>
}

/* ── 1. the hook: a life drawn as one long line ─────────────────────────── */
const Hook: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const draw = clamp((frame - 14) / 60, 0, 1)
  const e = Easing.out(Easing.cubic)(draw)
  return (
    <Ground>
      <Grid opacity={0.12} />
      <Alive intensity={0.5}>
        {/* the line of a life, age 0 → 90 */}
        <div style={{ position: 'absolute', left: 160, right: 160, top: 620, height: 3, background: LINE }} />
        <div style={{ position: 'absolute', left: 160, top: 620, height: 3, width: `${e * (1920 - 320)}px`, background: `linear-gradient(90deg, ${GOLD}, ${ICE})` }} />
        {[['0', 0], ['30', 0.33], ['60', 0.66], ['90', 1]].map(([label, at], i) => {
          const show = draw > (at as number) - 0.02
          const x = 160 + (at as number) * (1920 - 320)
          return (
            <div key={i} style={{ position: 'absolute', left: x - 30, top: 640, width: 60, textAlign: 'center', opacity: show ? 1 : 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: i === 3 ? GOLD : MUTE, margin: '0 auto 10px' }} />
              <div style={{ fontSize: 17, color: i === 3 ? GOLD : MUTE, fontWeight: 700 }}>age {label}</div>
            </div>
          )
        })}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 210 }}>
          <div style={{ textAlign: 'center', maxWidth: 1400 }}>
            <Kicker at={4} text="A decision made once" />
            <div style={{ height: 20 }} />
            <Line at={10} size={82} font={SERIF} weight={400}>A head start so powerful,</Line>
            <Line at={26} size={82} font={SERIF} weight={400}>it&rsquo;s still working at <span style={{ color: GOLD }}>ninety</span>.</Line>
          </div>
        </AbsoluteFill>
      </Alive>
      <SettleSweep color={GOLD} hold={hold} />
    </Ground>
  )
}

/* ── 2. time is the asset ───────────────────────────────────────────────── */
const Time: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const bars = Array.from({ length: 24 }, (_, i) => i)
  return (
    <Ground bg={DEEP}>
      <Grid opacity={0.1} />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Kicker at={2} text="Why age zero" />
            <div style={{ height: 18 }} />
            <Line at={8} size={72} font={SERIF} weight={400}>The one thing money</Line>
            <Line at={20} size={72} font={SERIF} weight={400}>can&rsquo;t buy back: <span style={{ color: GOLD }}>time</span>.</Line>
          </div>
        </AbsoluteFill>
        {/* compounding, drawn: each bar taller than the last */}
        <div style={{ position: 'absolute', left: 240, right: 240, bottom: 230, height: 210, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          {bars.map((i) => {
            const at = sustained(i, bars.length, Math.round(hold * 0.8), 26)
            const g = clamp((frame - at) / 14, 0, 1)
            const h = Math.pow((i + 1) / bars.length, 1.9) * 100
            return <div key={i} style={{ flex: 1, height: `${h * Easing.out(Easing.cubic)(g)}%`, background: i > 18 ? GOLD : `${GOLD}66`, borderRadius: 3 }} />
          })}
        </div>
      </Alive>
      <SettleSweep color={GOLD} hold={hold} />
    </Ground>
  )
}

/* ── 3. the deal: $50 a day, 16 years, then stop ────────────────────────── */
const Deal: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const stopAt = Math.round(hold * 0.6)
  const paid = clamp((frame - 30) / 40, 0, 1)
  return (
    <Ground>
      <Grid opacity={0.1} />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 120 }}>
          <Kicker at={2} text="From day one" />
        </AbsoluteFill>
        {/* the benefit, big */}
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 120 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 150, fontWeight: 900, color: ICE, letterSpacing: '-0.04em', lineHeight: 1, paddingBottom: '0.06em' }}>
              <CountUp to={1000000} prefix="$" decimals={0} startAt={8} dur={40} />
            </div>
            <div style={{ fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTE, marginTop: 10 }}>death benefit, from day one</div>
          </div>
        </AbsoluteFill>
        {/* sixteen years of premium, then it stops */}
        <div style={{ position: 'absolute', left: 300, right: 300, bottom: 210 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60 }}>
            {Array.from({ length: 25 }, (_, i) => {
              const on = i < 16
              const lit = paid > i / 16
              return <div key={i} style={{ flex: 1, height: on ? 44 : 16, borderRadius: 3, background: on ? (lit ? GOLD : `${GOLD}33`) : LINE, opacity: !on && frame > stopAt ? 1 : !on ? 0.35 : 1 }} />
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 16, color: MUTE }}>
            <span><strong style={{ color: GOLD }}>$50 a day</strong> · 16 years</span>
            <span style={{ opacity: clamp((frame - stopAt) / 16, 0, 1), color: GREEN, fontWeight: 700 }}>you stop paying — the plan keeps working →</span>
          </div>
        </div>
      </Alive>
      <Illustrated at={40} />
      <SettleSweep color={GOLD} hold={hold} />
    </Ground>
  )
}

/* ── 4. the floor: market falls, she keeps what she built ───────────────── */
const Floor: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const W = 1200, H = 320, L = 360, T = 400
  // A market line that rises, crashes, and rises again.
  const pts = [0, 18, 34, 52, 44, 62, 30, 48, 70, 88, 76, 96]
  const drawn = clamp((frame - 16) / 70, 0, 1)
  const shown = Math.max(2, Math.round(pts.length * drawn))
  const path = pts.slice(0, shown).map((v, i) => `${L + (i / (pts.length - 1)) * W},${T + H - (v / 100) * H}`).join(' ')
  const hers = pts.slice(0, shown).map((_v, i, a) => Math.max(...a.slice(0, i + 1)))   // never gives back
  const hersPath = hers.map((v, i) => `${L + (i / (pts.length - 1)) * W},${T + H - (v / 100) * H}`).join(' ')
  return (
    <Ground bg={DEEP}>
      <Grid opacity={0.1} />
      <Alive intensity={0.4}>
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 110 }}>
          <div style={{ textAlign: 'center' }}>
            <Kicker at={2} text="How it grows" />
            <div style={{ height: 14 }} />
            <Line at={8} size={56}>Up with the market. <span style={{ color: GREEN }}>A floor underneath.</span></Line>
          </div>
        </AbsoluteFill>
        <svg style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 }}>
          <line x1={L} y1={T + H} x2={L + W} y2={T + H} stroke={LINE} strokeWidth={2} />
          <polyline points={path} fill="none" stroke={MUTE} strokeWidth={3} strokeDasharray="7 7" />
          <polyline points={hersPath} fill="none" stroke={GOLD} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ position: 'absolute', left: L, top: T + H + 34, display: 'flex', gap: 34, fontSize: 17 }}>
          <span style={{ color: MUTE }}>— — the market</span>
          <span style={{ color: GOLD, fontWeight: 700 }}>—— her value</span>
        </div>
      </Alive>
      <Illustrated at={50} />
      <SettleSweep color={GOLD} hold={hold} />
    </Ground>
  )
}

/* ── 5. built in: living benefits + the year-five bonus ─────────────────── */
const BuiltIn: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const cards = [
    { k: 'Living benefits', d: 'Reach part of the benefit early if she ever faces a serious illness.' },
    { k: 'Year-five bonus', d: 'After year five, a bonus is added on top of her growing value.' },
  ]
  return (
    <Ground>
      <Grid opacity={0.1} />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 120 }}>
          <Kicker at={2} text="Built in" />
        </AbsoluteFill>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 44, padding: '0 220px', paddingBottom: 40 }}>
          {cards.map((c, i) => {
            const p = pop(frame, 12 + i * 16, 14)
            return (
              <div key={c.k} style={{ flex: 1, background: '#0f2545', border: `1px solid ${LINE}`, borderRadius: 10, padding: '38px 34px', opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 34}px)` }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: GOLD, marginBottom: 12 }}>{c.k}</div>
                <div style={{ fontSize: 24, color: MUTE, lineHeight: 1.45 }}>{c.d}</div>
              </div>
            )
          })}
        </AbsoluteFill>
      </Alive>
      <Illustrated at={40} />
      <SettleSweep color={GOLD} hold={hold} />
    </Ground>
  )
}

/* ── 6+7. the numbers, one at a time so they land ───────────────────────── */
const Milestone: React.FC<{ hold: number; kicker: string; head: string; value: number; unit: string; foot: string; prefix?: string }> =
({ hold, kicker, head, value, unit, foot, prefix = '$' }) => (
  <Ground bg={DEEP}>
    <Grid opacity={0.1} />
    <Alive intensity={0.5}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Kicker at={2} text={kicker} />
          <div style={{ height: 16 }} />
          <Line at={8} size={46} color={MUTE} weight={600}>{head}</Line>
          <div style={{ height: 22 }} />
          <div style={{ fontSize: 170, fontWeight: 900, color: GOLD, letterSpacing: '-0.045em', lineHeight: 1, paddingBottom: '0.06em' }}>
            <CountUp to={value} prefix={prefix} decimals={0} startAt={16} dur={44} />
          </div>
          <div style={{ fontSize: 24, letterSpacing: '0.18em', textTransform: 'uppercase', color: MUTE, marginTop: 14 }}>{unit}</div>
          <div style={{ height: 26 }} />
          <Line at={54} size={28} color={ICE} weight={600}>{foot}</Line>
        </div>
      </AbsoluteFill>
    </Alive>
    <Illustrated at={30} />
    <SettleSweep color={GOLD} hold={hold} />
  </Ground>
)

/* ── 8. the ninety figure, the biggest moment ───────────────────────────── */
const Ninety: React.FC<{ hold: number }> = ({ hold }) => {
  return (
    <Ground>
      <Grid opacity={0.12} />
      <Alive intensity={0.6}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Kicker at={2} text="By age ninety" />
            <div style={{ height: 30 }} />
            <div style={{ display: 'flex', gap: 90, alignItems: 'flex-end', justifyContent: 'center' }}>
              {[
                { v: 10000000, l: 'illustrated cash value' },
                { v: 13000000, l: 'in protection' },
              ].map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: 132, fontWeight: 900, color: i ? ICE : GOLD, letterSpacing: '-0.045em', lineHeight: 1, paddingBottom: '0.06em' }}>
                    <CountUp to={m.v} prefix="$" decimals={0} startAt={10 + i * 18} dur={46} />
                  </div>
                  <div style={{ fontSize: 20, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTE, marginTop: 12 }}>{m.l}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 44 }} />
            <Line at={62} size={40} font={SERIF} weight={400}>From <span style={{ color: GOLD }}>fifty dollars a day</span>.</Line>
          </div>
        </AbsoluteFill>
      </Alive>
      <Illustrated at={40} />
      <SettleSweep color={GOLD} hold={hold} />
    </Ground>
  )
}

/* ── 9. it never ages her out ───────────────────────────────────────────── */
const Generations: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const draw = clamp((frame - 12) / 60, 0, 1)
  return (
    <Ground bg={DEEP}>
      <Grid opacity={0.1} />
      <Alive intensity={0.4}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 130 }}>
          <div style={{ textAlign: 'center' }}>
            <Kicker at={2} text="Designed to last" />
            <div style={{ height: 18 }} />
            <Line at={8} size={64} font={SERIF} weight={400}>In force to age <span style={{ color: GOLD }}>131</span>.</Line>
            <div style={{ height: 14 }} />
            <Line at={26} size={30} color={MUTE} weight={600}>It never ages her out.</Line>
          </div>
        </AbsoluteFill>
        <div style={{ position: 'absolute', left: 260, right: 260, bottom: 210, height: 4, background: LINE }} />
        <div style={{ position: 'absolute', left: 260, bottom: 210, height: 4, width: `${Easing.out(Easing.cubic)(draw) * (1920 - 520)}px`, background: `linear-gradient(90deg, ${GOLD}, ${ICE})` }} />
        <div style={{ position: 'absolute', right: 260, bottom: 228, fontSize: 18, color: GOLD, fontWeight: 800, opacity: clamp((draw - 0.9) * 10, 0, 1) }}>131</div>
      </Alive>
      <SettleSweep color={GOLD} hold={hold} />
    </Ground>
  )
}

/* ── 10. the compliance beat — calm, readable, not skipped ──────────────── */
const Disclosure: React.FC<{ hold: number }> = ({ hold }) => (
  <Ground bg="#f4f6fa">
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 260px' }}>
      <div style={{ textAlign: 'left', maxWidth: 1300 }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5a6b86' }}>Important disclosures</div>
        <div style={{ height: 22 }} />
        {[
          'Illustrated values are not guaranteed and are subject to change.',
          'For educational purposes only — not legal, tax or financial advice.',
          'Benefits depend on the claims-paying ability of the issuing carrier.',
          'Review your policy documents with a licensed professional.',
        ].map((t, i) => (
          <div key={i} style={{ fontSize: 30, color: '#16233a', lineHeight: 1.5, marginBottom: 14, opacity: 1 }}>
            <span style={{ color: '#a9b6ca', marginRight: 14 }}>·</span>{t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
    <SettleSweep color="#c9d3e2" hold={hold} />
  </Ground>
)

/* ── 11. the ask ────────────────────────────────────────────────────────── */
const Cta: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const fade = interpolate(frame, [hold - 16, hold - 2], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const p = clamp(spring({ frame: frame - 4, fps: FPS, config: { damping: 13, stiffness: 140 } }), 0, 1)
  return (
    <Ground>
      <Grid opacity={0.12} />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: fade }}>
          <div style={{ textAlign: 'center', transform: `scale(${0.9 + 0.1 * p})` }}>
            <Line at={2} size={70} font={SERIF} weight={400}>Start something that</Line>
            <Line at={14} size={70} font={SERIF} weight={400}>outlives us all.</Line>
            <div style={{ height: 46 }} />
            <div style={{ display: 'inline-block', background: GOLD, color: DEEP, fontWeight: 900, fontSize: 42, padding: '18px 44px', borderRadius: 10, transform: `scale(${pop(frame, 30, 12)})` }}>
              1‑773‑259‑6908
            </div>
            <div style={{ height: 26 }} />
            <div style={{ fontSize: 22, color: MUTE, opacity: clamp(pop(frame, 44) * 2, 0, 1) }}>Aziz Ali · azizali.insurance@gmail.com</div>
          </div>
        </AbsoluteFill>
      </Alive>
    </Ground>
  )
}

/* ── assembly ───────────────────────────────────────────────────────────── */
const BEATS: BeatSpec[] = [
  { dur: s(D[0] + 1.0), el: (h) => <Hook hold={h} /> },
  { dur: s(D[1] + 0.8), el: (h) => <Time hold={h} /> },
  { dur: s(D[2] + 0.9), el: (h) => <Deal hold={h} />, impact: true },
  { dur: s(D[3] + 0.9), el: (h) => <Floor hold={h} /> },
  { dur: s(D[4] + 0.8), el: (h) => <BuiltIn hold={h} /> },
  { dur: s(D[5] + 0.9), el: (h) => <Milestone hold={h} kicker="At twenty-four" head="Four years of college money" value={744000} unit="taken out" foot="On $280,000 paid in." /> },
  { dur: s(D[6] + 0.9), el: (h) => <Milestone hold={h} kicker="From fifty-six" head="Every year, to ninety-six" value={341000} unit="a year" foot="Retirement income, illustrated." /> },
  { dur: s(D[7] + 1.0), el: (h) => <Ninety hold={h} />, impact: true },
  { dur: s(D[8] + 0.8), el: (h) => <Generations hold={h} /> },
  { dur: s(D[9] + 0.6), el: (h) => <Disclosure hold={h} /> },
  { dur: s(D[10] + 1.8), el: (h) => <Cta hold={h} />, impact: true },
]
const TL = timeline(BEATS, (grid as { beats: number[] }).beats)
export const MDB_FRAMES = TL.total
export const MDB_FPS = FPS

export const MillionDollarBaby: React.FC = () => (
  <AbsoluteFill style={{ background: NAVY }}>
    {BEATS.map((b, i) => (
      <Sequence key={i} from={TL.starts[i]} durationInFrames={TL.durs[i] + 6}>
        {b.el(TL.durs[i], i)}
        {i > 0 && <StreakWipe color={i === 9 ? '#f4f6fa' : GOLD} dir={i % 2 ? 1 : -1} dur={10} />}
      </Sequence>
    ))}
    <FadeOut total={TL.total} dur={20} />
    <AudioBed id="mdb" voice={!('placeholder' in vo)} beats={BEATS} tl={TL} voDur={D} musicFrames={s(100)} loud={0.26} duck={0.09} whoosh={0.14} impacts={BEATS.map((b, i) => b.impact ? TL.starts[i] : -1).filter((f) => f >= 0)} />
  </AbsoluteFill>
)
