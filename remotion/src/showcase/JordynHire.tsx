import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import vo from '../../public/showcase/jordyn-hire/vo.json'
import grid from '../../public/showcase/jordyn-hire/beatgrid.json'
import { StreakWipe, Alive, SettleSweep, LogoBug, CountUp } from '../lib/pizzazz'
import { Camera, Tick, Sheen, Shake, Layer, Typed, ease, hit } from './motion'
import { Slam, Impact, Flash, WordsOnBeat, Parallax, FocusIn, LightRay, Vignette, Swarm, Dial } from './wow'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from '../lib/audio'
import { MusicBed } from '../lib/musicbed'

/**
 * JORDYN — "the perfect employee".
 *
 * BUILT IN THE RESTYLEZ LAUNCH STYLE, deliberately and closely: bold colour
 * grounds rather than darkness, real screens and real illustrations rather
 * than abstract shapes, a logo slam, big kinetic type that lands a phrase at a
 * time, streak wipes between beats and a settle sweep on each one.
 *
 * The first attempt at this film was an abstract glowing orb on black. It was
 * wrong in the way that matters — it showed nothing the customer would
 * recognise as Jordyn, used none of the brand's own art, and looked nothing
 * like the launch film it was supposed to match. What follows uses the REAL
 * assets: the wordmark, and the editorial illustrations in her own warm
 * terracotta-and-sage style.
 *
 * THE STORY is still one idea rather than a feature tour — every business
 * owner wants the same impossible person, and now they can have her — so the
 * capabilities appear as four proofs, not nine.
 */

const { fontFamily: F } = loadInter()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30
const s = (sec: number) => Math.round(sec * FPS)

/* Jordyn's own palette, read off her logo and illustrations. */
const CLAY = '#B5563A'      // the wordmark
const TERRA = '#C9674A'
const SAGE = '#8FA98B'
const CREAM = '#F7F1E8'
const PAPER = '#FDFAF5'
const INK = '#2B2320'
const WHITE = '#ffffff'

const R = (n: string) => staticFile(`showcase/jordyn-hire/${n}`)
const D = (vo as { durations: number[] }).durations

const Ground: React.FC<{ bg: string; children: React.ReactNode }> = ({ bg, children }) => (
  <AbsoluteFill style={{ background: bg, fontFamily: F }}>{children}</AbsoluteFill>
)

const pop = (frame: number, at: number, damping = 13) =>
  clamp(spring({ frame: frame - at, fps: FPS, config: { damping, stiffness: 160, mass: 0.8 } }), 0, 1.2)

const Scene: React.FC<{
  bg: string
  kicker?: string
  kColor?: string
  head: React.ReactNode
  headColor?: string
  headSize?: number
  headAt?: number
  at?: number
  children: React.ReactNode
}> = ({ bg, kicker, kColor = CLAY, head, headColor = INK, headSize = 62, headAt = 3, children }) => {
  const frame = useCurrentFrame()
  /*
   * TWO STAGES, not one fade. The kicker arrives first and the headline
   * follows four frames later, so the line reads as being delivered rather
   * than appearing. Four frames is enough to feel deliberate and too short to
   * feel slow.
   */
  const kp = ease(frame, headAt)
  const hp = ease(frame, headAt + 4)
  return (
    <Ground bg={bg}>
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', padding: '96px 110px 84px' }}>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>
        <div style={{ flex: '0 0 auto', textAlign: 'center', paddingTop: 28 }}>
          {kicker && (
            <div style={{
              fontWeight: 800, fontSize: 24, letterSpacing: '0.18em', textTransform: 'uppercase', color: kColor, marginBottom: 12,
              opacity: clamp(kp * 1.8, 0, 1), transform: `translateY(${(1 - clamp(kp, 0, 1)) * 16}px)`,
            }}>{kicker}</div>
          )}
          <div style={{
            fontWeight: 900, fontSize: headSize, color: headColor, lineHeight: 1.06, letterSpacing: '-0.03em', paddingBottom: '0.06em',
            opacity: clamp(hp * 1.6, 0, 1), transform: `translateY(${(1 - clamp(hp, 0, 1)) * 26}px)`,
          }}>{head}</div>
        </div>
      </AbsoluteFill>
    </Ground>
  )
}

