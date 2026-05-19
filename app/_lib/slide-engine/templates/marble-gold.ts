import type { TemplateSpec } from '../types'

export const marbleGold: TemplateSpec = {
  id: 'marble-gold',
  name: 'Marble & Gold',
  description: 'Luxury marble textures with gold foil accents',
  designSpec: {
    background: {
      base: 'white marble (#f5f0eb) with gray veining',
      texture: 'realistic marble texture — white/cream with subtle gray veins',
    },
    decorativeElements: {
      primary: 'gold foil borders and frames — thin elegant gold lines around content',
      secondary: 'gold foil geometric shapes — triangles, hexagons, thin lines as dividers',
      accents: 'small gold leaf accents, gold dust particles, gold corner ornaments',
    },
    typography: {
      headline: 'elegant thin serif in dark charcoal (#1a1a1a), uppercase, wide letter-spacing',
      accent: 'light weight sans-serif in gold (#c5a55a) for subtitles',
      numbers: 'large thin serif numbers in gold (#c5a55a) with small decorative line beneath',
      body: 'clean serif in dark gray (#3a3a3a)',
      labels: 'small uppercase sans-serif in gold at 80% opacity, letter-spacing',
    },
    cardStyle: 'white panels on marble with thin gold border (1px), subtle shadow for elevation',
    chartStyle: 'gold-filled chart elements, thin gold grid lines, marble-textured backgrounds',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'gold (#c5a55a)',
      text: 'dark charcoal (#1a1a1a)',
      background: 'white marble (#f5f0eb)',
      highlight: 'gold (#c5a55a)',
    },
  },
  promptTemplate: 'Luxury marble and gold presentation. Elegant marble textures, gold foil accents, premium serif typography. Sophisticated and high-end.',
}
