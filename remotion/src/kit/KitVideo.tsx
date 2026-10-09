import React, { useMemo } from 'react'
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, type CalculateMetadataFunction } from 'remotion'
import { TransitionSeries, linearTiming, type TransitionPresentation, type TransitionPresentationComponentProps } from '@remotion/transitions'
import { slide } from '@remotion/transitions/slide'
import { Easing } from 'remotion'
import { getAudioDurationInSeconds } from '@remotion/media-utils'
import { setAssetBase, staticFile } from '../lib/asset'
import { MusicBed } from '../lib/musicbed'
import { explainerMusicDuck, type VoWindow } from '../lib/audio'
import {
  cueFrame, defaultMood, FEEL, KIT_FPS, KIT_H, KIT_LOOKS, KIT_W, kitTimeline, sanitizeLook, VO_LEAD,
  type KitPlan, type KitScene, type KitTimeline, type Mood,
} from './spec'
import { KitBackground, KitChrome, KitThemeProvider } from './theme'
import { SCENE_VIEWS } from './scenes'
import type { SceneTiming } from './parts'

// =============================================================================
// KitVideo — the ONE composition for the scene kit.
//
// It renders a plan (spec.ts KitPlan): a list of kit scenes, each with its own
// voice file, in one look. Everything else — cuts, music ducking, sound
// effects, the frame chrome — is decided here from the plan, never per video.
//
// Timeline: spec.ts kitTimeline (scenes overlap by the cut). The voice of each
// scene starts VO_LEAD frames into it, so it never talks over a cut.
//
// Per-video files (voice, music, logo, photo) are NAMED in the plan, so the
// Lambda uploader (scripts/lambda-render.mjs) finds and uploads every one,
// and calculateMetadata keeps `assetBase` (it REPLACES the props — dropping
// it sent the photo lookup to the bundle and crashed renders; see memory
// "remotion lambda").
// =============================================================================

export type KitVideoProps = {
  plan: KitPlan
  assetBase?: string
  /** The free preview: one picture, no sound, every scene the same length. */
  still?: boolean
  /** Worked out by calculateMetadata. */
  timeline?: KitTimeline
  musicFrames?: number
}

const EMPTY: KitPlan = { version: 1, title: '', look: KIT_LOOKS['animated-slides'], brand: {}, scenes: [] }

export const kitMetadata: CalculateMetadataFunction<KitVideoProps> = async ({ props }) => {
  setAssetBase(props?.assetBase)
  const assetBase = props?.assetBase
  const plan = props?.plan
  const base = { fps: KIT_FPS, width: KIT_W, height: KIT_H }
  if (!plan || !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    // Renderable-but-empty placeholder: a throwing calculateMetadata would break the whole composition list.
    return { ...base, durationInFrames: 30, props: { plan: EMPTY, assetBase, timeline: kitTimeline([], 'premium') } }
  }
  const look = sanitizeLook(plan.look)
  if (props.still) {
    const timeline = kitTimeline(plan.scenes, look.feel, { preview: true })
    return { ...base, durationInFrames: timeline.total, props: { ...props, assetBase, plan: { ...plan, look }, timeline, still: true } }
  }
  // Voice lengths: the render service writes voSec; measure any it didn't.
  const scenes: KitScene[] = await Promise.all(plan.scenes.map(async (s) => {
    if ((s.voSec ?? 0) > 0 || !s.vo) return s
    try { return { ...s, voSec: await getAudioDurationInSeconds(staticFile(s.vo)) } } catch { return s }
  }))
  const timeline = kitTimeline(scenes, look.feel)
  let musicFrames = 0
  const music = plan.audio?.music || FEEL[look.feel].music
  try { musicFrames = Math.round((await getAudioDurationInSeconds(staticFile(music))) * KIT_FPS) } catch { /* MusicBed loops by itself */ }
  return { ...base, durationInFrames: timeline.total, props: { ...props, assetBase, plan: { ...plan, look, scenes }, timeline, musicFrames } }
}

// ── the reveal cut: the old scene pushes forward and fades, the new one rises
// out of the page — content-only, so no two scenes' words ever overlap.
const ZoomThrough: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress
  const entering = presentationDirection === 'entering'
  const style: React.CSSProperties = entering
    ? { opacity: interpolate(p, [0.35, 1], [0, 1], { extrapolateLeft: 'clamp' }), transform: `scale(${0.9 + 0.1 * p})`, filter: `blur(${(1 - p) * 8}px)` }
    : { opacity: interpolate(p, [0, 0.6], [1, 0], { extrapolateRight: 'clamp' }), transform: `scale(${1 + 0.08 * p})`, filter: `blur(${p * 6}px)` }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>
}
const zoomThrough = (): TransitionPresentation<Record<string, never>> => ({ component: ZoomThrough, props: {} })

