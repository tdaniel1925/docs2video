import React from 'react'
import {
  AbsoluteFill, Audio, Img, Sequence, OffthreadVideo, staticFile,
  useCurrentFrame, interpolate, Easing, spring,
} from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { MusicBed } from '../lib/musicbed'
import longPlan from '../../public/commercials/jordyn-v2/plan-long.json'
import shortPlan from '../../public/commercials/jordyn-v2/plan-short.json'

/**
 * JORDYN v2 — the commercial, in two cuts.
 *
 * WHY THE NUMBERS ARE DRAWN HERE AND NOT GENERATED. Every figure in this film
 * — the payback, the monthly cost, the multiple — is typed, animated type on a
 * flat ground. An image model cannot be trusted with a digit, and shot "payback"
 * is the single most important frame in the piece. Generated pictures carry the
 * feeling; code carries the facts.
 *
 * WHY IT CUTS SO FAST. v1 held one shot per line of narration and averaged 4.9
 * seconds a shot, which reads as a slideshow. Here the shot list comes from
 * scripts/jordyn-beats.mjs, where pace is a property of the ACT, so a single
 * sentence carries three or four cuts underneath it. Average is 1.64s, and 58
 * of 95 shots are under 1.5 seconds. Five key frames still hold 3-4s, because
 * if everything is fast then nothing lands.
 *
 * ONE COMPONENT, TWO FILMS. The long cut and the 45-second cut differ only in
 * which plan they read.
 */

const { fontFamily: F } = loadInter()
export const JV2_FPS = 30
const FPS = JV2_FPS
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* jordyn.app's own tokens, read from its globals.css — not approximated. */
const CREAM = '#faf9f5'
const CREAM_D = '#f0eee6'
const INK = '#3d3929'
const INK_SOFT = '#6b6759'
const CLAY = '#c96442'
const SAGE = '#7d8c6f'

type Shot = {
  kind: string; act: string; hold: number; key: boolean
  line: string | null; accent: string | null; see: string | null
  build: string | null; src: string | null; poster: string | null
  vo: string | null; voFile: string | null; voSecs: number | null
}
type Plan = { name: string; music: string | null; bpm: number; shots: Shot[] }

const ASSET = (n: string) => staticFile(`commercials/jordyn-v2/${n}`)

/* ── timing ───────────────────────────────────────────────────────────────
 *
 * Each shot's hold comes from the beat sheet, but a line of narration must
 * never be cut off mid-word. So a shot GROUP (the shot carrying a line plus
 * the silent ones after it) is stretched if the measured audio is longer than
 * the group — proportionally, so the fast cutting inside it is preserved.
 */
function layout(plan: Plan) {
  const holds = plan.shots.map((s) => s.hold)
  for (let i = 0; i < plan.shots.length; i++) {
    const s = plan.shots[i]
    if (!s.voSecs) continue
    let end = i + 1
    while (end < plan.shots.length && !plan.shots[end].vo) end++
    const span = holds.slice(i, end).reduce((a, b) => a + b, 0)
    const need = s.voSecs + 0.25
    if (span >= need) continue
    const k = need / span
    for (let j = i; j < end; j++) holds[j] *= k
  }
  const starts: number[] = []
  let t = 0
  for (const h of holds) { starts.push(Math.round(t * FPS)); t += h }
  return { starts, frames: holds.map((h) => Math.max(1, Math.round(h * FPS))), total: Math.round(t * FPS) }
}

/* ── the moving picture ───────────────────────────────────────────────────
 *
 * A small push on every shot. Cycling directions so ninety-five shots do not
 * all drift the same way, which is what makes generated footage read as cheap.
 * Video gets less of it than a still, because the footage already moves.
 */
const MOVES = [
  { from: 1.04, to: 1.10, x: 0, y: 0 },
  { from: 1.10, to: 1.04, x: 0, y: 0 },
  { from: 1.05, to: 1.11, x: -18, y: 0 },
  { from: 1.09, to: 1.03, x: 16, y: 0 },
  { from: 1.03, to: 1.09, x: 0, y: -14 },
  { from: 1.08, to: 1.03, x: 0, y: 12 },
]

