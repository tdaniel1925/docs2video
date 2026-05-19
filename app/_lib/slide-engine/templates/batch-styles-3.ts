import type { TemplateSpec } from '../types'

export const inventorBox: TemplateSpec = {
  id: 'inventor-box', name: 'Inventor Box', description: 'Da Vinci-style inventor blueprints',
  designSpec: {
    background: { base: 'blueprint blue (#1a2744)', texture: 'blueprint grid lines at 8% opacity in lighter blue' },
    decorativeElements: { primary: 'technical drawing-style diagrams — schematics, gears, pulleys in white/light blue', secondary: 'annotation arrows and measurement lines', accents: 'small compass roses, proportional guides, handwritten notes' },
    typography: { headline: 'clean condensed sans-serif in white, engineering blueprint style', accent: 'handwritten annotation style in light cyan', numbers: 'technical drawing numbers in white with measurement units', body: 'clean sans-serif in light blue (#b0c4de)', labels: 'small monospace in light cyan, annotation style' },
    cardStyle: 'thin white line border panels on blue, technical drawing frame style', chartStyle: 'blueprint-style charts — white lines on blue, technical grid',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'light cyan (#87ceeb)', text: 'white (#ffffff)', background: 'blueprint blue (#1a2744)' },
  },
  promptTemplate: 'Inventor blueprint style. Technical drawings, blueprint grid, Da Vinci aesthetic, engineering precision.',
}

export const cafeRealistic: TemplateSpec = {
  id: 'cafe-realistic', name: 'Cafe Guide', description: 'Warm cafe atmosphere with realistic textures',
  designSpec: {
    background: { base: 'warm wood brown (#3a2a1a)', texture: 'realistic dark wood table texture' },
    decorativeElements: { primary: 'paper menu/recipe cards on wooden surface, coffee stain rings', secondary: 'small food/drink illustrations — coffee cups, pastries', accents: 'coffee beans, steam wisps, chalkboard labels' },
    typography: { headline: 'bold slab-serif in cream (#f5e6c8), warm and inviting', accent: 'chalk-style handwriting in white for labels', numbers: 'large slab-serif numbers in cream on dark backgrounds', body: 'clean serif in cream (#f0dcc0)', labels: 'small chalkboard-style uppercase in white' },
    cardStyle: 'paper/menu cards on wood surface with realistic shadow, slightly aged edges', chartStyle: 'warm-toned bars on wooden background, cream labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'cream (#f5e6c8)', background: 'warm wood (#3a2a1a)' },
  },
  promptTemplate: 'Warm cafe style. Wood textures, paper cards, coffee stains, cozy and inviting atmosphere.',
}

export const oldNewspaper: TemplateSpec = {
  id: 'old-newspaper', name: 'Old Newspaper', description: 'Vintage newspaper front page layout',
  designSpec: {
    background: { base: 'aged yellow-white (#f0e8d0)', texture: 'aged newspaper paper with slight yellowing and foxing' },
    decorativeElements: { primary: 'newspaper column rules and thick headline borders', secondary: 'dateline, masthead elements, small editorial ornaments', accents: 'classified-ad style boxes, photo credits' },
    typography: { headline: 'bold high-contrast serif in black, classic newspaper headline style ALL CAPS', accent: 'italic serif in dark gray for subheads and datelines', numbers: 'bold condensed serif numbers in black', body: 'serif in dark gray (#333) in narrow newspaper column width', labels: 'small caps serif in gray — "BREAKING", "EXCLUSIVE", "PAGE 1"' },
    cardStyle: 'newspaper column layout — bordered sections, headline above', chartStyle: 'classic newsprint infographic style, black and white with accent color',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'black (#000000)', background: 'aged paper (#f0e8d0)' },
  },
  promptTemplate: 'Vintage newspaper front page. Column layout, bold headlines, aged paper texture, datelines and mastheads.',
}

