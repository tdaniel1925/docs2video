import { useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { Glyph, type GlyphName } from './Glyph'
import { StatCounter } from './StatCounter'

/**
 * A glyph + counting value + label, in a column. The small unit that composes
 * into rows/grids (e.g. "shield · $176,204 · Death Benefit"). The glyph pops in
 * on a spring, the value counts up under it.
 */
export const IconMetric: React.FC<{
  icon: GlyphName
  value: string
  label: string
  theme: Theme
  accent?: string
  startFrame?: number
  valueSize?: number
}> = ({ icon, value, label, theme, accent, startFrame = 4, valueSize = TYPE.title * 0.7 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const a = accent ?? theme.accents[0]
  const pop = spring({ frame: frame - startFrame, fps, config: { damping: 13, stiffness: 130, mass: 0.7 } })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center', minWidth: 0 }}>
      <div style={{
        transform: `scale(${0.6 + pop * 0.4})`, opacity: Math.min(1, pop * 1.5),
        width: 96, height: 96, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hexA(a, theme.mode === 'dark' ? 0.12 : 0.08), border: `1px solid ${hexA(a, 0.4)}`,
      }}>
        <Glyph name={icon} size={52} color={a} />
      </div>
      <StatCounter value={value} theme={theme} color={theme.textPrimary} fontSize={valueSize} startFrame={startFrame + 4} />
      <div style={{ fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 3, fontSize: TYPE.label * 0.82, color: theme.textMuted, textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}

function hexA(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
