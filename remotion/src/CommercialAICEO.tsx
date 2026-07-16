import React from 'react'
import { AbsoluteFill, OffthreadVideo, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadBodoni } from '@remotion/google-fonts/BodoniModa'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import beatgrid from '../public/beatgrid.json'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'

// TYPE SYSTEM (art-directed pairing, not safe defaults):
//   DISPLAY  — Fraunces: high-contrast, characterful serif for emotional heads
//   FASHION  — Bodoni Moda: ultra-high-contrast serif for the big pivot moments
//   GROTESK  — Archivo: tight modern sans for kickers, labels, CTA
const { fontFamily: DISPLAY } = loadFraunces()
const { fontFamily: FASHION } = loadBodoni()
const { fontFamily: GROTESK } = loadArchivo()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const FPS = 30

/* ============================================================================
 * THE AI CEO — a commercial, directed as ONE cohesive film.
 *
 * STORY (complete arc, first-person, Trent narrates from frame one so "I" is
 * never a stranger; every loop closed — who I am, what's wrong, why me, proof,
 * the promise, the call):
 *
 *   1  "I've sat across from a thousand owners who did everything right."   ← who
 *   2  "They bought the tools. Hired the consultants. Watched the demos."
 *   3  "And they were still drowning."                                       ← problem
 *   4  "Because the problem was never AI."
 *   5  "It was clarity."                                                     ← reframe
 *   6  "I'm Trent Daniel. 100+ AI systems, live and running."               ← why me
 *   7  "In 48 hours I find you 40+ hours a month. Or it's free."
 *   8  "$8.4M influenced. No hype. No jargon. Just the plan."               ← proof
 *   9  "I don't sell you software. I give you back your time."              ← promise
 *  10  "I'm the AI CEO. Let's find your clarity."                           ← call
 *
 * DIRECTION — one locked visual system (editorial luxury):
 *   · ONE serif (Playfair) for every headline, ONE sans (Inter) for labels.
 *   · Text ALWAYS fades + holds in the SAME lower-third band. Never pops,
 *     never bounces, never scatters. One rhythm for the whole film.
 *   · Every cut is the SAME slow cross-dissolve through black.
 *   · Gold (#d4af37) is the only accent, always the same hairline treatment.
 *   · Sync is structural: each beat's length is DERIVED from its VO duration.
 *   · Generated cinematic imagery carries the story; real photos of Trent used
 *     ONLY where they earn it (the reframe + the close).
 * ==========================================================================*/

const GOLD = '#d4af37', GOLD_HI = '#f6e27a', GOLD_DEEP = '#a67c00'
const INK = '#0a0a0c'
const CREAM = '#f7f7f5', MUTE = '#b0b0b8'

