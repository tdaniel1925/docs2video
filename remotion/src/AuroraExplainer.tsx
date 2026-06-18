import { AbsoluteFill, Series, Audio, Img, staticFile, useCurrentFrame, interpolate } from 'remotion'
import { FPS, SCENE_SECONDS } from './tokens'
import type { ExplainerProps } from './schema'
import { CoverScene } from './scenes/CoverScene'
import { PillarsScene } from './scenes/PillarsScene'
import { StatScene } from './scenes/StatScene'
import { BulletsScene } from './scenes/BulletsScene'
import { ClosingScene } from './scenes/ClosingScene'

const sec = (s: number) => Math.max(1, Math.round(s * FPS))

const Faded: React.FC<{ durationInFrames: number; children: React.ReactNode }> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame()
  const fade = 8
  const opacity = interpolate(frame, [0, fade, durationInFrames - fade, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

type SceneKey = 'cover' | 'pillars' | 'stat' | 'bullets' | 'closing'

export const AuroraExplainer: React.FC<ExplainerProps> = (props) => {
  const { theme, narration, sceneDurations, backgrounds } = props
  const dur = (k: SceneKey) => sec(sceneDurations?.[k] ?? SCENE_SECONDS[k])
  const order: SceneKey[] = ['cover', 'pillars', 'stat', 'bullets', 'closing']

  // Scene node is a function of (duration) so backgrounds can Ken-Burns over the
  // exact scene length.
  const renderScene = (k: SceneKey, d: number): React.ReactNode => {
    const bg = backgrounds?.[k]
    switch (k) {
      case 'cover': return <CoverScene data={props.cover} brandName={props.brandName} theme={theme} bgImage={bg} durationInFrames={d} />
      case 'pillars': return <PillarsScene title={props.pillarsTitle} pillars={props.pillars} theme={theme} bgImage={bg} durationInFrames={d} />
      case 'stat': return <StatScene data={props.stat} theme={theme} bgImage={bg} durationInFrames={d} />
      case 'bullets': return <BulletsScene data={props.bullets} theme={theme} bgImage={bg} durationInFrames={d} />
      case 'closing': return <ClosingScene data={props.closing} brandName={props.brandName} theme={theme} bgImage={bg} durationInFrames={d} />
    }
  }

  const total = order.reduce((s, k) => s + dur(k), 0)

  return (
    <AbsoluteFill>
      <Series>
        {order.map((k) => {
          const d = dur(k)
          const a = narration?.[k]
          return (
            <Series.Sequence key={k} durationInFrames={d}>
              <Faded durationInFrames={d}>{renderScene(k, d)}</Faded>
              {a ? <Audio src={staticFile(a)} /> : null}
            </Series.Sequence>
          )
        })}
      </Series>

      {/* Background music — low under the narration, gentle fade in/out. */}
      {props.music ? (
        <Audio src={staticFile(props.music)} volume={(f) =>
          interpolate(f, [0, 30, total - 45, total], [0, 0.12, 0.12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        } />
      ) : null}

      {/* Persistent small brand logo, bottom-right. */}
      {props.logo ? (
        <Img src={staticFile(props.logo)} style={{ position: 'absolute', bottom: 44, right: 56, height: 56, opacity: 0.92, objectFit: 'contain' }} />
      ) : null}
    </AbsoluteFill>
  )
}

/** Total frames — derived the same way the composition computes durations. */
export function totalFrames(props: ExplainerProps): number {
  const keys: SceneKey[] = ['cover', 'pillars', 'stat', 'bullets', 'closing']
  return keys.reduce((sum, k) => sum + sec(props.sceneDurations?.[k] ?? SCENE_SECONDS[k]), 0)
}
