import React from 'react'
import {
  AbsoluteFill, Img, Audio, Sequence, OffthreadVideo, staticFile,
  useCurrentFrame, interpolate, spring, Easing,
} from 'remotion'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import vo from '../../public/showcase/jordyn-hire/vo.json'
import grid from '../../public/showcase/jordyn-hire/beatgrid.json'
import { beatLock, gridToFrames } from '../lib/audio'
import { MusicBed } from '../lib/musicbed'

/**
 * THE MORNING — one business day, told through one screen.
 *
 * Four cuts of this film were a list of capabilities with motion applied to
 * it, and they read as a slide deck however much motion went on. The note
 * that ended that approach was the right one: "it looks like you moved some
 * elements and added a few colour screens."
 *
 * So the conceit is different. This is a DAY. A clock in the corner runs from
 * 6:14am to 6:02pm and never lies, and what changes across it is how much is
 * left for you to do. Every capability still appears — but as an event at a
 * time, not a bullet on a list.
 *
 * And it is built on REAL FOOTAGE. Not screenshots with a camera move over
 * them: actual recordings of the product being driven, with a visible cursor
 * that moves, hesitates and clicks. The Restylez film this was always meant
 * to match ran on 25 real artifacts; this one now runs on seven real takes.
 *
 * THE TWO SILENCES are deliberate. Everything else is wall to wall, so the
 * gap before the reveal and the gap at the refusal are the loudest moments in
 * the film.
 */

const { fontFamily: F } = loadInter()
export const MORNING_FPS = 30
const FPS = MORNING_FPS
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const s = (sec: number) => Math.round(sec * FPS)

const CLAY = '#B5563A'
const SAGE = '#8FA98B'
const CREAM = '#F7F1E8'
const INK = '#2B2320'
const WHITE = '#ffffff'

const R = (n: string) => staticFile(`showcase/jordyn-hire/${n}`)
const FILM = (n: string) => staticFile(`showcase/jordyn-hire/film/${n}`)
const D = (vo as { durations: number[] }).durations

const ease = (frame: number, at: number, damping = 18, stiffness = 130) =>
  clamp(spring({ frame: frame - at, fps: FPS, config: { damping, stiffness, mass: 0.9 } }), 0, 1.12)

const hit = (frame: number, at: number) =>
  clamp(spring({ frame: frame - at, fps: FPS, config: { damping: 11, stiffness: 210, mass: 0.8 } }), 0, 1.18)

/* ── THE CLOCK ─────────────────────────────────────────────────────────────
 * The spine of the whole film. It sits in the same corner of every shot and
 * never moves, which is what lets eighty seconds read as twelve hours. The
 * cheapest continuity device there is, and the one doing the most work.
 */
const Clock: React.FC<{ time: string; dark?: boolean }> = ({ time, dark = false }) => {
  const frame = useCurrentFrame()
  const p = ease(frame, 2)
  return (
    <div style={{
      position: 'absolute', right: 78, top: 58, zIndex: 40,
      display: 'flex', alignItems: 'baseline', gap: 12,
      opacity: clamp(p * 2, 0, 1),
      transform: `translateY(${(1 - clamp(p, 0, 1)) * -10}px)`,
    }}>
      <div style={{
        fontWeight: 900, fontSize: 46, letterSpacing: '-0.03em',
        color: dark ? WHITE : INK,
        fontVariantNumeric: 'tabular-nums',
      }}>{time}</div>
      <div style={{
        width: 9, height: 9, borderRadius: '50%', background: CLAY,
        opacity: 0.55 + 0.45 * Math.sin(frame * 0.16),
      }} />
    </div>
  )
}

/**
 * A REAL TAKE, PLAYED INTO THE FRAME.
 *
 * `from` is where in the source clip to start, in seconds — the useful moment
 * is rarely at zero and a shot that opens on dead air wastes the cut. The
 * slow scale is a camera push over real footage, which keeps the frame alive
 * without pretending the recording itself moves.
 */