const Picture: React.FC<{ shot: Shot; hold: number; i: number }> = ({ shot, hold, i }) => {
  const frame = useCurrentFrame()
  const mv = MOVES[i % MOVES.length]
  const t = interpolate(frame, [0, Math.max(1, hold)], [0, 1], { extrapolateRight: 'clamp', easing: Easing.linear })
  const moving = shot.kind === 'stock' || (shot.kind === 'anim' && shot.src?.endsWith('.mp4'))
  /*
   * A SCREENSHOT MUST NOT BE CROPPED.
   *
   * The first render zoomed every shot to 1.04-1.11 and used objectFit cover,
   * which sliced the left sidebar clean off the product screens — the UI was
   * the whole reason for showing them. Footage can be cropped freely (it is
   * texture), but a screenshot is evidence, so it is fitted whole with a much
   * gentler push.
   */
  const isShot = shot.kind === 'product'
  const k = isShot ? 0.22 : moving ? 0.45 : 1
  const scale = isShot
    ? 1 + (mv.to - mv.from) * t * k
    : mv.from + (mv.to - mv.from) * t * k

  /*
   * A FAST CUT NEEDS A FAST DISSOLVE. Three frames — a tenth of a second.
   * Long enough that nothing strobes, short enough that a 0.9-second shot is
   * still a cut rather than a fade.
   */
  const fade = Math.min(clamp(frame / 3, 0, 1), clamp((hold - frame) / 3, 0, 1))
  const src = shot.src ?? shot.poster
  if (!src) return null

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: CREAM }}>
      <AbsoluteFill style={{
        transform: `scale(${scale}) translate(${(isShot ? 0 : mv.x) * t * k}px, ${(isShot ? 0 : mv.y) * t * k}px)`,
        opacity: fade,
      }}>
        {src.endsWith('.mp4')
          ? <OffthreadVideo src={ASSET(src)} muted
              /* stock clips are longer than their slot; start a little in so
                 the shot is not always the clip's first frozen moment */
              startFrom={Math.round(0.6 * FPS)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Img src={ASSET(src)} style={{ width: '100%', height: '100%', objectFit: isShot ? 'contain' : 'cover' }} />}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ── type ─────────────────────────────────────────────────────────────────── */

const Line: React.FC<{ line: string; accent: string | null; hold: number }> = ({ line, accent, hold }) => {
  const frame = useCurrentFrame()
  const k = clamp(spring({ frame, fps: FPS, config: { damping: 26, stiffness: 150, mass: 0.7 } }), 0, 1)
  const out = clamp((hold - frame) / 5, 0, 1)
  const at = accent ? line.indexOf(accent) : -1
  const parts = at >= 0 ? [line.slice(0, at), accent as string, line.slice(at + (accent as string).length)] : [line, '', '']
  return (
    <div style={{
      position: 'absolute', left: 92, right: 92, bottom: 92, zIndex: 30,
      fontFamily: F, fontWeight: 700, fontSize: 66, lineHeight: 1.14,
      letterSpacing: '-0.025em', color: INK, opacity: Math.min(k, out),
    }}>
      <span style={{ display: 'inline-block', transform: `translateY(${(1 - k) * 14}px)` }}>
        {parts[0]}<span style={{ color: CLAY }}>{parts[1]}</span>{parts[2]}
      </span>
    </div>
  )
}

/** A cream wash so type stays readable over footage without crushing it. */
const Wash: React.FC = () => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 400, zIndex: 20,
    background: `linear-gradient(0deg, ${CREAM} 0%, rgba(250,249,245,0.82) 44%, transparent 100%)`,
  }} />
)

/* ── built scenes: everything factual ─────────────────────────────────────── */

const Big: React.FC<{ children: React.ReactNode; size?: number; color?: string }> = ({ children, size = 200, color = INK }) => (
  <div style={{
    fontFamily: F, fontWeight: 800, fontSize: size, letterSpacing: '-0.04em',
    color, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
  }}>{children}</div>
)
const Cap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: F, fontWeight: 600, fontSize: 30, color: INK_SOFT, marginTop: 20, letterSpacing: '-0.01em' }}>{children}</div>
)
const Centre: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: CREAM, alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ textAlign: 'center' }}>{children}</div>
  </AbsoluteFill>
)