// ---- ONE text component — art-directed. Every headline goes through this so
// the film reads as one designer's hand. The reveal is a MASK-WIPE up (text
// rises out from behind a hard edge) + gold hairline that DRAWS on — not a plain
// fade. `align` composes the block left/center to react to the image, but the
// baseline always sits on the same lower-third line (TITLE_BAND). ----
const TITLE_BAND = 150
const Title: React.FC<{ pre?: string; gold?: string; post?: string; kicker?: string; size?: number; hold: number; align?: 'center' | 'left'; fashion?: boolean }> =
({ pre = '', gold = '', post = '', kicker, size = 62, hold, align = 'center', fashion = false }) => {
  const frame = useCurrentFrame()
  // mask-wipe reveal: the line's clip-path opens upward over 14f
  const wipe = interpolate(frame, [2, 16], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const rise = interpolate(frame, [2, 18], [26, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const outA = Math.max(15, hold - 10), outB = Math.max(outA + 1, hold)
  const o = interpolate(frame, [0, 10, outA, outB], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const kO = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
  const rule = interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const face = fashion ? FASHION : DISPLAY
  const isL = align === 'left'
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: isL ? 'flex-start' : 'center', paddingBottom: TITLE_BAND, paddingLeft: isL ? 130 : 0 }}>
      <div style={{ opacity: o, textAlign: isL ? 'left' : 'center', maxWidth: 1500 }}>
        {kicker && <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 20, letterSpacing: '0.42em', textTransform: 'uppercase', color: GOLD, marginBottom: 22, opacity: kO, transform: `translateX(${(1 - kO) * (isL ? -10 : 0)}px)` }}>{kicker}</div>}
        <div style={{ overflow: 'hidden', paddingBottom: 8 }}>
          <div style={{ fontFamily: face, fontWeight: fashion ? 600 : 500, fontSize: size, color: CREAM, lineHeight: 1.08, letterSpacing: fashion ? '0.005em' : '-0.005em', textShadow: '0 4px 44px rgba(0,0,0,0.92)', clipPath: `inset(0 0 ${100 - wipe}% 0)`, transform: `translateY(${rise}px)` }}>
            {pre}{gold && <span style={{ color: 'transparent', backgroundImage: `linear-gradient(175deg, ${GOLD_HI}, ${GOLD} 45%, ${GOLD_DEEP})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', fontWeight: fashion ? 700 : 600 }}>{gold}</span>}{post}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: isL ? 'flex-start' : 'center', marginTop: 24 }}>
          <div style={{ width: 140 * rule, height: 1.5, background: `linear-gradient(90deg, ${isL ? GOLD : 'transparent'}, ${GOLD_HI}, transparent)`, boxShadow: `0 0 12px ${GOLD}66` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ---- CINEMATIC image treatment: PARALLAX (image drifts opposite a subtle
// direction while pushing in — fakes camera depth), a SIGNATURE COLOR GRADE
// (crushed blacks + gold highlight roll-off + teal shadow separation via
// layered blends), volumetric LIGHT RAYS, floating DUST, and lens breathing.
// Always leaves the lower third readable for the title band. ----
const Frame: React.FC<{ src: string; gen?: boolean; z0?: number; z1?: number; dur: number; focus?: string; dim?: number; drift?: [number, number] }> =
({ src, gen = true, z0 = 1.06, z1 = 1.16, dur, focus = '50% 42%', dim = 1, drift = [-1.2, 0.6] }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' })
  const sc = z0 + (z1 - z0) * p
  // lens breathing: tiny non-linear scale wobble
  const breathe = Math.sin(frame * 0.04) * 0.004
  const dx = drift[0] * p, dy = drift[1] * p
  const path = gen ? `aiceo/gen/${src}` : `aiceo/${src}`
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: INK }}>
      <Img src={staticFile(path)} style={{ width: '108%', height: '108%', position: 'absolute', left: '-4%', top: '-4%', objectFit: 'cover', objectPosition: focus, transform: `scale(${sc + breathe}) translate(${dx}%, ${dy}%)`, filter: `brightness(${0.8 * dim}) contrast(1.12) saturate(1.02)` }} />
      {/* SIGNATURE GRADE — teal in the shadows, gold in the highlights */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(20,40,48,0.28), transparent 40%)`, mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ background: `radial-gradient(75% 75% at 78% 16%, ${GOLD}22, transparent 46%)`, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${INK}66, transparent 8%)`, mixBlendMode: 'multiply' }} /> {/* crush blacks */}
      <LightRays />
      <Dust seed={gen ? 3 : 7} />
      {/* readability: bottom crush + vignette */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${INK}33, transparent 24%, transparent 42%, ${INK}f4)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(135% 135% at 50% 38%, transparent 44%, ${INK}d0)` }} />
    </AbsoluteFill>
  )
}

// volumetric gold light rays streaming from top-right — slow drift
const LightRays: React.FC = () => {
  const frame = useCurrentFrame()
  const o = 0.12 + Math.sin(frame * 0.03) * 0.03
  const rot = -18 + Math.sin(frame * 0.015) * 1.5
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none', opacity: o }}>
      <div style={{ position: 'absolute', top: '-30%', right: '2%', width: '55%', height: '150%', transform: `rotate(${rot}deg)`, background: `repeating-linear-gradient(90deg, transparent 0px, ${GOLD}22 2px, transparent 6px, transparent 40px)`, filter: 'blur(6px)', maskImage: 'linear-gradient(160deg, black, transparent 70%)', WebkitMaskImage: 'linear-gradient(160deg, black, transparent 70%)' }} />
    </AbsoluteFill>
  )
}

