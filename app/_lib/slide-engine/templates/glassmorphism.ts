import type { TemplateSpec } from '../types'

export const glassmorphism: TemplateSpec = {
  id: 'glassmorphism',
  name: 'Glassmorphism',
  description: 'Frosted glass cards on colorful gradient backgrounds',
  designSpec: {
    background: {
      base: 'rich gradient from deep purple (#1a0533) to dark blue (#0c1445)',
      texture: 'subtle noise grain at 3% opacity',
      gradient: 'large soft colorful blobs — PRIMARY color blob top-left, SECONDARY color blob bottom-right, both blurred heavily',
    },
    decorativeElements: {
      primary: 'frosted glass panels with heavy blur backdrop, white border at 15% opacity',
      secondary: 'floating translucent orbs in soft PRIMARY and SECONDARY colors',
      accents: 'thin white lines connecting data points, subtle sparkle effects',
    },
    typography: {
      headline: 'bold white sans-serif, weight 800, slight text shadow for depth',
      accent: 'medium weight sans-serif in PRIMARY color with slight glow',
      numbers: 'extra bold white numbers with colored underline accent',
      body: 'clean sans-serif in white at 85% opacity',
      labels: 'small uppercase in white at 60% opacity, letter-spacing',
    },
    cardStyle: 'frosted glass — rgba(255,255,255,0.08) background, backdrop-blur, 1px white border at 15% opacity, rounded corners 16px',
    chartStyle: 'translucent gradient bars with white edges, frosted glass legend cards',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'white (#ffffff)',
      background: 'deep purple-blue gradient (#1a0533 to #0c1445)',
    },
  },
  promptTemplate: 'Modern glassmorphism design. Frosted glass cards, colorful gradient background, translucent elements, depth and blur effects.',
}
