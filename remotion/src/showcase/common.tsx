import React from 'react'
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, interpolate, spring, Easing } from 'remotion'
import { staticFile } from '../lib/asset'
import { makeMusicDuck, beatLock, gridToFrames, durationsFromStarts, type VoWindow } from '../lib/audio'
import { MusicBed } from '../lib/musicbed'

/* ============================================================================
 * SHOWCASE COMMON — the plumbing every showcase piece shares:
 *   · a beat timeline built from the narration lengths, snapped to the music grid
 *   · music bed looped + ducked under the voice, whoosh on every cut
 *   · a few typographic atoms (rule, chip, big word, kicker) used across looks
 * The three pieces (Harbor, Northwind, Forge) are deliberately different in
 * look and rhythm; only this plumbing is the same.
 * ==========================================================================*/
export const FPS = 30
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const s = (sec: number) => Math.round(sec * FPS)
export const pop = (frame: number, at: number, damping = 13, stiffness = 160) => clamp(spring({ frame: frame - at, fps: FPS, config: { damping, stiffness, mass: 0.8 } }), 0, 1.2)

export type BeatSpec = { dur: number; el: (hold: number, i: number) => React.ReactNode; impact?: boolean; noVo?: boolean }
export type Timeline = { starts: number[]; durs: number[]; total: number }

/** Beat starts snapped to the music grid; total = last start + last dur + tail. */
export function timeline(beats: BeatSpec[], grid: number[], lead = 0): Timeline {
  const raw: number[] = []; let t = lead
  for (const b of beats) { raw.push(t); t += b.dur }
  const starts = beatLock(raw, gridToFrames(grid, FPS).filter((g) => g >= lead), Math.round(0.2 * FPS))
  const total = starts[starts.length - 1] + beats[beats.length - 1].dur + 6
  return { starts, durs: durationsFromStarts(starts, total - 6), total }
}

/** The audio layer: music bed, narration per beat, whoosh on cuts, optional impacts. */
export const AudioBed: React.FC<{ id: string; beats: BeatSpec[]; tl: Timeline; voDur: number[]; musicFrames: number; loud?: number; duck?: number; whoosh?: number; impacts?: number[]; voice?: boolean }> =
({ id, beats, tl, voDur, musicFrames, loud = 0.3, duck = 0.1, whoosh = 0.22, impacts = [], voice = true }) => {
  const voWin: VoWindow[] = beats.map((b, i) => b.noVo ? null : { start: tl.starts[i], end: tl.starts[i] + s(voDur[i] ?? 0) }).filter(Boolean) as VoWindow[]
  const musicDuck = makeMusicDuck(voWin, tl.total, { loud, duck, ramp: 14, fadeInEnd: 8 })
  return (
    <>
      <MusicBed src={`showcase/${id}/music.mp3`} musicFrames={musicFrames} volume={musicDuck} />
      {voice && beats.map((b, i) => b.noVo ? null : <Sequence key={'vo' + i} from={tl.starts[i]}><Audio src={staticFile(`showcase/${id}/vo-${i + 1}.mp3`)} volume={1} /></Sequence>)}
      {whoosh > 0 && tl.starts.slice(1).map((st, i) => <Sequence key={'w' + i} from={st - 3} durationInFrames={16}><Audio src={staticFile('sfx/whoosh-short.wav')} volume={whoosh} /></Sequence>)}
      {impacts.map((f, i) => <Sequence key={'imp' + i} from={f} durationInFrames={30}><Audio src={staticFile('sfx/impact.wav')} volume={0.4} /></Sequence>)}
    </>
  )
}

/** A thin rule that draws itself. */
export const Rule: React.FC<{ at: number; w?: number; color: string; dur?: number }> = ({ at, w = 120, color, dur = 14 }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - at) / dur, 0, 1)
  return <div style={{ width: w * Easing.out(Easing.cubic)(p), height: 1.5, background: color, margin: '0 auto' }} />
}

/** Text that rises + fades in on a frame. */
export const Rise: React.FC<{ at: number; children: React.ReactNode; dist?: number; dur?: number; style?: React.CSSProperties }> = ({ at, children, dist = 28, dur = 16, style }) => {
  const frame = useCurrentFrame()
  const p = clamp((frame - at) / dur, 0, 1)
  const e = Easing.out(Easing.cubic)(p)
  return <div style={{ opacity: e, transform: `translateY(${(1 - e) * dist}px)`, ...style }}>{children}</div>
}

/** Letters arriving one by one — for wordmarks. */
export const Letters: React.FC<{ text: string; at: number; step?: number; style?: React.CSSProperties; from?: 'below' | 'blur' }> = ({ text, at, step = 2, style, from = 'below' }) => {
  const frame = useCurrentFrame()
  return (
    <span style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {[...text].map((ch, i) => {
        const p = clamp((frame - at - i * step) / 12, 0, 1); const e = Easing.out(Easing.cubic)(p)
        return <span key={i} style={{ display: 'inline-block', opacity: e, transform: from === 'below' ? `translateY(${(1 - e) * 22}px)` : `scale(${0.85 + 0.15 * e})`, filter: from === 'blur' ? `blur(${(1 - e) * 8}px)` : undefined }}>{ch}</span>
      })}
    </span>
  )
}

/** A small caption chip anchored to a corner. */
export const Chip: React.FC<{ at: number; text: string; color: string; bg: string; x?: number; y?: number; font?: string; size?: number }> = ({ at, text, color, bg, x = 96, y = 880, font, size = 18 }) => {
  const frame = useCurrentFrame()
  const p = pop(frame, at, 14)
  return <div style={{ position: 'absolute', left: x, top: y, padding: '10px 16px', background: bg, color, borderRadius: 6, fontFamily: font, fontSize: size, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: clamp(p * 2, 0, 1), transform: `translateY(${(1 - clamp(p, 0, 1)) * 20}px)` }}>{text}</div>
}

/** Slow continuous fade to black over the last frames. */
export const FadeOut: React.FC<{ total: number; dur?: number }> = ({ total, dur = 24 }) => {
  const frame = useCurrentFrame()
  const o = clamp((frame - (total - dur)) / dur, 0, 1)
  return o > 0 ? <AbsoluteFill style={{ background: '#000', opacity: o, pointerEvents: 'none' }} /> : null
}

/** A cut transition: brief dip + light flash — cinematic, not a wipe. */
export const DipCut: React.FC<{ color?: string; dur?: number }> = ({ color = '#000', dur = 8 }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, dur], [0.9, 0], { extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: 'none' }} />
}