/** One of her illustrations, landing like a card on a table. */
const Illo: React.FC<{ src: string; w: number; x: number; y: number; at: number; rot?: number }> =
({ src, w, x, y, at, rot = 0 }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, at, 12)
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${0.86 + 0.14 * clamp(p, 0, 1)})`, opacity: clamp(p * 2, 0, 1) }}>
      <Img src={src} style={{ width: '100%', display: 'block', borderRadius: 18, boxShadow: '0 26px 60px rgba(43,35,32,0.20)' }} />
    </div>
  )
}

/* ── BEAT 0 — THE OPENING MARK. Two seconds, then the film starts. ─────── */
const OpenBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  /*
   * EVERY COMMERCIAL OPENS ON ITS BRAND. The first cut began on a bare job
   * advert, so nobody knew whose film they were watching until eighteen
   * seconds in. This is short on purpose — the mark arrives, breathes, and
   * gets out of the way.
   */
  const p = ease(frame, 2, 18, 130)
  const k = clamp(p, 0, 1)
  const out = clamp((frame - (hold - 12)) / 12, 0, 1)
  return (
    <Ground bg={PAPER}>
      <Camera hold={hold} dir="in" amount={0.03}>
        <Alive intensity={0.4}>
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', opacity: (1 - out) }}>
              <div style={{ transform: `scale(${0.9 + 0.1 * k})`, opacity: clamp(p * 2, 0, 1) }}>
                <Img src={R('logo.png')} style={{ width: 720, display: 'block' }} />
              </div>
              <div style={{
                fontWeight: 800, fontSize: 26, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#A99C91',
                marginTop: 26,
                opacity: clamp(ease(frame, 12) * 1.8, 0, 1),
                transform: `translateY(${(1 - clamp(ease(frame, 12), 0, 1)) * 14}px)`,
              }}>Your digital employee</div>
            </div>
          </AbsoluteFill>
        </Alive>
      </Camera>
    </Ground>
  )
}

/* ── BEAT 1 — THE WANT. A job advert nobody can fill. ───────────────────── */
const WantBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const t = clamp(frame / Math.max(1, hold - 10), 0, 1)
  const cx = interpolate(t, [0, 0.5, 1], [1180, 820, 980], { easing: Easing.inOut(Easing.quad) })
  const cy = interpolate(t, [0, 0.5, 1], [520, 300, 430], { easing: Easing.inOut(Easing.quad) })
  const want = ['Answers before you ask', 'Never drops a ball', 'Never forgets a name', 'Never leaves at five']
  // The headline lands in two stages: the setup, then the turn.
  return (
    <Scene bg={CREAM} kicker="The role" head={<>Every business owner wants<br /><span style={{ color: CLAY }}>the same person.</span></>} headSize={62} headAt={2}>
      <FocusIn dur={14} from={20}>
      <Camera hold={hold} dir="in" amount={0.035} origin="50% 30%">
        <Alive intensity={0.6}>
          <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', width: 1080, background: WHITE, borderRadius: 16, boxShadow: '0 30px 80px rgba(43,35,32,0.16)', padding: '40px 52px' }}>
            <div style={{ fontWeight: 900, fontSize: 34, color: INK }}>Wanted</div>
            <div style={{ height: 4, width: 90, background: CLAY, margin: '14px 0 26px' }} />
            {want.map((line, i) => {
              // One requirement every 9 frames, each with its box ticking.
              const at = 6 + i * 9
              const q = ease(frame, at)
              return (
                <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22, opacity: clamp(q * 1.8, 0, 1), transform: `translateX(${(1 - clamp(q, 0, 1)) * 20}px)` }}>
                  <Tick at={at + 4} size={30} color={SAGE} on={SAGE} />
                  <div style={{ fontWeight: 700, fontSize: 36, color: '#55483F' }}>{line}</div>
                </div>
              )
            })}
            <div style={{ marginTop: 26, fontWeight: 800, fontSize: 26, color: '#A99C91', opacity: clamp(ease(frame, 48) * 2, 0, 1) }}>0 applicants</div>
          </div>
          {/* the cursor is deliberate — it is hunting for someone who is not there */}
          <svg style={{ position: 'absolute', left: cx, top: cy, width: 42, height: 50, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.25))' }} viewBox="0 0 24 28">
            <path d="M3 2 L3 22 L8.5 17 L12 26 L15.5 24.5 L12 16 L19 16 Z" fill={INK} stroke={WHITE} strokeWidth="1.5" />
          </svg>
        </Alive>
      </Camera>
      </FocusIn>
      <SettleSweep color={WHITE} hold={hold} />
    </Scene>
  )
}

/* ── BEAT 2 — what the near-misses cost, and the role staying unfilled. ── */
const CostBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const stampAt = Math.round(hold * 0.52)
  const st = hit(frame, stampAt)
  // Six months rip past under "gone by spring".
  const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
  const ripAt = 22
  const m = clamp(Math.floor((frame - ripAt) / 4), 0, MONTHS.length - 1)
  return (
    <Scene bg={CREAM} head={<>Nobody applies. <span style={{ color: CLAY }}>The near-misses cost a fortune.</span></>} headSize={56}>
      <Shake at={stampAt} amount={5} dur={13}>
        <Camera hold={hold} dir="in" amount={0.025} origin="40% 45%">
          <Alive intensity={0.5}>
            <Layer hold={hold} depth={0.35}>
              <Illo src={R('illo-clients.png')} w={540} x={330} y={250} at={3} rot={-4} />
            </Layer>
            <div style={{ position: 'absolute', left: 760, top: 20, width: 700 }}>
              {/* the salary counts up rather than simply appearing */}
              <div style={{ marginBottom: 30, opacity: clamp(ease(frame, 8) * 2, 0, 1) }}>
                <div style={{ fontWeight: 900, fontSize: 72, color: CLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  <CountUp to={90000} prefix="$" dur={30} startAt={8} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 26, color: '#6B5C52', marginTop: 6 }}>a year</div>
              </div>
              {/* and the months tear past */}
              <div style={{ marginBottom: 30, opacity: clamp(ease(frame, ripAt - 4) * 2, 0, 1) }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                  <div style={{ fontWeight: 900, fontSize: 64, color: CLAY, letterSpacing: '-0.03em', lineHeight: 1.15, height: 74, display: 'flex', alignItems: 'center' }}>Gone by</div>
                  {/* the months roll in a window whose lines match the text beside it exactly */}
                  <div style={{ position: 'relative', width: 210, height: 74, overflow: 'hidden' }}>
                    {MONTHS.map((mo, i) => (
                      <div key={mo} style={{
                        position: 'absolute', left: 0, top: 0, height: 74,
                        display: 'flex', alignItems: 'center',
                        fontWeight: 900, fontSize: 64, color: i === m ? CLAY : '#C9BDB2', letterSpacing: '-0.03em', lineHeight: 1.15,
                        transform: `translateY(${(i - m) * 74}px)`,
                        opacity: Math.abs(i - m) > 1 ? 0 : 1,
                      }}>{mo}</div>
                    ))}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 26, color: '#6B5C52', marginTop: 6 }}>if they take it at all</div>
              </div>
              <div style={{ opacity: clamp(ease(frame, 44) * 2, 0, 1), transform: `translateY(${(1 - clamp(ease(frame, 44), 0, 1)) * 20}px)` }}>
                <div style={{ fontWeight: 900, fontSize: 64, color: CLAY, letterSpacing: '-0.03em', lineHeight: 1 }}>9 to 5</div>
                <div style={{ fontWeight: 700, fontSize: 26, color: '#6B5C52', marginTop: 6 }}>and not a minute past</div>
              </div>
            </div>
            {/* the verdict slams on */}
            <div style={{
              position: 'absolute', left: 210, top: 330,
              transform: `rotate(-9deg) scale(${2.2 - clamp(st, 0, 1) * 1.2})`,
              opacity: clamp(st * 2, 0, 1),
              border: `7px solid ${CLAY}`, color: CLAY, borderRadius: 12, padding: '12px 30px',
              fontWeight: 900, fontSize: 46, letterSpacing: '0.06em', background: '#ffffffee',
            }}>UNFILLED</div>
          </Alive>
        </Camera>
      </Shake>
      <SettleSweep color={CLAY} hold={hold} />
    </Scene>
  )
}

/* ── BEAT 3 — THE HERO REVEAL. Short and hard. ─────────────────────────── */
const SlamBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const p = hit(frame, 2)
  const ring = clamp((frame - 5) / 20, 0, 1)
  /*
   * FROM NEARLY BLACK. The ground lifts out of darkness as the mark arrives,
   * so the logo appears to bring the light with it. The first cut held a
   * lit logo for four seconds and it was the deadest shot in the film.
   */
  const lift = clamp((frame - 1) / 14, 0, 1)
  const bursts = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2
    const d = ring * (400 + (i % 3) * 100)
    return <div key={i} style={{ position: 'absolute', left: 960 + Math.cos(a) * d, top: 430 + Math.sin(a) * d, width: 16, height: 16, borderRadius: 4, background: [CLAY, SAGE, TERRA, WHITE][i % 4], opacity: (1 - ring) * 0.9, transform: `rotate(${ring * 320}deg)` }} />
  })
  return (
    <Ground bg={`rgb(${11 + lift * 32}, ${9 + lift * 26}, ${8 + lift * 24})`}>
      <Impact at={2} amount={18}>
      <Shake at={2} amount={6} dur={12}>
        <Camera hold={hold} dir="out" amount={0.05}>
          <Alive intensity={0.5}>
            {frame > 5 && bursts}
            <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 160 }}>
              <div style={{ transform: `scale(${2.6 - 1.6 * clamp(p, 0, 1)})`, opacity: clamp(p * 3, 0, 1) }}>
                <Img src={R('logo.png')} style={{ width: 1000, display: 'block', filter: 'drop-shadow(0 24px 60px rgba(0,0,0,0.7)) brightness(1.35)' }} />
              </div>
            </AbsoluteFill>
          </Alive>
        </Camera>
      </Shake>
      </Impact>
      {/* ONE FRAME OF WHITE as the mark lands. Felt more than seen — it is
          the difference between the logo appearing and the logo ARRIVING. */}
      <Flash at={2} peak={0.9} />
      {/* the two lines arrive fast, right behind the mark */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 0 110px' }}>
        {/*
          * A FIXED WIDTH, because the line builds a word at a time.
          *
          * This wrapper sits in a centering flex column, so it shrinks to fit
          * whatever is currently inside it — and with the words arriving one
          * by one that meant the box grew on every beat and the whole line
          * crept rightwards under the viewer. Giving it the full frame width
          * fixes the centre once, and the words land into a line that never
          * moves.
          */}
        <div style={{ textAlign: 'center', width: 1920 }}>
          <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '0.18em', textTransform: 'uppercase', color: SAGE, marginBottom: 14, opacity: clamp(ease(frame, 12) * 1.8, 0, 1) }}>Your digital employee</div>
          <div style={{ fontWeight: 900, fontSize: 62, color: WHITE, lineHeight: 1.06, letterSpacing: '-0.03em' }}>
            <WordsOnBeat text="So we built her instead." at={17} every={7} accent={SAGE} accentAt={[4]} />
          </div>
        </div>
      </AbsoluteFill>
    </Ground>
  )
}

/**
 * THE PROOF SCENES — Jordyn visibly doing the work.
 *
 * The first cut revealed three status rows and held. A review named the fix
 * exactly: "now the viewer watches Jordyn actually work" is the difference
 * between a bullet list and a commercial. So each of these is a small story
 * with a beginning and an end — mail arrives and is answered, a call rings and
 * books, an invoice is raised, chased and paid.
 */

/* ── EMAIL — the inbox fills, one opens, a reply types itself. ─────────── */
const EmailBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const unread = clamp(Math.floor((frame - 4) / 1.1), 0, 84)
  const openAt = 30
  const opened = frame >= openAt
  return (
    <Scene bg={CREAM} kicker="Every inbox, overnight" head={<>What needs you is waiting <span style={{ color: CLAY }}>before your coffee.</span></>} headSize={56}>
      <Camera hold={hold} dir="in" amount={0.028} origin="55% 40%">
        <Alive intensity={0.5}>
          <Layer hold={hold} depth={0.3}>
            <Illo src={R('illo-email.png')} w={500} x={300} y={250} at={2} rot={-3} />
          </Layer>
          <div style={{ position: 'absolute', left: 690, top: 0, width: 800 }}>
            {/* the counter runs while the messages stack up */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, opacity: clamp(ease(frame, 3) * 2, 0, 1) }}>
              <div style={{ fontWeight: 900, fontSize: 54, color: CLAY, letterSpacing: '-0.02em' }}>{unread}</div>
              <div style={{ fontWeight: 700, fontSize: 28, color: '#6B5C52' }}>unread overnight</div>
            </div>
            {/* messages arrive, then the first opens and is answered */}
            {['Quote for the Henderson job', 'Re: Tuesday site visit', 'Invoice question'].map((subj, i) => {
              const at = 8 + i * 6
              const q = ease(frame, at)
              const isOpen = opened && i === 0
              return (
                <div key={subj} style={{
                  background: WHITE, borderRadius: 14, padding: isOpen ? '22px 26px' : '18px 26px', marginBottom: 12,
                  boxShadow: isOpen ? '0 20px 44px rgba(43,35,32,0.18)' : '0 10px 26px rgba(43,35,32,0.08)',
                  borderLeft: `6px solid ${isOpen ? CLAY : '#E6DDD3'}`,
                  opacity: clamp(q * 2, 0, 1),
                  transform: `translateX(${(1 - clamp(q, 0, 1)) * 26}px) scale(${isOpen ? 1.02 : 1})`,
                }}>
                  <div style={{ fontWeight: 800, fontSize: 27, color: INK }}>{subj}</div>
                  {isOpen && (
                    <div style={{ marginTop: 12, fontWeight: 600, fontSize: 24, color: '#6B5C52', lineHeight: 1.4 }}>
                      <Typed text="Thanks for reaching out — I can have that quote over to you by Thursday." at={openAt + 4} cps={30} />
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, opacity: clamp(ease(frame, openAt + 34) * 2, 0, 1) }}>
              <Tick at={openAt + 36} size={30} color={SAGE} on={SAGE} />
              <div style={{ fontWeight: 800, fontSize: 30, color: INK }}>Reply drafted in your voice</div>
            </div>
          </div>
        </Alive>
      </Camera>
      <SettleSweep color={CLAY} hold={hold} />
    </Scene>
  )
}

/* ── PHONE — it rings, she answers, the appointment drops in. ──────────── */
const PhoneBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const answerAt = 20
  const bookAt = 46
  const ringing = frame < answerAt
  /* A live waveform, but only while they are actually talking. */
  const bars = Array.from({ length: 26 }, (_, i) => {
    const live = frame >= answerAt && frame < bookAt
    return live ? 12 + Math.abs(Math.sin((frame * 0.32) + i * 0.7)) * 46 : 8
  })
  return (
    <Scene bg={PAPER} kicker="Your own answered number" head={<>She answers the phone — <span style={{ color: SAGE }}>callers book, mid-call.</span></>} headSize={56}>
      <Camera hold={hold} dir="in" amount={0.026} origin="45% 45%">
        <Alive intensity={0.5}>
          <Layer hold={hold} depth={0.3}>
            <Illo src={R('illo-phone.png')} w={480} x={290} y={250} at={2} rot={-3} />
          </Layer>
          <div style={{ position: 'absolute', left: 660, top: 20, width: 830 }}>
            <div style={{ background: WHITE, borderRadius: 18, padding: '26px 30px', boxShadow: '0 20px 44px rgba(43,35,32,0.12)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: ringing ? TERRA : SAGE,
                  opacity: ringing ? (Math.floor(frame / 6) % 2 ? 1 : 0.25) : 1,
                }} />
                <div style={{ fontWeight: 800, fontSize: 30, color: INK }}>
                  {ringing ? 'Incoming call' : 'Answered in 2 rings'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 64, marginTop: 18 }}>
                {bars.map((h, i) => (
                  <div key={i} style={{ width: 7, height: h, borderRadius: 4, background: frame >= answerAt ? SAGE : '#E6DDD3' }} />
                ))}
              </div>
            </div>
            {/* the appointment drops into the calendar */}
            <div style={{
              background: WHITE, borderRadius: 18, padding: '24px 30px', boxShadow: '0 20px 44px rgba(43,35,32,0.14)',
              borderLeft: `8px solid ${SAGE}`,
              opacity: clamp(ease(frame, bookAt) * 2, 0, 1),
              transform: `translateY(${(1 - clamp(ease(frame, bookAt), 0, 1)) * -34}px)`,
            }}>
              <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A99C91', marginBottom: 8 }}>Booked</div>
              <div style={{ fontWeight: 900, fontSize: 34, color: INK }}>Thursday, 10:30am</div>
              <div style={{ fontWeight: 600, fontSize: 24, color: '#6B5C52', marginTop: 4 }}>Added to your calendar</div>
            </div>
          </div>
        </Alive>
      </Camera>
      <SettleSweep color={SAGE} hold={hold} />
    </Scene>
  )
}

/* ── INVOICE — raised, sent, chased, paid. ─────────────────────────────── */
const InvoiceBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const steps = [['Invoice raised', 6], ['Sent', 20], ['Chased on day 7', 34], ['Paid', 50]] as const
  const paidAt = 50
  const paid = hit(frame, paidAt)
  return (
    <Scene bg={CREAM} kicker="Stripe invoicing, built in" head={<>Writes, invoices, chases, files — <span style={{ color: TERRA }}>on your letterhead.</span></>} headSize={56}>
      <Shake at={paidAt} amount={3} dur={10}>
        <Camera hold={hold} dir="in" amount={0.026} origin="50% 45%">
          <Alive intensity={0.5}>
            <Layer hold={hold} depth={0.3}>
              <Illo src={R('illo-invoice.png')} w={470} x={280} y={250} at={2} rot={-3} />
            </Layer>
            <div style={{ position: 'absolute', left: 640, top: 30, width: 860 }}>
              {steps.map(([label, at], i) => {
                const q = ease(frame, at as number)
                const done = frame >= (at as number) + 8
                const isPaid = i === steps.length - 1
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18, opacity: clamp(q * 2, 0, 1), transform: `translateX(${(1 - clamp(q, 0, 1)) * 24}px)` }}>
                    <Tick at={(at as number) + 3} size={32} color={isPaid ? SAGE : '#D9CDC2'} on={isPaid ? SAGE : TERRA} />
                    <div style={{
                      flex: 1, background: WHITE, borderRadius: 14, padding: '20px 26px',
                      boxShadow: '0 12px 30px rgba(43,35,32,0.10)',
                      fontWeight: isPaid ? 900 : 700, fontSize: isPaid ? 36 : 30,
                      color: isPaid && done ? SAGE : INK,
                      borderLeft: isPaid ? `8px solid ${SAGE}` : '8px solid transparent',
                    }}>{label}</div>
                  </div>
                )
              })}
              <div style={{
                position: 'absolute', right: -10, bottom: 6,
                transform: `rotate(-8deg) scale(${1.9 - clamp(paid, 0, 1) * 0.9})`,
                opacity: clamp(paid * 2, 0, 1),
                border: `6px solid ${SAGE}`, color: SAGE, borderRadius: 10, padding: '8px 22px',
                fontWeight: 900, fontSize: 34, letterSpacing: '0.08em', background: '#ffffffee',
              }}>PAID</div>
            </div>
          </Alive>
        </Camera>
      </Shake>
      <SettleSweep color={TERRA} hold={hold} />
    </Scene>
  )
}

/* ── WHO SHE IS — a chat bubble collapses, the business flows in. ──────── */
const WhoBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  /*
   * THE LONGEST LINE IN THE FILM, and in the first cut it was one static
   * composition for twelve seconds — the worst pacing problem in it. Now it
   * plays out: a chat bubble shrinks away, her card takes its place, and
   * pieces of the business fly in and are absorbed as "she learns your
   * business" lands.
   */
  const killAt = 14      // the chat bubble collapses
  const learnAt = 40     // the business starts flowing in
  const bubble = clamp(1 - (frame - killAt) / 12, 0, 1)
  const pieces = ['Your tone', 'Your prices', 'Your clients', 'Your calendar', 'Your files']
  return (
    <Scene bg={CREAM} kicker="Not a chatbot" head={<>She learns your business <span style={{ color: CLAY }}>the way a great hire does.</span></>} headSize={56}>
      <Camera hold={hold} dir="in" amount={0.03} origin="50% 45%">
        <Alive intensity={0.5}>
          {/* the thing she is NOT, collapsing */}
          {bubble > 0.02 && (
            <div style={{
              position: 'absolute', left: 640, top: 150,
              background: '#E6DDD3', borderRadius: '22px 22px 22px 6px', padding: '26px 34px',
              opacity: bubble, transform: `scale(${0.6 + bubble * 0.4})`,
              boxShadow: '0 14px 34px rgba(43,35,32,0.10)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 30, color: '#8C7F74' }}>How can I help you today?</div>
            </div>
          )}
          {/* the thing she IS, arriving as it goes */}
          <Layer hold={hold} depth={0.5}>
            <Illo src={R('illo-hero.png')} w={560} x={560} y={250} at={killAt + 4} rot={-2} />
          </Layer>
          {/* the business flying in and being absorbed */}
          <div style={{ position: 'absolute', left: 980, top: 40, width: 700 }}>
            {pieces.map((piece, i) => {
              const at = learnAt + i * 5
              const q = ease(frame, at)
              // each chip slides toward her, then settles into the column
              const k = clamp(q, 0, 1)
              return (
                <div key={piece} style={{
                  display: 'inline-block', margin: '0 10px 12px 0',
                  background: WHITE, borderRadius: 999, padding: '14px 26px',
                  boxShadow: '0 10px 24px rgba(43,35,32,0.10)',
                  fontWeight: 800, fontSize: 27, color: INK,
                  opacity: clamp(q * 2, 0, 1),
                  transform: `translateX(${(1 - k) * 90}px) scale(${0.9 + 0.1 * k})`,
                }}>{piece}</div>
              )
            })}
          </div>
        </Alive>
      </Camera>
      <SettleSweep color={CLAY} hold={hold} />
    </Scene>
  )
}

/* ── THE BRAIN — industries slide past like a carousel. ────────────────── */
const BrainBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const words = ['Insurance', 'Real estate', 'Law', 'Whatever you are']
  const step = Math.max(1, Math.round(hold / (words.length + 0.5)))
  const idx = Math.min(words.length - 1, Math.floor(frame / step))
  /* A smooth slide between cards rather than a cut — the carousel a review
     asked for, eased so it settles rather than snapping. */
  const raw = frame / step
  const glide = interpolate(clamp(raw - idx, 0, 1), [0, 1], [0, 1], { easing: Easing.inOut(Easing.cubic) })
  const pos = idx + glide - (raw >= words.length - 1 ? 0 : 0)
  const CARD_W = 430
  return (
    <Scene bg={INK} kicker="The swappable brain" kColor={SAGE} headColor={WHITE} headSize={56}
      head={<>Tell her your industry. <span style={{ color: SAGE }}>It installs in seconds.</span></>}>
      <Camera hold={hold} dir="in" amount={0.024} origin="50% 45%">
        <Alive intensity={0.5}>
          {/* she sits left, tilting a little as each brain loads */}
          <div style={{ position: 'absolute', left: 90, top: 40, transform: `rotate(${-2 + glide * 4}deg)` }}>
            <Illo src={R('illo-brain.png')} w={470} x={235} y={230} at={2} />
          </div>
          {/* the carousel runs right, with the live card centred in its window */}
          <div style={{ position: 'absolute', left: 620, top: 120, width: 900, height: 230, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: (900 - CARD_W) / 2, top: 0, display: 'flex', gap: 26, transform: `translateX(${-pos * (CARD_W + 26)}px)` }}>
              {words.map((w, i) => {
                const active = i === idx
                return (
                  <div key={w} style={{
                    flex: `0 0 ${CARD_W}px`,
                    background: active ? WHITE : 'rgba(255,255,255,0.07)',
                    borderRadius: 20, padding: '34px 30px', textAlign: 'center',
                    boxShadow: active ? '0 24px 60px rgba(0,0,0,0.5)' : 'none',
                    border: active ? 'none' : '1px solid rgba(255,255,255,0.10)',
                    transform: `scale(${active ? 1 : 0.9})`,
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '0.16em', textTransform: 'uppercase', color: active ? '#A99C91' : 'rgba(255,255,255,0.35)', marginBottom: 10 }}>Industry</div>
                    <div style={{ fontWeight: 900, fontSize: 46, color: active ? CLAY : 'rgba(255,255,255,0.45)', letterSpacing: '-0.02em' }}>{w}</div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* the install bar runs under it, so "in seconds" is shown not said */}
          <div style={{ position: 'absolute', left: 620, top: 380, width: 880 }}>
            <div style={{ height: 10, borderRadius: 8, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${clamp(glide * 100, 0, 100)}%`, background: SAGE, borderRadius: 8, boxShadow: `0 0 18px ${SAGE}` }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'rgba(255,255,255,0.55)', marginTop: 12 }}>Installing her brain…</div>
          </div>
        </Alive>
      </Camera>
      <SettleSweep color={SAGE} hold={hold} />
    </Scene>
  )
}

