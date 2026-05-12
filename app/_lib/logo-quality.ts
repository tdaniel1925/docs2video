/**
 * Logo quality assessment — determines if a logo is good enough
 * for Gemini to integrate, or if we should fall back to text-only branding.
 */

export type LogoQualityResult = {
  passed: boolean
  reasons: string[]
  metadata: {
    width: number
    height: number
    hasAlpha: boolean
    format: string
  }
}

export async function assessLogoQuality(
  logoBuffer: Buffer
): Promise<LogoQualityResult> {
  const sharpMod = await import('sharp')
  const sharp = sharpMod.default ?? sharpMod

  const reasons: string[] = []
  const metadata = await sharp(logoBuffer).metadata()

  // Resolution check
  if (!metadata.width || !metadata.height) {
    reasons.push('Could not read logo dimensions')
  } else if (metadata.width < 200 || metadata.height < 200) {
    reasons.push(`Resolution too low: ${metadata.width}x${metadata.height} (min 200x200)`)
  }

  // Alpha channel check (transparency)
  if (!metadata.hasAlpha) {
    reasons.push('No alpha channel — logo may have visible background')
  }

  // Aspect ratio sanity check
  if (metadata.width && metadata.height) {
    const ratio = metadata.width / metadata.height
    if (ratio > 5 || ratio < 0.2) {
      reasons.push(`Extreme aspect ratio ${ratio.toFixed(2)} — may not integrate well`)
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    metadata: {
      width: metadata.width || 0,
      height: metadata.height || 0,
      hasAlpha: metadata.hasAlpha || false,
      format: metadata.format || 'unknown',
    },
  }
}

export function shouldUseFallback(quality: LogoQualityResult): boolean {
  // Hard fails: missing dimensions or too small
  if (!quality.metadata.width || quality.metadata.width < 200) return true
  if (!quality.metadata.height || quality.metadata.height < 200) return true
  return false
}
