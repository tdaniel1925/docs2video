import type { TemplateSpec } from '../types'

export const executive: TemplateSpec = {
  id: 'executive',
  name: 'Executive',
  description: 'Dark mode premium dashboard',
  designSpec: {
    background: {
      base: 'deep near-black (#020617)',
      texture: 'faint dot grid pattern at 3% opacity',
      gradient: 'subtle radial gradient — slightly lighter (#0f172a) in center fading to dark edges',
    },
    decorativeElements: {
      primary: 'floating ambient light orbs — soft PRIMARY colored glow top-left, soft SECONDARY glow bottom-right at very low opacity (5%)',
      secondary: 'thin accent lines in top-left and bottom-right corners',
      accents: 'subtle horizontal scan lines across background at very low opacity for texture',
    },
    typography: {
      headline: 'large bold white sans-serif, weight 800-900',
      accent: 'small caps in PRIMARY color with letter-spacing for kicker/eyebrow text',
      numbers: 'massive bold numbers with colored neon glow matching their hue',
      body: 'clean sans-serif in light gray (#94a3b8)',
      labels: 'small caps in muted gray, letter-spacing',
    },
    cardStyle: 'glassmorphism — semi-transparent (#0f172a at 80%) with faint white border (1px, 10% opacity), soft inner glow, top-edge white highlight line for 3D depth',
    chartStyle: 'gradient-filled bars (dark bottom, bright top) with subtle reflections, glowing data labels',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'white (#ffffff)',
      background: 'near-black (#020617)',
      highlight: 'FROM_LOGO_SECONDARY',
    },
  },
  promptTemplate: 'Ultra-premium Bloomberg terminal meets Tesla dashboard. Glassmorphism, ambient lighting, neon glows. Every element polished and premium.',
}
