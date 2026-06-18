import { AbsoluteFill, useCurrentFrame } from 'remotion'
import type { Theme } from './tokens'
import { drift } from './helpers'

/**
 * Rich corporate background: deep ground + faint diagonal geometric facets +
 * a drifting accent glow + subtle grid. Far less flat than a plain gradient.
 */
export const PremiumBackground: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame()
  const gx = 78 + drift(frame, 320, 6)
  const gy = 20 + drift(frame, 380, 5)
  const a0 = theme.accents[0]
  const dark = theme.mode === 'dark'

  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
      {/* diagonal facet panels for depth */}
      <AbsoluteFill style={{ background: `linear-gradient(120deg, ${theme.inkSoft} 0%, ${theme.ink} 45%, ${theme.inkSoft} 100%)` }} />
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '70%', height: '140%', background: theme.inkSoft, transform: 'skewX(-12deg)', opacity: dark ? 0.5 : 0.6 }} />
      {/* faint grid */}
      <AbsoluteFill style={{
        backgroundImage: `linear-gradient(${theme.glassEdge} 1px, transparent 1px), linear-gradient(90deg, ${theme.glassEdge} 1px, transparent 1px)`,
        backgroundSize: '64px 64px', opacity: dark ? 0.25 : 0.4,
      }} />
      {/* drifting accent glow */}
      <AbsoluteFill style={{ background: `radial-gradient(50% 55% at ${gx}% ${gy}%, ${a0}33, transparent 70%)`, filter: 'blur(6px)' }} />
      {/* vignette */}
      <AbsoluteFill style={{ background: `radial-gradient(130% 130% at 50% 50%, transparent 55%, rgba(0,0,0,${dark ? 0.5 : 0.12}) 100%)` }} />
    </AbsoluteFill>
  )
}
