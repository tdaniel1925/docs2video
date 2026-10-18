import { useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { StatCounter } from './StatCounter'
import { Fit } from '../../lib/fit'
import { Stage, type Reserve } from './Stage'

export type KPI = { label: string; value: string; highlight?: boolean }

/**
 * A grid of metric cards (2–4), each a glass card with a counting value and a
 * label. Cards stagger in (spring rise + fade) and each value counts up. This is
 * the "four pillars" scene — PREMIUM / DEATH BENEFIT / CASH VALUE / RIDERS.
 * 1 item → single wide card; 2 → side by side; 3–4 → 2-up grid.
 *
 * Every word is in a <Fit> (shrinks to its card), and the whole scene sits on a
 * <Stage> (never off the top/bottom, never under the brand logo).
 */
export const KPIGrid: React.FC<{
  items: KPI[]
  theme: Theme
  heading?: string
  /** Space to keep clear at the top/bottom of the frame (eyebrow, logo). */
  reserve?: Reserve
}> = ({ items, theme, heading, reserve }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const list = items.slice(0, 4)
  const cols = list.length === 1 ? 1 : 2
  const headP = settleProgress(frame, 2)

  return (
    <Stage width={1500} padX={150} reserve={reserve}>
      {heading ? (
        <div style={{ width: '100%', maxWidth: 1500, marginBottom: 56, opacity: headP, transform: `translateY(${(1 - headP) * 12}px)` }}>
          <Fit max={TYPE.title * 0.62} min={36} lines={3} style={{
            fontFamily: FONTS.display, fontWeight: 800,
            color: theme.textPrimary, textAlign: 'center', lineHeight: 1.05,
          }}>
            {heading}
          </Fit>
        </div>
      ) : null}

      <div style={{
        // minmax(0, 1fr), not 1fr: a plain 1fr column grows to its longest
        // word, and a long value pushed its card off the frame.
        display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 40,
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
              padding: '46px 44px', minWidth: 0,
              display: 'flex', flexDirection: 'column', gap: 18,
              boxShadow: emphasized ? `0 0 60px ${hexA(accent, theme.mode === 'dark' ? 0.18 : 0.10)}` : 'none',
            }}>
              <Fit max={TYPE.label * 0.86} min={18} lines={3} style={{
                fontFamily: FONTS.body, fontWeight: 800, letterSpacing: '0.17em', lineHeight: 1.25,
                color: accent, textTransform: 'uppercase',
              }}>
                {kpi.label}
              </Fit>
              <StatCounter
                value={kpi.value} theme={theme} color={theme.textPrimary}
                fontSize={list.length >= 3 ? TYPE.title * 0.72 : TYPE.title * 0.95}
                startFrame={start + 2} durationFrames={Math.round(1.1 * fps)}
              />
            </div>
          )
        })}
      </div>
    </Stage>
  )
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
