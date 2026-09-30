import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { Fit } from '../../lib/fit'
import { InfographicBackground } from './InfographicBackground'
import { HeroMetric } from './HeroMetric'
import { KPIGrid } from './KPIGrid'
import { BarChart } from './BarChart'
import { IconMetric } from './IconMetric'
import { InfoCard } from './InfoCard'
import { ProgressTimeline } from './ProgressTimeline'
import { Stage, type Reserve } from './Stage'
import { pickKind, glyphFor, type SceneContent } from './layoutPicker'

/** The eyebrow line sits at this y; content keeps clear of it. */
const EYEBROW_TOP = 90
const EYEBROW_CLEAR = 150

/**
 * Renders ONE infographic scene: shared background + an eyebrow (the title acts
 * as the heading inside data components), then the component the layout-picker
 * chose for this scene's data shape. This is the unit the full InfographicVideo
 * maps over — the auto-theme equivalent of FullScreenScene.
 *
 * `reserve` is the space the video keeps clear over this scene (the intro brand
 * lockup at the top of the first scene, the outro brand at the bottom of the
 * last, the corner logo in between). Every layout sits on a <Stage> that stays
 * inside it, and every line of text is a <Fit>.
 */
export const InfographicScene: React.FC<{ scene: SceneContent; theme: Theme; bgImage?: string; reserve?: Reserve }> = ({ scene: raw, theme, bgImage, reserve }) => {
  const frame = useCurrentFrame()
  const scene = withHeroMetric(raw)
  const kind = pickKind(scene)
  const ebP = settleProgress(frame, 2)

  const Eyebrow = scene.eyebrow ? (
    <div style={{
      position: 'absolute', top: EYEBROW_TOP, left: 150, right: 150,
      opacity: ebP, transform: `translateY(${(1 - ebP) * 10}px)`,
    }}>
      <Fit max={TYPE.label * 0.9} min={16} lines={1} style={{
        fontFamily: FONTS.body, fontWeight: 800, letterSpacing: '0.32em', lineHeight: 1.2,
        color: theme.accents[0], textTransform: 'uppercase', textAlign: 'center',
      }}>
        {scene.eyebrow}
      </Fit>
    </div>
  ) : null

  const clear: Reserve = {
    top: Math.max(reserve?.top ?? 0, scene.eyebrow ? EYEBROW_CLEAR : 0),
    bottom: reserve?.bottom,
  }

  return (
    <AbsoluteFill>
      <InfographicBackground theme={theme} image={bgImage} />
      {Eyebrow}
      {renderKind(kind, scene, theme, clear)}
    </AbsoluteFill>
  )
}

/**
 * The app promotes one scene per video to a single giant "hero" figure and
 * sends it as `heroMetric` INSTEAD of `metrics` (app/_lib/v3-render.ts). This
 * engine only reads `metrics`, so that scene showed its title and nothing else —
 * the figure the video was built around went missing. Treat it as the one
 * metric it is.
 */
type HeroMetricIn = { value?: string; label?: string; caption?: string }
function withHeroMetric(s: SceneContent): SceneContent {
  const hm = (s as SceneContent & { heroMetric?: HeroMetricIn }).heroMetric
  if ((s.metrics && s.metrics.length) || !hm || !hm.value) return s
  return { ...s, metrics: [{ label: hm.caption || hm.label || s.title, value: hm.value }] }
}

function renderKind(kind: ReturnType<typeof pickKind>, s: SceneContent, theme: Theme, reserve: Reserve) {
  const metrics = s.metrics ?? []
  switch (kind) {
    case 'hero': {
      const m = metrics[0]
      return <HeroMetric label={m?.label ?? s.title} value={m?.value ?? ''} support={s.body} theme={theme} reserve={reserve} />
    }
    case 'kpis':
      return <KPIGrid theme={theme} heading={s.title} reserve={reserve} items={metrics.map((m) => ({ label: m.label, value: m.value, highlight: m.highlight }))} />
    case 'barchart':
      return <BarChart theme={theme} heading={s.title} reserve={reserve} bars={metrics.map((m) => ({ label: m.label, value: m.value, highlight: m.highlight }))} />
    case 'iconrow': {
      const row = metrics.slice(0, 4)
      return (
        <Stage width={1620} padX={120} reserve={reserve}>
          <Heading text={s.title} theme={theme} />
          {/* minmax(0, 1fr), not 1fr: a plain 1fr column grows to its longest word. */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, row.length)}, minmax(0, 1fr))`, gap: 48, width: '100%', maxWidth: 1620 }}>
            {row.map((m, i) => (
              <IconMetric key={i} icon={m.icon ?? glyphFor(m.label)} value={m.value} label={m.label} theme={theme} accent={theme.accents[i % theme.accents.length]} startFrame={6 + i * 4} />
            ))}
          </div>
        </Stage>
      )
    }
    case 'timeline':
      return <ProgressTimeline theme={theme} heading={s.title} reserve={reserve} steps={(s.steps ?? []).map((st) => ({ ...st, icon: st.icon ?? glyphFor(st.label) }))} />
    case 'cards':
      return <InfoCard theme={theme} heading={s.title} reserve={reserve} items={(s.cards ?? []).map((c) => ({ ...c, icon: c.icon ?? glyphFor(c.title) }))} />
    case 'statement':
    default:
      return (
        <Stage width={1500} padX={200} reserve={reserve}>
          <Heading text={s.title} theme={theme} big />
          {s.body ? <Body text={s.body} theme={theme} /> : null}
        </Stage>
      )
  }
}

const Heading: React.FC<{ text: string; theme: Theme; big?: boolean }> = ({ text, theme, big }) => {
  const frame = useCurrentFrame()
  const p = settleProgress(frame, 4)
  const max = big ? TYPE.title * 1.15 : TYPE.title * 0.62
  return (
    <div style={{
      width: '100%', maxWidth: 1500, marginBottom: big ? 36 : 54,
      opacity: p, transform: `translateY(${(1 - p) * 16}px)`,
    }}>
      <Fit max={max} min={big ? 48 : 36} lines={big ? 4 : 3} style={{
        fontFamily: FONTS.display, fontWeight: 900,
        color: theme.textPrimary, textAlign: 'center', lineHeight: 1.04,
      }}>
        {text}
      </Fit>
    </div>
  )
}

const Body: React.FC<{ text: string; theme: Theme }> = ({ text, theme }) => {
  const frame = useCurrentFrame()
  const p = settleProgress(frame, 24)
  return (
    <div style={{ width: '100%', maxWidth: 1200, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      <Fit max={TYPE.subhead} min={26} lines={5} style={{
        fontFamily: FONTS.body, fontWeight: 500, color: theme.textMuted, textAlign: 'center', lineHeight: 1.4,
      }}>
        {text}
      </Fit>
    </div>
  )
}
