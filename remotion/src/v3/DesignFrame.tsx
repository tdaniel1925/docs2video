import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion'
import { FONTS, roles, type Theme } from '../tokens'
import { Fit, FitBox } from '../lib/fit'

/**
 * DesignFrame — the persistent "chrome" that overlays EVERY scene and is the
 * single biggest reason reference graphics read as one cohesive product rather
 * than a stack of loose slides. It draws (all $0, pure CSS):
 *
 *   • a 2px gradient HAIRLINE along the very top edge
 *   • a soft radial EDGE-GLOW bleeding in from the top-left corner
 *   • a top-left EYEBROW chip  ( • LABEL )           ← brand / section
 *   • an optional top-right TAG ( pill )             ← date / source url
 *   • a footer row of up to 3 supporting CHIPS       ← proof points
 *
 * Mounted once in V3Video, ABOVE the backdrop and BELOW nothing else, so it
 * sits over all scene content. It never resets at a cut (driven by the global
 * frame), which is what holds the video together visually.
 */

export type FrameConfig = {
  /** Top-left eyebrow text, e.g. "REAL API COST BENCHMARK". Usually the brand. */
  eyebrow?: string
  /** Top-right tag, e.g. "JUNE 2026" or a source URL. */
  tag?: string
  /** Up to 3 footer chips (proof points / supporting facts). */
  footer?: string[]
  /** Brand name fallback for the eyebrow when none supplied. */
  brandName?: string
}

const UPPER = (s: string) => s.toUpperCase()
/** Archivo's own "normal" line height, written out: <Fit> counts lines by the
 *  line height, and it can't read "normal" (it guesses 1.2, which makes two
 *  Archivo lines look like one). */
const ARCHIVO_LH = 1.1
/** Height of the footer chip line (22px Inter at its normal line height). */
const FOOTER_LINE = 27

export const DesignFrame: React.FC<{ theme: Theme; config?: FrameConfig }> = ({ theme, config }) => {
  const f = useCurrentFrame()
  const r = roles(theme)
  const eyebrow = config?.eyebrow || config?.brandName || ''
  const tag = config?.tag
  const footer = (config?.footer || []).slice(0, 3)
  const isLight = theme.mode === 'light'

  // Gentle settle on entry (so the chrome doesn't pop in hard at frame 0).
  const settle = interpolate(f, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })

  const chromeText = isLight ? theme.textMuted : 'rgba(255,255,255,0.62)'
  const hairline = `linear-gradient(90deg, transparent, ${r.hero}, ${r.neutral}, transparent)`
  const cornerGlow = isLight
    ? `radial-gradient(900px 520px at 6% -6%, ${hexA(r.hero, 0.10)}, transparent 60%)`
    : `radial-gradient(1000px 560px at 4% -8%, ${hexA(r.hero, 0.22)}, transparent 62%)`

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 10 }}>
      {/* Corner edge-glow — depth without a heavy full background. */}
      <AbsoluteFill style={{ background: cornerGlow, opacity: settle }} />

      {/* 2px gradient hairline along the very top edge. */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: hairline, opacity: 0.9 * settle }} />

      {/* Top row: eyebrow on the left, tag pill on the right, sharing ONE row
          so they can never run into each other. The tag keeps its natural
          width (up to 45% of the row); the eyebrow gets the rest. Either one
          shrinks to fit on its single line when it's too long. Positions match
          the old layout (eyebrow at top 46, pill at top 42). */}
      {eyebrow || tag ? (
        <div style={{
          position: 'absolute', top: 42, left: 56, right: 56,
          display: 'flex', alignItems: 'flex-start', gap: 32,
          opacity: settle, transform: `translateY(${(1 - settle) * -8}px)`,
        }}>
          {eyebrow ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, minWidth: 0, flex: '0 1 auto' }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: r.hero, boxShadow: `0 0 14px ${r.hero}`, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: '0 1 auto' }}>
                <Fit max={24} min={16} lines={1} style={{ fontFamily: FONTS.display, fontWeight: 800, lineHeight: ARCHIVO_LH, letterSpacing: 3, color: chromeText, textTransform: 'uppercase' }}>
                  {UPPER(eyebrow)}
                </Fit>
              </div>
            </div>
          ) : null}
          {tag ? (
            <div style={{
              marginLeft: 'auto', flex: '0 0 auto', minWidth: 0, maxWidth: '45%',
              padding: '8px 16px', borderRadius: 8,
              border: `1.5px solid ${hexA(r.hero, isLight ? 0.4 : 0.5)}`,
              background: hexA(r.hero, isLight ? 0.06 : 0.10),
            }}>
              <Fit max={20} min={14} lines={1} style={{ fontFamily: FONTS.display, fontWeight: 800, lineHeight: ARCHIVO_LH, letterSpacing: 2, color: r.hero, textTransform: 'uppercase' }}>
                {UPPER(tag)}
              </Fit>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Footer chip row: always ONE line. If the chips are longer than the
          row, the whole row scales down together (so all chips stay the same
          size) instead of wrapping upward into the scene or the logo. */}
      {footer.length ? (
        <div style={{
          position: 'absolute', bottom: 40, left: 56, right: 56,
          opacity: settle, transform: `translateY(${(1 - settle) * 8}px)`,
          borderTop: `1px solid ${isLight ? 'rgba(20,40,80,0.10)' : 'rgba(255,255,255,0.08)'}`,
          paddingTop: 18,
        }}>
          <div style={{ height: FOOTER_LINE }}>
            <FitBox valign="center" minScale={0.65}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 40, whiteSpace: 'nowrap' }}>
                {footer.map((chip, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: i === 0 ? r.hero : r.neutral, boxShadow: `0 0 10px ${i === 0 ? r.hero : r.neutral}` }} />
                    <span style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 22, lineHeight: `${FOOTER_LINE}px`, color: isLight ? theme.textPrimary : 'rgba(255,255,255,0.82)' }}>
                      {chip}
                    </span>
                  </div>
                ))}
              </div>
            </FitBox>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

/** hex (#rrggbb) + alpha → rgba() string. */
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const r = parseInt(n.slice(0, 2), 16) || 0
  const g = parseInt(n.slice(2, 4), 16) || 0
  const b = parseInt(n.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${a})`
}
