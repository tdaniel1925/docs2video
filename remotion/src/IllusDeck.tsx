// ILLUSTRATION DECK — 6 Gemini plates + real animated Remotion text + VO.
//
// Gemini designed and rendered each slide, a strip pass removed its type, and
// everything readable here is re-set as live text: editable, brand-swappable,
// compliance-scrubbable, animated, and timed to the narration.
//
// Coordinates are measured off the PLATES (not the design guides) — the strip
// pass re-composes slightly, so guide positions do not carry over.
import React from 'react'
import {
  AbsoluteFill, Img, Audio, Series, staticFile, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'

const { fontFamily: ARCHIVO } = loadArchivo()
const D = `"${ARCHIVO}", Impact, sans-serif`

export const ILLUS_FPS = 30
/** Scene lengths measured from the VO clips, plus a beat of air on each end. */
const LEN = [247, 328, 436, 467, 379, 288]
export const ILLUS_FRAMES = LEN.reduce((a, b) => a + b, 0)

const NAVY = '#123049'
const CORAL = '#E8443A'
const YELLOW = '#FFC629'
const CREAM = '#F5EFE2'

const useRise = (delay: number, damping = 14) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } })
  return { y: interpolate(s, [0, 1], [54, 0]), o: interpolate(s, [0, 1], [0, 1]), s }
}

/** Digits tick to the real figure. Ease-out so it decelerates into the value
 *  instead of stopping dead; comma-formatted the whole way so it never reads
 *  as a raw integer mid-count. */
const Count: React.FC<{ to: number; delay: number; prefix?: string; suffix?: string }> =
({ to, delay, prefix = '', suffix = '' }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame - delay, [0, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const e = 1 - Math.pow(1 - p, 3)
  return <>{prefix}{Math.round(to * e).toLocaleString('en-US')}{suffix}</>
}

/** Every page ends on the same full-width disclosure bar. Real text, so the
 *  compliance layer can read and scrub it. */
const Bar: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 60 }) => {
  const r = useRise(delay)
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 96,
      display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: r.o,
    }}>
      <span style={{
        fontFamily: D, fontSize: 25, fontWeight: 700, color: CREAM,
        letterSpacing: '.055em', textAlign: 'center', padding: '0 60px',
      }}>{children}</span>
    </div>
  )
}

/** Plate + slow push, with the type INSIDE the same transform.
 *
 *  Text anchored to a badge or box on the plate has to scale with the plate.
 *  Scaling only the image drifts every anchored label off its shape as the
 *  push progresses — text that lines up on frame 1 is visibly wrong by the end
 *  of the scene. One transform over both keeps them locked. */
const Push: React.FC<{ src: string; from?: number; to?: number; children: React.ReactNode }> =
({ src, from = 1.05, to = 1.11, children }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const scale = interpolate(frame, [0, durationInFrames], [from, to])
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {children}
    </AbsoluteFill>
  )
}

const Vo: React.FC<{ n: number }> = ({ n }) => <Audio src={staticFile(`illus-vo/${n}.mp3`)} />

