import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { parseMetric, renderMetric } from './format'

export type Bar = { label: string; value: string; highlight?: boolean }

/**
 * Animated vertical bar chart. Bars grow from 0 to a height proportional to
 * their numeric value (parsed from "$176,204" etc.), staggered. The value label
 * counts up above each bar. Turns a set of comparable metrics into an actual
 * GRAPH instead of cards — the thing that makes a scene read as "infographic".
 *
 * Used when 2–5 metrics share a comparable unit (all $, all %, all counts).
 */
export const BarChart: React.FC<{ bars: Bar[]; theme: Theme; heading?: string }> = ({ bars, theme, heading }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const list = bars.slice(0, 5)
  const headP = settleProgress(frame, 2)

  const nums = list.map((b) => parseMetric(b.value).number ?? 0)
  const max = Math.max(...nums, 1)
  const CHART_H = 480

  return (
    <AbsoluteFill style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 150px' }}>
      {heading ? (
        <div style={{
          opacity: headP, transform: `translateY(${(1 - headP) * 12}px)`,
          fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title * 0.6,
          color: theme.textPrimary, marginBottom: 64, textAlign: 'center', maxWidth: 1500, lineHeight: 1.05,
        }}>
          {heading}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 56, height: CHART_H + 140, width: '100%', maxWidth: 1500 }}>
        {list.map((b, i) => {
          const start = 10 + i * Math.round(0.12 * fps)
          const grow = spring({ frame: frame - start, fps, config: { damping: 18, stiffness: 90, mass: 1 } })
          const targetH = (nums[i] / max) * CHART_H
          const h = targetH * grow
          const accent = theme.accents[i % theme.accents.length]
          const countP = interpolate(frame, [start, start + Math.round(1.1 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, flex: 1, maxWidth: 240 }}>
              {/* value label (counts up) */}
              <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: TYPE.cardTitle * 0.8, color: theme.textPrimary, opacity: Math.min(1, grow * 1.5), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {renderMetric(parseMetric(b.value), countP)}
              </div>
              {/* bar */}
              <div style={{
                width: '100%', height: Math.max(4, h), borderRadius: 8,
                background: `linear-gradient(180deg, ${accent}, ${hexA(accent, 0.55)})`,
                boxShadow: b.highlight ? `0 0 40px ${hexA(accent, 0.5)}` : `0 0 18px ${hexA(accent, 0.25)}`,
                border: b.highlight ? `1px solid ${hexA(accent, 0.7)}` : 'none',
              }} />
              {/* label */}
              <div style={{ fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 2, fontSize: TYPE.label * 0.74, color: theme.textMuted, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, minHeight: 48 }}>
                {b.label}
              </div>
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
