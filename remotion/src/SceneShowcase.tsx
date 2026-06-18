import { AbsoluteFill, Series, useCurrentFrame, interpolate } from 'remotion'
import { FPS, IHOSTPOKER, type Theme } from './tokens'
import { BarChartScene } from './scenes/BarChartScene'
import { DonutScene } from './scenes/DonutScene'
import { ComparisonScene } from './scenes/ComparisonScene'
import { KpiScene } from './scenes/KpiScene'

const D = 4 * FPS // 4s per scene

const Faded: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 8, D - 8, D], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

/** Showcase of the data/chart scene types (no audio) to judge variety. */
export const SceneShowcase: React.FC<{ theme: Theme }> = ({ theme }) => {
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={D}>
          <Faded><BarChartScene theme={theme} bgImage="bg-stat.png" durationInFrames={D} title="Bookings by quarter" unit="" data={[{ label: 'Q1', value: 320 }, { label: 'Q2', value: 540 }, { label: 'Q3', value: 610 }, { label: 'Q4', value: 880 }]} /></Faded>
        </Series.Sequence>
        <Series.Sequence durationInFrames={D}>
          <Faded><DonutScene theme={theme} bgImage="bg-pillars.png" durationInFrames={D} title="Guest satisfaction" percent={96} centerLabel="would book again" accentIndex={1} /></Faded>
        </Series.Sequence>
        <Series.Sequence durationInFrames={D}>
          <Faded><ComparisonScene theme={theme} bgImage="bg-bullets.png" durationInFrames={D} title="The difference" left={{ label: 'DIY party', value: '😬' }} right={{ label: 'iHostPoker', value: '🎉' }} /></Faded>
        </Series.Sequence>
        <Series.Sequence durationInFrames={D}>
          <Faded><KpiScene theme={theme} bgImage="bg-cover.png" durationInFrames={D} title="By the numbers" kpis={[{ value: '12+', label: 'Games' }, { value: '10k+', label: 'Parties' }, { value: '20+', label: 'Years' }, { value: '5★', label: 'Rated' }]} /></Faded>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  )
}

export const SHOWCASE_FRAMES = D * 4
export const SHOWCASE_THEME = IHOSTPOKER
