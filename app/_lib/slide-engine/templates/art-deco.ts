import type { TemplateSpec } from '../types'

export const artDeco: TemplateSpec = {
  id: 'art-deco',
  name: 'Art Deco',
  description: 'Luxurious 1920s art deco with gold accents and geometric patterns',
  designSpec: {
    background: {
      base: 'deep navy (#0d1b2a)',
      texture: 'subtle art deco geometric pattern — fan shapes and sunbursts at 5% opacity',
      gradient: 'radial gradient slightly lighter in center',
    },
    decorativeElements: {
      primary: 'gold geometric borders — stepped corners, sunburst dividers, chevron patterns',
      secondary: 'thin gold line art frames around content areas',
      accents: 'small gold diamond and fan decorations, ornamental line flourishes',
    },
    typography: {
      headline: 'elegant art deco display font in gold (#d4af37), uppercase, wide letter-spacing',
      accent: 'thin condensed sans-serif in gold for subtitles',
      numbers: 'large bold gold numbers with decorative frames around them',
      body: 'clean serif in cream (#f5e6c8)',
      labels: 'small uppercase in gold at 70% opacity, wide letter-spacing',
    },
    cardStyle: 'dark panels with thin gold double-line borders, art deco corner ornaments',
    chartStyle: 'gold-filled bars with geometric patterns, cream gridlines at low opacity',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'gold (#d4af37)',
      text: 'cream (#f5e6c8)',
      background: 'deep navy (#0d1b2a)',
      highlight: 'gold (#d4af37)',
    },
  },
  promptTemplate: 'Luxurious 1920s Art Deco presentation. Gold geometric patterns, elegant typography, premium feel with sunburst and chevron motifs.',
}
