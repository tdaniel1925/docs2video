import { AbsoluteFill, Series, Audio, staticFile, useCurrentFrame, interpolate } from 'remotion'
import { z } from 'zod'
import { editorialFromBrand, type EditorialTheme } from './theme'
import { pickArchetype, type EditorialScene } from './archetype'
import { CoverScene, LedeScene, GridScene, PullQuoteScene, StatScene, ListScene, DecisionScene } from './EditorialScenes'

const itemSchema = z.object({ title: z.string(), detail: z.string().optional() })
const metricSchema = z.object({ label: z.string(), value: z.string() })

export const editorialSceneSchema = z.object({
  archetype: z.enum(['cover', 'lede', 'grid', 'pullquote', 'stat', 'list', 'decision']).optional(),
  kicker: z.string().optional(),
  title: z.string(),
  dek: z.string().optional(),
  body: z.string().optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
  items: z.array(itemSchema).optional(),
  metrics: z.array(metricSchema).optional(),
  image: z.string().optional(),
  audio: z.string().optional(),
  durationInFrames: z.number(),
})

export const editorialSchema = z.object({
  /** Publication masthead — the brand name (e.g. "ACME" or "EPOCH"). */
  masthead: z.string().default('EPOCH'),
  /** Running title shown in the folio header. */
  runningTitle: z.string().optional(),
  /** Brand primary color → editorial accent (frame, rules, kickers). */
  brandColor: z.string().optional(),
  music: z.string().optional(),
  scenes: z.array(editorialSceneSchema).min(1),
})
export type EditorialProps = z.infer<typeof editorialSchema>

export function editorialTotal(p: EditorialProps): number {
  return p.scenes.reduce((a, s) => a + s.durationInFrames, 0)
}

/** Cross-fade between pages (a "page turn" feel — restrained, not flashy). */
const PageTurn: React.FC<{ d: number; children: React.ReactNode }> = ({ d, children }) => {
  const f = useCurrentFrame()
  const inP = interpolate(f, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const outP = interpolate(f, [d - 8, d], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: inP * (1 - outP) }}>{children}</AbsoluteFill>
}

export const EditorialVideo: React.FC<EditorialProps> = ({ masthead, runningTitle, brandColor, music, scenes }) => {
  const theme: EditorialTheme = editorialFromBrand(brandColor)
  const running = (runningTitle || scenes[0]?.title || '').toUpperCase().slice(0, 32)
  const total = scenes.reduce((a, s) => a + s.durationInFrames, 0)

  const render = (s: EditorialScene, i: number) => {
    const a = pickArchetype(s, i, scenes.length)
    const props = { scene: s, theme, masthead, runningTitle: running, page: i + 1 }
    switch (a) {
      case 'cover': return <CoverScene {...props} />
      case 'lede': return <LedeScene {...props} />
      case 'grid': return <GridScene {...props} />
      case 'pullquote': return <PullQuoteScene {...props} />
      case 'stat': return <StatScene {...props} />
      case 'list': return <ListScene {...props} />
      case 'decision': return <DecisionScene {...props} />
      default: return <LedeScene {...props} />
    }
  }

  return (
    <AbsoluteFill style={{ background: theme.paper }}>
      <Series>
        {scenes.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={s.durationInFrames}>
            <PageTurn d={s.durationInFrames}>{render(s as EditorialScene, i)}</PageTurn>
            {s.audio ? <Audio src={staticFile(s.audio)} /> : null}
          </Series.Sequence>
        ))}
      </Series>
      {music ? (
        <Audio src={staticFile(music)} volume={(f) => interpolate(f, [0, 30, total - 45, total], [0, 0.09, 0.09, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      ) : null}
    </AbsoluteFill>
  )
}

export const EDITORIAL_DEFAULT: EditorialProps = {
  masthead: 'EPOCH',
  scenes: [{ archetype: 'cover', title: 'Run the editorial generator first', durationInFrames: 120 }],
}
