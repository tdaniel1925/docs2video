import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from 'remotion'
import type { Theme } from './tokens'
import { ThemedBackground } from './AuroraBackground'

/**
 * Layered scene background:
 *   1. Gemini concrete image (if provided) with slow Ken Burns zoom/pan
 *   2. dark scrim so overlaid text/cards stay readable
 *   3. the themed mesh glow on top (keeps the house look + brand color depth)
 * Falls back to just the themed mesh glow when no image is supplied.
 */
export const SceneBackground: React.FC<{
  theme: Theme
  image?: string
  durationInFrames: number
}> = ({ theme, image, durationInFrames }) => {
  const frame = useCurrentFrame()

  if (!image) {
    return <ThemedBackground theme={theme} />
  }

  // Ken Burns: slow zoom 1.06→1.14 + gentle drift across the scene.
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const scale = 1.06 + t * 0.08
  const tx = interpolate(t, [0, 1], [-1.5, 1.5])
  const ty = interpolate(t, [0, 1], [1, -1])

  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${scale}) translate(${tx}%, ${ty}%)` }}>
        <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      {/* dark scrim — guarantees text sits on a dark base no matter what the
          image looks like (so light text is always readable, never light-on-light).
          Strong in the center where titles/cards live, lighter at the edges. */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(110% 110% at 50% 50%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.40) 100%)',
        }}
      />
      {/* themed glow on top for brand-color depth + house look (no solid ground) */}
      <AbsoluteFill style={{ opacity: 0.55 }}>
        <ThemedBackground theme={theme} glowOnly />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
