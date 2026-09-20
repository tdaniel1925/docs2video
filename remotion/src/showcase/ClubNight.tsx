import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, useCurrentFrame, interpolate, spring, Easing } from 'remotion'
import { staticFile } from '../lib/asset'
import { loadFont as loadNeon } from '@remotion/google-fonts/TiltNeon'
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue'
import vo from '../../public/showcase/club/vo.json'
import grid from '../../public/showcase/club/beatgrid.json'
import { Alive, SettleSweep, CountUp } from '../lib/pizzazz'
import { gridToFrames } from '../lib/audio'
import { FPS, s, clamp, pop, timeline, AudioBed, FadeOut, type BeatSpec } from './common'

/* ============================================================================
 * CLUB NIGHT — "the flyer comes alive". A rich-artwork style demo:
 *   the printed Midnight Society flyer lands, the camera pushes in, and the
 *   scene opens into a widescreen plate with separate crowd + DJ layers,
 *   code-drawn lasers, haze and strobes. The neon type is drawn in code so it
 *   can flicker on and pulse on every beat. Same engine as the house style.
 * ==========================================================================*/
const { fontFamily: NEON } = loadNeon()
const { fontFamily: BEBAS } = loadBebas()
const BLUE = '#39c6ff', PINK = '#ff3fb4', WHITE = '#ffffff', BLACK = '#05030a'
const C = (n: string) => staticFile(`showcase/club/${n}`)
const D = (vo as any).durations as number[]
const BEAT_FRAMES = gridToFrames((grid as any).beats, FPS)

/** 0..1 pulse that spikes on the nearest past beat (absolute frame). */
const beatPulse = (abs: number, decay = 9, every = 1) => {
  let last = -999
  for (let k = 0; k < BEAT_FRAMES.length; k += every) { if (BEAT_FRAMES[k] <= abs) last = BEAT_FRAMES[k]; else break }
  return clamp(1 - (abs - last) / decay, 0, 1)
}
const onBeat = (abs: number, every = 1, width = 2) => { for (let k = 0; k < BEAT_FRAMES.length; k += every) { if (abs >= BEAT_FRAMES[k] && abs < BEAT_FRAMES[k] + width) return true; if (BEAT_FRAMES[k] > abs) break } return false }
const hash = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x) }

/** Neon tube lettering: flickers on per letter, glow pulses on the beat. */
const Neon: React.FC<{ text: string; color: string; size: number; at: number; abs: number; font?: string; step?: number; style?: React.CSSProperties; pulse?: number }> = ({ text, color, size, at, abs, font = NEON, step = 2, style, pulse = 0.35 }) => {
  const frame = useCurrentFrame()
  const p = beatPulse(abs)
  return (
    <div style={{ fontFamily: font, fontSize: size, lineHeight: 1, letterSpacing: '0.04em', whiteSpace: 'pre', ...style }}>
      {[...text].map((ch, i) => {
        const on = at + i * step + Math.floor(hash(i + size) * 4)
        const t = frame - on
        let o = t < 0 ? 0 : 1
        if (t >= 0 && t < 14) { const seq = [1, 0.15, 0.9, 0.2, 1, 1, 0.3, 1, 1, 1, 0.5, 1, 1, 1]; o = seq[t] * (0.6 + 0.4 * hash(i * 7 + t)) }
        const g = (0.75 + pulse * p) * o
        const core = color === PINK ? '#ffd2ee' : color === BLUE ? '#d6f5ff' : '#ffffff'
        return <span key={i} style={{ display: 'inline-block', color: o > 0.5 ? core : color, WebkitTextStroke: `1.5px ${color}`, opacity: 0.12 + 0.88 * o, textShadow: `0 0 ${3 * g}px #fff, 0 0 ${10 * g}px ${color}, 0 0 ${24 * g}px ${color}, 0 0 ${55 * g}px ${color}, 0 0 ${110 * g}px ${color}`, transform: `scale(${1 + 0.02 * p * o})` }}>{ch}</span>
      })}
    </div>
  )
}
/** Lasers from a vanishing point, sweeping. */
const Lasers: React.FC<{ abs: number; n?: number; strength?: number }> = ({ abs, n = 10, strength = 0.55 }) => {
  const frame = useCurrentFrame()
  const p = beatPulse(abs, 12)
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, k) => {
        const base = -40 + (k / (n - 1)) * 80
        const a = base + Math.sin(frame * 0.045 + k * 1.3) * 14 + Math.sin(frame * 0.11 + k) * 3
        const c = k % 2 ? PINK : BLUE
        return <div key={k} style={{ position: 'absolute', left: 960, top: 300, width: 2400, height: 3, marginLeft: -1200, transformOrigin: '50% 50%', transform: `rotate(${90 + a}deg) translateX(1200px)`, background: `linear-gradient(90deg, ${c} 0%, ${c}88 40%, transparent 100%)`, opacity: (strength + 0.4 * p) * (0.6 + 0.4 * hash(k + Math.floor(frame / 3))), filter: 'blur(1.2px)', boxShadow: `0 0 12px ${c}` }} />
      })}
    </AbsoluteFill>
  )
}
/** Haze + bokeh drifting up. */
const Haze: React.FC<{ count?: number }> = ({ count = 40 }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const sp = 0.4 + hash(i) * 1.2, x = hash(i * 3) * 1920, y = ((hash(i * 5) * 1400 - frame * sp) % 1400 + 1400) % 1400 - 160
        const r = 4 + hash(i * 9) * 22
        return <div key={i} style={{ position: 'absolute', left: x + Math.sin(frame * 0.02 + i) * 30, top: y, width: r, height: r, borderRadius: r, background: i % 3 ? PINK : BLUE, opacity: 0.08 + hash(i * 11) * 0.25, filter: `blur(${r / 4}px)` }} />
      })}
    </AbsoluteFill>
  )
}
const Strobe: React.FC<{ abs: number; every?: number; amount?: number }> = ({ abs, every = 2, amount = 0.16 }) => onBeat(abs, every) ? <AbsoluteFill style={{ background: WHITE, opacity: amount, pointerEvents: 'none' }} /> : null
const Vignette: React.FC = () => <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.65) 100%)', pointerEvents: 'none' }} />

