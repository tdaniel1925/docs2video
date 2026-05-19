import type { TemplateSpec } from '../types'

export const comicBook: TemplateSpec = {
  id: 'comic-book',
  name: 'Comic Book',
  description: 'Bold comic panels with halftone dots and speech bubbles',
  designSpec: {
    background: {
      base: 'bright yellow (#fff44f)',
      texture: 'halftone dot pattern at 8% opacity',
    },
    decorativeElements: {
      primary: 'bold black comic panel borders (3px), action burst shapes ("POW!", "BAM!" style) in PRIMARY color',
      secondary: 'speed lines and motion streaks radiating from key elements',
      accents: 'small halftone shading, Ben-Day dots in corners, starburst shapes',
    },
    typography: {
      headline: 'extra bold comic-style sans-serif in black with white outline, slightly rotated',
      accent: 'comic action text in PRIMARY color with black outline — bold, impactful',
      numbers: 'massive bold numbers in SECONDARY color inside action burst shapes',
      body: 'clean bold sans-serif in black, comic book dialogue style',
      labels: 'small bold uppercase in PRIMARY color inside caption boxes',
    },
    cardStyle: 'white comic panels with thick black borders (3px), slight rotation for dynamic feel',
    chartStyle: 'bold flat-colored bars with thick black outlines, comic-style labels',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'black (#000000)',
      background: 'bright yellow (#fff44f)',
    },
  },
  promptTemplate: 'Bold comic book style. Thick outlines, halftone dots, action bursts, dynamic panel layouts. Fun, energetic, eye-catching.',
}
