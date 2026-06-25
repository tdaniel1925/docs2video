import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion'
import { FONTS, roles, type Theme } from '../tokens'

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

      {/* Top-left eyebrow chip. */}
      {eyebrow ? (
        <div style={{
          position: 'absolute', top: 46, left: 56,
          display: 'flex', alignItems: 'center', gap: 12,
          opacity: settle, transform: `translateY(${(1 - settle) * -8}px)`,
        }}>
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: r.hero, boxShadow: `0 0 14px ${r.hero}` }} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 24, letterSpacing: 3, color: chromeText, textTransform: 'uppercase' }}>
            {UPPER(eyebrow)}
          </span>
        </div>
      ) : null}

      {/* Top-right tag pill (date / source). */}
      {tag ? (
        <div style={{
          position: 'absolute', top: 42, right: 56,
          padding: '8px 16px', borderRadius: 8,
          border: `1.5px solid ${hexA(r.hero, isLight ? 0.4 : 0.5)}`,
          background: hexA(r.hero, isLight ? 0.06 : 0.10),
          opacity: settle, transform: `translateY(${(1 - settle) * -8}px)`,
        }}>
          <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 20, letterSpacing: 2, color: r.hero, textTransform: 'uppercase' }}>
            {UPPER(tag)}
          </span>
        </div>
      ) : null}

      {/* Footer chip row. */}
      {footer.length ? (
        <div style={{
          position: 'absolute', bottom: 40, left: 56, right: 56,
          display: 'flex', alignItems: 'center', gap: 40,
          opacity: settle, transform: `translateY(${(1 - settle) * 8}px)`,
          borderTop: `1px solid ${isLight ? 'rgba(20,40,80,0.10)' : 'rgba(255,255,255,0.08)'}`,
          paddingTop: 18,
        }}>
          {footer.map((chip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: i === 0 ? r.hero : r.neutral, boxShadow: `0 0 10px ${i === 0 ? r.hero : r.neutral}` }} />
              <span style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 22, color: isLight ? theme.textPrimary : 'rgba(255,255,255,0.82)' }}>
                {chip}
              </span>
            </div>
          ))}
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