/* ── THE SPEC — the four qualities, arriving one at a time. ────────────── */
const SpecBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const items = [
    ['Answers before you ask', SAGE],
    ['Never drops a ball', CLAY],
    ['Never forgets a name', TERRA],
    ['Never leaves at five', SAGE],
  ] as const
  return (
    <Scene bg={PAPER} kicker="The job spec" head={<>Everyone has written it.<br /><span style={{ color: CLAY }}>Nobody has filled it.</span></>} headSize={58}>
      {/* the camera pulls BACK to reveal all four — a review asked for exactly
          this, and it is what stops the grid reading as a slide */}
      <Camera hold={hold} dir="out" amount={0.06} origin="50% 40%">
        <Alive intensity={0.6}>
          {items.map(([label, col], i) => {
            const at = 4 + i * 5
            const q = ease(frame, at)
            const k = clamp(q, 0, 1)
            const row = Math.floor(i / 2), col2 = i % 2
            return (
              <div key={label} style={{
                position: 'absolute',
                left: 100 + col2 * 790, top: 120 + row * 230,
                width: 740, padding: '44px 46px',
                background: WHITE, borderRadius: 18,
                boxShadow: '0 22px 50px rgba(43,35,32,0.14)',
                borderLeft: `10px solid ${col}`,
                opacity: clamp(q * 1.8, 0, 1),
                transform: `translateY(${(1 - k) * 30}px) scale(${0.95 + 0.05 * k})`,
              }}>
                <div style={{ fontWeight: 900, fontSize: 44, color: INK, letterSpacing: '-0.02em' }}>{label}</div>
              </div>
            )
          })}
        </Alive>
      </Camera>
      <SettleSweep color={SAGE} hold={hold} />
    </Scene>
  )
}

