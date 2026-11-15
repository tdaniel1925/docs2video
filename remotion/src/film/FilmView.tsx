import React, { useMemo } from 'react'
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion'
import { KIT_FPS, VO_LEAD, type KitPlan, type KitTimeline } from '../kit/spec'
import { CL, Finish, Ornament, StartCtx, ThemeCtx } from './core'
import { BrandMark, FilmScene, type SceneCtx } from './kitscenes'
import { themeForPlan } from './theme'

/**
 * A kit plan, drawn by the film engine. The timeline is the kit's (KitVideo works it out from the voice lengths), so
 * the voice, music and the render service's scene stills line up exactly as they do for the kit. Scenes cut on
 * their start frame; each cut lands with a small settle (and a breath of light in dark looks).
 */
export const FilmView: React.FC<{ plan: KitPlan; tl: KitTimeline }> = ({ plan, tl }) => {
  const frame = useCurrentFrame()
  const th = useMemo(() => themeForPlan(plan), [plan])
  const scenes = plan.scenes
  const { starts, durations, voFrames } = tl
  let i = 0
  for (let k = 0; k < scenes.length; k++) if (starts[k] <= frame) i = k
  const s = scenes[i]
  const t = (frame - starts[i]) / KIT_FPS
  const c: SceneCtx = {
    t, d: durations[i] / KIT_FPS, vo0: VO_LEAD / KIT_FPS,
    voDur: (voFrames[i] > 0 ? voFrames[i] : Math.max(30, durations[i] - 40)) / KIT_FPS,
    words: s.words, brand: plan.brand || {}, recipient: plan.recipient, index: i, count: scenes.length,
  }
  const settle = i === 0 ? 0 : interpolate(t, [0, 0.35], [1, 0], { ...CL, easing: Easing.out(Easing.cubic) })
  const content = s.type !== 'title' && s.type !== 'cta'
  return (
    <ThemeCtx.Provider value={th}>
      <StartCtx.Provider value={0}>
        <AbsoluteFill style={{ background: th.bg }}>
          <AbsoluteFill style={{ transform: `scale(${1 + 0.025 * settle})` }}><FilmScene scene={s} c={c} /></AbsoluteFill>
          {th.dark ? <AbsoluteFill style={{ background: '#fff2dc', opacity: settle * 0.12, mixBlendMode: 'screen' }} /> : null}
          {content ? <div style={{ position: 'absolute', left: 96, top: th.letterbox ? 160 : th.ornament === 'index' ? 120 : 64, opacity: 0.85 * interpolate(t, [0.2, 0.7], [0, 1], CL) }}><BrandMark brand={plan.brand || {}} height={44} /></div> : null}
          <Ornament t={t} index={i} count={scenes.length} title={plan.title} />
          <Finish />
        </AbsoluteFill>
      </StartCtx.Provider>
    </ThemeCtx.Provider>
  )
}
