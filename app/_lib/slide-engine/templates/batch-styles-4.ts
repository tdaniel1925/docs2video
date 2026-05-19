import type { TemplateSpec } from '../types'

export const neonNightclub: TemplateSpec = {
  id: 'neon-nightclub', name: 'Neon Nightclub', description: 'Dark club atmosphere with neon lights',
  designSpec: {
    background: { base: 'very dark purple-black (#0a0612)', gradient: 'subtle purple/magenta glow from bottom' },
    decorativeElements: { primary: 'neon tube lights in PRIMARY — glowing outlines, signs, frames', secondary: 'laser beam lines and fog/haze effects', accents: 'small LED dot patterns, mirror ball light spots' },
    typography: { headline: 'bold sans-serif in white with neon glow in PRIMARY color', accent: 'neon sign style in SECONDARY — tube light effect', numbers: 'massive neon-glowing numbers in PRIMARY', body: 'clean sans-serif in light purple (#c0a0d0)', labels: 'small uppercase in neon PRIMARY at 70%' },
    cardStyle: 'dark transparent panels with neon border glow, smoky atmosphere', chartStyle: 'neon-lit bars glowing in dark, laser-grid background',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'very dark purple (#0a0612)' },
  },
  promptTemplate: 'Nightclub neon style. Glowing neon tubes, dark atmosphere, laser effects, club energy.',
}

export const brickBlocks: TemplateSpec = {
  id: 'brick-blocks', name: 'Brick Blocks', description: 'Industrial brick with block typography',
  designSpec: {
    background: { base: 'red brick (#8b4513)', texture: 'realistic red/brown brick wall texture' },
    decorativeElements: { primary: 'white painted elements on brick — arrows, borders, shapes', secondary: 'industrial metal brackets and bolts', accents: 'chalk markings, paint drips' },
    typography: { headline: 'extra bold block sans-serif in white, painted-on-wall style', accent: 'bold sans-serif in PRIMARY painted style', numbers: 'large bold white block numbers on brick', body: 'clean sans-serif in white on dark overlay', labels: 'small stencil uppercase in white' },
    cardStyle: 'dark semi-transparent overlay panels on brick, clean content', chartStyle: 'white painted bar charts on brick wall, bold and simple',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'brick red (#8b4513)' },
  },
  promptTemplate: 'Industrial brick wall. Block typography, painted elements, raw and bold.',
}

export const cinematicHud: TemplateSpec = {
  id: 'cinematic-hud', name: 'Cinematic HUD', description: 'Sci-fi heads-up display with data overlays',
  designSpec: {
    background: { base: 'near-black (#050510)', gradient: 'subtle blue-teal glow from edges' },
    decorativeElements: { primary: 'HUD interface elements — targeting reticles, scan lines, data readouts in cyan', secondary: 'hexagonal grid overlay, radar sweep animation feel', accents: 'small status indicators, blinking dots, scan markers' },
    typography: { headline: 'condensed uppercase sans-serif in bright cyan (#00d4ff), HUD display style', accent: 'monospace in PRIMARY for data readouts', numbers: 'large monospace numbers in cyan with data readout frame around them', body: 'condensed sans-serif in light blue (#88ccdd)', labels: 'small monospace uppercase in cyan at 60%, HUD label style' },
    cardStyle: 'HUD panels with thin cyan borders, corner brackets, semi-transparent dark fill', chartStyle: 'holographic-style charts — cyan wireframe bars, glowing data points, radar/gauge displays',
    colorSlots: { primary: 'cyan (#00d4ff)', secondary: 'FROM_LOGO_SECONDARY', text: 'light blue (#ccddee)', background: 'near-black (#050510)', highlight: 'FROM_LOGO_PRIMARY' },
  },
  promptTemplate: 'Sci-fi HUD interface. Heads-up display, targeting reticles, holographic data, cyberpunk tech.',
}

export const americanaPoster: TemplateSpec = {
  id: 'americana-poster', name: 'Americana Poster', description: 'Patriotic vintage American poster style',
  designSpec: {
    background: { base: 'aged cream (#f5e8d0)', texture: 'vintage poster paper texture with slight aging' },
    decorativeElements: { primary: 'bold stripes, stars, and shield shapes in red/white/blue', secondary: 'vintage banner ribbons and eagle motifs', accents: 'small stars, decorative borders, flag elements' },
    typography: { headline: 'bold condensed sans-serif in dark navy, vintage poster style ALL CAPS', accent: 'script/cursive in red for accent phrases', numbers: 'large bold condensed numbers in navy with red accent', body: 'serif in dark navy (#1a1a3a)', labels: 'small condensed uppercase in navy' },
    cardStyle: 'vintage poster panels with star-bordered frames, patriotic accents', chartStyle: 'red-white-blue bar charts, vintage propaganda poster infographic style',
    colorSlots: { primary: 'navy blue (#1a1a5a)', secondary: 'red (#b22234)', text: 'dark navy (#1a1a3a)', background: 'aged cream (#f5e8d0)' },
  },
  promptTemplate: 'Americana vintage poster. Patriotic colors, bold condensed type, stars and stripes, propaganda poster aesthetic.',
}

