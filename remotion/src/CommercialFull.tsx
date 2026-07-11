import React from 'react'
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig, interpolate, useCurrentFrame } from 'remotion'
import { HeroReveal, KineticHype, CinematicOpen, SplitCompare, StatGrid, CTAClose } from './CommercialProto'

/**
 * CommercialFull — a complete ~40s hand-assembled commercial that sequences the
 * 6 cinematic prototype scenes into one arc, with a music bed, per-scene VO, and
 * SFX hits on the cuts. This is the "finished product" pitch before we build the
 * automated AI-director pipeline.
 *
 * ARC (Meridian Financial annuity):
 *   Open (brand) → Hook (kinetic) → Compare → Stats → Hero number → CTA close
 */

const FPS = 30
const sec = (s: number) => Math.round(s * FPS)

// scene plan: [component, durationSec, voFile]. Durations give each VO room to
// breathe + a beat of hold; cuts land on ~1s grid boundaries for rhythm.
const SCENES: { C: React.FC; dur: number; vo: string }[] = [
  { C: CinematicOpen, dur: 4.0, vo: 'comm-vo-1' },   // "What if your retirement was built for you?"
  { C: KineticHype, dur: 3.5, vo: 'comm-vo-2' },     // "Stop guessing. Start growing."
  { C: SplitCompare, dur: 4.0, vo: 'comm-vo-3' },    // "The old way costs you thousands..."
  { C: StatGrid, dur: 5.5, vo: 'comm-vo-4' },        // "Trusted by thousands. Zero downside..."
  { C: HeroReveal, dur: 8.0, vo: 'comm-vo-5' },      // "...824,500. Guaranteed for life."
  { C: CTAClose, dur: 6.0, vo: 'comm-vo-6' },        // "Your future starts today..."
]

// SFX per cut: a whoosh into each new scene, a soft impact when the hero number
// and stat grid land, a sub-drop on the final CTA.
const cutSfx = ['whoosh', 'whoosh-short', 'whoosh', 'impact-soft', 'impact', 'subdrop']

export const commercialDuration = SCENES.reduce((a, s) => a + sec(s.dur), 0) + sec(1)

const Sfx: React.FC<{ name: string; at: number; vol?: number }> = ({ name, at, vol = 0.3 }) => (
  <Sequence from={at} durationInFrames={Math.min(60, sec(2))}><Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} /></Sequence>
)

// a quick white flash on each cut — the visual half of the "hit".
const CutFlash: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame()
  const o = Math.max(0, 1 - (frame - at) / 4) * (frame >= at ? 1 : 0)
  return <AbsoluteFill style={{ background: '#fff', opacity: o * 0.14, pointerEvents: 'none' }} />
}

// VO clip durations (sec) — for building the music-ducking envelope.
const VO_DUR = [2.4, 2.2, 2.9, 4.9, 7.2, 5.2]

export const CommercialFull: React.FC = () => {
  const { durationInFrames } = useVideoConfig()
  // compute each scene's start frame
  const starts: number[] = []
  let t = 0
  for (const s of SCENES) { starts.push(t); t += sec(s.dur) }
  const total = t + sec(1)

  // DUCKING envelope: music sits LOUD (0.42) except while VO is speaking, where
  // it dips to 0.16 with a smooth ramp in/out (0.3s) so the voice is always
  // clearly on top. This is the standard commercial mix — music serves the voice.
  const voWindows = starts.map((s, i) => ({ start: s + 8, end: s + 8 + sec(VO_DUR[i]) }))
  // SMOOTH ducking — build one continuous "voice activity" curve (0=silent,
  // 1=speaking) with soft ramps, then map it to a music level. Because it's one
  // continuous interpolation with no per-window Math.min jumps, there are no
  // discontinuities → no pops/clicks. The level GLIDES between loud and ducked.
  const musicDuck = (f: number): number => {
    const LOUD = 0.40, DUCK = 0.15, RAMP = 14   // longer ramp = gentler, no pop
    // voice activity: max over windows of a smooth trapezoid (0..1)
    let voice = 0
    for (const w of voWindows) {
      const up = interpolate(f, [w.start - RAMP, w.start], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      const down = interpolate(f, [w.end, w.end + RAMP], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      voice = Math.max(voice, Math.min(up, down))
    }
    // ease the voice curve so the transition is smooth (no linear kink)
    const eased = voice * voice * (3 - 2 * voice)   // smoothstep
    const level = LOUD + (DUCK - LOUD) * eased
    const fade = interpolate(f, [0, 12, total - 40, total - 8], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    return level * fade
  }

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* MUSIC — a BESPOKE ElevenLabs track composed for this spot (builds to the
          hero moment, resolves for the CTA). Louder than a flat bed since it's
          intentional; still ducks under the VO. */}
      <Audio src={staticFile('comm-music.mp3')} volume={musicDuck} />

      {/* SCENES — each in its own Sequence at its start frame, with a short
          cross-hold. VO plays synced to the scene. */}
      {SCENES.map((s, i) => {
        const { C } = s
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={sec(s.dur) + (i < SCENES.length - 1 ? 8 : sec(1))}>
            <C />
          </Sequence>
        )
      })}

      {/* per-scene VO (louder than music; the voice carries the spot) */}
      {SCENES.map((s, i) => (
        <Sequence key={'vo' + i} from={starts[i] + 8}><Audio src={staticFile(`${s.vo}.mp3`)} volume={1.0} /></Sequence>
      ))}

      {/* SFX hits + cut flashes on each scene boundary */}
      {SCENES.map((s, i) => (
        <React.Fragment key={'sfx' + i}>
          <Sfx name={cutSfx[i]} at={starts[i] - 2} vol={i >= 4 ? 0.4 : 0.28} />
          <CutFlash at={starts[i]} />
        </React.Fragment>
      ))}
    </AbsoluteFill>
  )
}