/* ── SHE STAYS — the ledger, each NEVER lit by a passing sheen. ────────── */
const StaysBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const rows = [['Calls in sick', 'Never'], ['Hands in her notice', 'Never'], ['Asks for a raise', 'Never'], ['Works weekends', 'Always']] as const
  return (
    <Scene bg={INK} kicker="No notice period" kColor={SAGE} headColor={WHITE} headSize={56}
      head={<>The one hire who <span style={{ color: SAGE }}>never leaves.</span></>}>
      <Camera hold={hold} dir="in" amount={0.022}>
        <Alive intensity={0.5}>
          <div style={{ position: 'absolute', left: 180, top: 60, right: 180 }}>
            {rows.map(([l, r], i) => {
              const at = 4 + i * 9
              const q = ease(frame, at)
              const good = r === 'Never'
              return (
                <div key={l} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '26px 34px', marginBottom: 16,
                  background: 'rgba(255,255,255,0.06)', borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.10)',
                  opacity: clamp(q * 2, 0, 1),
                  transform: `translateY(${(1 - clamp(q, 0, 1)) * 24}px)`,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 36, color: '#D8CEC5' }}>{l}</div>
                  <div style={{ fontWeight: 900, fontSize: 40, color: good ? SAGE : CLAY, letterSpacing: '0.02em' }}>
                    <Sheen at={at + 6} dur={22}>{r}</Sheen>
                  </div>
                </div>
              )
            })}
          </div>
        </Alive>
      </Camera>
      <SettleSweep color={SAGE} hold={hold} />
    </Scene>
  )
}

