import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import apexGrid from '../public/apex/beatgrid.json'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'
import { Intro, pickIntro } from './lib/intros'
import { StreakWipe, LogoBug } from './lib/pizzazz'
import { CinematicFootage, FootageFlash } from './lib/footage'

const { fontFamily: SANS } = loadArchivo()
const { fontFamily: BLACK } = loadArchivoBlack()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * APEX AFFINITY GROUP — CINEMATIC FOOTAGE edition. Real Pexels stock footage,
 * graded to look like a filmed commercial (color grade + grain + bloom + vignette
 * + letterbox + brand tint), with bold kinetic text over it, beat-cut. Brand:
 * red #cc2027 + dark slate blue #1e3a72 (the real Apex palette).
 * ==========================================================================*/

const NAVY = '#0e1c3a', NAVY2 = '#1e3a72', RED = '#cc2027', RED_HI = '#ff5268'
const STEEL = '#5b8ad6', WHITE = '#ffffff', ICE = '#dbe4f5'

// bold kinetic headline over the footage
const Over: React.FC<{ pre?: string; hot?: string; post?: string; color?: string; size?: number; hold: number; kicker?: string }> =
({ pre = '', hot = '', post = '', color = RED_HI, size = 96, hold, kicker }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 220 } })
  const o = interpolate(frame, [0, 6, hold - 8, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const kO = interpolate(frame, [2, 10], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: o, transform: `scale(${0.88 + pop * 0.12})`, textAlign: 'center', maxWidth: 1560, padding: '0 90px' }}>
        {kicker && <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 26, letterSpacing: '0.32em', textTransform: 'uppercase', color: RED_HI, marginBottom: 22, opacity: kO, textShadow: '0 2px 20px #000' }}>{kicker}</div>}
        <div style={{ fontFamily: BLACK, fontSize: size, lineHeight: 0.98, textTransform: 'uppercase', color: WHITE, letterSpacing: '-0.01em', textShadow: '0 6px 40px rgba(0,0,0,0.9)' }}>
          {pre}{hot && <span style={{ color }}>{hot}</span>}{post}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// a graded footage beat (brand-tinted, cinematic)
const Foot: React.FC<{ src: string; dur: number; focus?: string; slowmo?: boolean; grade?: any; trim?: number }> =
({ src, dur, focus = '50% 42%', slowmo = false, grade = 'teal-orange', trim = 0.3 }) => (
  <CinematicFootage src={`apex/footage/${src}.mp4`} dur={dur} focus={focus} slowmo={slowmo} grade={grade}
    brand={NAVY2} brandStrength={0.16} letterbox grain={0.09} bloom={1} vignette={1} trim={trim} />
)

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode; bug?: boolean }
// EVERY beat gets its OWN distinct clip, matched to the line. Longer beats split
// across TWO clips (a mid-beat cut) so nothing sits on one shot too long.
const BEATS: Beat[] = [
  // 1 — pick a lane (someone stuck, staring out the window)
  { dur: s(2.74 + 0.2), vo: 'ax-1', el: <><Foot src="stuck" dur={s(2.94)} slowmo focus="50% 40%" />
      <Over pre="Most make you " hot="pick a lane." color={RED_HI} size={84} hold={s(2.74 + 0.2)} /></> },
  // 2 — Apex built two (dramatic city rise)
  { dur: s(1.63 + 0.9), vo: 'ax-2', el: <><Foot src="rise" dur={s(2.53)} focus="50% 45%" />
      <Over pre="Apex built " hot="TWO." color={RED_HI} size={140} hold={s(1.63 + 0.9)} /></> },
  // 3 — two paths (a crossroads / diverging)
  { dur: s(6.18 + 0.2), vo: 'ax-3', bug: true, el: <TwoClip a="paths" b="agent" dur={s(6.38)} focusA="50% 45%" focusB="50% 40%"
      over={<Over kicker="Two proven paths" pre="Insurance. AI. " hot="Or both." color={STEEL} size={78} hold={s(6.18 + 0.2)} />} /> },
  // 4 — the differentiator (AI tech advantage)
  { dur: s(6.36 + 0.2), vo: 'ax-4', bug: true, el: <TwoClip a="tech" b="work" dur={s(6.56)} focusA="50% 42%" focusB="55% 45%"
      over={<Over kicker="The only one of its kind" pre="An AI stack built to help you " hot="win." color={RED_HI} size={64} hold={s(6.36 + 0.2)} />} /> },
  // 5 — finds your next client (working → closing)
  { dur: s(10.40 + 0.2), vo: 'ax-5', bug: true, el: <TwoClip a="success" b="closing" dur={s(10.6)} focusA="50% 38%" focusB="50% 45%" slowmoA
      over={<Over pre="AI that finds your next " hot="client." color={RED_HI} size={72} hold={s(10.40 + 0.2)} />} /> },
  // 6 — everything to grow (confident growth)
  { dur: s(6.27 + 0.2), vo: 'ax-6', bug: true, el: <TwoClip a="growth" b="celebrate" dur={s(6.47)} focusA="50% 38%" focusB="50% 40%" slowmoA
      over={<Over kicker="A-rated · $0 to start · no cap" pre="Everything you need to " hot="grow." color={STEEL} size={66} hold={s(6.27 + 0.2)} />} /> },
  // 7 — room for everyone (the team together)
  { dur: s(3.90 + 0.2), vo: 'ax-7', el: <TwoClip a="together" b="everyone" dur={s(4.1)} focusA="50% 40%" focusB="50% 45%"
      over={<Over pre="One opportunity. " hot="Room for everyone." color={RED_HI} size={68} hold={s(3.90 + 0.2)} />} /> },
  // 8 — CTA (over the handshake, darkened)
  { dur: s(2.93 + 2.2), vo: 'ax-8', el: <CTACard hold={s(2.93 + 2.2)} /> },
]

