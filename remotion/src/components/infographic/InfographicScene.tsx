import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { InfographicBackground } from './InfographicBackground'
import { HeroMetric } from './HeroMetric'
import { KPIGrid } from './KPIGrid'
import { IconMetric } from './IconMetric'
import { InfoCard } from './InfoCard'
import { ProgressTimeline } from './ProgressTimeline'
import { pickKind, glyphFor, type SceneContent } from './layoutPicker'

/**
 * Renders ONE infographic scene: shared background + an eyebrow (the title acts
 * as the heading inside data components), then the component the layout-picker
 * chose for this scene's data shape. This is the unit the full InfographicVideo
 * maps over — the auto-theme equivalent of FullScreenScene.
 */
export const InfographicScene: React.FC<{ scene: SceneContent; theme: Theme }> = ({ scene, theme }) => {
  const frame = useCurrentFrame()
  const kind = pickKind(scene)
  const ebP = settleProgress(frame, 2)

  const Eyebrow = scene.eyebrow ? (
    <div style={{
      position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center',
      opacity: ebP, transform: `translateY(${(1 - ebP) * 10}px)`,
      fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 8, fontSize: TYPE.label * 0.9,
      color: theme.accents[0], textTransform: 'uppercase',
    }}>
      {scene.eyebrow}
    </div>
  ) : null

  return (
    <AbsoluteFill>
      <InfographicBackground theme={theme} />
      {Eyebrow}
      {renderKind(kind, scene, theme)}
    </AbsoluteFill>
  )
}

function renderKind(kind: ReturnType<typeof pickKind>, s: SceneContent, theme: Theme) {
  const metrics = s.metrics ?? []
  switch (kind) {
    case 'hero': {
      const m = metrics[0]
      return <HeroMetric label={m?.label ?? s.title} value={m?.value ?? ''} support={s.body} theme={theme} />
    }
    case 'kpis':
      return <KPIGrid theme={theme} heading={s.title} items={metrics.map((m) => ({ label: m.label, value: m.value, highlight: m.highlight }))} />
    case 'iconrow':
      return (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 120px', flexDirection: 'column' }}>
          <Heading text={s.title} theme={theme} />
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, 1fr)`, gap: 48, width: '100%', maxWidth: 1620 }}>
            {metrics.slice(0, 4).map((m, i) => (
              <IconMetric key={i} icon={m.icon ?? glyphFor(m.label)} value={m.value} label={m.label} theme={theme} accent={theme.accents[i % theme.accents.length]} startFrame={6 + i * 4} />
            ))}
          </div>
        </AbsoluteFill>
      )
    case 'timeline':
      return <ProgressTimeline theme={theme} heading={s.title} steps={(s.steps ?? []).map((st) => ({ ...st, icon: st.icon ?? glyphFor(st.label) }))} />
    case 'cards':
      return <InfoCard theme={theme} heading={s.title} items={(s.cards ?? []).map((c) => ({ ...c, icon: c.icon ?? glyphFor(c.title) }))} />
    case 'statement':
    default:
      return (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 200px' }}>
          <Heading text={s.title} theme={theme} big />
          {s.body ? <Body text={s.body} theme={theme} /> : null}
        </AbsoluteFill>
      )
  }
}

const Heading: React.FC<{ text: string; theme: Theme; big?: boolean }> = ({ text, theme, big }) => {
  const frame = useCurrentFrame()
  const p = settleProgress(frame, 4)
  return (
    <div style={{
      opacity: p, transform: `translateY(${(1 - p) * 16}px)`,
      fontFamily: FONTS.display, fontWeight: 900, fontSize: big ? TYPE.title * 1.15 : TYPE.title * 0.62,
      color: theme.textPrimary, marginBottom: big ? 36 : 54, textAlign: 'center', maxWidth: 1500, lineHeight: 1.04,
    }}>
      {text}
    </div>
  )
}

const Body: React.FC<{ text: string; theme: Theme }> = ({ text, theme }) => {
  const frame = useCurrentFrame()
  const p = settleProgress(frame, 24)
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)`, fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.subhead, color: theme.textMuted, textAlign: 'center', maxWidth: 1200, lineHeight: 1.4 }}>
      {text}
    </div>
  )
}