/** The scene: plate + DJ + crowd with parallax, driven by a camera scale/offset. */
const Scene: React.FC<{ abs: number; zoom?: number; px?: number; pump?: boolean; children?: React.ReactNode }> = ({ abs, zoom = 1, px = 0, pump = true, children }) => {
  const frame = useCurrentFrame()
  const p = pump ? beatPulse(abs) : 0
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Img src={C('plate.png')} style={{ position: 'absolute', left: -60 + px * 0.3, top: -100, width: 2040, height: 1360, objectFit: 'cover', transform: `scale(${zoom})`, transformOrigin: '50% 40%' }} />
      <Lasers abs={abs} />
      <Img src={C('dj.png')} style={{ position: 'absolute', left: 700 + px * 0.6, top: 330, width: 520, transform: `scale(${zoom * (1 + 0.02 * p)})`, transformOrigin: '50% 100%', filter: 'drop-shadow(0 0 30px rgba(57,198,255,0.5))' }} />
      <Haze />
      <Img src={C('crowd.png')} style={{ position: 'absolute', left: -120 + px, top: 190 + Math.sin(frame * 0.08) * 6, width: 2160, transform: `scale(${zoom * (1 + 0.035 * p)})`, transformOrigin: '50% 100%' }} />
      <Vignette />
      {children}
    </AbsoluteFill>
  )
}

