import type { TemplateSpec } from '../types'

export const commercialPro: TemplateSpec = {
  id: 'commercial-pro',
  name: 'Commercial Pro',
  description: 'Clean corporate style with bold accents and data visualization',
  designSpec: {
    background: {
      base: 'white (#ffffff)',
      gradient: 'very subtle gradient from white to light gray (#f8f9fa) at bottom',
    },
    decorativeElements: {
      primary: 'bold PRIMARY colored accent bar on left side of content, clean geometric shapes',
      secondary: 'light gray section dividers, subtle drop shadows on cards',
      accents: 'small PRIMARY colored dots for bullet markers, thin accent lines',
    },
    typography: {
      headline: 'bold sans-serif in PRIMARY color, weight 800, clean and modern',
      accent: 'medium sans-serif in SECONDARY color for subheadings',
      numbers: 'extra bold sans-serif numbers in PRIMARY color, large and prominent',
      body: 'clean sans-serif in dark gray (#444444)',
      labels: 'small uppercase sans-serif in medium gray (#888888), letter-spacing',
    },
    cardStyle: 'white cards with subtle shadow, 4px left border in PRIMARY color, rounded corners 8px',
    chartStyle: 'PRIMARY colored bars with rounded tops, clean grid, data labels above bars',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'dark charcoal (#222222)',
      background: 'white (#ffffff)',
    },
  },
  promptTemplate: 'Clean corporate professional presentation. Bold accent colors, structured layout, data-driven with clean charts and metrics.',
}