const Take: React.FC<{
  src: string
  from: number
  /** How far the push travels over the shot. */
  push?: number
  /** Crop the top and bottom in, to fill the frame with the live part. */
  zoom?: number
  y?: number
  hold: number
}> = ({ src, from, push = 0.05, zoom = 1.06, y = 0, hold }) => {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [0, Math.max(1, hold)], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad),
  })
  const p = ease(frame, 0, 22, 110)
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{
        transform: `scale(${zoom + push * t}) translateY(${y}px)`,
        opacity: clamp(p * 2.6, 0, 1),
      }}>
        <OffthreadVideo
          src={src}
          startFrom={Math.round(from * FPS)}
          muted
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** The line at the foot of a shot. Never more than one thought. */
const Line: React.FC<{
  at?: number
  children: React.ReactNode
  dark?: boolean
  size?: number
  sub?: string
}> = ({ at = 4, children, dark = false, size = 58, sub }) => {
  const frame = useCurrentFrame()
  const p = ease(frame, at)
  const k = clamp(p, 0, 1)
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 76, zIndex: 30,
      textAlign: 'center', padding: '0 120px',
    }}>
      {sub && (
        <div style={{
          fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: dark ? SAGE : CLAY, marginBottom: 14,
          opacity: clamp(ease(frame, at - 2) * 2, 0, 1),
        }}>{sub}</div>
      )}
      <div style={{
        fontWeight: 900, fontSize: size, lineHeight: 1.08, letterSpacing: '-0.03em',
        color: dark ? WHITE : INK,
        opacity: clamp(p * 1.8, 0, 1),
        transform: `translateY(${(1 - k) * 24}px)`,
        textShadow: dark ? '0 4px 30px rgba(0,0,0,0.5)' : '0 4px 30px rgba(247,241,232,0.9)',
      }}>{children}</div>
    </div>
  )
}

/** A wash under the type, so a line over real footage stays readable. */
const Foot: React.FC<{ dark?: boolean }> = ({ dark = false }) => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 420, zIndex: 20,
    background: dark
      ? 'linear-gradient(0deg, rgba(20,16,14,0.94) 0%, rgba(20,16,14,0.78) 45%, transparent 100%)'
      : 'linear-gradient(0deg, rgba(247,241,232,0.97) 0%, rgba(247,241,232,0.85) 45%, transparent 100%)',
  }} />
)

/* ── BEAT 1 — 6:14 AM. What you woke up to. ──────────────────────────────── */
const Woke: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  /* the count climbs fast and stops dead — 47 things, none of them done */
  const n = Math.round(clamp((frame - 10) / 26, 0, 1) * 47)
  const out = clamp((frame - (hold - 10)) / 10, 0, 1)
  return (
    <AbsoluteFill style={{ background: '#100D0C', fontFamily: F, opacity: 1 - out }}>
      <Clock time="6:14 AM" dark />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontWeight: 900, fontSize: 240, color: WHITE, letterSpacing: '-0.05em', lineHeight: 1,
            opacity: clamp(ease(frame, 8) * 2, 0, 1),
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 20px 80px rgba(0,0,0,0.8)',
          }}>{n}</div>
          <div style={{
            fontWeight: 800, fontSize: 30, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)', marginTop: 18,
            opacity: clamp(ease(frame, 22) * 2, 0, 1),
          }}>unread, overnight</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ── BEAT 2 — 6:15 AM. She already did it. ───────────────────────────────── */
const Already: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
    <Take src={FILM('mock_cases.webm')} from={0.6} hold={hold} zoom={1.02} push={0.035} y={-14} />
    <Foot />
    <Clock time="6:15 AM" />
    <Line at={6} sub="One minute later" size={56}>
      She worked <span style={{ color: CLAY }}>while you slept.</span>
    </Line>
  </AbsoluteFill>
)

/* ── BEAT 3 — 7:02 AM. The inbox, swept. ─────────────────────────────────── */
const Swept: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
    <Take src={FILM('mock_cases.webm')} from={2.4} hold={hold} zoom={1.02} push={0.035} y={-14} />
    <Foot />
    <Clock time="7:02 AM" />
    <Line at={6} sub="Every inbox, overnight" size={54}>
      What needs you is waiting <span style={{ color: CLAY }}>before your coffee.</span>
    </Line>
  </AbsoluteFill>
)

/* ── BEAT 4 — 9:30 AM. It goes on the calendar without you. ──────────────── */
const Booked: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
    <Take src={FILM('mock_call.webm')} from={1.2} hold={hold} zoom={1.02} push={0.035} y={-14} />
    <Foot />
    <Clock time="9:30 AM" />
    <Line at={6} sub="Your own answered number" size={52}>
      She answers the phone — <span style={{ color: '#5E7355' }}>callers book, mid-call.</span>
    </Line>
  </AbsoluteFill>
)

