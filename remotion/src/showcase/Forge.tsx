import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing } from 'remotion'
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import vo from '../../public/showcase/forge/vo.json'
import grid from '../../public/showcase/forge/beatgrid.json'
import { CinematicFootage, FootageFlash } from '../lib/footage'
import { CamPunch, CamMove } from '../lib/cinematography'
import { SpeedRamp, ShatterWord, ParticleField } from '../lib/dynamics'
import { CountUp } from '../lib/pizzazz'
import { FPS, s, clamp, pop, timeline, AudioBed, Rise, FadeOut, type BeatSpec } from './common'

const { fontFamily: DISPLAY } = loadBebas()
const { fontFamily: SANS } = loadInter()

/* ============================================================================
 * FORGE FITNESS — a gym. The "hit it hard" piece: two-frame cuts on the drum
 * hits, condensed type slammed on the beat, speed ramps, punch-ins, a shatter,
 * high-contrast footage with an ember tint. 30 seconds, no air.
 * ==========================================================================*/
const BLACK = '#050505', WHITE = '#f7f4ef', EMBER = '#ff5a1f', GREY = '#8a8a8a'
const D = (vo as { durations: number[] }).durations
const G = (grid as { beats: number[]; bpm: number })
const F = (i: number) => `showcase/forge/f-${i}.mp4`
const beatFrames = G.beats.map((b) => Math.round(b * FPS))
/** frames of the music beats that fall inside a beat window (relative to its start) */
const hitsIn = (start: number, len: number, every = 1) => beatFrames.filter((f) => f >= start && f < start + len).filter((_, i) => i % every === 0).map((f) => f - start)

const Slam: React.FC<{ text: string; at: number; size?: number; color?: string; y?: number; rot?: number }> = ({ text, at, size = 260, color = WHITE, y = 0, rot = 0 }) => {
  const frame = useCurrentFrame()
  const since = frame - at
  if (since < 0) return null
  const sc = interpolate(since, [0, 4], [1.25, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const blur = since <= 1 ? 10 : 0
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontFamily: DISPLAY, fontSize: size, color, lineHeight: 0.9, letterSpacing: '0.02em', transform: `scale(${sc}) translateY(${y}px) rotate(${rot}deg)`, filter: `blur(${blur}px)`, textShadow: '0 10px 40px rgba(0,0,0,.7)', whiteSpace: 'pre-line', textAlign: 'center' }}>{text}</div>
    </AbsoluteFill>
  )
}

/** Footage that hard-cuts between clips on the drum hits, with a flash on each cut. */
const HitCuts: React.FC<{ clips: number[]; hold: number; every?: number; grade?: 'noir' | 'teal-orange'; children?: React.ReactNode }> = ({ clips, hold, every = 2, grade = 'noir', children }) => {
  const frame = useCurrentFrame()
  const hits = [0, ...hitsIn(0, hold, every)]
  let idx = 0; for (let i = 0; i < hits.length; i++) if (frame >= hits[i]) idx = i
  const clip = clips[idx % clips.length]
  const start = hits[idx]
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Sequence from={start} key={idx}>
        <CinematicFootage src={F(clip)} dur={hold} grade={grade} brand={EMBER} brandStrength={0.22} grain={0.12} push={0.1} trim={(idx * 1.3) % 3} vignette={1.2} />
      </Sequence>
      {hits.slice(1).map((h) => <FootageFlash key={h} at={h} color={WHITE} dur={4} />)}
      {children}
    </AbsoluteFill>
  )
}

// 1 — "Six weeks." A single clip, a speed ramp, the words slam in.
const Six: React.FC<{ hold: number }> = ({ hold }) => (
  <SpeedRamp rampAt={Math.round(hold * 0.5)} whip={1.4}>
    <CinematicFootage src={F(0)} dur={hold} grade="noir" brand={EMBER} brandStrength={0.2} grain={0.12} push={0.14} slowmo={0.6}>
      <Slam text={'SIX\nWEEKS.'} at={4} size={300} />
    </CinematicFootage>
  </SpeedRamp>
)

