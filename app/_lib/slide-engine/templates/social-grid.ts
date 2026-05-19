import type { TemplateSpec } from '../types'
export const socialGrid: TemplateSpec = {
  id: 'social-grid', name: 'Social Grid', description: 'Instagram-style grid layout with bold colors',
  designSpec: {
    background: { base: 'white (#ffffff)' },
    decorativeElements: { primary: 'rounded photo/content cards in a grid layout, Instagram-style', secondary: 'subtle drop shadows on cards', accents: 'small heart/like icons, engagement indicators' },
    typography: { headline: 'bold sans-serif in black, weight 800', accent: 'medium sans-serif in PRIMARY color', numbers: 'bold sans-serif numbers in PRIMARY with circular background', body: 'clean sans-serif in dark gray (#333)', labels: 'small uppercase sans-serif in light gray' },
    cardStyle: 'rounded cards (12px radius) with subtle shadow, white background, photo-first layout', chartStyle: 'flat colored bars with rounded ends, clean labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'black (#000000)', background: 'white (#ffffff)' },
  },
  promptTemplate: 'Social media grid style. Instagram aesthetic, bold colors, rounded cards, modern and clean.',
}
