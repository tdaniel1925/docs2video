import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { StatCounter } from './StatCounter'

export type KPI = { label: string; value: string; highlight?: boolean }

/**
 * A grid of metric cards (2–4), each a glass card with a counting value and a
 * label. Cards stagger in (spring rise + fade) and each value counts up. This is
 * the "four pillars" scene — PREMIUM / DEATH BENEFIT / CASH VALUE / RIDERS.
 * 1 item → single wide card; 2 → side by side; 3–4 → 2-up grid.
 */
export const KPIGrid: React.FC<{
  items: KPI[]
  theme: Theme
  heading?: string
}> = ({ items, theme, heading }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const list = items.slice(0, 4)
  const cols = list.length === 1 ? 1 : 2
  const headP = settleProgress(frame, 2)

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 150px', flexDirection: 'column' }}>
      {heading ? (
        <div style={{
          opacity: headP, transform: `translateY(${(1 - headP) * 12}px)`,
          fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title * 0.62,
          color: theme.textPrimary, marginBottom: 56, textAlign: 'center', maxWidth: 1500, lineHeight: 1.05,
        }}>
          {heading}
        </div>
      ) : null}

      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 40,
        width: '100%', maxWidth: cols === 1 ? 1000 : 1500,
      }}>
        {list.map((kpi, i) => {
          const start = 8 + i * Math.round(0.12 * fps)   // stagger
          const rise = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 110, mass: 0.9 } })
          const accent = theme.accents[i % theme.accents.length]
          const emphasized = kpi.highlight
          return (
            <div key={i} style={{
              opacity: Math.min(1, rise * 1.5),
              transform: `translateY(${(1 - rise) * 40}px)`,
              background: emphasized ? hexA(accent, theme.mode === 'dark' ? 0.12 : 0.08) : theme.glass,
              border: `1px solid ${emphasized ? hexA(accent, 0.55) : theme.glassEdge}`,
              borderRadius: 10,                            // house rule: max 10px
              padding: '46px 44px',
              display: 'flex', flexDirection: 'column', gap: 18,
              boxShadow: emphasized ? `0 0 60px ${hexA(accent, theme.mode === 'dark' ? 0.18 : 0.10)}` : 'none',
            }}>
              <div style={{
                fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 4, fontSize: TYPE.label * 0.86,
                color: accent, textTransform: 'uppercase',
              }}>
                {kpi.label}
              </div>
              <StatCounter
                value={kpi.value} theme={theme} color={theme.textPrimary}
                fontSize={list.length >= 3 ? TYPE.title * 0.72 : TYPE.title * 0.95}
                startFrame={start + 2} durationFrames={Math.round(1.1 * fps)}
              />
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