export const blackLabel: TemplateSpec = {
  id: 'black-label', name: 'Black Label', description: 'Premium black with gold/silver accents',
  designSpec: {
    background: { base: 'pure black (#000000)', texture: 'subtle leather or carbon fiber texture at 3%' },
    decorativeElements: { primary: 'thin gold or silver line borders and frames', secondary: 'premium label/badge shapes — embossed-look shields and crests', accents: 'small diamond shapes, thin decorative rules, premium quality marks' },
    typography: { headline: 'thin elegant uppercase serif in white, wide letter-spacing', accent: 'thin serif in gold (#c5a55a)', numbers: 'large thin serif numbers in gold with decorative underline', body: 'clean light sans-serif in light gray (#aaa)', labels: 'small uppercase in gold at 60%, wide letter-spacing' },
    cardStyle: 'near-black panels (#111) with thin gold border, premium subtle shadow', chartStyle: 'gold-accented bars on black, thin elegant grid lines in dark gray',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'gold (#c5a55a)', text: 'white (#ffffff)', background: 'black (#000000)', highlight: 'gold (#c5a55a)' },
  },
  promptTemplate: 'Premium black label. Luxury dark background, gold accents, elegant thin typography, high-end exclusive feel.',
}

export const fireVibes: TemplateSpec = {
  id: 'fire-vibes', name: 'Fire Vibes', description: 'Hot fire gradients with energetic feel',
  designSpec: {
    background: { base: 'dark charcoal (#1a0a0a)', gradient: 'fire gradient — dark red at edges, orange glow in center bottom' },
    decorativeElements: { primary: 'fire/flame shapes and ember particles in orange/red', secondary: 'heat wave distortion effects, smoke wisps', accents: 'small spark/ember dots, heat shimmer lines' },
    typography: { headline: 'extra bold sans-serif in white with orange glow/shadow', accent: 'bold sans-serif in orange (#ff6b35)', numbers: 'massive bold numbers in orange-yellow gradient, fire-lit feel', body: 'clean sans-serif in light warm gray (#ddd)', labels: 'small uppercase in orange at 70%' },
    cardStyle: 'dark semi-transparent panels with orange-red border glow, ember particles', chartStyle: 'fire-gradient bars — dark red at bottom, bright orange at top',
    colorSlots: { primary: 'orange (#ff6b35)', secondary: 'red (#cc2200)', text: 'white (#ffffff)', background: 'dark charcoal (#1a0a0a)', highlight: 'yellow (#ffaa00)' },
  },
  promptTemplate: 'Fire and heat vibes. Flame gradients, ember particles, hot energy, intense and powerful.',
}

export const summerFest: TemplateSpec = {
  id: 'summer-fest', name: 'Summer Fest', description: 'Bright summer festival with tropical colors',
  designSpec: {
    background: { base: 'bright yellow (#fff44f)', gradient: 'warm gradient from yellow to light orange' },
    decorativeElements: { primary: 'tropical elements — palm leaves, sun rays, waves in bright colors', secondary: 'confetti dots, festival banner flags', accents: 'small tropical icons — flamingos, sunglasses, pineapples' },
    typography: { headline: 'extra bold rounded sans-serif in dark navy (#1a1a3a), playful', accent: 'bold sans-serif in hot pink (#ff1493)', numbers: 'large bold numbers in white inside bright colored circles', body: 'rounded sans-serif in dark gray (#333)', labels: 'small bold uppercase in PRIMARY' },
    cardStyle: 'bright white cards with colorful border, rounded corners 16px, playful shadow', chartStyle: 'bright tropical-colored bars — coral, teal, yellow, pink',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'hot pink (#ff1493)', text: 'dark navy (#1a1a3a)', background: 'bright yellow (#fff44f)' },
  },
  promptTemplate: 'Summer festival style. Tropical colors, palm leaves, bright and cheerful, party energy.',
}
