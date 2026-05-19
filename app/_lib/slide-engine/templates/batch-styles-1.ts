import type { TemplateSpec } from '../types'

export const blueSteps: TemplateSpec = {
  id: 'blue-steps', name: 'Blue Steps', description: 'Step-by-step process with blue gradient',
  designSpec: {
    background: { base: 'white (#ffffff)', gradient: 'subtle blue gradient from light (#f0f7ff) at top to white at bottom' },
    decorativeElements: { primary: 'numbered step circles connected by lines in PRIMARY color', secondary: 'subtle blue watermark shapes in background', accents: 'small arrow icons between steps' },
    typography: { headline: 'bold sans-serif in dark navy (#1a2744)', accent: 'medium sans-serif in PRIMARY color for step labels', numbers: 'large bold numbers inside colored circles — white text on PRIMARY bg', body: 'clean sans-serif in dark gray (#444)', labels: 'small uppercase in PRIMARY at 60% opacity' },
    cardStyle: 'white cards with left border in PRIMARY color, light shadow', chartStyle: 'blue gradient bars, clean grid lines',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark navy (#1a2744)', background: 'white (#ffffff)' },
  },
  promptTemplate: 'Step-by-step process layout. Blue gradient accents, numbered circles, clean corporate progression.',
}

export const isometric: TemplateSpec = {
  id: 'isometric', name: 'Isometric', description: '3D isometric illustrations with clean data',
  designSpec: {
    background: { base: 'light gray (#f5f5f8)', gradient: 'very subtle gradient to white in center' },
    decorativeElements: { primary: 'isometric 3D shapes — cubes, cylinders, blocks in PRIMARY and SECONDARY colors', secondary: 'isometric grid pattern at 3% opacity', accents: 'small isometric icons — buildings, charts, devices' },
    typography: { headline: 'bold sans-serif in dark charcoal (#2d2d2d)', accent: 'medium sans-serif in PRIMARY color', numbers: 'bold numbers on isometric blocks or platforms', body: 'clean sans-serif in gray (#555)', labels: 'small uppercase sans-serif in muted gray' },
    cardStyle: 'white cards with isometric shadow (shifted right and down), subtle border', chartStyle: 'isometric bar charts — 3D extruded bars in PRIMARY/SECONDARY',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark charcoal (#2d2d2d)', background: 'light gray (#f5f5f8)' },
  },
  promptTemplate: 'Isometric 3D illustration style. Clean geometric shapes, depth perspective, modern tech aesthetic.',
}

export const flatVector: TemplateSpec = {
  id: 'flat-vector', name: 'Flat Vector', description: 'Clean flat design with vector illustrations',
  designSpec: {
    background: { base: 'white (#ffffff)' },
    decorativeElements: { primary: 'flat vector illustrations — people, objects, scenes in PRIMARY and SECONDARY', secondary: 'geometric shapes — circles, triangles as accent elements', accents: 'small flat icons next to data points' },
    typography: { headline: 'bold rounded sans-serif in dark gray (#2a2a2a)', accent: 'medium sans-serif in PRIMARY color', numbers: 'large bold numbers in PRIMARY with flat colored backgrounds', body: 'clean sans-serif in medium gray (#555)', labels: 'small sans-serif in light gray' },
    cardStyle: 'flat colored panels with no shadow, rounded corners 12px, pastel-tinted backgrounds', chartStyle: 'flat colored bars with rounded tops, no shadows, clean and minimal',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark gray (#2a2a2a)', background: 'white (#ffffff)' },
  },
  promptTemplate: 'Clean flat vector design. Minimal shadows, bold colors, geometric shapes, modern illustration style.',
}

export const doodle: TemplateSpec = {
  id: 'doodle', name: 'Doodle', description: 'Hand-drawn doodle style with sketch aesthetics',
  designSpec: {
    background: { base: 'white (#ffffff)', texture: 'subtle notebook grid lines at 5% opacity' },
    decorativeElements: { primary: 'hand-drawn doodle borders, squiggly lines, and sketched frames in black', secondary: 'doodle icons — arrows, stars, lightbulbs, speech bubbles', accents: 'colored marker highlights in PRIMARY and SECONDARY, like highlighter pen strokes' },
    typography: { headline: 'hand-drawn marker style in black, bold and playful', accent: 'handwritten style in PRIMARY color', numbers: 'large hand-drawn numbers with circle or underline accent', body: 'clean handwriting-style in dark gray', labels: 'small hand-printed uppercase in gray' },
    cardStyle: 'hand-drawn rectangular frames with slightly wobbly lines, no fill', chartStyle: 'hand-drawn bar charts with sketchy lines, colored marker fills',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'black (#000000)', background: 'white (#ffffff)' },
  },
  promptTemplate: 'Hand-drawn doodle style. Sketched elements, notebook paper feel, marker accents, playful and approachable.',
}

export const lineArt: TemplateSpec = {
  id: 'line-art', name: 'Line Art', description: 'Elegant single-line illustrations',
  designSpec: {
    background: { base: 'warm cream (#faf8f4)' },
    decorativeElements: { primary: 'continuous single-line art illustrations in PRIMARY color — portraits, objects, scenes', secondary: 'thin geometric line frames around content', accents: 'small dot accents and thin cross marks' },
    typography: { headline: 'light weight serif in dark charcoal (#1a1a1a), elegant and minimal', accent: 'thin sans-serif in PRIMARY color', numbers: 'thin elegant numbers in PRIMARY with fine underline', body: 'light sans-serif in dark gray (#444)', labels: 'small uppercase thin sans-serif in muted gray, wide letter-spacing' },
    cardStyle: 'minimal — thin line borders only, no fill, no shadow', chartStyle: 'line charts preferred, thin elegant lines in PRIMARY, minimal grid',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark charcoal (#1a1a1a)', background: 'warm cream (#faf8f4)' },
  },
  promptTemplate: 'Elegant single-line art style. Continuous line illustrations, minimal and sophisticated, warm cream background.',
}

export const vintageCraft: TemplateSpec = {
  id: 'vintage-craft', name: 'Vintage Craft', description: 'Rustic vintage with craft textures',
  designSpec: {
    background: { base: 'kraft paper brown (#d4c5a9)', texture: 'realistic kraft/brown paper texture with subtle grain' },
    decorativeElements: { primary: 'vintage stamp and badge shapes in PRIMARY color, woodcut-style borders', secondary: 'hand-drawn banners and ribbons', accents: 'small vintage ornaments, tiny stars, cross-hatch shading' },
    typography: { headline: 'bold slab-serif in dark brown (#3a2a1a), vintage poster style', accent: 'script font in PRIMARY color for accent phrases', numbers: 'large bold slab-serif numbers inside vintage badge shapes', body: 'serif in dark brown (#4a3a2a)', labels: 'small uppercase slab-serif in dark brown' },
    cardStyle: 'paper-texture cards with vintage border frames, slightly yellowed edges', chartStyle: 'vintage-style charts with woodcut-texture fills, brown grid lines',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark brown (#3a2a1a)', background: 'kraft paper (#d4c5a9)' },
  },
  promptTemplate: 'Rustic vintage craft style. Kraft paper texture, slab-serif typography, vintage badges and stamps.',
}

export const flatCartoon: TemplateSpec = {
  id: 'flat-cartoon', name: 'Flat Cartoon', description: 'Playful cartoon illustrations with flat colors',
  designSpec: {
    background: { base: 'light pastel blue (#e8f4fd)' },
    decorativeElements: { primary: 'cartoon character illustrations with flat colors, rounded shapes', secondary: 'puffy cloud shapes and rounded rectangles', accents: 'small stars, hearts, and sparkle effects' },
    typography: { headline: 'extra bold rounded sans-serif in dark navy (#1a2a44), playful and friendly', accent: 'bold rounded sans-serif in PRIMARY color', numbers: 'large bold rounded numbers in white inside colored circles', body: 'rounded sans-serif in dark gray (#444)', labels: 'small bold rounded sans-serif in PRIMARY at 70%' },
    cardStyle: 'rounded cards (16px radius) with pastel colored backgrounds, subtle shadow, friendly feel', chartStyle: 'rounded bars with pastel fills, friendly cartoon labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark navy (#1a2a44)', background: 'light pastel blue (#e8f4fd)' },
  },
  promptTemplate: 'Playful flat cartoon style. Rounded shapes, pastel colors, friendly illustrations, approachable and fun.',
}