// ---- BEAT 0 — the printed flyer lands, then the camera dives into it ------------
const FlyerBeat: React.FC<{ hold: number; start: number }> = ({ hold, start }) => {
  const frame = useCurrentFrame(); const abs = start + frame
  const p = clamp(spring({ frame: frame - 2, fps: FPS, config: { damping: 12, stiffness: 150, mass: 0.9 } }), 0, 1)
  const dive = clamp((frame - (hold - 22)) / 20, 0, 1); const e = Easing.in(Easing.cubic)(dive)
  const streak = clamp((frame - 14) / 16, 0, 1)
  const glow = 0.5 + 0.5 * beatPulse(abs)
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Haze count={24} />
      <Alive intensity={0.5}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', transform: `scale(${1 + e * 2.4}) translateY(${e * 110}px)`, transformOrigin: '50% 30%' }}>
          <div style={{ position: 'relative', width: 573, height: 860, borderRadius: 8, overflow: 'hidden', transform: `scale(${0.5 + 0.5 * p}) rotate(${(1 - p) * -14 + Math.sin(frame * 0.03) * 1.2}deg) rotateY(${(1 - p) * 40}deg)`, opacity: clamp(p * 2, 0, 1), boxShadow: `0 40px 90px rgba(0,0,0,0.8), 0 0 ${60 * glow}px rgba(255,63,180,${0.35 * glow}), 0 0 ${120 * glow}px rgba(57,198,255,${0.25 * glow})` }}>
            <Img src={C('flyer.jpg')} style={{ width: '100%', height: '100%', display: 'block' }} />
            {/* a light streak across the print */}
            <div style={{ position: 'absolute', top: -200, left: -300 + streak * 1200, width: 140, height: 1300, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)', transform: 'rotate(18deg)', opacity: streak > 0 && streak < 1 ? 1 : 0 }} />
          </div>
        </AbsoluteFill>
      </Alive>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center', fontFamily: BEBAS, fontSize: 30, letterSpacing: '0.3em', color: '#8d86a3', opacity: clamp(pop(frame, 16) * 2, 0, 1) * (1 - dive) }}>YOUR FLYER  ·  RESTYLED BY RESTYLEZ  ·  NOW IN MOTION</div>
    </AbsoluteFill>
  )
}

// ---- BEAT 1 — the scene opens: plate, crowd, DJ, lasers; the kicker flickers on -----
const AliveBeat: React.FC<{ hold: number; start: number }> = ({ hold, start }) => {
  const frame = useCurrentFrame(); const abs = start + frame
  const zoom = interpolate(frame, [0, hold], [1.18, 1.0], { easing: Easing.out(Easing.cubic) })
  const px = interpolate(frame, [0, hold], [40, -40])
  const flash = clamp(1 - frame / 10, 0, 1)
  return (
    <Scene abs={abs} zoom={zoom} px={px}>
      <Strobe abs={abs} every={2} amount={0.12} />
      <AbsoluteFill style={{ background: WHITE, opacity: flash * 0.9, pointerEvents: 'none' }} />
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: 120 }}>
        <Neon text="FRIDAY NIGHT" color={BLUE} size={54} at={14} abs={abs} style={{ letterSpacing: '0.42em' }} />
      </AbsoluteFill>
    </Scene>
  )
}

// ---- BEAT 2 — the sign: MIDNIGHT / SOCIETY flicker on and pulse -------------------------
const SignBeat: React.FC<{ hold: number; start: number }> = ({ hold, start }) => {
  const frame = useCurrentFrame(); const abs = start + frame
  const zoom = interpolate(frame, [0, hold], [1.0, 1.08], { easing: Easing.inOut(Easing.quad) })
  return (
    <Scene abs={abs} zoom={zoom} px={-20 + frame * 0.2}>
      <Strobe abs={abs} every={4} amount={0.1} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
        <div style={{ textAlign: 'center' }}>
          <Neon text="FRIDAY NIGHT" color={BLUE} size={34} at={0} abs={abs} style={{ letterSpacing: '0.42em', marginBottom: 26 }} pulse={0.2} />
          <Neon text="MIDNIGHT" color={BLUE} size={250} at={6} abs={abs} step={3} />
          <Neon text="SOCIETY" color={PINK} size={250} at={26} abs={abs} step={3} style={{ marginTop: -10 }} />
        </div>
      </AbsoluteFill>
      <SettleSweep color={PINK} hold={hold} />
    </Scene>
  )
}