/* ── CONNECTED — she works inside the tools you already pay for. ───────── */
const ConnectBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  /*
   * DRAWN AS TILES, NOT AS THEIR LOGOS. Real third-party marks in a
   * commercial need permission and go stale when a brand refreshes; a
   * wordmark tile in her own palette says the same thing, stays hers, and
   * cannot be wrong.
   *
   * They arrive around her in a ring, then a line runs from each into the
   * centre — the point is not "we have integrations", it is that everything
   * flows to one place.
   */
  const tools = [
    { name: 'Slack', tone: CLAY },
    { name: 'Notion', tone: INK },
    { name: 'Salesforce', tone: SAGE },
    { name: 'HubSpot', tone: TERRA },
    { name: 'Gmail', tone: CLAY },
    { name: 'Outlook', tone: SAGE },
    { name: 'Stripe', tone: INK },
    { name: 'Calendar', tone: TERRA },
  ]
  const CX = 880, CY = 250, RX = 440, RY = 210
  return (
    <Scene bg={CREAM} kicker="Already connected" head={<>She works inside <span style={{ color: CLAY }}>the tools you already use.</span></>} headSize={56}>
      <Camera hold={hold} dir="out" amount={0.05} origin="50% 40%">
        <Alive intensity={0.5}>
          {/* THE GATHER, under everything: many separate things becoming one. */}
          <Swarm
            at={2}
            dur={22}
            color={CLAY}
            size={11}
            targets={tools.map((_, i) => {
              const a = (i / tools.length) * Math.PI * 2 - Math.PI / 2
              return { x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY }
            })}
          />
          {/* the lines, drawn before the tiles so they sit behind */}
          <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            {tools.map((t, i) => {
              const a = (i / tools.length) * Math.PI * 2 - Math.PI / 2
              const x = CX + Math.cos(a) * RX
              const y = CY + Math.sin(a) * RY
              const at = 8 + i * 3
              const draw = clamp((frame - at - 6) / 12, 0, 1)
              return (
                <line key={t.name}
                  x1={CX} y1={CY}
                  x2={CX + (x - CX) * draw} y2={CY + (y - CY) * draw}
                  stroke={SAGE} strokeWidth="2.5" strokeOpacity={0.4 * draw} strokeLinecap="round" />
              )
            })}
          </svg>
          {/* her mark at the centre, everything reporting to it */}
          <div style={{
            position: 'absolute', left: CX, top: CY, transform: 'translate(-50%, -50%)',
            background: WHITE, borderRadius: 20, padding: '24px 40px',
            boxShadow: '0 24px 60px rgba(43,35,32,0.18)',
            opacity: clamp(ease(frame, 3) * 2, 0, 1),
            zIndex: 2,
          }}>
            <Img src={R('logo.png')} style={{ width: 230, display: 'block' }} />
          </div>
          {/* and the tools around her */}
          {tools.map((t, i) => {
            const a = (i / tools.length) * Math.PI * 2 - Math.PI / 2
            const x = CX + Math.cos(a) * RX
            const y = CY + Math.sin(a) * RY
            const at = 8 + i * 3
            const q = ease(frame, at)
            const k = clamp(q, 0, 1)
            return (
              <div key={t.name} style={{
                position: 'absolute', left: x, top: y,
                transform: `translate(-50%, -50%) scale(${0.8 + 0.2 * k})`,
                opacity: clamp(q * 2, 0, 1),
                background: WHITE, borderRadius: 14, padding: '16px 26px',
                boxShadow: '0 14px 34px rgba(43,35,32,0.12)',
                fontWeight: 800, fontSize: 28, color: t.tone,
                whiteSpace: 'nowrap',
              }}>{t.name}</div>
            )
          })}
          {/* the count, landing last */}
          <div style={{
            position: 'absolute', left: CX, top: CY + 320, transform: 'translateX(-50%)',
            textAlign: 'center',
            opacity: clamp(ease(frame, 42) * 2, 0, 1),
          }}>
            <div style={{ fontWeight: 900, fontSize: 46, color: CLAY, letterSpacing: '-0.02em' }}>
              <CountUp to={500} suffix="+" dur={26} startAt={42} /> more
            </div>
            <div style={{ fontWeight: 700, fontSize: 24, color: '#6B5C52', marginTop: 4 }}>through Zapier and Make</div>
          </div>
        </Alive>
      </Camera>
      <SettleSweep color={SAGE} hold={hold} />
    </Scene>
  )
}

