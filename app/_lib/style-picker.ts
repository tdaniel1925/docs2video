import { SLIDE_STYLES } from './types'

// Map color hue ranges to template families
const STYLE_BY_HUE: [number, number, string][] = [
  [0, 30, 'executive'],      // reds/warm → executive
  [30, 60, 'steampunk'],     // oranges → steampunk
  [60, 90, 'vintage-craft'], // yellows → vintage
  [90, 160, 'flat-vector'],  // greens → flat vector
  [160, 200, 'blue-steps'],  // teals → blue steps
  [200, 260, 'neon-cyber'],  // blues → neon cyber
  [260, 300, 'watercolor'],  // purples → watercolor
  [300, 360, 'social-grid'], // magentas → social grid
]

const STYLE_BY_INDUSTRY: Record<string, string> = {
  insurance: 'executive',
  finance: 'executive',
  'real-estate': 'social-grid',
  legal: 'line-art',
  healthcare: 'blue-steps',
  education: 'flat-cartoon',
  technology: 'neon-cyber',
  consulting: 'flat-vector',
  marketing: 'colorful-steps',
  default: 'executive',
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
  return 'executive'
}