export const paperLayers: TemplateSpec = {
  id: 'paper-layers', name: 'Paper Layers', description: 'Layered paper cut-out effect with depth',
  designSpec: {
    background: { base: 'light blue (#e3edf7)' },
    decorativeElements: { primary: 'layered paper shapes with visible shadows — mountains, waves, geometric forms', secondary: 'paper texture on each layer, visible edges', accents: 'small paper-cut decorative elements — trees, buildings, stars' },
    typography: { headline: 'bold sans-serif in dark navy (#1a2744), clean against paper layers', accent: 'medium sans-serif in PRIMARY color', numbers: 'large bold numbers on paper card layers with shadow', body: 'clean sans-serif in dark gray (#444)', labels: 'small uppercase on paper tag shapes' },
    cardStyle: 'white paper cards with layered shadow effect — appears to float above background', chartStyle: 'layered paper bar charts — each bar a stacked paper strip',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark navy (#1a2744)', background: 'light blue (#e3edf7)' },
  },
  promptTemplate: 'Paper cut-out layered style. Visible depth, paper textures, shadow layers, clean and dimensional.',
}

export const streetGraffiti: TemplateSpec = {
  id: 'street-graffiti', name: 'Street Graffiti', description: 'Urban graffiti wall with spray paint style',
  designSpec: {
    background: { base: 'concrete gray (#6a6a6a)', texture: 'realistic brick/concrete wall texture' },
    decorativeElements: { primary: 'graffiti-style spray paint elements in PRIMARY — drips, splatters, tag shapes', secondary: 'stencil-style graphics, wheat-paste poster elements', accents: 'paint drips, spray paint fade effects, marker tags' },
    typography: { headline: 'graffiti/wildstyle bold in PRIMARY color with dark outline, spray paint texture', accent: 'stencil-style uppercase in white', numbers: 'large spray-painted numbers in SECONDARY with drips', body: 'clean sans-serif in white on dark panels', labels: 'stencil uppercase in white at 80%' },
    cardStyle: 'dark semi-transparent panels on brick wall, spray paint border accents', chartStyle: 'spray-painted bar charts on wall, graffiti-style labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'concrete gray (#6a6a6a)' },
  },
  promptTemplate: 'Street graffiti style. Spray paint on brick walls, urban tags, stencil art, raw and energetic.',
}

export const urbanChaos: TemplateSpec = {
  id: 'urban-chaos', name: 'Urban Chaos', description: 'Gritty urban collage with distressed textures',
  designSpec: {
    background: { base: 'dark grungy gray (#1a1a1a)', texture: 'distressed concrete/asphalt texture with scratches' },
    decorativeElements: { primary: 'torn poster layers, distressed type, grunge overlays in PRIMARY', secondary: 'industrial stencil markings, caution tape elements', accents: 'noise/static overlays, glitch effects, barcode strips' },
    typography: { headline: 'distressed bold sans-serif in white, grunge texture on letters', accent: 'stencil/stamp style in PRIMARY or SECONDARY', numbers: 'large distressed numbers in SECONDARY with noise effect', body: 'clean sans-serif in light gray (#ccc)', labels: 'small stencil uppercase in PRIMARY' },
    cardStyle: 'dark distressed panels with rough edges, grunge border', chartStyle: 'gritty industrial charts, distressed fills, rough grid lines',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'dark grungy gray (#1a1a1a)' },
  },
  promptTemplate: 'Gritty urban chaos. Distressed textures, torn posters, industrial elements, raw and edgy.',
}

export const urbanCanvas: TemplateSpec = {
  id: 'urban-canvas', name: 'Urban Canvas', description: 'Street art on canvas with mixed media',
  designSpec: {
    background: { base: 'warm off-white (#f5f0e5)', texture: 'canvas/linen texture visible' },
    decorativeElements: { primary: 'painted brush strokes in PRIMARY — thick, visible texture', secondary: 'pencil sketch elements underneath paint, mixed media layers', accents: 'paint splatters, charcoal smudges, tape strips' },
    typography: { headline: 'bold painted brush-stroke text in black or PRIMARY', accent: 'handwritten marker in SECONDARY', numbers: 'large painted numbers with visible brush texture', body: 'clean sans-serif in dark charcoal (#333)', labels: 'small pencil-written uppercase' },
    cardStyle: 'canvas patches with painted borders, mixed media frame', chartStyle: 'painted bar charts with brush stroke fills, hand-drawn grid',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark charcoal (#222)', background: 'warm off-white (#f5f0e5)' },
  },
  promptTemplate: 'Street art on canvas. Mixed media, brush strokes, paint splatters, artistic and textured.',
}