/* ── SAY IT — the workflow builds itself while you talk. ───────────────── */
const VoiceBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  /*
   * THE SPOKEN INSTRUCTION IS THE INTERFACE. So the screen shows exactly
   * that: a waveform while the owner talks, their sentence typing itself out
   * underneath, and then the steps of a real workflow assembling one at a
   * time — each one a thing she will now do without being asked again.
   */
  const said = 'When a new lead comes in, add them to HubSpot and text me'
  const speakAt = 4
  const buildAt = 66
  const steps = [
    ['Trigger', 'New lead arrives', CLAY],
    ['Then', 'Add to HubSpot', SAGE],
    ['Then', 'Send you a text', TERRA],
  ] as const
  const talking = frame >= speakAt && frame < buildAt
  const bars = Array.from({ length: 30 }, (_, i) =>
    talking ? 10 + Math.abs(Math.sin(frame * 0.34 + i * 0.6)) * 40 : 7)
  return (
    <Scene bg={INK} kicker="Built by talking" kColor={SAGE} headColor={WHITE} headSize={56}
      head={<>Tell her once. <span style={{ color: SAGE }}>The workflow builds itself.</span></>}>
      <Camera hold={hold} dir="in" amount={0.028}>
        <Alive intensity={0.5}>
          {/* what the owner is saying */}
          <div style={{
            position: 'absolute', left: 120, top: 20, width: 780,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18, padding: '28px 32px',
            opacity: clamp(ease(frame, 2) * 2, 0, 1),
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: talking ? CLAY : 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* a microphone, drawn rather than an icon font */}
                <svg width="20" height="26" viewBox="0 0 20 26" fill="none">
                  <rect x="6" y="1" width="8" height="14" rx="4" fill={WHITE} />
                  <path d="M2 12 a8 8 0 0 0 16 0" stroke={WHITE} strokeWidth="2.2" fill="none" strokeLinecap="round" />
                  <line x1="10" y1="20" x2="10" y2="25" stroke={WHITE} strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '0.14em', textTransform: 'uppercase', color: talking ? CLAY : 'rgba(255,255,255,0.4)' }}>
                {talking ? 'Listening' : 'Got it'}
              </div>
            </div>
            {/* the waveform moves only while they are speaking */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 54, marginBottom: 20 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ width: 7, height: h, borderRadius: 4, background: talking ? SAGE : 'rgba(255,255,255,0.18)' }} />
              ))}
            </div>
            <div style={{ fontWeight: 700, fontSize: 30, color: WHITE, lineHeight: 1.4, minHeight: 84 }}>
              <Typed text={said} at={speakAt} cps={30} />
            </div>
          </div>
          {/* and the workflow assembling from it */}
          <div style={{ position: 'absolute', left: 980, top: 20, width: 720 }}>
            {steps.map(([label, what, tone], i) => {
              const at = buildAt + i * 10
              const q = ease(frame, at)
              const k = clamp(q, 0, 1)
              return (
                <div key={what}>
                  {/* the connector between steps grows first */}
                  {i > 0 && (
                    <div style={{
                      width: 3, height: 26, marginLeft: 34, borderRadius: 2, background: SAGE,
                      opacity: clamp((frame - at + 6) / 8, 0, 1),
                      transformOrigin: 'top',
                      transform: `scaleY(${clamp((frame - at + 6) / 8, 0, 1)})`,
                    }} />
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 18,
                    background: WHITE, borderRadius: 16, padding: '22px 26px',
                    boxShadow: '0 18px 44px rgba(0,0,0,0.35)',
                    borderLeft: `8px solid ${tone}`,
                    opacity: clamp(q * 2, 0, 1),
                    transform: `translateX(${(1 - k) * 30}px) scale(${0.95 + 0.05 * k})`,
                  }}>
                    <Tick at={at + 4} size={30} color={tone} on={tone} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A99C91' }}>{label}</div>
                      <div style={{ fontWeight: 900, fontSize: 32, color: INK, marginTop: 2 }}>{what}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{
              marginTop: 22, textAlign: 'center',
              fontWeight: 800, fontSize: 26, color: SAGE,
              opacity: clamp(ease(frame, buildAt + 34) * 2, 0, 1),
            }}>Live. No setup, no builder, no developer.</div>
          </div>
        </Alive>
      </Camera>
      <SettleSweep color={SAGE} hold={hold} />
    </Scene>
  )
}

/* ── THE PROMISE — she stays, and what that is worth. ──────────────────── */
const PromiseBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  /*
   * The film used to end on the SAME card twice — CtaBeat ran for two beats,
   * so the last eight seconds were one static screen with a voice over it.
   * This one earns its place: the fantasy line, then the turn, on her own
   * ground rather than a repeat of the end card.
   */
  return (
    <Ground bg={INK}>
      <Camera hold={hold} dir="in" amount={0.03}>
        <Alive intensity={0.5}>
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 160px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontWeight: 900, fontSize: 66, color: 'rgba(255,255,255,0.55)', lineHeight: 1.12, letterSpacing: '-0.03em',
                textDecoration: frame > 34 ? 'line-through' : 'none',
                textDecorationColor: CLAY, textDecorationThickness: 6,
                opacity: clamp(ease(frame, 3) * 1.8, 0, 1),
                transform: `translateY(${(1 - clamp(ease(frame, 3), 0, 1)) * 24}px)`,
              }}>
                The perfect employee<br />was always a fantasy.
              </div>
              <div style={{
                fontWeight: 900, fontSize: 82, color: WHITE, lineHeight: 1.08, letterSpacing: '-0.03em', marginTop: 40,
                opacity: clamp(ease(frame, 40) * 1.8, 0, 1),
                transform: `translateY(${(1 - clamp(ease(frame, 40), 0, 1)) * 30}px)`,
              }}>
                Now she <span style={{ color: SAGE }}>starts tomorrow.</span>
              </div>
            </div>
          </AbsoluteFill>
        </Alive>
      </Camera>
      <SettleSweep color={SAGE} hold={hold} />
    </Ground>
  )
}

