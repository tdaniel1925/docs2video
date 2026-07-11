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

export const CommercialFull: React.FC = () => {
  const { durationInFrames } = useVideoConfig()
  // compute each scene's start frame
  const starts: number[] = []
  let t = 0
  for (const s of SCENES) { starts.push(t); t += sec(s.dur) }
  const total = t + sec(1)

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* MUSIC BED — one warm corporate bed under the whole spot, ducked + fades */}
      <Audio loop src={staticFile('music/bed-uplifting-128.wav')} volume={(f) => {
        const fi = 20, fo = total - 40, fe = total - 8
        return interpolate(f, [0, fi, fo, fe], [0, 0.22, 0.22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      }} />

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
        <Sequence key={'vo' + i} from={starts[i] + 8}><Audio src={staticFile(`${s.vo}.mp3`)} volume={0.95} /></Sequence>
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
