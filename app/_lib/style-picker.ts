import { SLIDE_STYLES } from './types'

// Map color hue ranges to illustrated styles
const STYLE_BY_HUE: [number, number, string][] = [
  [0, 30, 'warm-story'],         // reds/warm → warm story
  [30, 60, 'warm-story'],        // oranges → warm story
  [60, 120, 'playful-cartoon'],  // yellows/greens → playful
  [120, 180, 'watercolor'],      // greens/teals → watercolor
  [180, 240, 'corporate-clean'], // blues → corporate clean
  [240, 300, 'dark-cinematic'],  // purples → dark cinematic
  [300, 360, 'bold-infographic'],// magentas → bold infographic
]

const STYLE_BY_INDUSTRY: Record<string, string> = {
  insurance: 'warm-story',
  finance: 'corporate-clean',
  'real-estate': 'dark-cinematic',
  legal: 'corporate-clean',
  healthcare: 'watercolor',
  education: 'playful-cartoon',
  technology: 'bold-infographic',
  consulting: 'corporate-clean',
  marketing: 'playful-cartoon',
  default: 'corporate-clean',
}

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0
  if (max !== min) {
    const d = max - min
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return Math.round(h * 360)
}

export function autoSelectStyle(
  primaryColor?: string | null,
  industry?: string | null,
): string {
  // Priority 1: industry match
  if (industry) {
    const key = industry.toLowerCase().replace(/\s+/g, '-')
    if (STYLE_BY_INDUSTRY[key]) return STYLE_BY_INDUSTRY[key]
  }

  // Priority 2: color match
  if (primaryColor && primaryColor.startsWith('#') && primaryColor.length === 7) {
    const hue = hexToHue(primaryColor)
    for (const [min, max, styleId] of STYLE_BY_HUE) {
      if (hue >= min && hue < max) {
        // Verify this style exists
        if (SLIDE_STYLES.find(s => s.id === styleId)) return styleId
      }
    }
  }

  // Fallback
  return 'corporate-clean'
}

export function autoSelectFromBrand(brand: { primary_color?: string; industry?: string; tone?: string } | null): string {
  if (!brand) return 'corporate-clean'
  return autoSelectStyle(brand.primary_color, brand.industry)
}