// floating dust motes — slow rising specks catching the light
const Dust: React.FC<{ seed?: number }> = ({ seed = 3 }) => {
  const frame = useCurrentFrame()
  const motes = Array.from({ length: 26 }, (_, i) => {
    const r = ((i * 9301 + seed * 49297) % 233280) / 233280
    const r2 = ((i * 4021 + seed * 7919) % 233280) / 233280
    const x = r * 100, baseY = r2 * 100
    const y = (baseY - frame * (0.02 + r * 0.03)) % 100
    const size = 1 + r2 * 2.5
    const tw = 0.15 + Math.abs(Math.sin(frame * 0.05 + i)) * 0.35
    return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${(y + 100) % 100}%`, width: size, height: size, borderRadius: '50%', background: GOLD_HI, opacity: tw, filter: 'blur(0.5px)', boxShadow: `0 0 ${size * 2}px ${GOLD}88` }} />
  })
  return <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}>{motes}</AbsoluteFill>
}

// consistent film grain, one setting, everywhere
const Grain: React.FC = () => { const f = useCurrentFrame(); return (
  <AbsoluteFill style={{ opacity: 0.045, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
    <svg width="100%" height="100%"><filter id="gr"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={f % 8} /></filter><rect width="100%" height="100%" filter="url(#gr)" /></svg>
  </AbsoluteFill>) }

// ---- THE STORY, timed from the VO (measured durations, sync is structural) ----
// tr durations: 1:4.04 2:4.97 3:1.58 4:2.55 5:1.21 6:5.85 7:6.27 8:6.22 9:3.58 10:3.44
const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode; kicker?: boolean }

const BEATS: Beat[] = [
  // cold open — a held breath, no words
  { dur: s(1.4), el: <Frame src="overwhelm.png" dur={s(1.4)} z0={1.0} z1={1.05} /> },

  // 1 — who I am (Trent narrates from frame one)
  { dur: s(4.04 + 0.5), vo: 'tr-1', el: <><Frame src="overwhelm.png" z0={1.05} z1={1.14} dur={s(4.6)} />
      <Title kicker="THE AI CEO" pre="I've sat with a thousand owners who did " gold="everything right." size={54} hold={s(4.04 + 0.5)} /></> },
  // 2 — the false trail
  { dur: s(4.97 + 0.4), vo: 'tr-2', el: <><Frame src="tools.png" z0={1.04} z1={1.12} dur={s(5.4)} focus="50% 50%" />
      <Title pre="The tools. The consultants. " gold="The demos." size={58} hold={s(4.97 + 0.4)} /></> },
  // 3 — the gut punch
  { dur: s(1.58 + 0.9), vo: 'tr-3', el: <><Frame src="drowning.png" z0={1.06} z1={1.12} dur={s(2.5)} dim={0.8} />
      <Title gold="Still drowning." size={104} hold={s(1.58 + 0.9)} /></> },

  // silence beat — the turn
  { dur: s(0.7), el: <AbsoluteFill style={{ background: INK }} /> },

  // 4 — the reframe begins (clarity image, gold beam)
  { dur: s(2.55 + 0.4), vo: 'tr-4', el: <><Frame src="clarity.png" z0={1.04} z1={1.1} dur={s(3.0)} focus="50% 50%" />
      <Title pre="The problem was never " gold="AI." size={64} hold={s(2.55 + 0.4)} /></> },
  // 5 — THE pivot line, lands on the word
  { dur: s(1.21 + 1.2), vo: 'tr-5', el: <><Frame src="clarity.png" z0={1.1} z1={1.16} dur={s(2.4)} focus="50% 50%" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ClarityHero hold={s(1.21 + 1.2)} /></AbsoluteFill></> },

  // 6 — WHY ME. Trent revealed, named. (real photo earns its place here)
  { dur: s(5.85 + 0.3), vo: 'tr-6', el: <><Frame src="bio.png" gen={false} z0={1.12} z1={1.05} dur={s(6.2)} focus="50% 32%" />
      <Title kicker="TRENT DANIEL" pre="I've built " gold="100+ AI systems" post=" — live and running." size={52} hold={s(5.85 + 0.3)} /></> },
  // 7 — the offer
  { dur: s(6.27 + 0.3), vo: 'tr-7', el: <><Frame src="time.png" z0={1.04} z1={1.12} dur={s(6.6)} focus="50% 50%" />
      <Title pre="In 48 hours, I find you " gold="40+ hours a month." post=" Or it's free." size={50} hold={s(6.27 + 0.3)} /></> },
  // 8 — the proof
  { dur: s(6.22 + 0.3), vo: 'tr-8', el: <ProofBeat hold={s(6.22 + 0.3)} /> },
  // 9 — the promise (back to Trent)
  { dur: s(3.58 + 0.4), vo: 'tr-9', el: <><Frame src="bio.png" gen={false} z0={1.08} z1={1.02} dur={s(4.0)} focus="50% 32%" dim={0.95} />
      <Title pre="I don't sell software. I give you back " gold="your time." size={52} hold={s(3.58 + 0.4)} /></> },

  // 10 — the call
  { dur: s(3.44 + 1.4), vo: 'tr-10', el: <CloseCard hold={s(3.44 + 1.4)} /> },
]

// the pivot line — same fonts/gold, just larger and centered (still one system)
function ClarityHero({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 14, hold - 12, hold], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 18], [16, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return (
    <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: 'center' }}>
      <div style={{ fontFamily: GROTESK, fontWeight: 500, fontSize: 30, color: MUTE, letterSpacing: '0.16em', marginBottom: 14 }}>It was</div>
      <div style={{ fontFamily: FASHION, fontWeight: 700, fontSize: 150, lineHeight: 1.2, paddingBottom: '0.1em', color: 'transparent', backgroundImage: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD} 55%, ${GOLD_DEEP})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', textShadow: `0 0 70px ${GOLD}55` }}>clarity.</div>
    </div>
  )
}

// proof stats — same gold serif numerals, revealed in sequence, one band
function ProofBeat({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const stats = [['$8.4M+', 'Revenue Influenced'], ['100+', 'Systems Live'], ['48hr', 'Turnaround']]
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: INK }}>
      <Frame src="drowning.png" z0={1.06} z1={1.13} dur={hold} dim={0.55} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 90 }}>
        {stats.map(([v, l], i) => {
          const at = 8 + i * 14
          const o = interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          const yy = interpolate(frame, [at, at + 14], [18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          return (
            <div key={i} style={{ textAlign: 'center', opacity: o, transform: `translateY(${yy}px)` }}>
              <div style={{ fontFamily: FASHION, fontWeight: 700, fontSize: 96, color: 'transparent', backgroundImage: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD_DEEP})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', textShadow: `0 0 40px ${GOLD}33` }}>{v}</div>
              <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 22, color: CREAM, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 12 }}>{l}</div>
            </div>
          )
        })}
      </AbsoluteFill>
      <Title pre="No hype. No jargon. " gold="Just the plan." size={44} hold={hold} />
    </AbsoluteFill>
  )
}

// close — the team, wordmark, CTA. same gold/serif system.
function CloseCard({ hold }: { hold: number }) {
  const frame = useCurrentFrame()
  const up = interpolate(frame, [4, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const cta = interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const rule = clamp((frame - 22) / 18, 0, 1)
  const yy = interpolate(frame, [4, 24], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Frame src="team.png" gen={false} z0={1.04} z1={1.1} dur={hold} focus="50% 40%" dim={0.5} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${INK}55, ${INK}cc 52%, ${INK}f6)` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ opacity: up, transform: `translateY(${yy}px)`, textAlign: 'center' }}>
          <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 22, letterSpacing: '0.5em', color: CREAM, marginBottom: 8 }}>THE</div>
          <div style={{ fontFamily: FASHION, fontWeight: 700, fontSize: 118, lineHeight: 0.9, color: 'transparent', backgroundImage: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD} 55%, ${GOLD_DEEP})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', textShadow: `0 0 60px ${GOLD}44` }}>AI CEO</div>
        </div>
        <div style={{ width: 300 * rule, height: 1.5, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: 28 }} />
        <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 30, color: CREAM, letterSpacing: '0.18em', marginTop: 30, textTransform: 'uppercase', opacity: cta }}>Book Your Free Clarity Call</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---- BEAT-LOCK: snap each cut to the nearest musical beat so the edit rides
