import { AbsoluteFill, Series, Audio, staticFile, useCurrentFrame, interpolate } from 'remotion'
import { z } from 'zod'
import { editorialFromBrand, explainerPageTheme, type EditorialTheme, type EditorialVariant } from './theme'
import { pickArchetype, type EditorialScene } from './archetype'
import { CoverScene, LedeScene, GridScene, PullQuoteScene, StatScene, ListScene, DecisionScene, TimelineScene, ChartScene, MatrixScene } from './EditorialScenes'

const itemSchema = z.object({ title: z.string(), detail: z.string().optional() })
const metricSchema = z.object({ label: z.string(), value: z.string() })

export const editorialSceneSchema = z.object({
  archetype: z.enum(['cover', 'lede', 'grid', 'pullquote', 'stat', 'list', 'decision', 'timeline', 'chart', 'matrix']).optional(),
  kicker: z.string().optional(),
  title: z.string(),
  dek: z.string().optional(),
  body: z.string().optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
  items: z.array(itemSchema).optional(),
  metrics: z.array(metricSchema).optional(),
  timeline: z.array(z.object({ when: z.string(), title: z.string(), detail: z.string().optional() })).optional(),
  chart: z.object({ kind: z.enum(['donut', 'bar']).optional(), segments: z.array(z.object({ label: z.string(), value: z.number() })) }).optional(),
  matrix: z.object({ columns: z.array(z.string()), rows: z.array(z.object({ label: z.string(), cells: z.array(z.string()) })) }).optional(),
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
  /** Which magazine look: 'time' (bold red) or 'editorial' (clean/warm). */
  variant: z.enum(['editorial', 'time', 'explainer']).optional(),
  music: z.string().optional(),
  /** Contact line for the closing decision page. */
  contactLine: z.string().optional(),
  /** Presenter (Person profile): portrait + name/role placed per style. */
  presenter: z.object({ name: z.string().optional(), role: z.string().optional(), photo: z.string().optional() }).optional(),
  presenterOnCover: z.boolean().optional(),
  presenterOnClosing: z.boolean().optional(),
  scenes: z.array(editorialSceneSchema).min(1),
})
export type EditorialProps = z.infer<typeof editorialSchema>

export function editorialTotal(p: EditorialProps): number {
  return p.scenes.reduce((a, s) => a + s.durationInFrames, 0)
}

/** Cross-fade between pages (a "page turn" feel — restrained, not flashy). */
const PageTurn: React.FC<{ d: number; isLast?: boolean; children: React.ReactNode }> = ({ d, isLast, children }) => {
  const f = useCurrentFrame()
  const inP = interpolate(f, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  // The last page HOLDS — no fade-out — so the closing decision page stays visible.
  const outP = isLast ? 0 : interpolate(f, [d - 8, d], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ opacity: inP * (1 - outP) }}>{children}</AbsoluteFill>
}

export const EditorialVideo: React.FC<EditorialProps> = ({ masthead, runningTitle, brandColor, variant, music, scenes, contactLine, presenter, presenterOnCover, presenterOnClosing }) => {
  const theme: EditorialTheme = editorialFromBrand(brandColor, (variant as EditorialVariant) || 'time')
  const running = (runningTitle || scenes[0]?.title || '').toUpperCase().slice(0, 32)
  const total = scenes.reduce((a, s) => a + s.durationInFrames, 0)

  const render = (s: EditorialScene, i: number) => {
    const a = pickArchetype(s, i, scenes.length)
    // EXPLAINER: each page gets its own bold full-bleed accent background with
    // contrast-flipped text/cards (matches the sample). The cover keeps the
    // navy-on-cream identity, so only content pages get a colored background.
    const pageTheme = theme.variant === 'explainer' && a !== 'cover'
      ? explainerPageTheme(theme, i + 1)
      : theme
    const props = { scene: s, theme: pageTheme, masthead, runningTitle: running, page: i + 1 }
    switch (a) {
      case 'cover': return <CoverScene {...props} presenter={presenterOnCover ? presenter : undefined} />
      case 'lede': return <LedeScene {...props} />
      case 'grid': return <GridScene {...props} />
      case 'pullquote': return <PullQuoteScene {...props} />
      case 'stat': return <StatScene {...props} />
      case 'list': return <ListScene {...props} />
      case 'timeline': return <TimelineScene {...props} />
      case 'chart': return <ChartScene {...props} />
      case 'matrix': return <MatrixScene {...props} />
      case 'decision': return <DecisionScene {...props} contactLine={contactLine} presenter={presenterOnClosing ? presenter : undefined} />
      default: return <LedeScene {...props} />
    }
  }

  return (
    <AbsoluteFill style={{ background: theme.paper }}>
      <Series>
        {scenes.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={s.durationInFrames}>
            <PageTurn d={s.durationInFrames} isLast={i === scenes.length - 1}>{render(s as EditorialScene, i)}</PageTurn>
            {s.audio ? <Audio src={staticFile(s.audio)} /> : null}
          </Series.Sequence>
        ))}
      </Series>
      {music ? (
        <Audio src={staticFile(music)} volume={(f) => interpolate(f, [0, 30, total - 45, total], [0, 0.036, 0.036, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      ) : null}
    </AbsoluteFill>
  )
}

export const EDITORIAL_DEFAULT: EditorialProps = {
  masthead: 'EPOCH',
  scenes: [{ archetype: 'cover', title: 'Run the editorial generator first', durationInFrames: 120 }],
}
