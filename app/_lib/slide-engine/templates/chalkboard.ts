import type { TemplateSpec } from '../types'

export const chalkboard: TemplateSpec = {
  id: 'chalkboard',
  name: 'Chalkboard',
  description: 'Dark green chalkboard with chalk-drawn elements',
  designSpec: {
    background: {
      base: 'dark green chalkboard (#2a3a2a)',
      texture: 'realistic chalk dust and board texture, subtle scratches and smudges',
    },
    decorativeElements: {
      primary: 'chalk-drawn borders, frames, and divider lines in white',
      secondary: 'chalk-drawn icons and doodles — arrows, stars, lightbulbs, underlines',
      accents: 'colored chalk highlights in PRIMARY and SECONDARY colors',
    },
    typography: {
      headline: 'bold chalk-style handwriting in white, slightly rough edges',
      accent: 'cursive chalk writing in PRIMARY color (colored chalk)',
      numbers: 'large bold chalk numbers in SECONDARY color (colored chalk), circled or boxed',
      body: 'clean chalk-style sans-serif in white at 90% opacity',
      labels: 'small uppercase chalk text in light gray',
    },
    cardStyle: 'chalk-drawn boxes with rounded corners, white chalk borders, no fill (transparent)',
    chartStyle: 'chalk-drawn bar charts and pie charts, hand-drawn grid lines, colored chalk fills',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'white (#ffffff)',
      background: 'dark green chalkboard (#2a3a2a)',
    },
  },
  promptTemplate: 'Educational chalkboard style. Chalk-drawn elements, handwritten feel, dark green board with realistic texture.',
}
