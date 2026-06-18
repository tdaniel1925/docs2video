import { AbsoluteFill } from 'remotion'
import { ALL_THEMES, FONTS, TYPE, type Theme } from './tokens'
import { PillarsScene } from './scenes/PillarsScene'
import type { Pillar } from './schema'

const PILLARS: Pillar[] = [
  { accentIndex: 0, label: 'Coverage', title: 'Protected', subhead: 'Comprehensive plans built around you.', icon: 'shield' },
  { accentIndex: 1, label: 'Growth', title: 'Cash Value', subhead: 'Builds steadily over the years.', icon: 'chart' },
  { accentIndex: 2, label: 'Simple', title: 'Clear Terms', subhead: 'No jargon, no surprises.', icon: 'spark' },
]

/** One frame that shows a theme's full look: title, glass cards, accents, text,
 *  on the theme ground. Rendered as a still per theme for side-by-side preview. */
export const ThemePreview: React.FC<{ themeIndex: number }> = ({ themeIndex }) => {
  const theme: Theme = ALL_THEMES[themeIndex] ?? ALL_THEMES[0]
  return (
    <AbsoluteFill>
      <PillarsScene title="Why families choose us" pillars={PILLARS} theme={theme} durationInFrames={120} />
      {/* theme name tag, bottom-left */}
      <div style={{ position: 'absolute', bottom: 40, left: 56, fontFamily: FONTS.body, fontWeight: 700, fontSize: TYPE.label, color: theme.accents[0], letterSpacing: 2, textTransform: 'uppercase', opacity: 0.9 }}>
        {theme.name}
      </div>
    </AbsoluteFill>
  )
}

export const THEME_COUNT = ALL_THEMES.length
