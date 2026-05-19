import type { TemplateSpec } from '../types'

export const profileResume: TemplateSpec = {
  id: 'profile-resume',
  name: 'Profile Resume',
  description: 'Cream background, bold infographic style',
  designSpec: {
    background: {
      base: 'cream/off-white (#F5F0E8)',
      texture: 'subtle paper texture, very faint',
    },
    decorativeElements: {
      primary: 'bold colored circles and shapes for stat displays in PRIMARY color',
      secondary: 'dotted line section dividers',
      accents: 'small business icons (charts, shields, graduation caps, coins) next to data points',
    },
    typography: {
      headline: 'bold uppercase slab-serif in PRIMARY color, large and impactful',
      accent: 'clean sans-serif subtitle in dark gray',
      numbers: 'large bold numbers inside colored circles — white text on PRIMARY/SECONDARY colored backgrounds',
      body: 'clean sans-serif in dark charcoal (#333333)',
      labels: 'small uppercase in PRIMARY color, letter-spacing',
    },
    cardStyle: 'flat colored sections with rounded corners, subtle shadow, white background with colored left border accent',
    chartStyle: 'bold flat colored shapes — circles for stats, horizontal bars for comparisons',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'dark charcoal (#333333)',
      background: 'cream/off-white (#F5F0E8)',
    },
  },
  promptTemplate: 'Professional executive resume infographic. Bold, data-rich, impactful. Mixed typography with slab-serif headers and clean sans-serif body.',
}
