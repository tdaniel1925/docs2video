import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { Glyph, type GlyphName } from './Glyph'

export type Step = { label: string; sub?: string; icon?: GlyphName }

/**
 * A horizontal process timeline: nodes connected by a line that DRAWS across as
 * each node lights up in sequence. For process/step content
 * (Upload → Analyze → Storyboard → Narrate → Render). The connector fills with
 * accent; each node springs to full color as the fill reaches it.
 */
export const ProgressTimeline: React.FC<{
  steps: Step[]
  theme: Theme
  heading?: string
}> = ({ steps, theme, heading }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const list = steps.slice(0, 6)
  const n = list.length
  const headP = settleProgress(frame, 2)

  // The line draws from 0→1 over the middle ~70% of the scene.
  const drawStart = Math.round(0.5 * fps)
  const drawEnd = Math.max(drawStart + fps, durationInFrames - Math.round(0.6 * fps))
  const fill = interpolate(frame, [drawStart, drawEnd], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  })

  return (
    <AbsoluteFill style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 130px' }}>
      {heading ? (
        <div style={{
          opacity: headP, transform: `translateY(${(1 - headP) * 12}px)`,
          fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.title * 0.6,
          color: theme.textPrimary, marginBottom: 80, textAlign: 'center', maxWidth: 1500, lineHeight: 1.06,
        }}>
          {heading}
        </div>
      ) : null}

      <div style={{ position: 'relative', width: '100%', maxWidth: 1620, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* base track */}
        <div style={{ position: 'absolute', top: 47, left: 47, right: 47, height: 3, background: theme.glassEdge, borderRadius: 2 }} />
        {/* accent fill that draws across */}
        <div style={{
          position: 'absolute', top: 47, left: 47, height: 3, borderRadius: 2,
          width: `calc((100% - 94px) * ${fill})`,
          background: `linear-gradient(90deg, ${theme.accents[0]}, ${theme.accents[1]})`,
          boxShadow: `0 0 16px ${theme.accents[0]}`,
        }} />

        {list.map((step, i) => {
          // The node lights when the fill passes its position.
          const pos = n === 1 ? 0 : i / (n - 1)
          const lit = fill >= pos - 0.001
          const litP = spring({ frame: frame - (drawStart + Math.round((drawEnd - drawStart) * pos)), fps, config: { damping: 14, stiffness: 140, mass: 0.6 } })
          const accent = theme.accents[i % theme.accents.length]
          return (
            <div key={i} style={{ width: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, zIndex: 1, textAlign: 'center' }}>
              <div style={{
                width: 94, height: 94, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: lit ? hexA(accent, theme.mode === 'dark' ? 0.18 : 0.12) : theme.inkSoft,
                border: `2px solid ${lit ? accent : theme.glassEdge}`,
                boxShadow: lit ? `0 0 ${20 * litP}px ${hexA(accent, 0.6)}` : 'none',
                transform: `scale(${0.9 + (lit ? litP * 0.1 : 0)})`,
              }}>
                <Glyph name={step.icon ?? 'dot'} size={42} color={lit ? accent : theme.textMuted} />
              </div>
              <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: TYPE.cardTitle * 0.6, color: lit ? theme.textPrimary : theme.textMuted, marginTop: 6 }}>
                {step.label}
              </div>
              {step.sub ? (
                <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.label * 0.74, color: theme.textMuted, lineHeight: 1.3 }}>{step.sub}</div>
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
