'use client'

/*
 * ONE STORYBOARD PICTURE, drawn in the browser (2026-11-15). The film engine (FilmView, what KitVideo draws for a film plan) through
 * @remotion/player's Thumbnail: one still frame, the same frame the render service drew before
 * (render-service/kit.js previewKitJob: the scene's start + 150), in about a second and for $0.
 * A still only: no player, no play button, no motion (owner rule for the storyboard).
 * Loaded lazily (next/dynamic from Storyboard.tsx), so only the storyboard carries the video code.
 */
import { Component, useMemo, type ReactNode } from 'react'
import { Thumbnail } from '@remotion/player'
import { FilmView } from '../../../../../remotion/src/film/FilmView'
import { KIT_FPS, KIT_H, KIT_W, kitTimeline, sanitizeLook, type KitPlan, type KitTimeline } from '../../../../../remotion/src/kit/spec'

// The film engine's picture only: FilmView, not KitVideo. KitVideo also pulls in @remotion/transitions, whose
// copy on Vercel is a newer Remotion than the app's (the build failed on it, 2026-11-15); a still needs no sound or cuts.
const FilmStill = ({ plan, tl }: { plan: KitPlan; tl: KitTimeline }) => <FilmView plan={plan} tl={tl} />

class Guard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export default function StoryboardStill({ plan, label, fallback }: { plan: KitPlan; label: string; fallback: ReactNode }) {
  const job = useMemo(() => {
    const look = sanitizeLook(plan.look)
    const timeline = kitTimeline(plan.scenes, look.feel, { preview: true })
    const idx = Math.max(0, plan.scenes.findIndex((s) => s.type !== 'title' && s.type !== 'cta'))
    const frame = Math.min(timeline.total - 1, (timeline.starts[idx] ?? 0) + 150)
    return { props: { plan: { ...plan, look }, tl: timeline }, frame, total: timeline.total }
  }, [plan])
  return (
    <Guard fallback={fallback}>
      <div role="img" aria-label={label} style={{ position: 'absolute', inset: 0 }}>
        <Thumbnail component={FilmStill} inputProps={job.props} frameToDisplay={job.frame} durationInFrames={job.total}
          compositionWidth={KIT_W} compositionHeight={KIT_H} fps={KIT_FPS} style={{ width: '100%', height: '100%' }} />
      </div>
    </Guard>
  )
}
