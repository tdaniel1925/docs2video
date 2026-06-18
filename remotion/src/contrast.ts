/** Relative luminance (0=black,1=white) of a hex color. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 0.5
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Readable text color (near-white or near-ink) for a given background hex. */
export function readableOn(bgHex: string, lightText: string, darkText: string): string {
  return luminance(bgHex) > 0.5 ? darkText : lightText
}

/**
 * Effective text colors for a scene. With a Gemini image present, a strong dark
 * scrim sits behind the text → light text is always safe. Without an image, we
 * choose based on the theme ground luminance so we never get light-on-light.
 */
export function sceneText(theme: { ink: string; textPrimary: string; textMuted: string }, hasImage: boolean) {
  if (hasImage) {
    return { primary: '#FFFFFF', muted: 'rgba(255,255,255,0.78)' }
  }
  const onDark = luminance(theme.ink) <= 0.5
  return onDark
    ? { primary: theme.textPrimary, muted: theme.textMuted }
    : { primary: '#0B0F17', muted: 'rgba(11,15,23,0.72)' }
}
