import { AbsoluteFill, Series, Audio, staticFile, useCurrentFrame, interpolate } from 'remotion'
import type { V3Props, V3Scene } from './schema'
import { FullScreenScene, type Placement } from './FullScreenScene'
import { LogoWatermark, type LogoSource } from '../components/infographic/BrandLogo'

/** Auto-vary placement across scenes so the video never feels one-dimensional. */
const PLACEMENT_CYCLE: Placement[] = ['center', 'left', 'bottom', 'right', 'bottom', 'left', 'center', 'right', 'bottom', 'center']
const KEN: ('in' | 'left' | 'right')[] = ['in', 'right', 'in', 'left', 'in', 'right', 'in', 'left', 'in', 'in']

/** Per-scene in/out transition that VARIES by index so cuts feel edited, not a
 *  slideshow: cycles through fade, push-up, push-left, and zoom-blur. */
const Transition: React.FC<{ d: number; variant: number; children: React.ReactNode }> = ({ d, variant, children }) => {
  const f = useCurrentFrame()
  const IN = 14, OUT = 12
  const inP = interpolate(f, [0, IN], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outP = interpolate(f, [d - OUT, d], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const opacity = inP * (1 - outP)
  let transform = ''
  let filter = ''
  const v = variant % 4
  if (v === 1) transform = `translateY(${(1 - inP) * 40 + outP * -30}px)`        // push up
  else if (v === 2) transform = `translateX(${(1 - inP) * 50 + outP * -40}px)`   // push left
  else if (v === 3) { const s = 1.06 - inP * 0.06 + outP * 0.04; transform = `scale(${s})`; filter = `blur(${(1 - inP) * 10 + outP * 8}px)` } // zoom-blur
  // v===0 = pure fade
  return <AbsoluteFill style={{ opacity, transform, filter }}>{children}</AbsoluteFill>
}

export const V3Video: React.FC<V3Props & { logoChip?: boolean }> = ({ theme, scenes, music, logo, logoChip }) => {
  const total = scenes.reduce((s, sc) => s + sc.durationInFrames, 0)
  return (
    <AbsoluteFill>
      <Series>
        {scenes.map((sc: V3Scene, i) => {
          const placement = sc.placement ?? PLACEMENT_CYCLE[i % PLACEMENT_CYCLE.length]
          const kenBurns = sc.kenBurns ?? KEN[i % KEN.length]
          return (
            <Series.Sequence key={i} durationInFrames={sc.durationInFrames}>
              <Transition d={sc.durationInFrames} variant={i}>
                <FullScreenScene
                  image={sc.image}
                  placement={placement}
                  kenBurns={kenBurns}
                  eyebrow={sc.eyebrow}
                  title={sc.title}
                  body={sc.body}
                  accentWordIndex={sc.accentWordIndex}
                  theme={theme}
                  durationInFrames={sc.durationInFrames}
                />
              </Transition>
              {sc.audio ? <Audio src={staticFile(sc.audio)} /> : null}
            </Series.Sequence>
          )
        })}
      </Series>

      {music ? (
        <Audio src={staticFile(music)} volume={(f) => interpolate(f, [0, 30, total - 45, total], [0, 0.1, 0.1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      ) : null}
      {logo ? <LogoWatermark logo={logo as LogoSource} theme={theme} chip={logoChip} corner="bottom-right" height={50} /> : null}
    </AbsoluteFill>
  )
}

export function v3Total(props: V3Props): number {
  return props.scenes.reduce((s, sc) => s + sc.durationInFrames, 0)
}