/* ── BEAT 5 — 11:00 AM. The work, at speed. ──────────────────────────────── */
const Grind: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
    {/* the same take, run fast — the ramp IS the point: hours in seconds */}
    <Take src={FILM('mock_letter.webm')} from={1.4} hold={hold} zoom={1.02} push={0.035} y={-14} />
    <Foot />
    <Clock time="11:00 AM" />
    <Line at={6} sub="Stripe invoicing, built in" size={52}>
      Writes, invoices, chases, files — <span style={{ color: '#A34B2C' }}>on your letterhead.</span>
    </Line>
  </AbsoluteFill>
)

/* ── BEAT 6 — 2:15 PM. Tell her something new. ───────────────────────────── */
const Told: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
    <Take src={FILM('mock_hvac.webm')} from={1.2} hold={hold} zoom={1.02} push={0.035} y={-14} />
    <Foot />
    <Clock time="2:15 PM" />
    <Line at={6} sub="Built by talking" size={54}>
      Tell her once. <span style={{ color: CLAY }}>The workflow builds itself.</span>
    </Line>
  </AbsoluteFill>
)

/* ── BEAT 7 — THE REFUSAL. The one nobody else can show. ─────────────────── */
const Refuse: React.FC<{ hold: number }> = () => {
  const frame = useCurrentFrame()
  const p = hit(frame, 8)
  return (
    <AbsoluteFill style={{ background: '#151110', fontFamily: F }}>
      <Clock time="4:40 PM" dark />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 200px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontWeight: 800, fontSize: 24, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: SAGE, marginBottom: 26,
            opacity: clamp(ease(frame, 4) * 2, 0, 1),
          }}>The draft is ready</div>
          <div style={{
            fontWeight: 900, fontSize: 82, color: WHITE, lineHeight: 1.06, letterSpacing: '-0.035em',
            opacity: clamp(p * 2, 0, 1),
            transform: `scale(${0.94 + 0.06 * clamp(p, 0, 1)})`,
          }}>
            Nothing sends<br />
            <span style={{ color: SAGE }}>without your OK.</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ── BEAT 8 — 6:02 PM. You leave. She doesn't. ───────────────────────────── */
const Stays: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  /* the light goes down on the room and stays up on the work */
  const dim = clamp((frame - 14) / 30, 0, 1)
  return (
    <AbsoluteFill style={{ background: '#0E0B0A', fontFamily: F }}>
      <Take src={FILM('score.webm')} from={1.4} hold={hold} zoom={1.12} push={0.04} />
      <AbsoluteFill style={{ background: `rgba(14,11,10,${0.30 + 0.52 * dim})` }} />
      <Foot dark />
      <Clock time="6:02 PM" dark />
      <Line at={8} dark sub="No notice period" size={56}>
        You go home. <span style={{ color: SAGE }}>She doesn&rsquo;t.</span>
      </Line>
    </AbsoluteFill>
  )
}

/* ── BEAT 9 — WHATEVER YOU ARE. The brain, installing. ───────────────────── */
const Brain: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ background: INK, fontFamily: F }}>
    <Take src={FILM('brain.webm')} from={5.5} hold={hold} zoom={1.22} push={0.06} y={-30} />
    <Foot dark />
    <Line at={6} dark sub="The swappable brain" size={54}>
      Tell her your trade. <span style={{ color: SAGE }}>Her brain installs in seconds.</span>
    </Line>
  </AbsoluteFill>
)

/* ── BEAT 10 — THE PAYOFF, WRITTEN BY THE PRODUCT. ───────────────────────── */
const Speaks: React.FC<{ hold: number }> = ({ hold }) => (
  <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
    {/* "Your assistant now speaks residential real estate." — the app's own
        words, filmed. No line of ours could beat it, so there isn't one. */}
    <Take src={FILM('install.webm')} from={23.2} hold={hold} zoom={1.3} push={0.05} y={-10} />
  </AbsoluteFill>
)