/** Count a number up, settling before the shot ends. */
const useCount = (to: number, hold: number, from = 0) => {
  const frame = useCurrentFrame()
  return Math.round(interpolate(frame, [2, Math.max(6, hold * 0.62)], [from, to], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  }))
}

const Built: React.FC<{ build: string; hold: number }> = ({ build, hold }) => {
  const frame = useCurrentFrame()
  const money = (n: number) => `$${n.toLocaleString('en-US')}`

  switch (build) {
    /* 60 emails arriving, 4 of them marked — the visual of the line. */
    case 'inbox-count': {
      const n = useCount(60, hold)
      return (
        <AbsoluteFill style={{ background: CREAM, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 46px)', gap: 11 }}>
            {Array.from({ length: 60 }, (_, i) => {
              const on = i < n
              const hot = i % 17 === 3
              return <div key={i} style={{
                width: 46, height: 32, borderRadius: 3,
                background: on ? (hot ? CLAY : CREAM_D) : 'transparent',
                border: `1.5px solid ${on ? (hot ? CLAY : CREAM_D) : 'transparent'}`,
                transform: `scale(${on ? 1 : 0.6})`, opacity: on ? 1 : 0,
              }} />
            })}
          </div>
          <div style={{ marginTop: 36, display: 'flex', gap: 56, alignItems: 'baseline' }}>
            <Big size={116}>{n}</Big>
            <Big size={116} color={CLAY}>4</Big>
          </div>
        </AbsoluteFill>
      )
    }

    /* an unsent invoice, the week running past it */
    case 'invoice-days': {
      const days = ['TUE', 'WED', 'THU', 'FRI']
      const on = Math.min(days.length, Math.floor(interpolate(frame, [0, hold * 0.8], [1, 4.9], { extrapolateRight: 'clamp' })))
      return (
        <Centre>
          <div style={{ display: 'flex', gap: 22, justifyContent: 'center', marginBottom: 40 }}>
            {days.map((d, i) => (
              <div key={d} style={{
                fontFamily: F, fontWeight: 700, fontSize: 40, padding: '20px 30px', borderRadius: 6,
                background: i < on ? (i === 0 ? CLAY : CREAM_D) : 'transparent',
                color: i === 0 && i < on ? CREAM : INK,
                opacity: i < on ? 1 : 0.16, letterSpacing: '0.04em',
              }}>{d}</div>
            ))}
          </div>
          <Big size={92}>Still unsent</Big>
        </Centre>
      )
    }

    /* a chat window shrinking to nothing — "not a chatbot" */
    case 'not-chatbot': {
      const s = interpolate(frame, [0, hold * 0.85], [1, 0.12], { extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) })
      const o = interpolate(frame, [hold * 0.5, hold * 0.9], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      return (
        <Centre>
          <div style={{
            width: 620, height: 360, borderRadius: 10, background: CREAM_D,
            border: `2px solid ${INK_SOFT}22`, transform: `scale(${s})`, opacity: o,
            display: 'flex', flexDirection: 'column', gap: 16, padding: 34,
          }}>
            {[0.75, 0.5, 0.62].map((w, i) => (
              <div key={i} style={{ height: 34, width: `${w * 100}%`, borderRadius: 5, background: i % 2 ? CLAY + '33' : INK_SOFT + '22', alignSelf: i % 2 ? 'flex-end' : 'flex-start' }} />
            ))}
          </div>
        </Centre>
      )
    }

    /* the services she plugs into */
    case 'connect': {
      const names = ['Gmail', 'Outlook', 'Fastmail', 'Your number']
      return (
        <Centre>
          <div style={{ display: 'flex', gap: 26, justifyContent: 'center', alignItems: 'center' }}>
            {names.map((nm, i) => {
              const k = clamp(spring({ frame: frame - i * 4, fps: FPS, config: { damping: 24, stiffness: 170, mass: 0.6 } }), 0, 1)
              return <div key={nm} style={{
                fontFamily: F, fontWeight: 700, fontSize: 34, padding: '22px 30px', borderRadius: 8,
                background: CREAM_D, color: INK, opacity: k, transform: `translateY(${(1 - k) * 18}px)`,
                letterSpacing: '-0.01em',
              }}>{nm}</div>
            })}
          </div>
          <Cap>connected, not replaced</Cap>
        </Centre>
      )
    }

    /* an invoice flipping to PAID */
    case 'invoice-paid': {
      const flip = clamp(spring({ frame: frame - 6, fps: FPS, config: { damping: 18, stiffness: 190, mass: 0.6 } }), 0, 1)
      return (
        <Centre>
          <Big size={118} color={INK}>Invoice</Big>
          <div style={{ marginTop: 26, transform: `scale(${0.7 + flip * 0.3})`, opacity: flip }}>
            <div style={{
              display: 'inline-block', fontFamily: F, fontWeight: 800, fontSize: 84,
              color: CREAM, background: SAGE, padding: '14px 44px', borderRadius: 8, letterSpacing: '-0.02em',
            }}>PAID</div>
          </div>
        </Centre>
      )
    }

    /* eight hour-blocks stacking */
    case 'hours-week': {
      const on = interpolate(frame, [0, hold * 0.7], [0, 8], { extrapolateRight: 'clamp' })
      return (
        <Centre>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'flex-end', height: 250 }}>
            {Array.from({ length: 8 }, (_, i) => {
              const k = clamp(on - i, 0, 1)
              return <div key={i} style={{ width: 70, height: 220 * k, background: CLAY, borderRadius: 5 }} />
            })}
          </div>
          <Cap>eight hours, every week</Cap>
        </Centre>
      )
    }

    /* 52 squares; ten lift out — "ten working weeks a year, gone" */
    case 'year-grid': {
      const lift = interpolate(frame, [hold * 0.18, hold * 0.72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
      return (
        <AbsoluteFill style={{ background: CREAM, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 52px)', gap: 10 }}>
            {Array.from({ length: 52 }, (_, i) => {
              const gone = i % 5 === 2 && i < 50
              return <div key={i} style={{
                width: 52, height: 40, borderRadius: 4,
                background: gone ? CLAY : CREAM_D,
                transform: gone ? `translateY(${-lift * 140}px)` : 'none',
                opacity: gone ? 1 - lift * 0.75 : 1,
              }} />
            })}
          </div>
          <div style={{ marginTop: 42, fontFamily: F, fontWeight: 800, fontSize: 66, color: INK, letterSpacing: '-0.03em' }}>
            <span style={{ color: CLAY }}>Ten weeks</span> a year
          </div>
        </AbsoluteFill>
      )
    }

    case 'monthly-cost': {
      const n = useCount(2600, hold)
      return <Centre><Big size={230} color={CLAY}>{money(n)}</Big><Cap>of your own time, every month</Cap></Centre>
    }

    /* the cost of a hire stacking taller and taller */
    case 'hire-stack': {
      const rows = [['Salary', 50000], ['Payroll tax', 4000], ['Training', 6000]] as const
      const on = interpolate(frame, [0, hold * 0.72], [0, 3], { extrapolateRight: 'clamp' })
      return (
        <Centre>
          <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 10, alignItems: 'center' }}>
            {rows.map(([label, v], i) => {
              const k = clamp(on - i, 0, 1)
              return (
                <div key={label} style={{
                  display: 'flex', gap: 24, alignItems: 'baseline', justifyContent: 'space-between',
                  width: 640, padding: '16px 28px', borderRadius: 6, background: CREAM_D,
                  opacity: k, transform: `translateY(${(1 - k) * 22}px)`,
                }}>
                  <span style={{ fontFamily: F, fontWeight: 600, fontSize: 32, color: INK_SOFT }}>{label}</span>
                  <span style={{ fontFamily: F, fontWeight: 800, fontSize: 44, color: INK, fontVariantNumeric: 'tabular-nums' }}>{money(v)}+</span>
                </div>
              )
            })}
          </div>
          <Cap>to hire it out</Cap>
        </Centre>
      )
    }

    /*
     * THE MONEY SHOT. The most important frame in the film: $499 against that
     * stack, and five working days ticking off. Typed, never generated.
     */
    case 'payback': {
      const days = Math.min(5, Math.floor(interpolate(frame, [hold * 0.3, hold * 0.78], [0, 5.9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })))
      const k = clamp(spring({ frame, fps: FPS, config: { damping: 22, stiffness: 160, mass: 0.7 } }), 0, 1)
      return (
        <AbsoluteFill style={{ background: CREAM, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ opacity: k, transform: `translateY(${(1 - k) * 20}px)`, textAlign: 'center' }}>
            <Big size={210} color={CLAY}>$499</Big>
            <div style={{ fontFamily: F, fontWeight: 600, fontSize: 30, color: INK_SOFT, marginTop: 12 }}>a month &middot; about $16 a day</div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 54 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} style={{
                width: 74, height: 74, borderRadius: 8,
                background: i < days ? SAGE : CREAM_D,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F, fontWeight: 800, fontSize: 34,
                color: i < days ? CREAM : INK_SOFT + '55',
              }}>{i + 1}</div>
            ))}
          </div>
          <div style={{ fontFamily: F, fontWeight: 800, fontSize: 54, color: INK, marginTop: 34, letterSpacing: '-0.025em' }}>
            Paid back in <span style={{ color: SAGE }}>five days</span>
          </div>
        </AbsoluteFill>
      )
    }

    case 'multiple': {
      const k = clamp(spring({ frame, fps: FPS, config: { damping: 20, stiffness: 170, mass: 0.7 } }), 0, 1)
      return (
        <Centre>
          <div style={{ transform: `scale(${0.72 + k * 0.28})`, opacity: k }}>
            <Big size={300} color={SAGE}>5&times;</Big>
          </div>
          <Cap>back, every month after that</Cap>
        </Centre>
      )
    }

    /* two response clocks — one answers, one keeps ticking */
    case 'race-clocks': {
      const p = interpolate(frame, [0, hold], [0, 1], { extrapolateRight: 'clamp' })
      const mins = Math.round(interpolate(p, [0, 1], [0, 220]))
      return (
        <AbsoluteFill style={{ background: CREAM, flexDirection: 'row' }}>
          <div style={{ flex: 1, background: SAGE + '1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Big size={150} color={SAGE}>2 min</Big>
            <Cap>they answered</Cap>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Big size={150} color={CLAY}>{mins} min</Big>
            <Cap>still waiting on you</Cap>
          </div>
        </AbsoluteFill>
      )
    }

    /* three setup steps checking off */
    case 'steps': {
      const steps = ['Type your industry', 'Her brain builds', 'Connect your email']
      const on = interpolate(frame, [0, hold * 0.8], [0, 3], { extrapolateRight: 'clamp' })
      return (
        <Centre>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'flex-start' }}>
            {steps.map((s, i) => {
              const k = clamp(on - i, 0, 1)
              return (
                <div key={s} style={{ display: 'flex', gap: 22, alignItems: 'center', opacity: 0.2 + k * 0.8 }}>
                  <div style={{
                    width: 54, height: 54, borderRadius: 27, background: k > 0.6 ? SAGE : CREAM_D,
                    color: k > 0.6 ? CREAM : INK_SOFT, fontFamily: F, fontWeight: 800, fontSize: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{k > 0.6 ? '✓' : i + 1}</div>
                  <span style={{ fontFamily: F, fontWeight: 700, fontSize: 46, color: INK, letterSpacing: '-0.02em' }}>{s}</span>
                </div>
              )
            })}
          </div>
          <Cap>about thirty seconds</Cap>
        </Centre>
      )
    }

    default:
      return <AbsoluteFill style={{ background: CREAM }} />
  }
}

