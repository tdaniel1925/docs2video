import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing } from 'remotion'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import vo from '../../public/showcase/harbor/vo.json'
import grid from '../../public/showcase/harbor/beatgrid.json'
import { CinematicFootage, FootageFlash } from '../lib/footage'
import { CamMove, CamBreath } from '../lib/cinematography'
import { ParticleField } from '../lib/dynamics'
import { SettleSweep } from '../lib/pizzazz'
import { FPS, s, clamp, pop, timeline, AudioBed, Rule, Rise, Letters, Chip, FadeOut, DipCut, type BeatSpec } from './common'

const { fontFamily: SERIF } = loadFraunces()
const { fontFamily: SANS } = loadInter()

/* ============================================================================
 * HARBOR & VINE — a coastal restaurant. The "expensive camera" piece: real
 * footage, teal-orange + warm grades, slow continuous camera moves, film grain,
 * letterbox, a serif wordmark that assembles letter by letter, cuts on the beat.
 * Every scene keeps moving (push-ins, drifts, sweeps); nothing is ever a still.
 * ==========================================================================*/
const GOLD = '#d9b56a', CREAM = '#f3ecdf', INK = '#0b0f14', SEA = '#0f2a36'
const D = (vo as { durations: number[] }).durations
const F = (i: number) => `showcase/harbor/f-${i}.mp4`

const Wordmark: React.FC<{ at: number; size?: number; sub?: boolean }> = ({ at, size = 96, sub = true }) => {
  const frame = useCurrentFrame()
  return (
    <div style={{ textAlign: 'center', color: CREAM }}>
      <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: size, letterSpacing: '0.22em', lineHeight: 1 }}>
        <Letters text="HARBOR" at={at} step={3} /><span style={{ color: GOLD, fontStyle: 'italic', fontWeight: 300, opacity: clamp((frame - at - 22) / 12, 0, 1) }}> &amp; </span><Letters text="VINE" at={at + 24} step={3} />
      </div>
      {sub && <div style={{ marginTop: 18, opacity: clamp((frame - at - 40) / 14, 0, 1) }}><Rule at={at + 40} w={160} color={GOLD} /><div style={{ fontFamily: SANS, fontSize: 16, letterSpacing: '0.42em', textTransform: 'uppercase', marginTop: 14, color: GOLD }}>Kitchen on the Atlantic</div></div>}
    </div>
  )
}

// 1 — the coast. A slow push over the cliffs; the first line rises quietly.
const Open: React.FC<{ hold: number }> = ({ hold }) => (
  <CamMove keys={[{ at: 0, scale: 1 }, { at: hold, scale: 1.08, y: -1.5 }]}>
    <CinematicFootage src={F(0)} dur={hold} grade="teal-orange" letterbox grain={0.07} push={0.02} focus="50% 40%">
      <ParticleField color={CREAM} count={14} kind="dust" speed={0.5} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 190 }}>
        <Rise at={10} dur={22} style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, fontSize: 52, color: CREAM, textShadow: '0 4px 30px rgba(0,0,0,.6)' }}>Where the road ends, the table begins.</Rise>
      </AbsoluteFill>
    </CinematicFootage>
  </CamMove>
)

// 2 — the name. Waves behind, deep sea tint, wordmark assembles on the beat.
const Name: React.FC<{ hold: number }> = ({ hold }) => (
  <CamMove keys={[{ at: 0, scale: 1.06 }, { at: hold, scale: 1 }]}>
    <CinematicFootage src={F(6)} dur={hold} grade="cool" brand={SEA} brandStrength={0.4} grain={0.1} slowmo={0.6} push={0}>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 60% at 50% 50%, transparent, rgba(0,0,0,.55))' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}><Wordmark at={6} /></AbsoluteFill>
      <FootageFlash at={6} color={GOLD} dur={10} />
    </CinematicFootage>
  </CamMove>
)

// 3 — the boats. Harbor at dawn, a caption chip, a drifting camera.
const Boats: React.FC<{ hold: number }> = ({ hold }) => (
  <CamMove keys={[{ at: 0, x: 1.5, scale: 1.04 }, { at: hold, x: -1.5, scale: 1.08 }]}>
    <CinematicFootage src={F(2)} dur={hold} grade="warm" grain={0.07} letterbox>
      <Chip at={8} text="Landed this morning" color={INK} bg={GOLD} font={SANS} x={110} y={700} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-start', padding: '0 0 150px 110px' }}>
        <Rise at={14} style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 56, color: CREAM, maxWidth: 900, lineHeight: 1.1, textShadow: '0 4px 30px rgba(0,0,0,.6)' }}>Every morning, the boats decide the menu.</Rise>
      </AbsoluteFill>
    </CinematicFootage>
  </CamMove>
)

// 4 — twelve courses, one long table. A huge serif "12" grows in over the table.
const Twelve: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, 6, 16, 90)
  return (
    <CamMove keys={[{ at: 0, scale: 1.1, y: 1 }, { at: hold, scale: 1.0, y: -1 }]}>
      <CinematicFootage src={F(3)} dur={hold} grade="warm" grain={0.08} focus="50% 55%">
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ fontFamily: SERIF, fontWeight: 200, fontSize: 420, color: CREAM, lineHeight: 0.9, letterSpacing: '-0.04em', opacity: clamp(p * 1.4, 0, 0.92), transform: `scale(${0.7 + 0.3 * p})`, textShadow: '0 10px 60px rgba(0,0,0,.7)' }}>12</div>
        </AbsoluteFill>
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 130 }}>
          <Rise at={22} style={{ fontFamily: SANS, fontSize: 20, letterSpacing: '0.4em', textTransform: 'uppercase', color: GOLD }}>courses · one long table · the sun does the rest</Rise>
        </AbsoluteFill>
        <SettleSweep color={GOLD} hold={hold} />
      </CinematicFootage>
    </CamMove>
  )
}