/* ── THE CLOSE — the offer, plainly. ───────────────────────────────────── */
const CtaBeat: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const p = ease(frame, 2, 18, 130)
  const btn = ease(frame, 24, 16, 150)
  return (
    <Ground bg={PAPER}>
      <FocusIn dur={12} from={14}>
      <Camera hold={hold} dir="in" amount={0.02}>
        <Alive intensity={0.4}>
          <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 250 }}>
            <div style={{ transform: `scale(${0.88 + 0.12 * clamp(p, 0, 1)})`, opacity: clamp(p * 2, 0, 1) }}>
              <Img src={R('logo.png')} style={{ width: 680, display: 'block' }} />
            </div>
          </AbsoluteFill>
        </Alive>
      </Camera>
      </FocusIn>
      {/* a slow pass of light over the mark — the last thing that moves */}
      <LightRay hold={hold} color="rgba(196,96,63,0.20)" angle={14} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 0 100px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontWeight: 900, fontSize: 60, color: INK, letterSpacing: '-0.03em',
            opacity: clamp(ease(frame, 10) * 1.8, 0, 1),
            transform: `translateY(${(1 - clamp(ease(frame, 10), 0, 1)) * 22}px)`,
          }}>
            Start your <span style={{ color: CLAY }}>7-day free trial.</span>
          </div>
          {/* a real button, because "go to the site" is the whole point of the film */}
          <div style={{
            display: 'inline-block', marginTop: 30,
            background: CLAY, color: WHITE, borderRadius: 14,
            padding: '22px 56px', fontWeight: 900, fontSize: 40, letterSpacing: '-0.01em',
            boxShadow: '0 18px 44px rgba(181,86,58,0.35)',
            opacity: clamp(btn * 2, 0, 1),
            transform: `scale(${0.9 + 0.1 * clamp(btn, 0, 1)})`,
          }}>jordyn.app</div>
          <div style={{
            fontWeight: 700, fontSize: 26, color: '#8C7F74', marginTop: 22,
            opacity: clamp(ease(frame, 34) * 1.8, 0, 1),
          }}>No card needed. She starts the day you do.</div>
        </div>
      </AbsoluteFill>
    </Ground>
  )
}

