import type { TemplateSpec } from '../types'

export const watercolor: TemplateSpec = {
  id: 'watercolor',
  name: 'Watercolor',
  description: 'Soft watercolor washes and hand-painted feel',
  designSpec: {
    background: {
      base: 'warm off-white (#faf6f0)',
      texture: 'watercolor paper texture, visible grain',
      gradient: 'very soft watercolor wash of PRIMARY color at 8% opacity, bleeding from edges',
    },
    decorativeElements: {
      primary: 'watercolor brush stroke accents in PRIMARY color — splashes, drips, and soft washes',
      secondary: 'delicate botanical line drawings and leaf motifs in light gray',
      accents: 'small paint splatters in SECONDARY color, hand-drawn circle and underline accents',
    },
    typography: {
      headline: 'elegant serif font in dark charcoal (#2d2d2d), weight 700',
      accent: 'handwritten cursive script in PRIMARY color for accent phrases',
      numbers: 'large bold serif numbers in PRIMARY color with watercolor splash behind',
      body: 'clean serif in dark gray (#4a4a4a)',
      labels: 'small uppercase sans-serif in muted gray, letter-spacing',
    },
    cardStyle: 'white cards with soft watercolor border wash, subtle shadow, rounded corners',
    chartStyle: 'watercolor-filled bars and shapes, soft edges, hand-painted aesthetic',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'dark charcoal (#2d2d2d)',
      background: 'warm off-white (#faf6f0)',
    },
  },
  promptTemplate: 'Artistic watercolor presentation. Soft washes, hand-painted elements, elegant serif typography on textured paper.',
}