// the score (~70 BPM, beat every 0.859s). We nudge each beat's START to the
// closest grid beat (max ±0.28s so the VO stays in sync), which cascades so
// every subsequent cut also lands on-grid. Key moments ('clarity', stats, CTA)
// thus fall on the pulse — the "scored, not soundtracked" feel. ----
// compute raw starts, then quantize cut points to the grid (shared plumbing)
const rawStarts: number[] = []; { let t = 0; for (const b of BEATS) { rawStarts.push(t); t += b.dur } }
const BEAT_STARTS = beatLock(rawStarts, gridToFrames((beatgrid as any).beats, FPS), Math.round(0.28 * FPS))

export const aiceoDuration = BEAT_STARTS[BEAT_STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6

export const CommercialAICEO: React.FC = () => {
  const starts = BEAT_STARTS
  const durs = durationsFromStarts(starts, aiceoDuration - 6)
  const total = aiceoDuration
  // GENTLE ducking (track is mastered flat) — shallow dip, long ramp = no pump
  const voWin = BEATS.map((b, i) => b.vo ? { start: starts[i], end: starts[i] + durs[i] } : null).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.34, duck: 0.18, ramp: 20, fadeInEnd: 18, fadeOutStart: total - 30, fadeOutEnd: total - 8 })

  return (
    <AbsoluteFill style={{ background: INK }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durs[i] + 8}>
          {b.el}
          <Grain />
          <Dissolve dur={durs[i]} />
        </Sequence>
      ))}
      <MusicBed src="ai-music.mp3" musicFrames={1351} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={starts[i]}><Audio src={staticFile(`${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}

      {/* ===================== SOUND DESIGN LAYER =====================
          The half of "high-end" that was missing. Keyed to the story beats:
          · warm ROOM TONE bed under the whole film (fills the silence, premium)
          · soft IMPACT on the "Still drowning" gut punch (beat 3)
          · elegant RISER swelling THROUGH the silence into the "clarity" turn
          · golden SHIMMER exactly as "clarity" lands (beat 5)
          · deep IMPACT as each proof stat hits (beat 8) + on the final logo/CTA
       */}
      {/* room tone — very low, looped across the whole piece */}
      <Audio src={staticFile('sfx/roomtone-warm.mp3')} volume={0.09} loop />
      {/* gut punch */}
      <Sequence from={starts[3]} durationInFrames={30}><Audio src={staticFile('sfx/impact-soft.wav')} volume={0.4} /></Sequence>
      {/* riser building through the silence (beat 4) into clarity (beat 5) */}
      <Sequence from={starts[4] - 8} durationInFrames={60}><Audio src={staticFile('sfx/riser-elegant.mp3')} volume={0.5} /></Sequence>
      {/* shimmer as "clarity" reveals */}
      <Sequence from={starts[5] + 4} durationInFrames={45}><Audio src={staticFile('sfx/shimmer.mp3')} volume={0.42} /></Sequence>
      {/* proof stats — three deep hits spaced across the ProofBeat */}
      {[8, 22, 36].map((off, k) => (
        <Sequence key={'st' + k} from={starts[8] + off} durationInFrames={40}><Audio src={staticFile('sfx/impact-lux.mp3')} volume={0.34} /></Sequence>
      ))}
      {/* logo / CTA landing on the close */}
      <Sequence from={starts[10] + 4} durationInFrames={50}><Audio src={staticFile('sfx/impact-lux.mp3')} volume={0.42} /></Sequence>
      <Sequence from={starts[10] + 60} durationInFrames={45}><Audio src={staticFile('sfx/shimmer.mp3')} volume={0.32} /></Sequence>
    </AbsoluteFill>
  )
}

// the ONE transition for the whole film — a slow cross-dissolve through black
const Dissolve: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame()
  // guard for short beats: keep the input range strictly increasing
  const inA = 10, outA = Math.max(inA + 2, dur - 8), outB = Math.max(outA + 1, dur + 2)
  const o = interpolate(frame, [0, inA, outA, outB], [1, 0, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ background: INK, opacity: o, pointerEvents: 'none' }} />
}