// ── the calm cut: a soft dip — the old scene is mostly gone before the new
// one arrives, so two scenes' words never sit on top of each other.
const Dip: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress }) => {
  const p = presentationProgress
  const o = presentationDirection === 'entering'
    ? interpolate(p, [0.42, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(p, [0, 0.55], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
}
const dip = (): TransitionPresentation<Record<string, never>> => ({ component: Dip, props: {} })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cut(mood: Mood, i: number): TransitionPresentation<any> {
  if (mood === 'calm') return dip()
  if (mood === 'reveal') return zoomThrough()
  return slide({ direction: i % 2 ? 'from-right' : 'from-bottom' })
}

/** The frame (from the scene start) a big number lands — shared with the sound effect. */
export function landingFrame(s: KitScene, voFrames: number): number | null {
  if (s.type !== 'bignumber') return null
  const c = cueFrame(s.words, s.landOn)
  return c != null ? VO_LEAD + c : VO_LEAD + Math.min(60, Math.max(30, Math.round(voFrames * 0.32)))
}

const Sfx: React.FC<{ name: string; at: number; total: number; volume: number }> = ({ name, at, total, volume }) => {
  if (at < 0 || at >= total - 2) return null
  return <Sequence from={at} durationInFrames={Math.min(90, total - at)}><Audio src={staticFile(`sfx/${name}`)} volume={volume} /></Sequence>
}

export const KitVideo: React.FC<KitVideoProps> = ({ plan, assetBase, still = false, timeline, musicFrames = 0 }) => {
  setAssetBase(assetBase)
  const frame = useCurrentFrame()
  const look = useMemo(() => sanitizeLook(plan?.look), [plan?.look])
  const scenes = plan?.scenes ?? []
  const tl = timeline ?? kitTimeline(scenes, look.feel, { preview: still })
  const { starts, durations, voFrames, total } = tl
  const cutLen = tl.cut

  if (!scenes.length) return <AbsoluteFill style={{ background: look.colors.bg }} />

  // MUSIC ducks under exactly the voice windows (0.20 between lines, 0.08 under).
  const voWin: VoWindow[] = scenes.map((_, i) => ({ start: starts[i] + VO_LEAD, end: starts[i] + VO_LEAD + Math.max(1, voFrames[i]) })).filter((w) => w.end > w.start + 1)
  const duck = explainerMusicDuck(voWin, total)
  const music = plan.audio?.music || FEEL[look.feel].music
  const sfxMode = plan.audio?.sfx ?? (plan.regulated ? 'quiet' : 'standard')
  const sfxVol = (look.feel === 'energetic' ? 0.3 : look.feel === 'calm' ? 0.18 : 0.24) * (sfxMode === 'quiet' ? 0.6 : 1)

  // The chrome (logo, "Prepared for", progress line) shows on content scenes
  // only; the cover and the sign-off are full-frame moments of their own.
  const chromeO = scenes.reduce((o, s, i) => {
    if (s.type === 'title' || s.type === 'cta') return o
    const a = starts[i], b = starts[i] + durations[i]
    return Math.max(o, interpolate(frame, [a + cutLen * 0.4, a + cutLen, b - cutLen, b - cutLen * 0.4], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
  }, 0)

  return (
    <KitThemeProvider look={look} brand={plan.brand || {}} recipient={plan.recipient}>
      <AbsoluteFill>
        {/* one continuous, always-moving page under every scene */}
        <KitBackground />
        <TransitionSeries>
          {scenes.map((s, i) => {
            const View = SCENE_VIEWS[s.type] as React.FC<{ scene: KitScene; timing: SceneTiming }>
            const timing: SceneTiming = {
              dur: durations[i], voStart: VO_LEAD,
              voFrames: voFrames[i] > 0 ? voFrames[i] : Math.min(130, durations[i] - 40),
              silent: !(voFrames[i] > 0),
            }
            const next = scenes[i + 1]
            return (
              <React.Fragment key={s.id ?? i}>
                <TransitionSeries.Sequence durationInFrames={durations[i]}>
                  {View ? <View scene={s} timing={timing} /> : null}
                </TransitionSeries.Sequence>
                {next ? (
                  <TransitionSeries.Transition
                    presentation={cut(next.mood ?? defaultMood(next.type), i)}
                    timing={linearTiming({ durationInFrames: cutLen, easing: Easing.bezier(0.22, 1, 0.36, 1) })}
                  />
                ) : null}
              </React.Fragment>
            )
          })}
        </TransitionSeries>
        {chromeO > 0.001 ? <AbsoluteFill style={{ opacity: chromeO }}><KitChrome globalFrame={frame} total={total} showTag /></AbsoluteFill> : null}

        {!still && (
          <>
            <MusicBed src={music} musicFrames={musicFrames} volume={duck} />
            {scenes.map((s, i) => (s.vo ? (
              <Sequence key={`vo-${i}`} from={starts[i] + VO_LEAD} durationInFrames={Math.max(1, Math.min(total - starts[i] - VO_LEAD, voFrames[i] + 30 || durations[i]))}>
                <Audio src={staticFile(s.vo)} />
              </Sequence>
            ) : null))}
            {sfxMode !== 'off' && scenes.map((s, i) => {
              const mood = s.mood ?? defaultMood(s.type)
              // A quiet whoosh on two cuts out of three (restraint makes them land);
              // calm cuts stay silent. The quiet set (insurance) uses only the short one.
              const whoosh = i > 0 && mood !== 'calm' && i % 3 !== 0
              const land = landingFrame(s, voFrames[i])
              return (
                <React.Fragment key={`sfx-${i}`}>
                  {whoosh ? <Sfx name={sfxMode === 'quiet' || i % 2 ? 'whoosh-short.wav' : 'whoosh.wav'} at={starts[i] - 2} total={total} volume={sfxVol} /> : null}
                  {land != null ? <Sfx name="impact-soft.wav" at={starts[i] + land - 1} total={total} volume={sfxVol * 0.95} /> : null}
                  {s.type === 'cta' && i === scenes.length - 1
                    ? <Sfx name={sfxMode === 'quiet' ? 'impact-soft.wav' : 'subdrop.wav'} at={starts[i] + 10} total={total} volume={sfxVol * (sfxMode === 'quiet' ? 0.9 : 1.2)} />
                    : null}
                </React.Fragment>
              )
            })}
          </>
        )}
      </AbsoluteFill>
    </KitThemeProvider>
  )
}
