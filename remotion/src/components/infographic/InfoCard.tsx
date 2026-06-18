import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { Glyph, type GlyphName } from './Glyph'

export type InfoItem = { icon?: GlyphName; title: string; body?: string }

/**
 * Descriptive (non-numeric) content as glass cards — for sections / key points
 * that aren't metrics (e.g. "Living Benefits — access part of the death benefit
 * early"). 1 item → one centered wide card; 2–3 → a row. Each card: optional
 * glyph chip, bold title, supporting body. Staggered spring-in.
 */
export const InfoCard: React.FC<{
  items: InfoItem[]
  theme: Theme
  heading?: string
}> = ({ items, theme, heading }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const list = items.slice(0, 3)
  const headP = settleProgress(frame, 2)
  const single = list.length === 1

  return (
    <AbsoluteFill style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 150px' }}>
      {heading ? (
        <div style={{
          opacity: headP, transform: `translateY(${(1 - headP) * 12}px)`,
          fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title * 0.6,
          color: theme.textPrimary, marginBottom: 54, textAlign: 'center', maxWidth: 1500, lineHeight: 1.06,
        }}>
          {heading}
        </div>
      ) : null}

      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${list.length}, 1fr)`, gap: 36,
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
              padding: single ? '54px 60px' : '44px 40px',
              display: 'flex', flexDirection: 'column', gap: 22, textAlign: 'left',
            }}>
              {item.icon ? (
                <div style={{
                  width: 80, height: 80, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: hexA(accent, theme.mode === 'dark' ? 0.12 : 0.08), border: `1px solid ${hexA(accent, 0.4)}`,
                }}>
                  <Glyph name={item.icon} size={44} color={accent} />
                </div>
              ) : null}
              <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: single ? TYPE.cardTitle * 1.1 : TYPE.cardTitle * 0.86, color: theme.textPrimary, lineHeight: 1.1 }}>
                {item.title}
              </div>
              {item.body ? (
                <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: single ? TYPE.body * 0.78 : TYPE.body * 0.62, color: theme.textMuted, lineHeight: 1.4 }}>
                  {item.body}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function hexA(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