type Beat = { dur: number; el: (hold: number) => React.ReactNode; impact?: boolean; noVo?: boolean }

/*
 * Each beat is its line's MEASURED length plus the air that line needs. The
 * slam and the close get the most, because a short sentence only lands when
 * nothing crowds it.
 */
const BEATS: Beat[] = [
  /* CINEMATIC — the opening breathes. */
  { dur: s(2.3), el: (h) => <OpenBeat hold={h} />, noVo: true },
  { dur: s(D[0] + 1.0), el: (h) => <WantBeat hold={h} /> },
  { dur: s(D[1] + 0.8), el: (h) => <SpecBeat hold={h} /> },
  /* KINETIC — the problem lands and the answer arrives. Tight. */
  { dur: s(D[2] + 0.35), el: (h) => <CostBeat hold={h} />, impact: true },
  { dur: s(D[3] + 1.1), el: (h) => <SlamBeat hold={h} />, impact: true },
  { dur: s(D[4] + 0.3), el: (h) => <WhoBeat hold={h} /> },
  /* DATA — the proof run. Snaps, so what surrounds it feels slower. */
  { dur: s(D[5] + 0.25), el: (h) => <EmailBeat hold={h} /> },
  { dur: s(D[6] + 0.25), el: (h) => <PhoneBeat hold={h} /> },
  { dur: s(D[7] + 0.3), el: (h) => <InvoiceBeat hold={h} /> },
  { dur: s(D[8] + 0.9), el: (h) => <BrainBeat hold={h} /> },
  /* proof of reach, then proof of control */
  { dur: s(D[9] + 0.8), el: (h) => <ConnectBeat hold={h} /> },
  { dur: s(D[10] + 0.5), el: (h) => <VoiceBeat hold={h} /> },
  { dur: s(D[11] + 0.35), el: (h) => <StaysBeat hold={h} /> },
  /* CINEMATIC — the turn and the close. Room to land. */
  { dur: s(D[12] + 1.2), el: (h) => <PromiseBeat hold={h} />, impact: true },
  { dur: s(D[13] + 2.4), el: (h) => <CtaBeat hold={h} /> },
]

const rawStarts: number[] = []
{ let t = 0; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
/*
 * EVERY CUT LANDS ON A BEAT.
 *
 * The first version of this film let each scene end wherever its voice line
 * happened to finish, which is why nothing felt synced — the cuts were
 * musically random. beatLock nudges each start to the nearest real beat of
 * the track (scripts/beatgrid.mjs reads them off the audio: 127.8 BPM here,
 * the same tempo as the Restylez launch), within a 0.2s tolerance so a line
 * is never pushed far enough to run over its own scene.
 */
const STARTS = beatLock(rawStarts, gridToFrames((grid as { beats: number[] }).beats, FPS), Math.round(0.2 * FPS))
export const JORDYN_HIRE_FRAMES = STARTS[STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6
export const JORDYN_HIRE_FPS = FPS
const MUSIC_FRAMES = Math.round(86.0 * FPS)

export const JordynHire: React.FC = () => {
  const starts = STARTS
  const durs = durationsFromStarts(starts, JORDYN_HIRE_FRAMES - 6)
  /* the voice index skips any silent beat, so line 1 lands on the first
     SPOKEN beat rather than on the opening mark */
  const voIndex = (i: number) => BEATS.slice(0, i).filter((b) => !b.noVo).length
  const voWin: VoWindow[] = BEATS.filter((x) => !x.noVo).map((_x, n) => {
    const i = BEATS.findIndex((x, k) => !x.noVo && BEATS.slice(0, k).filter((y) => !y.noVo).length === n)
    return { start: starts[i], end: starts[i] + s(D[n]) }
  })
  const musicDuck = makeMusicDuck(voWin, JORDYN_HIRE_FRAMES, { loud: 0.32, duck: 0.11, ramp: 14, fadeInEnd: 6 })
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      {/* durationInFrames is durs[i] and NOT durs[i] + 6. That six-frame tail
          let every scene live into the next one — the Restylez film gets away
          with it because its grounds are opaque full-bleed, and these have
          transparent areas, so two pages stacked visibly. */}
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i]}>
          {b.el(durs[i])}
          {/* no bug on the slam or the close — the logo IS the shot there */}
          {i !== 4 && i !== 10 && i !== 13 && i !== 14 && <LogoBug src="showcase/jordyn-hire/logo.png" width={160} opacity={0.92} />}
          {i > 0 && <StreakWipe color={i % 2 ? WHITE : CLAY} dir={i % 2 ? 1 : -1} dur={10} />}
        </Sequence>
      ))}
      <MusicBed src="showcase/jordyn-hire/music.mp3" musicFrames={MUSIC_FRAMES} volume={musicDuck} />
      {BEATS.map((b, i) => b.noVo ? null : (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={R(`vo-${voIndex(i) + 1}.mp3`)} volume={1.0} /></Sequence>
      ))}
      {starts.slice(1).map((st, i) => (
        <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={0.2} /></Sequence>
      ))}
      {BEATS.map((b, i) => b.impact ? <Sequence key={'imp' + i} from={starts[i]} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.38} /></Sequence> : null)}
    </AbsoluteFill>
  )
}