/* ── logo and the ask ─────────────────────────────────────────────────────── */

const Logo: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const k = clamp(spring({ frame, fps: FPS, config: { damping: 24, stiffness: 120, mass: 0.9 } }), 0, 1)
  const out = clamp((hold - frame) / 6, 0, 1)
  return (
    <AbsoluteFill style={{ background: CREAM, alignItems: 'center', justifyContent: 'center' }}>
      <Img src={ASSET('logo.png')} style={{
        width: 620, opacity: Math.min(k, out),
        transform: `translateY(${(1 - k) * 14}px) scale(${0.94 + k * 0.06})`,
      }} />
    </AbsoluteFill>
  )
}

/**
 * THE ASK. Held longest of anything in the film, deliberately — this is the
 * one frame a viewer has to be able to read and act on.
 */
const CTA: React.FC = () => {
  const frame = useCurrentFrame()
  const s = (d: number) => clamp(spring({ frame: frame - d, fps: FPS, config: { damping: 24, stiffness: 140, mass: 0.8 } }), 0, 1)
  return (
    <AbsoluteFill style={{ background: CREAM, alignItems: 'center', justifyContent: 'center' }}>
      <Img src={ASSET('logo.png')} style={{ width: 480, opacity: s(0), transform: `translateY(${(1 - s(0)) * 12}px)` }} />
      <div style={{ marginTop: 40, display: 'flex', gap: 20, alignItems: 'center', opacity: s(8) }}>
        <span style={{ fontFamily: F, fontWeight: 800, fontSize: 62, color: INK, letterSpacing: '-0.03em' }}>$499</span>
        <span style={{ fontFamily: F, fontWeight: 600, fontSize: 34, color: INK_SOFT }}>a month</span>
        <span style={{ width: 2, height: 44, background: CREAM_D }} />
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: 40, color: SAGE }}>14 days free</span>
      </div>
      <div style={{
        marginTop: 46, fontFamily: F, fontWeight: 800, fontSize: 92, color: CLAY,
        letterSpacing: '-0.035em', opacity: s(16), transform: `translateY(${(1 - s(16)) * 16}px)`,
      }}>jordyn.app</div>
    </AbsoluteFill>
  )
}

