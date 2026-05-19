import type { TemplateSpec } from '../types'

export const medicalJournal: TemplateSpec = {
  id: 'medical-journal',
  name: 'Medical Journal',
  description: 'Clean clinical look with structured data presentation',
  designSpec: {
    background: {
      base: 'clean white (#ffffff)',
      texture: 'very subtle paper grain at 2% opacity',
    },
    decorativeElements: {
      primary: 'thin PRIMARY colored header bar across top, clean horizontal rules between sections',
      secondary: 'small medical icons — stethoscope, heart, pill, chart — in light gray',
      accents: 'colored indicator dots and status markers next to data points',
    },
    typography: {
      headline: 'bold sans-serif in dark navy (#1a2332), clean and clinical',
      accent: 'medium weight sans-serif in PRIMARY color for section headers',
      numbers: 'bold tabular numbers in PRIMARY color, clearly readable with unit labels',
      body: 'clean sans-serif in dark gray (#333333), high readability',
      labels: 'small uppercase sans-serif in medium gray, letter-spacing for clinical labels',
    },
    cardStyle: 'white cards with light gray (#f0f0f0) background, thin left border in PRIMARY color, clean shadow',
    chartStyle: 'clean clinical charts — solid PRIMARY bars, clear grid lines, reference range indicators in light green/red',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'dark navy (#1a2332)',
      background: 'white (#ffffff)',
    },
  },
  promptTemplate: 'Professional medical journal layout. Clean, clinical, data-focused. High readability with structured sections and clear hierarchy.',
}