// ── 1 · Cover ──────────────────────────────────────────────────────────────
const Cover: React.FC = () => {
  const eye = useRise(6), name = useRise(16), head = useRise(28), sub = useRise(60), badge = useRise(44, 11)
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <Vo n={0} />
      <Push src="plates/1-cover.jpg">
      <div style={{ position: 'absolute', left: 96, top: 250, width: 1000 }}>
        <div style={{ fontFamily: D, fontSize: 34, fontWeight: 700, color: NAVY, letterSpacing: '.2em',
          opacity: eye.o, transform: `translateY(${eye.y}px)` }}>PREPARED FOR</div>
        <div style={{ fontFamily: D, fontSize: 76, fontWeight: 700, color: NAVY, letterSpacing: '-.02em',
          marginTop: 6, opacity: name.o, transform: `translateY(${name.y}px)` }}>BILL PROPPER</div>
        <div style={{ fontFamily: D, fontSize: 104, fontWeight: 700, color: CORAL, lineHeight: .96,
          letterSpacing: '-.03em', marginTop: 16, opacity: head.o, transform: `translateY(${head.y}px)`,
          textShadow: '3px 3px 0 #fff, -3px -3px 0 #fff, 3px -3px 0 #fff, -3px 3px 0 #fff' }}>
          YOUR PERSONAL<br />ILLUSTRATION
        </div>
        <div style={{ fontFamily: D, fontSize: 32, fontWeight: 700, color: NAVY, letterSpacing: '.05em',
          marginTop: 22, opacity: sub.o, transform: `translateY(${sub.y}px)` }}>
          A PLAN BUILT AROUND YOUR FAMILY
        </div>
      </div>
      {/* Badge shape sits top-left on this plate */}
      <div style={{ position: 'absolute', left: 179, top: 129, width: 320, marginLeft: -160, marginTop: -22,
        textAlign: 'center', fontFamily: D, fontSize: 30, fontWeight: 700, color: CREAM,
        transform: `rotate(-4deg) scale(${interpolate(badge.s, [0, 1], [.7, 1])})`, opacity: badge.o }}>
        PREPARED JULY 2026
      </div>
      </Push>
      <Bar delay={80}>PRESENTED BY TRENT DANIEL. FIGURES SHOWN ARE ILLUSTRATED AND ARE NOT GUARANTEES</Bar>
    </AbsoluteFill>
  )
}

// ── 2 · Premium ────────────────────────────────────────────────────────────
const Premium: React.FC = () => {
  const num = useRise(6), head = useRise(14), lab = useRise(78)
  const b1 = useRise(92, 11), b2 = useRise(104, 11), badge = useRise(50, 11)
  const box = (r: ReturnType<typeof useRise>, top: number, big: string, small: string) => (
    <div style={{ position: 'absolute', left: 1693, top, width: 360, marginLeft: -180, marginTop: -46,
      textAlign: 'center', opacity: r.o, transform: `scale(${interpolate(r.s, [0, 1], [.8, 1])})` }}>
      <div style={{ fontFamily: D, fontSize: 54, fontWeight: 700, color: NAVY, letterSpacing: '-.02em' }}>{big}</div>
      <div style={{ fontFamily: D, fontSize: 22, fontWeight: 700, color: '#5A6B78', letterSpacing: '.1em', marginTop: 4 }}>{small}</div>
    </div>
  )
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <Vo n={1} />
      <Push src="plates/2-premium.jpg">
      <div style={{ position: 'absolute', left: 96, top: 190, width: 1150 }}>
        <div style={{ fontFamily: D, fontSize: 44, fontWeight: 700, color: CORAL, letterSpacing: '.02em',
          opacity: num.o, transform: `translateY(${num.y}px)` }}>01</div>
        <div style={{ fontFamily: D, fontSize: 92, fontWeight: 700, color: NAVY, lineHeight: 1,
          letterSpacing: '-.025em', marginTop: 10, opacity: head.o, transform: `translateY(${head.y}px)` }}>
          WHAT YOU PUT IN
        </div>
        <div style={{ fontFamily: D, fontSize: 184, fontWeight: 700, color: CORAL, lineHeight: 1,
          letterSpacing: '-.035em', marginTop: 18, fontVariantNumeric: 'tabular-nums', paddingBottom: 14,
          textShadow: '4px 4px 0 #fff, -4px -4px 0 #fff, 4px -4px 0 #fff, -4px 4px 0 #fff' }}>
          <Count to={15000} delay={30} prefix="$" />
        </div>
        <div style={{ fontFamily: D, fontSize: 40, fontWeight: 700, color: NAVY, letterSpacing: '.06em',
          opacity: lab.o, transform: `translateY(${lab.y}px)` }}>EVERY YEAR</div>
      </div>
      {box(b1, 553, '20 YEARS', 'PAY PERIOD')}
      {box(b2, 803, '$300,000', 'TOTAL OUTLAY')}
      <div style={{ position: 'absolute', left: 1765, top: 122, width: 330, marginLeft: -165, marginTop: -20,
        textAlign: 'center', fontFamily: D, fontSize: 28, fontWeight: 700, color: CREAM,
        transform: `rotate(-5deg) scale(${interpolate(badge.s, [0, 1], [.7, 1])})`, opacity: badge.o }}>
        LEVEL PREMIUM
      </div>
      </Push>
      <Bar delay={120}>YOUR PREMIUM NEVER INCREASES. FLEXIBLE AFTER YEAR TEN</Bar>
    </AbsoluteFill>
  )
}

