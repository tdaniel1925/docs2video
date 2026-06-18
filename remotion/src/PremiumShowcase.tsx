import { AbsoluteFill, Series, useCurrentFrame, interpolate } from 'remotion'
import { FPS, EXECUTIVE_LIGHT, BOLD_EDITORIAL, type Theme } from './tokens'
import { StatSplitScene } from './scenes/StatSplitScene'
import { BigStatementScene } from './scenes/BigStatementScene'

const D = 5 * FPS

const Faded: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame()
  const o = interpolate(f, [0, 10, D - 10, D], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
}

/** Premium composed-layout showcase (the "Who We Serve" caliber), themed for
 *  corporate/insurance. Shows two distinct rich layouts. */
export const PremiumShowcase: React.FC<{ theme: Theme }> = ({ theme }) => {
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={D}>
          <Faded>
            <StatSplitScene
              theme={theme} durationInFrames={D} index={4} total={8}
              title="Who We Serve" eyebrowWordAccent={1}
              stats={[
                { icon: 'shield', label: 'Districts Served', value: 200, suffix: '+' },
                { icon: 'chart', label: 'Employees Reached', value: 50000, suffix: '+' },
              ]}
              bullets={[
                { icon: 'spark', text: 'Free retirement education for all employees' },
                { icon: 'shield', text: 'Classified, certificated & administrative staff' },
                { icon: 'chart', text: 'Personalized planning sessions available' },
              ]}
              footer="Teacher's Pension" image="pp-1.png"
            />
          </Faded>
        </Series.Sequence>
        <Series.Sequence durationInFrames={D}>
          <Faded>
            <BigStatementScene
              theme={BOLD_EDITORIAL} durationInFrames={D} index={5} total={8}
              ghostNumber="98" title="The coverage you can count on" accentWordIndex={2}
              statValue={98} statSuffix="%" statLabel="of claims paid within 10 business days"
              footer="Acme Insurance" image="pp-2.png"
            />
          </Faded>
        </Series.Sequence>
        <Series.Sequence durationInFrames={D}>
          <Faded>
            <StatSplitScene
              theme={theme} durationInFrames={D} index={6} total={8}
              title="Protection for every family" eyebrowWordAccent={3}
              stats={[
                { icon: 'shield', label: 'Families Protected', value: 12000, suffix: '+' },
                { icon: 'chart', label: 'Avg. Payout Days', value: 7 },
              ]}
              bullets={[
                { icon: 'spark', text: 'Plans tailored to your stage of life' },
                { icon: 'shield', text: 'Guaranteed, transparent pricing' },
                { icon: 'chart', text: 'A real advisor, whenever you need one' },
              ]}
              footer="Acme Insurance" image="pp-3.png"
            />
          </Faded>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  )
}

export const PREMIUM_FRAMES = D * 3
export const PREMIUM_THEME = EXECUTIVE_LIGHT