/* ── BEAT 11 — THE CLOSE. ────────────────────────────────────────────────── */
const Close: React.FC<{ hold: number }> = () => {
  const frame = useCurrentFrame()
  const p = ease(frame, 2, 18, 130)
  const btn = ease(frame, 26, 16, 150)
  return (
    <AbsoluteFill style={{ background: CREAM, fontFamily: F }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 210 }}>
        <div style={{ transform: `scale(${0.9 + 0.1 * clamp(p, 0, 1)})`, opacity: clamp(p * 2, 0, 1) }}>
          <Img src={R('logo.png')} style={{ width: 700, display: 'block' }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 0 110px' }}>
        <div style={{ textAlign: 'center', width: 1920 }}>
          <div style={{
            fontWeight: 900, fontSize: 58, color: INK, letterSpacing: '-0.03em',
            opacity: clamp(ease(frame, 12) * 1.8, 0, 1),
            transform: `translateY(${(1 - clamp(ease(frame, 12), 0, 1)) * 20}px)`,
          }}>
            Start your <span style={{ color: CLAY }}>14-day free trial.</span>
          </div>
          <div style={{
            display: 'inline-block', marginTop: 28,
            background: CLAY, color: WHITE, borderRadius: 14,
            padding: '22px 56px', fontWeight: 900, fontSize: 40,
            boxShadow: '0 18px 44px rgba(181,86,58,0.35)',
            opacity: clamp(btn * 2, 0, 1),
            transform: `scale(${0.9 + 0.1 * clamp(btn, 0, 1)})`,
          }}>jordyn.app</div>
          <div style={{
            fontWeight: 700, fontSize: 25, color: '#8C7F74', marginTop: 22,
            opacity: clamp(ease(frame, 36) * 2, 0, 1),
          }}>No card needed. She starts the day you do.</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * THE CUT.
 *
 * Voice lines carried over from the existing narration, which already tells
 * exactly this story — it was only ever the pictures that were wrong. Two
 * beats run silent on purpose: the 6:14 open, so the film starts on a number
 * and a held breath, and the refusal, where taking the music away is the
 * whole effect.
 * ──────────────────────────────────────────────────────────────────────────── */

type Beat = { dur: number; el: (hold: number) => React.ReactNode; vo?: number; dark?: boolean }

const BEATS: Beat[] = [
  { dur: s(3.4), el: (h) => <Woke hold={h} />, dark: true },
  { dur: s(D[3] + 0.8), el: (h) => <Already hold={h} />, vo: 3 },
  { dur: s(D[5] + 0.5), el: (h) => <Swept hold={h} />, vo: 5 },
  { dur: s(D[6] + 0.5), el: (h) => <Booked hold={h} />, vo: 6 },
  { dur: s(D[7] + 0.5), el: (h) => <Grind hold={h} />, vo: 7 },
  { dur: s(D[10] + 0.6), el: (h) => <Told hold={h} />, vo: 10 },
  { dur: s(3.6), el: (h) => <Refuse hold={h} />, dark: true },
  { dur: s(D[11] + 0.9), el: (h) => <Stays hold={h} />, vo: 11 },
  { dur: s(D[8] + 0.7), el: (h) => <Brain hold={h} />, vo: 8 },
  { dur: s(3.0), el: (h) => <Speaks hold={h} /> },
  { dur: s(D[13] + 2.6), el: (h) => <Close hold={h} />, vo: 13 },
]

const rawStarts: number[] = []
{ let t = 0; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
/* every cut on a real beat of the track — 127.8 BPM, read off the audio */
const STARTS = beatLock(rawStarts, gridToFrames((grid as { beats: number[] }).beats, FPS), Math.round(0.2 * FPS))
export const MORNING_FRAMES = STARTS[STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6
const MUSIC_FRAMES = MORNING_FRAMES + s(2)

export const TheMorning: React.FC = () => {
  const durs = STARTS.map((st, i) =>
    (i + 1 < STARTS.length ? STARTS[i + 1] : MORNING_FRAMES - 6) - st)

  return (
    <AbsoluteFill style={{ background: CREAM }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={STARTS[i]} durationInFrames={durs[i]}>
          {b.el(durs[i])}
        </Sequence>
      ))}

      {/*
        * THE MUSIC DROPS OUT AT THE REFUSAL.
        *
        * Two seconds of silence in an eighty-second film is the loudest thing
        * in it, and "nothing sends without your OK" is the one claim no
        * competitor can make. The silence is the emphasis.
        */}
      <MusicBed
        src="showcase/jordyn-hire/music.mp3"
        musicFrames={MUSIC_FRAMES}
        volume={(f) => {
          const refuseAt = STARTS[6]
          const refuseEnd = refuseAt + BEATS[6].dur
          if (f > refuseAt - 6 && f < refuseEnd - 8) return 0
          if (f >= refuseEnd - 8 && f < refuseEnd + 10) return 0.34 * ((f - (refuseEnd - 8)) / 18)
          return 0.34
        }}
      />

      {BEATS.map((b, i) => b.vo === undefined ? null : (
        <Sequence key={'vo' + i} from={STARTS[i]}>
          <Audio src={R(`vo-${b.vo + 1}.mp3`)} volume={1.0} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