// 5 — wine and bread: a split that slides in from both sides, a gold seam.
const Split: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const seam = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const lateSlide = interpolate(frame, [hold * 0.55, hold], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const pos = 50 + lateSlide * 12   // seam drifts right late in the beat so the frame keeps moving
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - pos * seam}% 0 0)` }}>
        <CinematicFootage src={F(4)} dur={hold} grade="warm" grain={0.08} slowmo={0.7} push={0.05} />
      </div>
      <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${pos * seam + (1 - seam) * 100}%)` }}>
        <CinematicFootage src={F(5)} dur={hold} grade="warm" grain={0.08} push={0.05} focus="50% 50%" />
      </div>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos * seam}%`, width: 3, background: GOLD, boxShadow: `0 0 30px ${GOLD}`, opacity: seam }} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 110px 140px', flexDirection: 'row', alignItems: 'flex-end', gap: 40 }}>
        <Rise at={10} style={{ flex: 1, fontFamily: SERIF, fontWeight: 300, fontSize: 46, color: CREAM, textShadow: '0 4px 30px rgba(0,0,0,.7)' }}>Wine from the hill behind us.</Rise>
        <Rise at={26} style={{ flex: 1, textAlign: 'right', fontFamily: SERIF, fontWeight: 300, fontSize: 46, color: CREAM, textShadow: '0 4px 30px rgba(0,0,0,.7)' }}>Bread from the oven beside you.</Rise>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// 6 — the invitation: chef plating, a card with the facts rises from the bottom.
const Book: React.FC<{ hold: number }> = ({ hold }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, 10, 15)
  return (
    <CamMove keys={[{ at: 0, scale: 1.0 }, { at: hold, scale: 1.07, x: 1 }]}>
      <CinematicFootage src={F(1)} dur={hold} grade="teal-orange" grain={0.07} focus="50% 45%">
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'flex-end', paddingRight: 120 }}>
          <div style={{ width: 560, background: 'rgba(11,15,20,.78)', backdropFilter: 'blur(6px)', border: `1px solid ${GOLD}55`, padding: '36px 40px', color: CREAM, opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 60}px)` }}>
            <div style={{ fontFamily: SANS, fontSize: 14, letterSpacing: '0.4em', textTransform: 'uppercase', color: GOLD }}>Open</div>
            <div style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 54, lineHeight: 1.05, marginTop: 6 }}>Thursday<br />to Sunday</div>
            <Rule at={26} w={80} color={GOLD} />
            <Rise at={30} style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, fontSize: 24, marginTop: 14, color: CREAM, opacity: .9 }}>Book the table, not a time — you’ll want the whole evening.</Rise>
          </div>
        </AbsoluteFill>
      </CinematicFootage>
    </CamMove>
  )
}

// 7 — the close: sunset waves, wordmark, tagline, address.
const Close: React.FC<{ hold: number }> = ({ hold }) => (
  <CamMove keys={[{ at: 0, scale: 1.08 }, { at: hold, scale: 1 }]}>
    <CinematicFootage src={F(6)} dur={hold} grade="warm" grain={0.09} slowmo={0.6} push={0} trim={2}>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.2), rgba(0,0,0,.65))' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
        <Wordmark at={4} size={110} sub={false} />
        <Rise at={44} style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, fontSize: 40, color: CREAM, marginTop: 26 }}>Come hungry. Leave slowly.</Rise>
        <Rise at={62} style={{ fontFamily: SANS, fontSize: 17, letterSpacing: '0.36em', textTransform: 'uppercase', color: GOLD, marginTop: 30 }}>harborandvine.com · Cape Bright</Rise>
      </AbsoluteFill>
      <FadeOut total={hold} dur={22} />
    </CinematicFootage>
  </CamMove>
)

const BEATS: BeatSpec[] = [
  { dur: s(D[0] + 1.2), el: (h) => <Open hold={h} /> },
  { dur: s(D[1] + 1.4), el: (h) => <Name hold={h} />, impact: true },
  { dur: s(D[2] + 0.9), el: (h) => <Boats hold={h} /> },
  { dur: s(D[3] + 0.9), el: (h) => <Twelve hold={h} /> },
  { dur: s(D[4] + 0.8), el: (h) => <Split hold={h} /> },
  { dur: s(D[5] + 0.8), el: (h) => <Book hold={h} /> },
  { dur: s(D[6] + 2.4), el: (h) => <Close hold={h} /> },
]
const TL = timeline(BEATS, (grid as { beats: number[] }).beats)
export const HARBOR_FRAMES = TL.total
export const HARBOR_FPS = FPS

export const Harbor: React.FC = () => (
  <AbsoluteFill style={{ background: INK }}>
    <CamBreath intensity={0.6}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={TL.starts[i]} durationInFrames={TL.durs[i] + 4}>
          {b.el(TL.durs[i], i)}
          {i > 0 && <DipCut color={INK} dur={7} />}
        </Sequence>
      ))}
    </CamBreath>
    <AudioBed id="harbor" voice={!('placeholder' in vo)} beats={BEATS} tl={TL} voDur={D} musicFrames={s(52)} loud={0.34} duck={0.13} whoosh={0.12} impacts={[TL.starts[1]]} />
  </AbsoluteFill>
)
