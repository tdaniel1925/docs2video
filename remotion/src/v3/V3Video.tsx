import { AbsoluteFill, Series, Audio, staticFile, useCurrentFrame, interpolate, Easing, spring, useVideoConfig } from 'remotion'
import type { V3Props, V3Scene } from './schema'
import { FullScreenScene, type Placement } from './FullScreenScene'
import { LogoWatermark, type LogoSource } from '../components/infographic/BrandLogo'
import { FONTS, type Theme } from '../tokens'

/** Auto-vary placement across scenes so the video never feels one-dimensional. */
const PLACEMENT_CYCLE: Placement[] = ['center', 'left', 'bottom', 'right', 'bottom', 'left', 'center', 'right', 'bottom', 'center']
const KEN: ('in' | 'left' | 'right')[] = ['in', 'right', 'in', 'left', 'in', 'right', 'in', 'left', 'in', 'in']

/** Per-scene in/out transition that VARIES by index so cuts feel EDITED, not a
 *  slideshow: cycles fade, push-up, whip-pan (with motion blur), zoom-blur, and
 *  flash-to-white. Punchier than a plain crossfade — gives the cut energy. */
const Transition: React.FC<{ d: number; variant: number; children: React.ReactNode }> = ({ d, variant, children }) => {
  const f = useCurrentFrame()
  const IN = 14, OUT = 12
  const inP = interpolate(f, [0, IN], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const outP = interpolate(f, [d - OUT, d], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) })
  const opacity = inP * (1 - outP)
  let transform = ''
  let filter = ''
  let flash = 0
  const v = variant % 5
  if (v === 1) transform = `translateY(${(1 - inP) * 48 + outP * -34}px)`        // push up
  else if (v === 2) { // whip-pan: fast slide + horizontal motion blur on the edges
    transform = `translateX(${(1 - inP) * 90 + outP * -90}px)`
    filter = `blur(${((1 - inP) + outP) * 7}px)`
  } else if (v === 3) { const s = 1.08 - inP * 0.08 + outP * 0.05; transform = `scale(${s})`; filter = `blur(${(1 - inP) * 12 + outP * 9}px)` } // zoom-blur
  else if (v === 4) { flash = Math.max(0, 1 - inP * 1.6) }                       // flash-to-white on entry
  // v===0 = pure fade
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity, transform, filter }}>{children}</AbsoluteFill>
      {flash > 0 ? <AbsoluteFill style={{ background: '#FFFFFF', opacity: flash * 0.85, pointerEvents: 'none' }} /> : null}
    </AbsoluteFill>
  )
}

/** Branded cold-open: brand name (or first title) springs up on black with an
 *  accent rule, holds, then a quick fade to the first scene. ~2s of premium tone. */
const COLD_OPEN_FRAMES = 54
const ColdOpen: React.FC<{ text: string; theme: Theme & { logo?: LogoSource } }> = ({ text, theme }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = spring({ frame: f - 4, fps, config: { damping: 16, stiffness: 110, mass: 0.9 } })
  const rule = interpolate(f, [10, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const out = interpolate(f, [COLD_OPEN_FRAMES - 10, COLD_OPEN_FRAMES], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const accent = theme.accents[1] ?? theme.accents[0]
  return (
    <AbsoluteFill style={{ background: '#05070C', alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, opacity: Math.min(1, rise * 1.4), transform: `translateY(${(1 - rise) * 28}px)` }}>
        <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: 96, color: '#FFFFFF', letterSpacing: '-0.02em', textAlign: 'center', maxWidth: 1400, lineHeight: 1 }}>
          {text}
        </div>
        <div style={{ height: 4, width: 220 * rule, borderRadius: 2, background: accent, boxShadow: `0 0 18px ${accent}` }} />
      </div>
    </AbsoluteFill>
  )
}

export const V3Video: React.FC<V3Props & { logoChip?: boolean }> = ({ theme, scenes, music, logo, logoChip, brandName }) => {
  const total = scenes.reduce((s, sc) => s + sc.durationInFrames, 0) + COLD_OPEN_FRAMES
  const openText = brandName || scenes[0]?.title || ''
  return (
    <AbsoluteFill>
      <Series>
        {openText ? (
          <Series.Sequence durationInFrames={COLD_OPEN_FRAMES}>
            <ColdOpen text={openText} theme={theme} />
          </Series.Sequence>
        ) : null}
        {scenes.map((sc: V3Scene, i) => {
          let placement = sc.placement ?? PLACEMENT_CYCLE[i % PLACEMENT_CYCLE.length]
          // A lower-third lives bottom-left, so keep the title OUT of the bottom
          // zone on metric scenes (otherwise they collide).
          if (sc.metric && (placement === 'bottom' || placement === 'left')) placement = 'top'
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
                  metric={sc.metric}
                  metrics={sc.metrics}
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
  const hasOpen = !!(props.brandName || props.scenes[0]?.title)
  return props.scenes.reduce((s, sc) => s + sc.durationInFrames, 0) + (hasOpen ? COLD_OPEN_FRAMES : 0)
}