// a beat that cuts between TWO clips at its midpoint (mid-beat cut on the beat)
// so longer lines never sit on one shot — real editing rhythm.
function TwoClip({ a, b, dur, over, focusA = '50% 42%', focusB = '50% 42%', slowmoA = false }:
  { a: string; b: string; dur: number; over: React.ReactNode; focusA?: string; focusB?: string; slowmoA?: boolean }) {
  const half = Math.round(dur * 0.5)
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={half + 4}><Foot src={a} dur={half} focus={focusA} slowmo={slowmoA} trim={0.4} /></Sequence>
      <Sequence from={half} durationInFrames={dur - half + 6}><Foot src={b} dur={dur - half} focus={focusB} trim={0.4} /><FootageFlash at={0} color="#fff" dur={6} /></Sequence>
      {over}
    </AbsoluteFill>
  )
}

function CTACard({ hold }: { hold: number }) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const logoUp = spring({ frame: frame - 2, fps, config: { damping: 14, stiffness: 130 } })
  const cta = interpolate(frame, [26, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const btn = spring({ frame: frame - 44, fps, config: { damping: 12, stiffness: 180 } })
  const url = interpolate(frame, [62, 74], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.12) * 0.02
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: NAVY }}>
      {/* graded footage behind, heavily darkened */}
      <CinematicFootage src="apex/footage/celebrate.mp4" dur={hold} focus="50% 40%" grade="teal-orange" brand={NAVY2} brandStrength={0.2} grain={0.08} vignette={1.3} bloom={0.6} trim={3} />
      <AbsoluteFill style={{ background: `${NAVY}bb` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ transform: `scale(${0.72 + clamp(logoUp, 0, 1) * 0.28})`, filter: `drop-shadow(0 0 30px ${RED}66)` }}>
          <Img src={staticFile('apex/logo-white.png')} style={{ width: 700, height: 'auto' }} />
        </div>
        <div style={{ fontFamily: BLACK, fontSize: 58, color: RED_HI, textTransform: 'uppercase', marginTop: 24, opacity: cta, textShadow: `0 0 30px ${RED}66` }}>Reach Your Apex.</div>
        <div style={{ marginTop: 34, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse})` }}>
          <div style={{ background: `linear-gradient(180deg, ${RED_HI}, ${RED})`, color: WHITE, fontFamily: SANS, fontWeight: 800, fontSize: 32, letterSpacing: '0.06em', padding: '18px 54px', borderRadius: 8, textTransform: 'uppercase', boxShadow: `0 0 30px ${RED}88` }}>Get Started — Free</div>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 28, color: ICE, marginTop: 24, opacity: url }}>reachtheapex.net</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// small persistent logo bug (white apex logo)
const Bug: React.FC = () => <LogoBug src="apex/logo-white.png" width={160} />

// ---- intro + beat-lock ----
const INTRO = Math.round(2.8 * FPS)
const rawStarts: number[] = []; { let t = INTRO; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const B_STARTS = beatLock(rawStarts, gridToFrames((apexGrid as any).beats, FPS).filter((g) => g >= INTRO), Math.round(0.22 * FPS))
export const apexFootageDuration = B_STARTS[B_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6
const MUSIC_FRAMES = Math.round(55.0 * FPS)

export const CommercialApexFootage: React.FC = () => {
  const starts = B_STARTS
  const durs = durationsFromStarts(starts, apexFootageDuration - 6)
  const total = apexFootageDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.18, duck: 0.07, ramp: 16, fadeInEnd: 14, fadeOutStart: total - 12, fadeOutEnd: total - 2 })
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Sequence from={0} durationInFrames={INTRO + 2}>
        <Intro style={pickIntro('bold')} dur={INTRO} tokens={{ bg: NAVY, bg2: NAVY2, accent: RED, accentHi: RED_HI, particle: RED }}
          render={<Img src={staticFile('apex/logo-white.png')} style={{ width: 640, height: 'auto', display: 'block' }} />} />
      </Sequence>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 6}>
          {b.el}
          {b.bug && <Bug />}
          {i > 0 && <FootageFlash at={0} color="#fff" />}
          {i > 0 && <StreakWipe color={i % 2 ? RED : STEEL} dir={i % 2 ? 1 : -1} dur={10} />}
        </Sequence>
      ))}
      <MusicBed src="apex/music.mp3" musicFrames={1650} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`apex/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
    </AbsoluteFill>
  )
}
