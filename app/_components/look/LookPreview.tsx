'use client'

// =============================================================================
// THE LIVE LOOK PREVIEW — the REAL scene kit (remotion/src/kit) playing in the
// browser through @remotion/player, on the person's own scenes. Not a
// lookalike drawing: the same theme, scenes, fonts and contrast guard the
// finished video is rendered with. Silent (the voice is made at Make it);
// the music sample is a separate small file played only after a click.
//
// Loaded lazily (next/dynamic from LookWizard), so no other page carries the
// player or the kit.
// =============================================================================

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { KitBackground, KitChrome, KitThemeProvider } from '../../../remotion/src/kit/theme'
import { SCENE_VIEWS } from '../../../remotion/src/kit/scenes'
import type { SceneTiming } from '../../../remotion/src/kit/parts'
import { KIT_FPS, KIT_H, KIT_W, VO_LEAD, type KitPlan, type KitScene, type Look } from '../../../remotion/src/kit/spec'

/** Frames each scene gets in the preview (5 s), and the soft cut between them. */
export const SCENE_FRAMES = 150
const CUT = 12
/** The frame inside a scene where everything has arrived (what a tab shows). */
export const SETTLED_AT = 110

type CompProps = { plan: KitPlan; look: Look }

const PreviewComp: React.FC<CompProps> = ({ plan, look }) => {
  const frame = useCurrentFrame()
  const scenes = plan.scenes
  const total = scenes.length * SCENE_FRAMES
  const timing: SceneTiming = { dur: SCENE_FRAMES, voStart: VO_LEAD, voFrames: SCENE_FRAMES - 40, silent: true }
  return (
    <KitThemeProvider look={look} brand={plan.brand || {}} recipient={plan.recipient}>
      <AbsoluteFill>
        <KitBackground />
        {scenes.map((s, i) => {
          const View = SCENE_VIEWS[s.type] as React.FC<{ scene: KitScene; timing: SceneTiming }>
          const from = i * SCENE_FRAMES
          const local = frame - from
          // a soft dip between scenes (never two scenes' words on top of each other)
          const o = i === 0 ? interpolate(local, [SCENE_FRAMES - CUT, SCENE_FRAMES], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            : Math.min(interpolate(local, [0, CUT], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }), interpolate(local, [SCENE_FRAMES - CUT, SCENE_FRAMES], [1, i === scenes.length - 1 ? 1 : 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
          const chrome = s.type !== 'title' && s.type !== 'cta'
          return (
            <Sequence key={s.id ?? i} from={from} durationInFrames={SCENE_FRAMES} layout="none">
              <AbsoluteFill style={{ opacity: o }}>
                {View ? <View scene={s} timing={timing} /> : null}
                {chrome ? <KitChrome globalFrame={frame} total={total} showTag /> : null}
              </AbsoluteFill>
            </Sequence>
          )
        })}
      </AbsoluteFill>
    </KitThemeProvider>
  )
}

export type LookPreviewHandle = { showScene: (i: number) => void; play10: () => void; stop: () => void }

const LookPreview = forwardRef<LookPreviewHandle, { plan: KitPlan; look: Look; onPlaying?: (on: boolean) => void; onScene?: (i: number) => void }>(
  function LookPreview({ plan, look, onPlaying, onScene }, ref) {
    const player = useRef<PlayerRef>(null)
    const stopAt = useRef<number | null>(null)
    const props = useMemo<CompProps>(() => ({ plan, look }), [plan, look])
    const total = Math.max(1, plan.scenes.length * SCENE_FRAMES)

    useImperativeHandle(ref, () => ({
      showScene: (i) => { const p = player.current; if (!p) return; p.pause(); stopAt.current = null; p.seekTo(i * SCENE_FRAMES + SETTLED_AT) },
      play10: () => {
        const p = player.current; if (!p) return
        const start = Math.floor(p.getCurrentFrame() / SCENE_FRAMES) * SCENE_FRAMES
        p.seekTo(start)
        stopAt.current = Math.min(total - 1, start + 10 * KIT_FPS)
        p.play()
      },
      stop: () => { stopAt.current = null; player.current?.pause() },
    }), [total])

    useEffect(() => {
      const p = player.current
      if (!p) return
      const onFrame = (e: { detail: { frame: number } }) => {
        const f = e.detail.frame
        onScene?.(Math.min(plan.scenes.length - 1, Math.floor(f / SCENE_FRAMES)))
        if (stopAt.current != null && f >= stopAt.current) { stopAt.current = null; p.pause() }
      }
      const onPlay = () => onPlaying?.(true)
      const onPause = () => onPlaying?.(false)
      p.addEventListener('frameupdate', onFrame)
      p.addEventListener('play', onPlay)
      p.addEventListener('pause', onPause)
      p.addEventListener('ended', onPause)
      return () => {
        p.removeEventListener('frameupdate', onFrame)
        p.removeEventListener('play', onPlay)
        p.removeEventListener('pause', onPause)
        p.removeEventListener('ended', onPause)
      }
    }, [plan.scenes.length, onPlaying, onScene])

    return (
      <Player
        ref={player}
        component={PreviewComp}
        inputProps={props}
        durationInFrames={total}
        compositionWidth={KIT_W}
        compositionHeight={KIT_H}
        fps={KIT_FPS}
        initialFrame={SETTLED_AT}
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        acknowledgeRemotionLicense
        style={{ width: '100%', aspectRatio: '16 / 9', display: 'block' }}
      />
    )
  },
)

export default LookPreview