// ── 3 · Growth ─────────────────────────────────────────────────────────────
const Growth: React.FC = () => {
  const frame = useCurrentFrame()
  const num = useRise(4), head = useRise(12), lab = useRise(80)
  const b1 = useRise(100, 11), b2 = useRise(112, 11)
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <Vo n={2} />
      <Push src="plates/3-growth.jpg">
      <div style={{ position: 'absolute', left: 84, top: 74, width: 1150 }}>
        <div style={{ fontFamily: D, fontSize: 44, fontWeight: 700, color: NAVY,
          opacity: num.o, transform: `translateY(${num.y}px)` }}>02</div>
        <div style={{ fontFamily: D, fontSize: 92, fontWeight: 700, color: NAVY, lineHeight: 1,
          letterSpacing: '-.025em', marginTop: 12, opacity: head.o, transform: `translateY(${head.y}px)`,
          textShadow: '2px 2px 0 #fff, -2px -2px 0 #fff' }}>WHAT IT BECOMES</div>
        <div style={{ fontFamily: D, fontSize: 168, fontWeight: 700, color: CORAL, lineHeight: 1,
          letterSpacing: '-.03em', marginTop: 8, fontVariantNumeric: 'tabular-nums', paddingBottom: 12,
          textShadow: '4px 4px 0 #fff, -4px -4px 0 #fff, 4px -4px 0 #fff, -4px 4px 0 #fff' }}>
          <Count to={176204} delay={34} prefix="$" />
        </div>
        <div style={{ fontFamily: D, fontSize: 40, fontWeight: 700, color: NAVY, letterSpacing: '.04em',
          opacity: lab.o, transform: `translateY(${lab.y}px)` }}>PROJECTED CASH VALUE</div>
      </div>
      <div style={{ position: 'absolute', left: 1447, top: 689, width: 420, marginLeft: -210, marginTop: -26,
        textAlign: 'center', transform: `rotate(-10deg) scale(${interpolate(b1.s, [0, 1], [.72, 1])})`,
        opacity: b1.o, fontFamily: D, fontSize: 38, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>
        98% PARTICIPATION
      </div>
      <div style={{ position: 'absolute', left: 1642, top: 802, width: 340, marginLeft: -170, marginTop: -24,
        textAlign: 'center', transform: `rotate(-8deg) scale(${interpolate(b2.s, [0, 1], [.72, 1])})`,
        opacity: b2.o, fontFamily: D, fontSize: 34, fontWeight: 700, color: CREAM, whiteSpace: 'nowrap' }}>
        FLOOR OF 0%
      </div>
      </Push>
      {/* One sweep so the plate's static chart reads as drawn, not photographed */}
      <AbsoluteFill style={{
        background: `linear-gradient(90deg,transparent,${YELLOW}33,transparent)`, mixBlendMode: 'screen',
        transform: `translateX(${interpolate(frame, [20, 76], [-1400, 1900], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      }} />
      <Bar delay={130}>PROJECTED VALUES ARE NOT GUARANTEED. SEE YOUR FULL ILLUSTRATION FOR COMPLETE TERMS</Bar>
    </AbsoluteFill>
  )
}

// ── 4 · Benefits ───────────────────────────────────────────────────────────
const PANELS = [
  { x: 360, title: 'YOUR FAMILY', body: 'A tax-free benefit paid directly to the people you name.', c: CREAM },
  { x: 1067, title: 'YOUR INCOME', body: 'Access to value while living, if you need it.', c: CREAM },
  { x: 1667, title: 'YOUR PLAN', body: 'A floor under the account in a down year.', c: NAVY },
]
const Benefits: React.FC = () => {
  const num = useRise(6), head = useRise(14), badge = useRise(56, 11)
  const p0 = useRise(50, 12), p1 = useRise(70, 12), p2 = useRise(90, 12)
  const rs = [p0, p1, p2]
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <Vo n={3} />
      <Push src="plates/4-benefits.jpg" from={1.04} to={1.08}>
      <div style={{ position: 'absolute', left: 96, top: 44 }}>
        <div style={{ fontFamily: D, fontSize: 34, fontWeight: 700, color: CORAL,
          opacity: num.o, transform: `translateY(${num.y}px)` }}>03</div>
        <div style={{ fontFamily: D, fontSize: 74, fontWeight: 700, color: NAVY, letterSpacing: '-.025em',
          marginTop: 2, opacity: head.o, transform: `translateY(${head.y}px)` }}>WHAT IT PROTECTS</div>
      </div>
      {PANELS.map((p, i) => (
        <div key={p.title} style={{
          position: 'absolute', left: p.x, top: 560, width: 560, marginLeft: -280,
          textAlign: 'center', opacity: rs[i].o, transform: `translateY(${rs[i].y}px)`,
        }}>
          <div style={{ fontFamily: D, fontSize: 54, fontWeight: 700, color: p.c, letterSpacing: '-.02em' }}>{p.title}</div>
          <div style={{ fontFamily: D, fontSize: 27, fontWeight: 400, color: p.c, opacity: .88,
            lineHeight: 1.45, marginTop: 18, padding: '0 46px' }}>{p.body}</div>
        </div>
      ))}
      <div style={{ position: 'absolute', left: 1715, top: 172, width: 340, marginLeft: -170, marginTop: -20,
        textAlign: 'center', fontFamily: D, fontSize: 30, fontWeight: 700, color: NAVY,
        transform: `rotate(-7deg) scale(${interpolate(badge.s, [0, 1], [.7, 1])})`, opacity: badge.o }}>
        LIVING BENEFITS
      </div>
      </Push>
      <Bar delay={130}>ACCESS TO VALUES MAY REDUCE THE BENEFIT PAID. REFER TO YOUR ILLUSTRATION</Bar>
    </AbsoluteFill>
  )
}

// ── 5 · Timeline ───────────────────────────────────────────────────────────
const STOPS = [
  { x: 310, age: 45, cap: 'START', sub: 'First premium paid' },
  { x: 751, age: 55, cap: 'BUILDING', sub: 'Value accumulating' },
  { x: 1206, age: 65, cap: 'OPTIONS', sub: 'Access begins' },
  { x: 1647, age: 85, cap: 'LEGACY', sub: 'Benefit to your family' },
]
const Timeline: React.FC = () => {
  const num = useRise(6), head = useRise(14)
  // Stagger the stops so the eye travels left to right along the band.
  const r = [useRise(46, 12), useRise(70, 12), useRise(94, 12), useRise(118, 12)]
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <Vo n={4} />
      {/* Gentler push here: the outermost stop sits close to the frame edge,
          and a stronger scale drives its caption off screen. */}
      <Push src="plates/5-timeline.jpg" from={1.0} to={1.035}>
      <div style={{ position: 'absolute', left: 96, top: 90 }}>
        <div style={{ fontFamily: D, fontSize: 38, fontWeight: 700, color: CORAL,
          opacity: num.o, transform: `translateY(${num.y}px)` }}>04</div>
        <div style={{ fontFamily: D, fontSize: 80, fontWeight: 700, color: NAVY, letterSpacing: '-.025em',
          marginTop: 4, opacity: head.o, transform: `translateY(${head.y}px)` }}>THE ROAD AHEAD</div>
      </div>
      {STOPS.map((s, i) => (
        <div key={s.age}>
          <div style={{ position: 'absolute', left: s.x, top: 424, width: 320, marginLeft: -160,
            textAlign: 'center', fontFamily: D, fontSize: 32, fontWeight: 700, color: NAVY,
            letterSpacing: '.1em', opacity: r[i].o, transform: `translateY(${r[i].y}px)` }}>{s.cap}</div>
          {/* Age sits inside the plate's navy circle */}
          <div style={{ position: 'absolute', left: s.x, top: 563, width: 240, marginLeft: -120, marginTop: -44,
            textAlign: 'center', fontFamily: D, fontSize: 76, fontWeight: 700, color: CREAM,
            fontVariantNumeric: 'tabular-nums', opacity: r[i].o,
            transform: `scale(${interpolate(r[i].s, [0, 1], [.6, 1])})` }}>{s.age}</div>
          <div style={{ position: 'absolute', left: s.x, top: 706, width: 300, marginLeft: -150,
            textAlign: 'center', fontFamily: D, fontSize: 25, fontWeight: 400, color: '#4A5A66',
            lineHeight: 1.35, opacity: r[i].o, transform: `translateY(${r[i].y}px)` }}>{s.sub}</div>
        </div>
      ))}
      </Push>
      <Bar delay={150}>AGES SHOWN ARE ILLUSTRATIVE. YOUR VALUES DEPEND ON ACTUAL PERFORMANCE</Bar>
    </AbsoluteFill>
  )
}

// ── 6 · Next ───────────────────────────────────────────────────────────────
const CONTACT = [
  { label: 'CALL', value: '1-555-014-2200' },
  { label: 'EMAIL', value: 'trent@example.com' },
  { label: 'ONLINE', value: 'example.com' },
]
const Next: React.FC = () => {
  const head = useRise(8)
  const r = [useRise(56, 12), useRise(70, 12), useRise(84, 12)]
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <Vo n={5} />
      <Push src="plates/6-next.jpg">
      <div style={{ position: 'absolute', left: 96, top: 210, width: 1000, opacity: head.o,
        transform: `translateY(${head.y}px)` }}>
        <div style={{ fontFamily: D, fontSize: 118, fontWeight: 700, color: NAVY, lineHeight: .98,
          letterSpacing: '-.035em' }}>TALK IT<br />THROUGH</div>
      </div>
      {/* Contact rows sit inside the plate's empty cream panel */}
      {CONTACT.map((c, i) => (
        <div key={c.label} style={{ position: 'absolute', left: 170 + i * 270, top: 700,
          opacity: r[i].o, transform: `translateY(${r[i].y}px)` }}>
          <div style={{ fontFamily: D, fontSize: 19, fontWeight: 700, color: '#8A8578', letterSpacing: '.18em' }}>{c.label}</div>
          <div style={{ fontFamily: D, fontSize: 27, fontWeight: 700, color: CORAL, marginTop: 6 }}>{c.value}</div>
        </div>
      ))}
      </Push>
      <Bar delay={110}>PREPARED BY TRENT DANIEL FOR EDUCATION ONLY. NOT A CONTRACT. SEE YOUR FULL ILLUSTRATION</Bar>
    </AbsoluteFill>
  )
}

const SCENES = [Cover, Premium, Growth, Benefits, Timeline, Next]

export const IllusDeck: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: NAVY }}>
    <Series>
      {SCENES.map((S, i) => (
        <Series.Sequence key={i} durationInFrames={LEN[i]}>
          <S />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
)
