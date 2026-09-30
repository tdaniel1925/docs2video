import { useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { Fit } from '../../lib/fit'
import { Glyph, type GlyphName } from './Glyph'
import { Stage, type Reserve } from './Stage'

export type InfoItem = { icon?: GlyphName; title: string; body?: string }

/**
 * Descriptive (non-numeric) content as glass cards — for sections / key points
 * that aren't metrics (e.g. "Living Benefits — access part of the death benefit
 * early"). 1 item → one centered wide card; 2–3 → a row. Each card: optional
 * glyph chip, bold title, supporting body. Staggered spring-in.
 *
 * Columns are minmax(0, 1fr) so a long word can't widen its card off the frame;
 * title and body are <Fit>s; the scene sits on a <Stage>.
 */
export const InfoCard: React.FC<{
  items: InfoItem[]
  theme: Theme
  heading?: string
  /** Space to keep clear at the top/bottom of the frame (eyebrow, logo). */
  reserve?: Reserve
}> = ({ items, theme, heading, reserve }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const list = items.slice(0, 3)
  const headP = settleProgress(frame, 2)
  const single = list.length === 1

  return (
    <Stage width={1600} padX={150} reserve={reserve}>
      {heading ? (
        <div style={{ width: '100%', maxWidth: 1500, marginBottom: 54, opacity: headP, transform: `translateY(${(1 - headP) * 12}px)` }}>
          <Fit max={TYPE.title * 0.6} min={36} lines={3} style={{
            fontFamily: FONTS.display, fontWeight: 800,
            color: theme.textPrimary, textAlign: 'center', lineHeight: 1.06,
          }}>
            {heading}
          </Fit>
        </div>
      ) : null}

      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, list.length)}, minmax(0, 1fr))`, gap: 36,
        width: '100%', maxWidth: single ? 1200 : 1600,
      }}>
        {list.map((item, i) => {
          const start = 8 + i * Math.round(0.12 * fps)
          const rise = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 110, mass: 0.9 } })
          const accent = theme.accents[i % theme.accents.length]
          return (
            <div key={i} style={{
              opacity: Math.min(1, rise * 1.5), transform: `translateY(${(1 - rise) * 36}px)`,
              background: theme.glass, border: `1px solid ${theme.glassEdge}`, borderRadius: 10,
              padding: single ? '54px 60px' : '44px 40px', minWidth: 0,
              display: 'flex', flexDirection: 'column', gap: 22, textAlign: 'left',
            }}>
              {item.icon ? (
                <div style={{
                  width: 80, height: 80, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: hexA(accent, theme.mode === 'dark' ? 0.12 : 0.08), border: `1px solid ${hexA(accent, 0.4)}`,
                  flexShrink: 0,
                }}>
                  <Glyph name={item.icon} size={44} color={accent} />
                </div>
              ) : null}
              <Fit max={single ? TYPE.cardTitle * 1.1 : TYPE.cardTitle * 0.86} min={26} lines={3} style={{
                fontFamily: FONTS.display, fontWeight: 800, color: theme.textPrimary, lineHeight: 1.1,
              }}>
                {item.title}
              </Fit>
              {item.body ? (
                <Fit max={single ? TYPE.body * 0.78 : TYPE.body * 0.62} min={20} lines={single ? 6 : 8} style={{
                  fontFamily: FONTS.body, fontWeight: 500, color: theme.textMuted, lineHeight: 1.4,
                }}>
                  {item.body}
                </Fit>
              ) : null}
            </div>
          )
        })}
      </div>
    </Stage>
  )
}

function hexA(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
