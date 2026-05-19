import type { TemplateSpec } from '../types'

export const urbanFriday: TemplateSpec = {
  id: 'urban-friday',
  name: 'Urban Friday',
  description: 'Gold splatter, brushstroke text, street party energy',
  designSpec: {
    background: {
      base: 'dark charcoal/black',
      texture: 'gritty urban texture overlay, subtle grain',
    },
    decorativeElements: {
      primary: 'paint splatter effects — drips, splatters, brushstroke textures in PRIMARY color',
      secondary: 'spray paint accents in SECONDARY color scattered around text',
      accents: 'white directional arrows as graphic accents pointing to key info',
    },
    typography: {
      headline: 'MASSIVE white condensed block letters, slightly angled, overlapping, with paint drips in PRIMARY color',
      accent: 'hand-painted cursive script in SECONDARY color overlapping the headline',
      numbers: 'massive condensed font — alternating white and SECONDARY color',
      body: 'clean white sans-serif',
      labels: 'small caps white, spaced out',
    },
    cardStyle: 'no cards — raw text blocks stacked and overlapping, gritty street poster feel',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'white',
      background: 'dark charcoal/black (#111111)',
    },
  },
  promptTemplate: 'Urban street party flyer meets corporate data. Raw, energetic, street — like a hip-hop club night flyer but with business metrics.',
}