// ---- BEAT 3 — hits: one word per two beats, chromatic split, crowd pumps ---------------
const HitsBeat: React.FC<{ hold: number; start: number }> = ({ hold, start }) => {
  const frame = useCurrentFrame(); const abs = start + frame
  const words = ['LASERS.', 'BASS.', 'TIL 4 AM.', 'NO SLEEP.']
  // the beat frames inside this hold, every 2 beats
  const local = BEAT_FRAMES.filter((b) => b >= start && b < start + hold).map((b) => b - start).filter((_, k) => k % 2 === 0)
  let idx = -1; for (let k = 0; k < local.length; k++) if (frame >= local[k]) idx = k
  const w = words[Math.min(Math.max(idx, 0), words.length - 1)]
  const since = idx >= 0 ? frame - local[idx] : 0
  const kick = clamp(spring({ frame: since, fps: FPS, config: { damping: 9, stiffness: 320 } }), 0, 1)
  const zoom = 1.05 + 0.06 * (1 - kick)
  return (
    <Scene abs={abs} zoom={zoom} px={idx % 2 ? 50 : -50}>
      <Strobe abs={abs} every={1} amount={0.2} />
      {idx >= 0 && (
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'relative', fontFamily: BEBAS, fontSize: 320, lineHeight: 1, letterSpacing: '0.02em', whiteSpace: 'nowrap', transform: `scale(${1.6 - 0.6 * kick}) rotate(${(1 - kick) * (idx % 2 ? 4 : -4)}deg)`, opacity: clamp(kick * 3, 0, 1) }}>
            <div style={{ position: 'absolute', left: -8 * (1 - kick) - 5, top: 0, color: BLUE, mixBlendMode: 'screen' }}>{w}</div>
            <div style={{ position: 'absolute', left: 8 * (1 - kick) + 5, top: 0, color: PINK, mixBlendMode: 'screen' }}>{w}</div>
            <div style={{ position: 'relative', color: WHITE, textShadow: `0 0 30px ${idx % 2 ? PINK : BLUE}` }}>{w}</div>
          </div>
        </AbsoluteFill>
      )}
    </Scene>
  )
}

// ---- BEAT 4 — the details: date, venue, door price ---------------------------------------
const DetailsBeat: React.FC<{ hold: number; start: number }> = ({ hold, start }) => {
  const frame = useCurrentFrame(); const abs = start + frame
  const rule = clamp((frame - 20) / 16, 0, 1)
  const priceAt = Math.round(hold * 0.5)
  const pp = pop(frame, priceAt, 10)
  return (
    <Scene abs={abs} zoom={1.06} px={20 - frame * 0.25}>
      <Strobe abs={abs} every={4} amount={0.08} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: BEBAS, fontSize: 64, letterSpacing: '0.12em', color: WHITE, opacity: clamp(pop(frame, 4) * 2, 0, 1), transform: `translateY(${(1 - clamp(pop(frame, 4), 0, 1)) * 40}px)`, textShadow: `0 0 20px ${PINK}` }}>FRI 18 OCTOBER <span style={{ color: PINK }}>·</span> DOORS 10PM</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30, marginTop: 20 }}>
            <div style={{ width: 260 * rule, height: 4, background: BLUE, boxShadow: `0 0 16px ${BLUE}` }} />
            <Neon text="THE WAREHOUSE" color={BLUE} size={150} at={14} abs={abs} step={2} />
            <div style={{ width: 260 * rule, height: 4, background: BLUE, boxShadow: `0 0 16px ${BLUE}` }} />
          </div>
          <div style={{ marginTop: 28, fontFamily: BEBAS, fontSize: 120, color: WHITE, letterSpacing: '0.06em', opacity: clamp(pp * 2, 0, 1), transform: `scale(${clamp(pp, 0, 1.15)})`, textShadow: `0 0 12px #fff, 0 0 40px ${PINK}, 0 0 90px ${PINK}` }}>
            <CountUp to={15} prefix="$" decimals={0} startAt={priceAt} dur={16} /> DOOR
          </div>
        </div>
      </AbsoluteFill>
      <SettleSweep color={BLUE} hold={hold} />
    </Scene>
  )
}

