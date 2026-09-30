import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { settleProgress } from '../../helpers'
import { Fit } from '../../lib/fit'
import { Glyph, type GlyphName } from './Glyph'
import { Stage, type Reserve } from './Stage'

export type Step = { label: string; sub?: string; icon?: GlyphName }

const ROW_W = 1620   // design width of the node row
const PAD_X = 130
const NODE = 96

/**
 * A horizontal process timeline: nodes connected by a line that DRAWS across as
 * each node lights up in sequence. For process/step content
 * (Upload → Analyze → Storyboard → Narrate → Render). The connector fills with
 * accent; each node springs to full color as the fill reaches it.
 *
 * Each step's words sit in a box centred under its node, as wide as the gap to
 * the next node allows (and no wider than keeps the first and last on the
 * frame). Label and note are <Fit>s: they wrap, then shrink, instead of
 * spilling over the neighbouring step or off the edge.
 */
export const ProgressTimeline: React.FC<{
  steps: Step[]
  theme: Theme
  heading?: string
  /** Space to keep clear at the top/bottom of the frame (eyebrow, logo). */
  reserve?: Reserve
}> = ({ steps, theme, heading, reserve }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames, width: W } = useVideoConfig()
  const list = steps.slice(0, 6)
  const n = list.length
  const headP = settleProgress(frame, 2)

  // Width of each step's text box: the space between two node centres (less a
  // gutter), and no wider than keeps the outermost ones clear of the frame edge.
  const rowW = Math.min(ROW_W, W - 2 * PAD_X)
  const firstCentre = (W - rowW) / 2 + NODE / 2
  const pitch = n > 1 ? (rowW - NODE) / (n - 1) : rowW
  const textW = Math.max(NODE, Math.min(pitch - 24, 2 * (firstCentre - 40)))

  // The line draws from 0→1 over the middle ~70% of the scene.
  const drawStart = Math.round(0.5 * fps)
  const drawEnd = Math.max(drawStart + fps, durationInFrames - Math.round(0.6 * fps))
  const fill = interpolate(frame, [drawStart, drawEnd], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  })

  return (
    <Stage width={ROW_W} padX={PAD_X} reserve={reserve}>
      {heading ? (
        <div style={{ width: '100%', maxWidth: 1500, marginBottom: 80, opacity: headP, transform: `translateY(${(1 - headP) * 12}px)` }}>
          <Fit max={TYPE.title * 0.6} min={36} lines={3} style={{
            fontFamily: FONTS.display, fontWeight: 800,
            color: theme.textPrimary, textAlign: 'center', lineHeight: 1.06,
          }}>
            {heading}
          </Fit>
        </div>
      ) : null}

      <div style={{ position: 'relative', width: '100%', maxWidth: ROW_W, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
            <div key={i} style={{ width: NODE, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, zIndex: 1, textAlign: 'center' }}>
              <div style={{
                width: 94, height: 94, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: lit ? hexA(accent, theme.mode === 'dark' ? 0.18 : 0.12) : theme.inkSoft,
                border: `2px solid ${lit ? accent : theme.glassEdge}`,
                boxShadow: lit ? `0 0 ${20 * litP}px ${hexA(accent, 0.6)}` : 'none',
                transform: `scale(${0.9 + (lit ? litP * 0.1 : 0)})`,
              }}>
                <Glyph name={step.icon ?? 'dot'} size={42} color={lit ? accent : theme.textMuted} />
              </div>
              {/* The text box is wider than the node and centred under it
                  (a flex item wider than its column overflows both sides equally). */}
              <div style={{ width: textW, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, marginTop: 6 }}>
                <Fit max={TYPE.cardTitle * 0.6} min={20} lines={2} style={{
                  fontFamily: FONTS.display, fontWeight: 800, color: lit ? theme.textPrimary : theme.textMuted,
                  textAlign: 'center', lineHeight: 1.15,
                }}>
                  {step.label}
                </Fit>
                {step.sub ? (
                  <Fit max={TYPE.label * 0.74} min={15} lines={3} style={{
                    fontFamily: FONTS.body, fontWeight: 500, color: theme.textMuted, lineHeight: 1.3, textAlign: 'center',
                  }}>
                    {step.sub}
                  </Fit>
                ) : null}
              </div>
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
