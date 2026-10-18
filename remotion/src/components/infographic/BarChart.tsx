import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { Fit } from '../../lib/fit'
import { parseMetric, renderMetric } from './format'
import { Stage, type Reserve } from './Stage'

export type Bar = { label: string; value: string; highlight?: boolean }

/**
 * Animated vertical bar chart. Bars grow from 0 to a height proportional to
 * their numeric value (parsed from "$176,204" etc.), staggered. The value label
 * counts up above each bar. Turns a set of comparable metrics into an actual
 * GRAPH instead of cards — the thing that makes a scene read as "infographic".
 *
 * Used when 2–5 metrics share a comparable unit (all $, all %, all counts).
 *
 * Each bar's column is at most 240px wide, and its value and label are <Fit>s
 * sized to that column: five "$1,234,567,890.00" values used to run into each
 * other on one line. The chart row grows (never overflows) if a value or label
 * needs a second line, and the scene sits on a <Stage>.
 */
export const BarChart: React.FC<{
  bars: Bar[]
  theme: Theme
  heading?: string
  /** Space to keep clear at the top/bottom of the frame (eyebrow, logo). */
  reserve?: Reserve
}> = ({ bars, theme, heading, reserve }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const list = bars.slice(0, 5)
  const headP = settleProgress(frame, 2)

  const nums = list.map((b) => parseMetric(b.value).number ?? 0)
  const max = Math.max(...nums, 1)
  const CHART_H = 480

  return (
    <Stage width={1500} padX={150} reserve={reserve}>
      {heading ? (
        <div style={{ width: '100%', maxWidth: 1500, marginBottom: 64, opacity: headP, transform: `translateY(${(1 - headP) * 12}px)` }}>
          <Fit max={TYPE.title * 0.6} min={36} lines={3} style={{
            fontFamily: FONTS.display, fontWeight: 800,
            color: theme.textPrimary, textAlign: 'center', lineHeight: 1.05,
          }}>
            {heading}
          </Fit>
        </div>
      ) : null}

      {/* minHeight, not height: a two-line value or label makes the row taller
          instead of pushing the tallest bar's value up into the heading. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 56, minHeight: CHART_H + 140, width: '100%', maxWidth: 1500 }}>
        {list.map((b, i) => {
          const start = 10 + i * Math.round(0.12 * fps)
          const grow = spring({ frame: frame - start, fps, config: { damping: 18, stiffness: 90, mass: 1 } })
          const targetH = (nums[i] / max) * CHART_H
          const h = targetH * grow
          const accent = theme.accents[i % theme.accents.length]
          const countP = interpolate(frame, [start, start + Math.round(1.1 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          const parsed = parseMetric(b.value)
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, flex: 1, maxWidth: 240, minWidth: 0 }}>
              {/* value label (counts up; sized by the final value so it doesn't jump) */}
              <div style={{ width: '100%', opacity: Math.min(1, grow * 1.5) }}>
                <Fit max={TYPE.cardTitle * 0.8} min={22} lines={2} sizeFor={renderMetric(parsed, 1)} style={{
                  fontFamily: FONTS.display, fontWeight: 900, color: theme.textPrimary,
                  fontVariantNumeric: 'tabular-nums', textAlign: 'center', lineHeight: 1.15,
                }}>
                  {renderMetric(parsed, countP)}
                </Fit>
              </div>
              {/* bar */}
              <div style={{
                width: '100%', height: Math.max(4, h), borderRadius: 8,
                background: `linear-gradient(180deg, ${accent}, ${hexA(accent, 0.55)})`,
                boxShadow: b.highlight ? `0 0 40px ${hexA(accent, 0.5)}` : `0 0 18px ${hexA(accent, 0.25)}`,
                border: b.highlight ? `1px solid ${hexA(accent, 0.7)}` : 'none',
              }} />
              {/* label */}
              <div style={{ width: '100%', minHeight: 48 }}>
                <Fit max={TYPE.label * 0.74} min={16} lines={2} style={{
                  fontFamily: FONTS.body, fontWeight: 700, letterSpacing: '0.1em', color: theme.textMuted,
                  textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2,
                }}>
                  {b.label}
                </Fit>
              </div>
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