// 2 — "No excuses…" three slams on three hits over cut footage.
const NoExcuses: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const hits = hitsIn(0, hold, 2)
  const words = ['NO EXCUSES.', 'NO SHORTCUTS.', 'NO DAYS OFF\nYOU DIDN’T EARN.']
  const at = [hits[0] ?? 2, hits[2] ?? 22, hits[4] ?? 44]
  let idx = 0; for (let i = 0; i < at.length; i++) if (frame >= at[i]) idx = i
  return (
    <HitCuts clips={[1, 2, 3]} hold={hold} every={2}>
      <CamPunch at={at[2]} amount={0.08}><Slam text={words[idx]} at={at[idx]} size={idx === 2 ? 170 : 230} color={idx === 2 ? EMBER : WHITE} /></CamPunch>
    </HitCuts>
  )
}

// 3 — small groups, real coaches: split thirds that slide in on hits.
const Coaches: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const hits = hitsIn(0, hold, 2)
  const panels = [{ clip: 4, at: hits[0] ?? 2, label: 'SMALL GROUPS' }, { clip: 2, at: hits[1] ?? 14, label: 'REAL COACHES' }, { clip: 5, at: hits[2] ?? 26, label: 'EVERY LIFT COUNTED' }]
  return (
    <AbsoluteFill style={{ background: BLACK, flexDirection: 'row' }}>
      {panels.map((p, i) => {
        const q = clamp((frame - p.at) / 7, 0, 1); const e = Easing.out(Easing.cubic)(q)
        return (
          <div key={i} style={{ flex: 1, position: 'relative', overflow: 'hidden', transform: `translateY(${(1 - e) * (i % 2 ? -100 : 100)}%)` }}>
            <CinematicFootage src={F(p.clip)} dur={hold} grade="noir" brand={EMBER} brandStrength={0.2} grain={0.1} push={0.12} trim={i} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 90, textAlign: 'center', fontFamily: DISPLAY, fontSize: p.label.length > 12 ? 50 : 64, color: WHITE, letterSpacing: '0.04em', opacity: clamp((frame - p.at - 4) / 6, 0, 1) }}>{p.label}</div>
            {i < 2 && <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, background: EMBER }} />}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

// 4 — the numbers: 3,105 and 96% punch in on the hits with ember particles.
const Numbers: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const h = hitsIn(0, hold, 2)
  const a = h[0] ?? 2, b = h[2] ?? 30
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <ParticleField color={EMBER} count={40} kind="ember" speed={1.6} />
      <CamPunch at={b} amount={0.07}>
        <AbsoluteFill style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 120 }}>
          {[{ at: a, v: 3105, suf: '', label: 'MEMBERS' }, { at: b, v: 96, suf: '%', label: 'FINISHED' }].map((c, i) => {
            const p = pop(frame, c.at, 9, 260)
            return (
              <div key={i} style={{ textAlign: 'center', opacity: clamp(p * 3, 0, 1), transform: `scale(${0.6 + 0.4 * clamp(p, 0, 1.1)})` }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 300, color: i ? EMBER : WHITE, lineHeight: 0.9 }}><CountUp to={c.v} suffix={c.suf} decimals={0} startAt={c.at} dur={20} /></div>
                <div style={{ fontFamily: DISPLAY, fontSize: 54, color: GREY, letterSpacing: '0.2em', marginTop: 8 }}>{c.label}</div>
              </div>
            )
          })}
        </AbsoluteFill>
      </CamPunch>
      {[a, b].map((f) => <FootageFlash key={f} at={f} color={EMBER} dur={5} />)}
    </AbsoluteFill>
  )
}

