import { AbsoluteFill, Series, Audio, staticFile } from 'remotion'
import { z } from 'zod'
import { type Theme, MODERN_FINTECH } from '../../tokens'
import { themeSchema } from '../../schema'
import { InfographicScene } from './InfographicScene'
import type { SceneContent } from './layoutPicker'

/** Per-scene schema for the infographic pipeline output. */
const metricSchema = z.object({ label: z.string(), value: z.string(), highlight: z.boolean().optional(), icon: z.string().optional() })
const stepSchema = z.object({ label: z.string(), sub: z.string().optional(), icon: z.string().optional() })
const cardSchema = z.object({ title: z.string(), body: z.string().optional(), icon: z.string().optional() })

export const infoSceneSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  kind: z.enum(['hero', 'kpis', 'iconrow', 'timeline', 'cards', 'statement']).optional(),
  metrics: z.array(metricSchema).optional(),
  steps: z.array(stepSchema).optional(),
  cards: z.array(cardSchema).optional(),
  audio: z.string().optional(),
  durationInFrames: z.number(),
})

export const infographicSchema = z.object({
  theme: themeSchema,
  brandName: z.string().optional(),
  logo: z.string().optional(),
  scenes: z.array(infoSceneSchema).min(1),
})
export type InfographicProps = z.infer<typeof infographicSchema>

export function infoTotal(props: InfographicProps): number {
  return props.scenes.reduce((a, s) => a + s.durationInFrames, 0)
}

export const InfographicVideo: React.FC<InfographicProps> = ({ theme, scenes }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink }}>
      <Series>
        {scenes.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={s.durationInFrames}>
            <InfographicScene scene={s as SceneContent} theme={theme as Theme} />
            {s.audio ? <Audio src={staticFile(s.audio)} /> : null}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  )
}

/** Demo fallback when no infographic.json exists yet. */
export const INFO_DEFAULT: InfographicProps = {
  theme: MODERN_FINTECH,
  scenes: [{ title: 'Run the infographic generator first', durationInFrames: 90 }],
}
