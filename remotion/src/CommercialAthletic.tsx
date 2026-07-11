import React from 'react'
import { AbsoluteFill, OffthreadVideo, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'

const { fontFamily: MONT } = loadMont()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/**
 * CommercialAthletic — a commercial in the GRITTY ATHLETIC style Gemini analyzed
 * from the reference YouTube ad. The craft it identified, applied:
 *   - 95% real footage (Pexels B-roll), minimal graphics
 *   - fast cuts (~15 per 10s), building from slow to rapid-fire
 *   - dark, high-contrast, desaturated "gritty" grade
 *   - minimal BOLD WHITE UPPERCASE type, stark on footage
 *   - structure: Isolation → The Shift → The Grind → Climax → Resolution
 *   - energy that BUILDS (slow atmospheric → accelerating montage → peak → resolve)
 *
 * Financial content ("Built for those who never stop") in athletic *style* — the
 * aspirational grit of showing up + doing the work, applied to a money message.
 */

// A single footage CUT — a clip segment with the gritty grade, a slow push, and
// a hard cut-in. `speed` <1 = slow-mo feel (we play a slice slowly). `zoom` adds
// a Ken-Burns push. Grade is dark + desaturated + high-contrast.
const Cut: React.FC<{ clip: number; startAt: number; trimSec?: number; zoom?: number; slowmo?: boolean; grade?: string }> =
({ clip, startAt, trimSec = 0, zoom = 1.08, slowmo = false, grade }) => {
  const frame = useCurrentFrame()
  const g = grade || 'brightness(0.62) saturate(0.55) contrast(1.25)'
  const sc = zoom + frame * 0.0009
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <OffthreadVideo
        src={staticFile(`broll/clip-${clip}.mp4`)}
        startFrom={Math.round(trimSec * FPS)}
        playbackRate={slowmo ? 0.5 : 1}
        muted
        style={{ width: '110%', height: '110%', position: 'absolute', left: '-5%', top: '-5%', objectFit: 'cover', transform: `scale(${sc})`, filter: g }}
      />
      {/* dark vignette + top/bottom crush for the gritty cinematic feel */}
      <AbsoluteFill style={{ background: 'radial-gradient(120% 120% at 50% 45%, transparent 40%, rgba(0,0,0,0.7))' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.5), transparent 25%, transparent 70%, rgba(0,0,0,0.7))' }} />
    </AbsoluteFill>
  )
}

// Stark centered word — bold white uppercase, fades in fast, slight tracking-in.
const Word: React.FC<{ text: string; size?: number; sub?: string }> = ({ text, size = 130, sub }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' })
  const track = interpolate(frame, [0, 20], [0.14, 0.06], { extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 12], [18, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
      <div style={{ fontFamily: MONT, fontWeight: 900, fontSize: size, color: '#fff', textTransform: 'uppercase', letterSpacing: `${track}em`, opacity: o, transform: `translateY(${y}px)`, textShadow: '0 4px 30px rgba(0,0,0,0.9)', textAlign: 'center', lineHeight: 1.02 }}>{text}</div>
      {sub && <div style={{ fontFamily: MONT, fontWeight: 600, fontSize: size * 0.24, color: '#d8d8d8', textTransform: 'uppercase', letterSpacing: '0.3em', marginTop: 22, opacity: interpolate(frame, [8, 16], [0, 1], { extrapolateRight: 'clamp' }) }}>{sub}</div>}
    </AbsoluteFill>
  )
}

// hard cut flash — a very fast black-to-clear (impact of a cut)
const FlashCut: React.FC = () => {
  const frame = useCurrentFrame()
  return <AbsoluteFill style={{ background: '#000', opacity: clamp(1 - frame / 2.5, 0, 1), pointerEvents: 'none' }} />
}

// ---------- THE EDIT ----------
// Each entry: [durationFrames, contentBuilder]. The edit ACCELERATES: long
// atmospheric holds up front, rapid-fire cuts in the montage, then a held climax.
type Shot = { dur: number; el: React.ReactNode }
const s = (sec: number) => Math.round(sec * FPS)

// The whole spot, shot list. Real footage clips 0-7, cut to build energy.
const SHOTS: Shot[] = [
  // === ISOLATION (slow, atmospheric) ===
  { dur: s(2.6), el: <Cut clip={6} startAt={0} trimSec={2} zoom={1.05} slowmo /> },                    // thoughtful, window
  { dur: s(2.2), el: <><Cut clip={3} startAt={0} trimSec={1} zoom={1.1} slowmo /><Word text="Every day" size={110} /></> }, // hands typing
  // === THE SHIFT ===
  { dur: s(1.6), el: <><Cut clip={0} startAt={0} trimSec={3} zoom={1.12} /><Word text="You show up." size={118} /></> },     // running
  // === THE GRIND (fast cuts) ===
  { dur: s(0.7), el: <Cut clip={0} startAt={0} trimSec={8} zoom={1.15} /> },
  { dur: s(0.7), el: <Cut clip={1} startAt={0} trimSec={2} zoom={1.12} /> },
  { dur: s(0.8), el: <><Cut clip={2} startAt={0} trimSec={1} zoom={1.14} /><Word text="Put in" size={104} /></> },
  { dur: s(0.7), el: <Cut clip={7} startAt={0} trimSec={1} zoom={1.16} /> },
  { dur: s(0.8), el: <><Cut clip={1} startAt={0} trimSec={5} zoom={1.12} /><Word text="the work." size={104} /></> },
  { dur: s(0.7), el: <Cut clip={5} startAt={0} trimSec={2} zoom={1.1} /> },
  { dur: s(0.7), el: <Cut clip={3} startAt={0} trimSec={6} zoom={1.15} /> },
  // === CLIMAX (held, the message lands) ===
  { dur: s(2.4), el: <><Cut clip={4} startAt={0} trimSec={4} zoom={1.06} /><Word text="Your future" size={100} sub="doesn't happen by accident" /></> }, // family home
  { dur: s(2.6), el: <><Cut clip={5} startAt={0} trimSec={8} zoom={1.05} /><Word text="It's earned." size={130} /></> },   // skyline
  // === RESOLUTION (brand + CTA) ===
  { dur: s(3.4), el: <BrandCard /> },
]

// Final brand card — stark, confident, on a dark graded skyline.
function BrandCard() {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const up = spring({ frame, fps, config: { damping: 20, stiffness: 70 } })
  const ctaUp = spring({ frame: frame - 18, fps, config: { damping: 18, stiffness: 90 } })
  const grow = 1 + interpolate(frame, [0, 90], [0, 0.05], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: '#05070a' }}>
      <Cut clip={1} startAt={0} trimSec={7} zoom={1.04} grade="brightness(0.4) saturate(0.5) contrast(1.2)" />
      <AbsoluteFill style={{ background: 'rgba(3,5,8,0.55)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', transform: `scale(${grow})` }}>
        <div style={{ fontFamily: MONT, fontWeight: 900, fontSize: 86, color: '#fff', letterSpacing: '0.02em', opacity: up, textTransform: 'uppercase', textShadow: '0 4px 30px rgba(0,0,0,0.9)' }}>Meridian Financial</div>
        <div style={{ width: 200 * clamp((frame - 14) / 16, 0, 1), height: 3, background: '#e8c877', marginTop: 24, boxShadow: '0 0 18px #e8c877' }} />
        <div style={{ fontFamily: MONT, fontWeight: 700, fontSize: 30, color: '#e8c877', letterSpacing: '0.24em', marginTop: 26, textTransform: 'uppercase', opacity: ctaUp }}>Built for those who never stop</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 120% at 50% 50%, transparent 45%, rgba(0,0,0,0.6))' }} />
    </AbsoluteFill>
  )
}