// 5 — the date shatters in.
const Date_: React.FC<{ hold: number }> = ({ hold }) => (
  <HitCuts clips={[0, 3]} hold={hold} every={3}>
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Rise at={2} dur={8} style={{ fontFamily: SANS, fontWeight: 800, fontSize: 26, letterSpacing: '0.4em', color: EMBER }}>NEXT CHALLENGE</Rise>
        <div style={{ marginTop: 10 }}><ShatterWord text="MARCH 3" size={300} font={DISPLAY} color={WHITE} shatterAt={Math.round(hold * 0.75)} /></div>
      </div>
    </AbsoluteFill>
  </HitCuts>
)

// 6 — close: wordmark forged (letters slam on hits), tagline, ember fade.
const Close: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const hits = hitsIn(0, hold, 1)
  const word = 'FORGE'
  return (
    <CamMove keys={[{ at: 0, scale: 1.08 }, { at: hold, scale: 1 }]}>
      <CinematicFootage src={F(5)} dur={hold} grade="noir" brand={EMBER} brandStrength={0.3} grain={0.14} slowmo={0.5} push={0}>
        <AbsoluteFill style={{ background: 'radial-gradient(60% 60% at 50% 50%, transparent, rgba(0,0,0,.75))' }} />
        <ParticleField color={EMBER} count={30} kind="ember" speed={1.2} />
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 340, color: WHITE, lineHeight: 0.9, letterSpacing: '0.06em', display: 'flex', justifyContent: 'center' }}>
              {[...word].map((ch, i) => { const at = hits[i] ?? i * 5; const since = frame - at; const sc = since < 0 ? 0 : interpolate(since, [0, 4], [1.6, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }); return <span key={i} style={{ display: 'inline-block', transform: `scale(${sc})`, opacity: since < 0 ? 0 : 1, color: i === 4 ? EMBER : WHITE }}>{ch}</span> })}
            </div>
            <div style={{ fontFamily: DISPLAY, fontSize: 70, color: GREY, letterSpacing: '0.3em', marginTop: 6, opacity: clamp((frame - (hits[5] ?? 30)) / 8, 0, 1) }}>FITNESS</div>
            <Rise at={(hits[6] ?? 40)} dur={10} style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, color: WHITE, marginTop: 26, letterSpacing: '0.04em' }}>COME IN SOFT. <span style={{ color: EMBER }}>LEAVE FORGED.</span></Rise>
            <Rise at={(hits[8] ?? 56)} dur={10} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 20, color: GREY, marginTop: 18, letterSpacing: '0.3em' }}>FORGEFITNESS.COM · AUSTIN</Rise>
          </div>
        </AbsoluteFill>
        <FadeOut total={hold} dur={16} />
      </CinematicFootage>
    </CamMove>
  )
}

const BEATS: BeatSpec[] = [
  { dur: s(D[0] + 1.0), el: (h) => <Six hold={h} />, impact: true },
  { dur: s(D[1] + 0.3), el: (h) => <NoExcuses hold={h} /> },
  { dur: s(D[2] + 0.3), el: (h) => <Coaches hold={h} /> },
  { dur: s(D[3] + 0.5), el: (h) => <Numbers hold={h} />, impact: true },
  { dur: s(D[4] + 0.6), el: (h) => <Date_ hold={h} /> },
  { dur: s(D[5] + 2.0), el: (h) => <Close hold={h} />, impact: true },
]
const TL = timeline(BEATS, G.beats)
export const FORGE_FRAMES = TL.total
export const FORGE_FPS = FPS

export const Forge: React.FC = () => (
  <AbsoluteFill style={{ background: BLACK }}>
    {BEATS.map((b, i) => (
      <Sequence key={i} from={TL.starts[i]} durationInFrames={TL.durs[i] + 4}>{b.el(TL.durs[i], i)}</Sequence>
    ))}
    <AudioBed id="forge" voice={!('placeholder' in vo)} beats={BEATS} tl={TL} voDur={D} musicFrames={s(38)} loud={0.42} duck={0.16} whoosh={0.1} impacts={BEATS.map((b, i) => b.impact ? TL.starts[i] : -1).filter((f) => f >= 0)} />
  </AbsoluteFill>
)
