import type { TemplateSpec } from '../types'

export const neonCyber: TemplateSpec = {
  id: 'neon-cyber',
  name: 'Neon Cyber',
  description: 'Dark background with neon glows and futuristic elements',
  designSpec: {
    background: {
      base: 'deep black (#0a0a0f)',
      texture: 'subtle circuit board pattern at 5% opacity',
      gradient: 'dark radial gradient with faint cyan glow in center',
    },
    decorativeElements: {
      primary: 'neon line borders and glowing edges in PRIMARY color',
      secondary: 'geometric hexagon wireframes in corners at low opacity',
      accents: 'small glowing dots and data stream particles',
    },
    typography: {
      headline: 'bold uppercase sans-serif with neon glow effect in PRIMARY color',
      accent: 'monospace text in SECONDARY color for labels and tags',
      numbers: 'massive bold numbers with bright neon glow, white with colored shadow',
      body: 'clean sans-serif in light cyan (#b0e0e6)',
      labels: 'small uppercase monospace in muted cyan, letter-spacing',
    },
    cardStyle: 'dark cards (#111118) with 1px neon border in PRIMARY, inner glow, slight transparency',
    chartStyle: 'neon-colored bars with glow effects, grid lines in dark cyan at 10% opacity',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'white (#ffffff)',
      background: 'deep black (#0a0a0f)',
      highlight: 'FROM_LOGO_SECONDARY',
    },
  },
  promptTemplate: 'Futuristic cyberpunk presentation. Neon glows, dark background, tech aesthetic. Circuit patterns, holographic elements.',
}