// ---- BEAT 5 — CTA: back to the flyer, ticket button pulses -------------------------------
const CtaBeat: React.FC<{ hold: number; start: number }> = ({ hold, start }) => {
  const frame = useCurrentFrame(); const abs = start + frame
  const p = clamp(spring({ frame: frame - 2, fps: FPS, config: { damping: 13, stiffness: 140 } }), 0, 1)
  const pulse = beatPulse(abs, 10)
  const zoom = interpolate(frame, [0, hold], [1.12, 1.02], { easing: Easing.out(Easing.cubic) })
  return (
    <Scene abs={abs} zoom={zoom} px={-30} pump={false}>
      <AbsoluteFill style={{ background: 'rgba(5,3,10,0.55)' }} />
      <Haze count={20} />
      <div style={{ position: 'absolute', left: 250, top: 90, width: 600, height: 900, borderRadius: 8, overflow: 'hidden', transform: `scale(${1.6 - 0.6 * p}) rotate(${(1 - p) * 10 - 4}deg)`, transformOrigin: '50% 50%', opacity: clamp(p * 2, 0, 1), boxShadow: `0 40px 90px rgba(0,0,0,0.8), 0 0 ${50 + 40 * pulse}px rgba(255,63,180,0.35), 0 0 120px rgba(57,198,255,0.25)` }}>
        <Img src={C('flyer.jpg')} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      <div style={{ position: 'absolute', left: 980, top: 300, width: 820 }}>
        <Neon text="MIDNIGHT" color={BLUE} size={110} at={8} abs={abs} step={2} />
        <Neon text="SOCIETY" color={PINK} size={110} at={20} abs={abs} step={2} />
        <div style={{ marginTop: 26, fontFamily: BEBAS, fontSize: 40, letterSpacing: '0.14em', color: '#cfc8e6', opacity: clamp(pop(frame, 30) * 2, 0, 1) }}>FRI 18 OCT · THE WAREHOUSE · DOORS 10PM</div>
        <div style={{ marginTop: 30, display: 'inline-block', border: `4px solid ${PINK}`, color: WHITE, fontFamily: BEBAS, fontSize: 56, letterSpacing: '0.12em', padding: '14px 40px', borderRadius: 8, boxShadow: `0 0 ${16 + 30 * pulse}px ${PINK}, inset 0 0 ${12 + 20 * pulse}px rgba(255,63,180,0.5)`, textShadow: `0 0 14px ${PINK}`, transform: `scale(${clamp(pop(frame, 40), 0, 1.1) * (1 + 0.03 * pulse)})`, opacity: clamp(pop(frame, 40) * 2, 0, 1) }}>TICKETS AT THE DOOR</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, textAlign: 'center', fontFamily: BEBAS, fontSize: 28, letterSpacing: '0.3em', color: '#8d86a3', opacity: clamp(pop(frame, 50) * 2, 0, 1) }}>MADE FROM ONE FLYER  ·  RESTYLEZ</div>
    </Scene>
  )
}

// ---- assembly -------------------------------------------------------------------------------
const BEATS: BeatSpec[] = [
  { dur: s(3.4), el: (h, i) => <FlyerBeat hold={h} start={TL.starts[i]} />, noVo: true, impact: true },
  { dur: s(3.8), el: (h, i) => <AliveBeat hold={h} start={TL.starts[i]} />, noVo: true, impact: true },
  { dur: s(D[2] + 3.6), el: (h, i) => <SignBeat hold={h} start={TL.starts[i]} />, impact: true },
  { dur: s(4.7), el: (h, i) => <HitsBeat hold={h} start={TL.starts[i]} />, noVo: true },
  { dur: s(D[4] + 3.8), el: (h, i) => <DetailsBeat hold={h} start={TL.starts[i]} />, impact: true },
  { dur: s(D[5] + 4.4), el: (h, i) => <CtaBeat hold={h} start={TL.starts[i]} />, impact: true },
]
// timeline() needs BEATS' durations only; the start frames are read back at render time via TL.
const TL = timeline(BEATS, (grid as any).beats)
export const CLUB_FRAMES = TL.total
export const CLUB_FPS = FPS

export const ClubNight: React.FC = () => (
  <AbsoluteFill style={{ background: BLACK }}>
    {BEATS.map((b, i) => (
      <Sequence key={i} from={TL.starts[i]} durationInFrames={TL.durs[i] + 6}>
        {b.el(TL.durs[i], i)}
      </Sequence>
    ))}
    <FadeOut total={TL.total} dur={20} />
    <AudioBed id="club" voice={!('placeholder' in vo)} beats={BEATS} tl={TL} voDur={D} musicFrames={s(96)} loud={0.5} duck={0.28} whoosh={0} impacts={BEATS.map((b, i) => b.impact ? TL.starts[i] : -1).filter((f) => f >= 0)} />
    <Sequence from={TL.starts[1] - 24} durationInFrames={40}><Audio src={staticFile('sfx/riser.wav')} volume={0.5} /></Sequence>
    <Sequence from={TL.starts[2]} durationInFrames={40}><Audio src={staticFile('sfx/subdrop.wav')} volume={0.6} /></Sequence>
    <Sequence from={TL.starts[5]} durationInFrames={40}><Audio src={staticFile('sfx/subdrop.wav')} volume={0.5} /></Sequence>
  </AbsoluteFill>
)
