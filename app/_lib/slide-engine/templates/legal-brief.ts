import type { TemplateSpec } from '../types'

export const legalBrief: TemplateSpec = {
  id: 'legal-brief',
  name: 'Legal Brief',
  description: 'Formal document style with structured numbering and seals',
  designSpec: {
    background: {
      base: 'warm ivory (#fdfaf3)',
      texture: 'subtle parchment paper texture at low opacity',
    },
    decorativeElements: {
      primary: 'formal double-line border around content area in dark gray',
      secondary: 'section numbering with Roman numerals or legal paragraph markers (§)',
      accents: 'small scales of justice or gavel icon watermark at very low opacity',
    },
    typography: {
      headline: 'bold serif (Times-style) in dark navy (#1a1a2e), formal and authoritative',
      accent: 'italic serif in PRIMARY color for case citations and references',
      numbers: 'bold serif numbers in dark navy, formal presentation',
      body: 'serif in dark charcoal (#333333), comfortable reading size, 1.6 line height',
      labels: 'small caps serif in medium gray for document labels (EXHIBIT, SECTION, ARTICLE)',
    },
    cardStyle: 'cream panels with thin dark border, numbered section markers on left edge',
    chartStyle: 'clean formal tables with alternating row shading, serif labels',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'dark navy (#1a1a2e)',
      background: 'warm ivory (#fdfaf3)',
    },
  },
  promptTemplate: 'Formal legal document presentation. Serif typography, structured sections, parchment feel. Authoritative and professional.',
}
