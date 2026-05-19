import type { TemplateSpec } from '../types'

export const terminal: TemplateSpec = {
  id: 'terminal',
  name: 'Terminal',
  description: 'Developer terminal / code editor aesthetic',
  designSpec: {
    background: {
      base: 'terminal dark (#1e1e2e)',
      texture: 'subtle scanline effect at 2% opacity',
    },
    decorativeElements: {
      primary: 'terminal window chrome — title bar with red/yellow/green dots, tab indicators',
      secondary: 'code syntax highlighting colors on keywords and values',
      accents: 'blinking cursor indicators, line numbers on left margin, command prompts ($ >)',
    },
    typography: {
      headline: 'monospace font in bright green (#50fa7b), weight 700',
      accent: 'monospace in PRIMARY color for highlighted terms',
      numbers: 'large monospace numbers in bright cyan (#8be9fd), with # or $ prefix',
      body: 'monospace in light gray (#f8f8f2)',
      labels: 'small monospace in comment-green (#6272a4) with // prefix',
    },
    cardStyle: 'dark panels (#282a36) with thin border (#44475a), terminal window header with dots, monospace content',
    chartStyle: 'ASCII-inspired bar charts, colored terminal output style, progress bar with [####----] aesthetic',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'bright green (#50fa7b)',
      text: 'light gray (#f8f8f2)',
      background: 'terminal dark (#1e1e2e)',
      highlight: 'bright cyan (#8be9fd)',
    },
  },
  promptTemplate: 'Developer terminal aesthetic. Monospace typography, dark code editor colors, syntax highlighting, command-line feel.',
}
