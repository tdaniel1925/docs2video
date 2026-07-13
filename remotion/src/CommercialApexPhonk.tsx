import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence, Audio, Img, staticFile, spring } from 'remotion'
import { MusicBed } from './lib/musicbed'
import { makeMusicDuck, type VoWindow } from './lib/audio'
import { Halftone, InkFlash, MotionLines } from './lib/comic'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'

/* ============================================================================
 * CommercialApexPhonk — the Apex spot as a gritty COMIC-BOOK "phonk edit"
 * (style ref: youtube fnySKJBeSNc). Mechanics:
 *   · Slow ominous BUILD (0-~11s): slow scale-creep + cold blue grade + suspense
 *   · The DROP (~11s+): beat-synced VIOLENT zoom pulses, strobe color flashes,
 *     jittery micro camera-shake, 2.5D parallax pushes, speed lines + POW bursts
 * The comic art (Gemini-generated panels) is what gets pulsed/strobed/shaken.
 * ==========================================================================*/

const { fontFamily: DISPLAY } = loadArchivoBlack()
const FPS = 30
const ASSET = 'c-apexPHONK'
const NAVY = '#152a52', RED = '#d81f27', WHITE = '#f5f2ea', BLACK = '#0a0a0a'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const MUSIC_FRAMES = Math.round(33.985 * FPS)

// ---- BEAT GRID: kicks land here (seconds). Slow build, then fast frenetic drop.
const DROP = 10.8 // when the beat drops
const BEATS_SEC = [
  // build — sparse, ominous
  1.6, 4.0, 6.6, 9.0,
  // drop — fast rhythmic kicks (~every 0.38s), the frenetic climax
  10.8, 11.2, 11.55, 11.95, 12.35, 12.75, 13.15, 13.55,
  13.95, 14.4, 14.85, 15.3, 15.75, 16.2, 16.65, 17.1,
  17.6, 18.1, 18.6, 19.1, 19.6, 20.1, 20.6, 21.1,
  21.7, 22.3, 22.9, 23.5, 24.1, 24.7, 25.3, 25.9,
  26.6, 27.3, 28.0, 28.8, 29.6, 30.5, 31.5, 32.6,
]
const BEATS = BEATS_SEC.map((s) => Math.round(s * FPS))
const isDrop = (f: number) => f >= DROP * FPS

// distance (in frames) to the nearest beat AT or BEFORE f, plus which beat
function beatPhase(f: number): { since: number; hard: boolean } {
  let last = -999
  for (const b of BEATS) { if (b <= f) last = b; else break }
  return { since: f - last, hard: last >= DROP * FPS }
}

// ---- KICK: an envelope 1→0 over `decay` frames right after each beat, used to
// drive zoom pulse / shake / strobe intensity. Sharper after the drop.
function kickEnv(f: number, decay: number): number {
  const { since } = beatPhase(f)
  if (since < 0) return 0
  return clamp(1 - since / decay, 0, 1)
}

// ---- ParallaxPanel: a comic panel with 2.5D depth (bg pushes slower than a
// pulled-forward focal crop) + beat-synced VIOLENT zoom pulse + jitter shake.
// `absOffset` = the scene's absolute start frame, so beat logic reads the global
// beat grid (Sequence gives a LOCAL frame; beats live on the absolute timeline).
const ParallaxPanel: React.FC<{ src: string; dur: number; focus?: string; build?: boolean; absOffset: number }> = ({ src, dur, focus = '50% 42%', build = false, absOffset }) => {
  const local = useCurrentFrame()
  const frame = local + absOffset
  const p = interpolate(local, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  // base slow creep (Ken Burns). Build = slow ominous; drop = faster push.
  const baseScale = build ? 1.05 + p * 0.10 : 1.08 + p * 0.16
  // beat zoom pulse — violent elastic scale on the kick (only meaningful post-drop)
  const kick = isDrop(frame) ? kickEnv(frame, 6) : kickEnv(frame, 10) * 0.35
  const pulse = kick * (isDrop(frame) ? 0.14 : 0.05)
  const scale = baseScale + pulse
  // jittery micro-shake (chaotic) — strong on kick after the drop
  const shakeAmp = isDrop(frame) ? kick * 14 : 0
  const sx = Math.sin(frame * 5.3) * shakeAmp
  const sy = Math.cos(frame * 6.7) * shakeAmp
  const rot = Math.sin(frame * 4.1) * kick * (isDrop(frame) ? 1.1 : 0)
  // 2.5D: slow parallax drift on the background layer
  const bgx = interpolate(p, [0, 1], [-2, 2])
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: BLACK }}>
      {/* bg layer (blurred, slower) for depth */}
      <Img src={staticFile(src)} style={{ position: 'absolute', width: '130%', height: '130%', left: '-15%', top: '-15%', objectFit: 'cover', objectPosition: focus, transform: `scale(${scale * 1.06}) translate(${bgx}%, 0)`, filter: 'blur(6px) brightness(0.7)' }} />
      {/* focal layer */}
      <Img src={staticFile(src)} style={{ position: 'absolute', width: '112%', height: '112%', left: '-6%', top: '-6%', objectFit: 'cover', objectPosition: focus, transform: `scale(${scale}) translate(${sx}px, ${sy}px) rotate(${rot}deg)` }} />
    </AbsoluteFill>
  )
}

