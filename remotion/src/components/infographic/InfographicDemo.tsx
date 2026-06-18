import { AbsoluteFill, Series } from 'remotion'
import { MODERN_FINTECH } from '../../tokens'
import { InfographicBackground } from './InfographicBackground'
import { HeroMetric } from './HeroMetric'
import { KPIGrid } from './KPIGrid'
import { StatCounter } from './StatCounter'

/**
 * Showcase comp for the wave-1 infographic components, fed the REAL extracted
 * insurance metrics (the QoL Max Accumulator+ III doc) so we're reviewing the
 * exact thing the pipeline will produce. Three scenes:
 *   1. HeroMetric  — $176,204 death benefit
 *   2. KPIGrid     — four real pillars
 *   3. StatCounter row — quick figures
 */
const THEME = MODERN_FINTECH

const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill>
    <InfographicBackground theme={THEME} />
    {children}
  </AbsoluteFill>
)

export const INFO_DEMO_FRAMES = 90 * 3

export const InfographicDemo: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={90}>
        <Scene>
          <HeroMetric
            label="Initial Death Benefit"
            value="$176,204"
            support="Guaranteed protection from day one, for a 40-year-old client."
            theme={THEME}
          />
        </Scene>
      </Series.Sequence>

      <Series.Sequence durationInFrames={90}>
        <Scene>
          <KPIGrid
            theme={THEME}
            heading="The policy at a glance"
            items={[
              { label: 'Planned Premium', value: '$10,000/yr', highlight: true },
              { label: 'Death Benefit', value: '$176,204', highlight: true },
              { label: 'Premium Duration', value: '20 years' },
              { label: 'Guaranteed To Age', value: '67' },
            ]}
          />
        </Scene>
      </Series.Sequence>

      <Series.Sequence durationInFrames={90}>
        <Scene>
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 120px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48, width: '100%', maxWidth: 1600 }}>
              <Stat label="Client Age" value="40" theme={THEME} accent={THEME.accents[0]} />
              <Stat label="Index Allocation" value="100% S&P 500" theme={THEME} accent={THEME.accents[1]} />
              <Stat label="Target Premium" value="$3,018.18" theme={THEME} accent={THEME.accents[2]} />
            </div>
          </AbsoluteFill>
        </Scene>
      </Series.Sequence>
    </Series>
  )
}

const Stat: React.FC<{ label: string; value: string; theme: typeof THEME; accent: string }> = ({ label, value, theme, accent }) => {
  // Long, multi-word values (e.g. "100% S&P 500") get a smaller size so each
  // column stays balanced and nothing collides with its neighbour.
  const isLong = value.length > 6
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minWidth: 0, textAlign: 'center' }}>
      <StatCounter value={value} theme={theme} color={accent} fontSize={isLong ? 60 : 88} startFrame={6} />
      <div style={{ fontFamily: 'Inter', fontWeight: 700, letterSpacing: 4, fontSize: 24, color: theme.textMuted, textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}