/* ── the film ─────────────────────────────────────────────────────────────── */

function Film({ plan }: { plan: Plan }) {
  const { starts, frames, total } = layout(plan)
  const musicFrames = Math.round(135 * FPS)

  /* music sits under the voice: down while she speaks, up between lines, and
     almost silent under the trust beat so the quiet lands */
  const duck = (f: number) => {
    const inF = clamp(f / (1.2 * FPS), 0, 1)
    const outF = clamp((total - f) / (2.0 * FPS), 0, 1)
    let speaking = false
    let hush = false
    plan.shots.forEach((s, i) => {
      const a = starts[i]
      if (s.voSecs && f >= a && f < a + s.voSecs * FPS) speaking = true
      if (s.act === 'close' && s.key && f >= a && f < a + frames[i]) hush = true
    })
    return Math.min(inF, outF) * (hush ? 0.05 : speaking ? 0.13 : 0.26)
  }

  return (
    <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
      {plan.shots.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={frames[i]}>
          {s.kind === 'logo' ? <Logo hold={frames[i]} />
            : s.kind === 'cta' ? <CTA />
              : s.kind === 'built' ? <Built build={s.build ?? ''} hold={frames[i]} />
                : <Picture shot={s} hold={frames[i]} i={i} />}

          {/* the built scenes carry their own type; footage needs a wash */}
          {s.line && s.kind !== 'built' && s.kind !== 'cta' && s.kind !== 'logo' && <Wash />}
          {s.line && s.kind !== 'built' && s.kind !== 'cta' && s.kind !== 'logo' && (
            <Line line={s.line} accent={s.accent} hold={frames[i]} />
          )}
        </Sequence>
      ))}

      {plan.shots.map((s, i) => (
        s.voFile ? <Sequence key={`v${i}`} from={starts[i]}><Audio src={ASSET(s.voFile)} /></Sequence> : null
      ))}

      {plan.music && (
        <Sequence from={0} durationInFrames={total}>
          <MusicBed src={`commercials/jordyn-v2/${plan.music}`} musicFrames={musicFrames} volume={duck} />
        </Sequence>
      )}
    </AbsoluteFill>
  )
}

const LONG = longPlan as unknown as Plan
const SHORT = shortPlan as unknown as Plan

export const JV2_LONG_FRAMES = layout(LONG).total
export const JV2_SHORT_FRAMES = layout(SHORT).total
export const JordynV2Long: React.FC = () => <Film plan={LONG} />
export const JordynV2Short: React.FC = () => <Film plan={SHORT} />