// ---- Strobe: hard color flashes on the beat (red/black/white) — post-drop only.
const Strobe: React.FC = () => {
  const frame = useCurrentFrame()
  if (!isDrop(frame)) return null
  const k = kickEnv(frame, 3)
  if (k <= 0.02) return null
  const { since } = beatPhase(frame)
  const col = since % 3 === 0 ? RED : since % 3 === 1 ? WHITE : BLACK
  return <AbsoluteFill style={{ background: col, opacity: k * 0.5, mixBlendMode: col === BLACK ? 'multiply' : 'screen', pointerEvents: 'none' }} />
}

// ---- ColdGrade: cold monochrome-blue overlay during the BUILD, lifts at drop.
const ColdGrade: React.FC = () => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, DROP * FPS - 20, DROP * FPS], [0.55, 0.5, 0], { extrapolateRight: 'clamp' })
  if (o <= 0) return null
  return <AbsoluteFill style={{ background: `linear-gradient(${NAVY}, #0a1630)`, opacity: o, mixBlendMode: 'multiply', pointerEvents: 'none' }} />
}

// ---- RedVignette: pumps on the beat post-drop (alarming red edges).
const RedPump: React.FC = () => {
  const frame = useCurrentFrame()
  if (!isDrop(frame)) return null
  const k = kickEnv(frame, 8)
  return <AbsoluteFill style={{ boxShadow: `inset 0 0 ${180 + k * 160}px ${40 + k * 90}px rgba(216,31,39,${0.25 + k * 0.4})`, pointerEvents: 'none' }} />
}

// ---- LowerThird: clean, readable caption pinned to the LOWER THIRD only, on a
// gradient scrim so it NEVER fights the art or covers the subject. Bold sans, no
// comic font, no rotation. A thin red accent bar keeps the brand energy.
const LowerThird: React.FC<{ text: string; at: number; sub?: string; absOffset: number; size?: number }> = ({ text, at, sub, absOffset, size = 76 }) => {
  const local = useCurrentFrame()
  const f = local - at
  if (f < 0) return null
  const o = clamp(f / 8, 0, 1)
  const rise = interpolate(o, [0, 1], [26, 0], { easing: Easing.out(Easing.cubic) })
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', pointerEvents: 'none' }}>
      {/* scrim so text is always legible over busy art */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 380, background: 'linear-gradient(to top, rgba(6,10,22,0.92) 8%, rgba(6,10,22,0.55) 55%, transparent)', opacity: o }} />
      <div style={{ position: 'relative', padding: '0 90px 78px', opacity: o, transform: `translateY(${rise}px)` }}>
        <div style={{ width: 84, height: 8, background: RED, marginBottom: 22, borderRadius: 2 }} />
        <div style={{ fontFamily: DISPLAY, fontSize: size, color: WHITE, textTransform: 'uppercase', lineHeight: 0.98, letterSpacing: '-0.01em', textShadow: '0 3px 18px rgba(0,0,0,0.7)' }}>{text}</div>
        {sub && <div style={{ fontFamily: DISPLAY, fontSize: 30, color: '#ff9a9d', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 16 }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  )
}

// ---- CornerLogo: small persistent Apex mark, top-left, subtle. On every frame.
const CornerLogo: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <Img src={staticFile('c-apexTORN/logo.png')} style={{ position: 'absolute', top: 46, left: 54, width: 190, height: 'auto', opacity: 0.9, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))' }} />
  </AbsoluteFill>
)

// ---- LogoIntro: branded title card (~2.5s) before the story — dark, dramatic.
const INTRO_SEC = 2.6
const INTRO = Math.round(INTRO_SEC * FPS)
const LogoIntro: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 4, fps, config: { damping: 13, stiffness: 140 } })
  const glow = interpolate(frame, [0, 20, INTRO - 8, INTRO], [0, 1, 1, 0], { extrapolateRight: 'clamp' })
  const out = interpolate(frame, [INTRO - 10, INTRO], [1, 0], { extrapolateLeft: 'clamp' })
  const drift = interpolate(frame, [0, INTRO], [1.0, 1.08])
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, #1c355f, #060a16 70%)`, justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <Halftone opacity={0.08} size={5} color={BLACK} />
      <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(216,31,39,0.35), transparent 60%)', opacity: glow, filter: 'blur(20px)' }} />
      <Img src={staticFile('c-apexTORN/logo.png')} style={{ width: 720, height: 'auto', transform: `scale(${(0.85 + clamp(pop, 0, 1) * 0.15) * drift})`, filter: 'drop-shadow(0 8px 30px rgba(0,0,0,0.8))' }} />
    </AbsoluteFill>
  )
}

