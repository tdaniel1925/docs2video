import { Img, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'
import { staticFile } from '../../lib/asset'
import { FONTS, type Theme } from '../../tokens'
import { Fit } from '../../lib/fit'

/**
 * Brand logo layer — composites a REAL uploaded logo (never AI-generated). The
 * Sharp upload pipeline produces a transparent PNG and, where possible, a light
 * + dark variant; this picks the variant that reads on the current theme mode.
 * If only one variant exists it's used as-is; a complex/multi-color logo sits on
 * a frosted chip so it survives any background without recoloring.
 *
 * When NO logo is present, callers fall back to company NAME as text (handled by
 * the scene), per the locked rule — this component renders nothing if no src.
 *
 * Both the brand name and the logo image are held to a fixed box: the name is a
 * <Fit> (wraps to two lines, then shrinks) and an extra-wide logo is scaled
 * down to the box width. A long company name used to run off both edges.
 * Also imported by the V3 engine (LogoWatermark, resolveLogo) — keep the props
 * backward compatible.
 */
export type LogoSource = string | { light?: string; dark?: string } | undefined

/** Resolve the best logo file for the theme mode. */
export function resolveLogo(logo: LogoSource, mode: 'dark' | 'light'): string | null {
  if (!logo) return null
  if (typeof logo === 'string') return logo
  // On a dark ground we want the LIGHT (white) logo, and vice-versa.
  const want = mode === 'dark' ? logo.light : logo.dark
  return want ?? logo.light ?? logo.dark ?? null
}

const POS: Record<string, React.CSSProperties> = {
  'top-right': { top: 64, right: 72 },
  'top-left': { top: 64, left: 72 },
  'bottom-right': { bottom: 64, right: 72 },
  'bottom-left': { bottom: 64, left: 72 },
}

/** The box the intro brand NAME is fitted into, and the intro logo image height (px). */
const LOCKUP_H = 150
/**
 * Tallest the intro lockup can really get (px). <Fit> lets letters hang up to
 * 0.35em past its box (so tall glyphs don't shrink text for nothing), which
 * lets two lines of name stand a little taller than LOCKUP_H: at most two
 * lines of ~86px = ~181px. The scene keeps this much clear under it.
 */
export const LOCKUP_MAX_H = 185
/** Tallest the outro brand name gets, in px (two lines at 56px). */
export const FEATURE_TEXT_MAX_H = 130

/** Widest a brand block may be: the design width, but always inside the frame. */
function boxWidth(frameW: number, design: number) {
  return Math.max(200, Math.min(design, frameW - 240))
}

/** Small persistent corner watermark on every scene. */
export const LogoWatermark: React.FC<{
  logo: LogoSource
  theme: Theme
  corner?: keyof typeof POS
  chip?: boolean           // frosted chip behind it (for complex/multi-color logos)
  height?: number
  opacity?: number
  /** Widest the logo image may be, in px (an extra-wide logo is scaled down to it). */
  maxWidth?: number
}> = ({ logo, theme, corner = 'top-right', chip = false, height = 52, opacity = 0.7, maxWidth = 480 }) => {
  const src = resolveLogo(logo, theme.mode)
  const frame = useCurrentFrame()
  if (!src) return null
  const fade = interpolate(frame, [6, 22], [0, opacity], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{
      position: 'absolute', ...POS[corner], opacity: fade, zIndex: 5,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...(chip ? {
        padding: '12px 18px', borderRadius: 10,
        background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)',
        border: `1px solid ${theme.glassEdge}`,
      } : {}),
    }}>
      <Img src={staticFile(src)} style={{ height, width: 'auto', maxWidth, objectFit: 'contain' }} />
    </div>
  )
}

/** Intro lockup — logo scales/fades in centered, optionally above a wordmark. */
export const LogoLockup: React.FC<{
  logo: LogoSource
  theme: Theme
  brandName?: string
  height?: number
  /** Widest the lockup may be, in px (always kept inside the frame). */
  maxWidth?: number
}> = ({ logo, theme, brandName, height = LOCKUP_H, maxWidth = 1500 }) => {
  const src = resolveLogo(logo, theme.mode)
  const frame = useCurrentFrame()
  const { fps, width: W } = useVideoConfig()
  const boxW = boxWidth(W, maxWidth)
  const pop = spring({ frame: frame - 4, fps, config: { damping: 15, stiffness: 110, mass: 0.9 } })
  // No logo: show the brand NAME as styled text (the locked fallback).
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, opacity: Math.min(1, pop * 1.4), transform: `scale(${0.85 + pop * 0.15})` }}>
      {src ? (
        <Img src={staticFile(src)} style={{ height, width: 'auto', maxWidth: boxW, objectFit: 'contain', filter: 'drop-shadow(0 8px 30px rgba(0,0,0,0.4))' }} />
      ) : brandName ? (
        <div style={{ width: boxW }}>
          <Fit max={92} min={44} lines={2} maxHeight={height} style={{
            fontFamily: FONTS.display, fontWeight: 900, color: theme.textPrimary,
            letterSpacing: -1, lineHeight: 1.05, textAlign: 'center',
          }}>
            {brandName}
          </Fit>
        </div>
      ) : null}
    </div>
  )
}

/** Outro feature — logo above the closing CTA/contact. Falls back to name text. */
export const LogoFeature: React.FC<{
  logo: LogoSource
  theme: Theme
  brandName?: string
  height?: number
  /** Widest the feature may be, in px (always kept inside the frame). */
  maxWidth?: number
}> = ({ logo, theme, brandName, height = 110, maxWidth = 1500 }) => {
  const src = resolveLogo(logo, theme.mode)
  const frame = useCurrentFrame()
  const { fps, width: W } = useVideoConfig()
  const boxW = boxWidth(W, maxWidth)
  const pop = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 120 } })
  if (!src && !brandName) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, pop * 1.5), transform: `translateY(${(1 - pop) * 20}px)`, marginBottom: 40 }}>
      {src ? (
        <Img src={staticFile(src)} style={{ height, width: 'auto', maxWidth: boxW, objectFit: 'contain' }} />
      ) : (
        <div style={{ width: boxW }}>
          <Fit max={56} min={28} lines={2} maxHeight={FEATURE_TEXT_MAX_H} style={{
            fontFamily: FONTS.display, fontWeight: 800, color: theme.accents[0],
            lineHeight: 1.1, textAlign: 'center',
          }}>
            {brandName}
          </Fit>
        </div>
      )}
    </div>
  )
}