// moving film grain over everything (the gritty texture)
const Grain: React.FC = () => {
  const frame = useCurrentFrame()
  return <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
    <svg width="100%" height="100%"><filter id="ag"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 8} /></filter><rect width="100%" height="100%" filter="url(#ag)" /></svg>
  </AbsoluteFill>
}

export const athleticDuration = SHOTS.reduce((a, sh) => a + sh.dur, 0)

// VO cues: [file, atSec, durSec] — synced to the shots (words land on footage).
const VO = [
  { f: 'ath-vo-1', at: 1.2, dur: 1.63 },   // "Every day, you show up." (over typing/running)
  { f: 'ath-vo-2', at: 4.4, dur: 1.30 },   // "You put in the work." (grind montage)
  { f: 'ath-vo-3', at: 11.2, dur: 2.23 },  // "Your future doesn't happen by accident." (family)
  { f: 'ath-vo-4', at: 13.9, dur: 3.99 },  // "It's earned. Protected. Guaranteed." (skyline)
  { f: 'ath-vo-5', at: 16.6, dur: 3.62 },  // "Meridian Financial..." (brand card)
]

export const CommercialAthletic: React.FC = () => {
  // shot start frames
  const starts: number[] = []; let t = 0
  for (const sh of SHOTS) { starts.push(t); t += sh.dur }
  const total = t

  // smooth music ducking under the VO (smoothstep — no pops)
  const musicDuck = (f: number): number => {
    const LOUD = 0.5, DUCK = 0.2, RAMP = 12
    let voice = 0
    for (const v of VO) {
      const a = v.at * FPS, b = (v.at + v.dur) * FPS
      const up = interpolate(f, [a - RAMP, a], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      const dn = interpolate(f, [b, b + RAMP], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      voice = Math.max(voice, Math.min(up, dn))
    }
    const eased = voice * voice * (3 - 2 * voice)
    const level = LOUD + (DUCK - LOUD) * eased
    const fade = interpolate(f, [0, 12, total - 24, total - 6], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    return level * fade
  }

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {SHOTS.map((sh, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={sh.dur}>
          {sh.el}
          <FlashCut />
        </Sequence>
      ))}
      <Grain />
      {/* MUSIC — bespoke ElevenLabs dark-driving track, ducked under the VO */}
      <Audio src={staticFile('ath-music.mp3')} volume={musicDuck} />
      {/* VO — punchy lines synced to the footage */}
      {VO.map((v, i) => (
        <Sequence key={i} from={Math.round(v.at * FPS)}><Audio src={staticFile(`${v.f}.mp3`)} volume={1.0} /></Sequence>
      ))}
    </AbsoluteFill>
  )
}