// ---------- beat scenes ---------- (off = scene's absolute start frame)
// MotionLines stay (background energy, focal center kept clear); all text is a
// clean LowerThird so it never covers the subject.
type Off = { off: number }
// build (ominous)
const S1: React.FC<Off> = ({ off }) => <><ParallaxPanel absOffset={off} src={`${ASSET}/p1-overwhelm.png`} dur={90} focus="50% 40%" build /><LowerThird absOffset={off} text={'Drowning in spreadsheets.'} at={14} size={72} /></>
const S2: React.FC<Off> = ({ off }) => <><ParallaxPanel absOffset={off} src={`${ASSET}/p2-question.png`} dur={90} focus="52% 50%" build /><LowerThird absOffset={off} text={'A book you can’t tame.'} at={12} size={72} /></>
// the DROP
const S3: React.FC<Off> = ({ off }) => <><ParallaxPanel absOffset={off} src={`${ASSET}/p3-weapon.png`} dur={70} focus="42% 55%" /><MotionLines at={0} color={RED} count={44} /><LowerThird absOffset={off} text={'SmartViewz.'} sub="ask your book anything" at={8} /></>
const S4: React.FC<Off> = ({ off }) => <><ParallaxPanel absOffset={off} src={`${ASSET}/p4-clarity.png`} dur={90} focus="50% 45%" /><LowerThird absOffset={off} text={'Answers in seconds.'} at={4} size={72} /></>
const S5: React.FC<Off> = ({ off }) => <><ParallaxPanel absOffset={off} src={`${ASSET}/p5-strike.png`} dur={100} focus="50% 45%" /><MotionLines at={0} color={BLACK} count={50} /><LowerThird absOffset={off} text={'Every lapse. Every deal.'} at={6} size={68} /></>
const S6: React.FC<Off> = ({ off }) => <><ParallaxPanel absOffset={off} src={`${ASSET}/p6-victory.png`} dur={130} focus="50% 40%" />
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 120 }}>
    <Img src={staticFile(`c-apexTORN/logo.png`)} style={{ width: 460, height: 'auto', filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.8))', opacity: clamp((useCurrentFrame() - 8) / 12, 0, 1), transform: `translateY(-30px)` }} />
  </AbsoluteFill>
  <LowerThird absOffset={off} text={'Reach the Apex.'} sub="reachtheapex.net" at={22} /></>

// scene start frames (seconds) — aligned to the build/drop structure
const SCENES: React.FC<Off>[] = [S1, S2, S3, S4, S5, S6]
const SCENE_AT_SEC = [0, 5.0, 10.6, 13.6, 17.4, 24.4]
const SCENE_AT = SCENE_AT_SEC.map((s) => Math.round(s * FPS))
const STORY = MUSIC_FRAMES                       // the comic story = length of the track
export const APEX_PHONK_FRAMES = INTRO + STORY   // intro card + story

// VO windows (relative to STORY start)
const VO_AT_SEC = [0.5, 5.4, 10.9, 13.9, 18.0, 25.6]
const VO_AT = VO_AT_SEC.map((s) => Math.round(s * FPS))
const VO_DUR_SEC = [1.39, 3.53, 1.11, 4.5, 3.81, 3.44]

// the comic story block — absolute frame 0 here = story start (beat grid basis)
const Story: React.FC = () => {
  const voWin: VoWindow[] = VO_AT.map((st, i) => ({ start: st, end: st + Math.round(VO_DUR_SEC[i] * FPS) }))
  // quiet bed: VO clearly on top. loud low, ducks further under VO.
  const duck = makeMusicDuck(voWin, STORY, { loud: 0.26, duck: 0.1, ramp: 12, fadeInEnd: 8, fadeOutStart: STORY - 24, fadeOutEnd: STORY - 3 })
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      {SCENES.map((S, i) => {
        const from = SCENE_AT[i]
        const to = i + 1 < SCENE_AT.length ? SCENE_AT[i + 1] : STORY
        return (
          <Sequence key={i} from={from} durationInFrames={to - from}>
            <AbsoluteFill><S off={from} /></AbsoluteFill>
          </Sequence>
        )
      })}
      <Halftone opacity={0.1} size={5} color={BLACK} />
      <ColdGrade />
      <RedPump />
      <Strobe />
      <CornerLogo />
      {SCENE_AT.slice(1).map((f, i) => <InkFlash key={i} at={f} color={i % 2 ? RED : WHITE} />)}
      {VO_AT.map((st, i) => (
        <Sequence key={'vo' + i} from={st}><Audio src={staticFile(`${ASSET}/vo-${i + 1}.mp3`)} volume={1} /></Sequence>
      ))}
      <MusicBed src={`${ASSET}/music.mp3`} musicFrames={MUSIC_FRAMES} volume={duck} />
    </AbsoluteFill>
  )
}

export const CommercialApexPhonk: React.FC = () => (
  <AbsoluteFill style={{ background: BLACK }}>
    <Sequence from={0} durationInFrames={INTRO}><LogoIntro /></Sequence>
    <Sequence from={INTRO} durationInFrames={STORY}><Story /></Sequence>
  </AbsoluteFill>
)
