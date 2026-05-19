import type { TemplateSpec } from '../types'

export const neubrutalism: TemplateSpec = {
  id: 'neubrutalism',
  name: 'Neubrutalism',
  description: 'Bold shadows, thick borders, raw playful aesthetic',
  designSpec: {
    background: {
      base: 'warm beige (#f5e6d3)',
    },
    decorativeElements: {
      primary: 'thick black borders (3-4px) on all elements with hard offset shadows (4px right, 4px down) in black',
      secondary: 'bold colored shapes — circles, rectangles — in PRIMARY and SECONDARY colors behind content',
      accents: 'small hand-drawn arrows, stars, and underlines in black',
    },
    typography: {
      headline: 'extra bold sans-serif in black, weight 900, large and playful, slightly irregular',
      accent: 'bold sans-serif in PRIMARY color, uppercase',
      numbers: 'massive black bold numbers inside colored shapes (PRIMARY background, white text)',
      body: 'medium weight sans-serif in black',
      labels: 'bold uppercase sans-serif in black, small, inside colored tag shapes',
    },
    cardStyle: 'white cards with thick black border (3px), hard shadow offset (4px, 4px) in black, no rounded corners or slightly rounded (4px)',
    chartStyle: 'bold flat bars with thick black outlines, hard shadow offset, bright fills in PRIMARY/SECONDARY',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'black (#000000)',
      background: 'warm beige (#f5e6d3)',
    },
  },
  promptTemplate: 'Neubrutalism design. Thick black borders, hard offset shadows, bold shapes, raw and playful. Anti-minimalist but structured.',
}
