import type { TemplateSpec } from '../types'

export const nightclubFlyer: TemplateSpec = {
  id: 'nightclub-flyer', name: 'Nightclub Flyer', description: 'Bold club flyer with vibrant colors',
  designSpec: {
    background: { base: 'black (#000000)', gradient: 'vibrant gradient — purple to magenta to cyan blobs' },
    decorativeElements: { primary: 'bold geometric shapes, lens flares, light streaks', secondary: 'glitter/sparkle particle effects', accents: 'DJ equipment silhouettes, turntable elements' },
    typography: { headline: 'ultra bold condensed sans-serif in white, nightlife poster impact', accent: 'bold sans-serif in neon magenta or cyan', numbers: 'massive condensed bold numbers with glow effect', body: 'clean sans-serif in white', labels: 'small bold uppercase in neon accent color' },
    cardStyle: 'dark panels with vibrant gradient borders, glow effects', chartStyle: 'neon gradient bars, glow effects, dark background',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'magenta (#ff00ff)', text: 'white (#ffffff)', background: 'black (#000000)' },
  },
  promptTemplate: 'Nightclub flyer. Bold vibrant colors, lens flares, party energy, ultra bold typography.',
}

export const concertPoster: TemplateSpec = {
  id: 'concert-poster', name: 'Concert Poster', description: 'Screen-printed concert poster aesthetic',
  designSpec: {
    background: { base: 'dark charcoal (#1a1a1a)' },
    decorativeElements: { primary: 'screen-print style illustration — limited color palette, visible print texture', secondary: 'woodcut/linocut style borders and frames', accents: 'small venue/date details in classic poster layout' },
    typography: { headline: 'bold condensed woodblock/poster sans-serif in PRIMARY, high impact', accent: 'condensed uppercase in SECONDARY', numbers: 'large condensed bold numbers in PRIMARY', body: 'clean condensed sans-serif in light gray', labels: 'small condensed uppercase in SECONDARY' },
    cardStyle: 'screen-print style panels with limited color fills, print texture visible', chartStyle: 'screen-print bar charts — flat fills with print texture',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'light gray (#dddddd)', background: 'dark charcoal (#1a1a1a)' },
  },
  promptTemplate: 'Screen-printed concert poster. Limited color palette, woodcut textures, bold condensed type, gig poster aesthetic.',
}

export const moviePoster: TemplateSpec = {
  id: 'movie-poster', name: 'Movie Poster', description: 'Cinematic movie poster with dramatic lighting',
  designSpec: {
    background: { base: 'dark (#0a0a14)', gradient: 'dramatic spotlight — bright from center-top, dark at edges' },
    decorativeElements: { primary: 'cinematic light beams, lens flares, atmospheric fog', secondary: 'film grain texture overlay at 3%', accents: 'small star ratings, critic quote formatting, credits block' },
    typography: { headline: 'bold condensed serif or sans-serif in white, cinematic title treatment — large, dramatic', accent: 'condensed uppercase in gold or PRIMARY for taglines', numbers: 'large cinematic numbers in white with subtle glow', body: 'clean condensed sans-serif in light gray', labels: 'small condensed uppercase for credits-style text' },
    cardStyle: 'dark cinematic panels with spotlight lighting, dramatic shadows', chartStyle: 'minimal dramatic charts — white on dark, cinematic feel',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'gold (#c5a55a)', text: 'white (#ffffff)', background: 'dark (#0a0a14)' },
  },
  promptTemplate: 'Cinematic movie poster. Dramatic lighting, spotlight effects, bold title treatment, blockbuster energy.',
}

export const festival: TemplateSpec = {
  id: 'festival', name: 'Festival', description: 'Music festival with boho/outdoor vibes',
  designSpec: {
    background: { base: 'warm sunset gradient (#ff9a56 to #ff6b95 to #a855f7)', texture: 'subtle noise grain' },
    decorativeElements: { primary: 'boho patterns — dream catchers, feathers, floral mandala elements', secondary: 'festival banner flags, string lights', accents: 'small floral and celestial elements — moons, stars, crystals' },
    typography: { headline: 'bold rounded sans-serif in white, festival poster style', accent: 'boho script in white for accent phrases', numbers: 'large bold white numbers with slight shadow', body: 'clean sans-serif in white', labels: 'small uppercase in white at 80%' },
    cardStyle: 'frosted white panels (rgba(255,255,255,0.15)) on gradient, boho corner decorations', chartStyle: 'white bars on gradient background, rounded ends, festival energy',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'sunset gradient (#ff9a56)' },
  },
  promptTemplate: 'Music festival outdoor vibes. Sunset gradients, boho elements, string lights, warm and free-spirited.',
}

export const scientificPaper: TemplateSpec = {
  id: 'scientific-paper', name: 'Scientific Paper', description: 'Academic scientific publication style',
  designSpec: {
    background: { base: 'white (#ffffff)' },
    decorativeElements: { primary: 'clean scientific figure frames with labeled axes', secondary: 'molecular/atom diagrams, DNA helix decorative elements', accents: 'footnote markers, citation numbers, figure labels (Fig. 1, Table 2)' },
    typography: { headline: 'bold serif in black, academic paper heading style', accent: 'italic serif in dark gray for emphasis and Latin terms', numbers: 'clean tabular serif numbers in black, scientific notation style', body: 'serif in dark gray (#333), academic reading width', labels: 'small sans-serif in gray for figure captions and axis labels' },
    cardStyle: 'clean bordered frames with "Figure X:" captions, minimal styling', chartStyle: 'scientific scatter plots and line charts, clean axes, serif labels, error bars',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'black (#000000)', background: 'white (#ffffff)' },
  },
  promptTemplate: 'Scientific academic paper. Clean figures, serif typography, formal hierarchy, research publication aesthetic.',
}

export const collageScrapbook: TemplateSpec = {
  id: 'collage-scrapbook', name: 'Collage Scrapbook', description: 'Scrapbook with photos, stickers, and decorations',
  designSpec: {
    background: { base: 'craft paper (#e8dcc8)', texture: 'scrapbook paper texture with subtle pattern' },
    decorativeElements: { primary: 'photo frames at slight angles with corner mounts, polaroid-style', secondary: 'decorative stickers, washi tape strips, paper flowers', accents: 'small hearts, stars, buttons, ribbon bows' },
    typography: { headline: 'handwritten marker in dark brown, fun and personal', accent: 'sticker-label style text in PRIMARY', numbers: 'handwritten numbers in dark brown, circled or starred', body: 'clean handwriting-style in dark brown', labels: 'small label-maker style uppercase' },
    cardStyle: 'photo/polaroid frames at slight angles, taped or pinned to background', chartStyle: 'hand-drawn charts with sticker-style data labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark brown (#3a2a1a)', background: 'craft paper (#e8dcc8)' },
  },
  promptTemplate: 'Scrapbook collage. Photo frames, stickers, washi tape, handwritten labels, personal and warm.',
}

export const gradientMesh: TemplateSpec = {
  id: 'gradient-mesh', name: 'Gradient Mesh', description: 'Modern fluid gradient mesh backgrounds',
  designSpec: {
    background: { base: 'fluid mesh gradient — blending PRIMARY, SECONDARY, and complement colors in soft organic shapes', gradient: 'multi-color mesh gradient with 4-5 color points, blurred organic blobs' },
    decorativeElements: { primary: 'fluid gradient shapes floating in background', secondary: 'frosted glass panels over gradient', accents: 'subtle blur orbs, soft light points' },
    typography: { headline: 'bold sans-serif in white, weight 800, with subtle text shadow for readability', accent: 'medium sans-serif in white at 90%', numbers: 'extra bold white numbers with slight shadow', body: 'clean sans-serif in white at 85%', labels: 'small uppercase in white at 60%' },
    cardStyle: 'frosted glass panels (rgba(255,255,255,0.1)) with backdrop-blur on gradient, thin white border at 15%', chartStyle: 'frosted glass chart elements on gradient, white lines and labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'gradient mesh' },
  },
  promptTemplate: 'Fluid gradient mesh. Organic color blobs, frosted glass cards, modern and vibrant, Apple-inspired aesthetic.',
}

export const newspaper: TemplateSpec = {
  id: 'newspaper', name: 'Newspaper', description: 'Modern newspaper/broadsheet layout',
  designSpec: {
    background: { base: 'light warm gray (#f5f3f0)' },
    decorativeElements: { primary: 'newspaper column rules, thick horizontal dividers between stories', secondary: 'section headers with bold rules above and below', accents: 'dateline elements, byline formatting, pull quotes' },
    typography: { headline: 'bold condensed serif in black, newspaper headline impact', accent: 'italic serif in dark gray for deck/subhead', numbers: 'large condensed serif numbers in black', body: 'serif in dark gray, narrow column width', labels: 'small sans-serif uppercase for section labels — "BUSINESS", "MARKETS"' },
    cardStyle: 'column-based layout with rules, no cards — open editorial design', chartStyle: 'clean newspaper infographic — black, gray, one accent color',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'black (#000000)', background: 'light warm gray (#f5f3f0)' },
  },
  promptTemplate: 'Modern newspaper broadsheet. Column layout, bold headlines, rules and dividers, journalistic authority.',
}

export const travelMagazine: TemplateSpec = {
  id: 'travel-magazine', name: 'Travel Magazine', description: 'Glossy travel magazine with large photos',
  designSpec: {
    background: { base: 'white (#ffffff)' },
    decorativeElements: { primary: 'large scenic photo areas with text overlays, magazine-style layout', secondary: 'thin elegant rules and page numbers', accents: 'small compass/map icons, location pins, travel stamps' },
    typography: { headline: 'elegant light serif in dark charcoal, wide letter-spacing, magazine cover style', accent: 'condensed uppercase sans-serif in PRIMARY for location names', numbers: 'elegant serif numbers for prices, distances, ratings', body: 'clean serif in dark gray, magazine column width', labels: 'small condensed uppercase sans-serif in PRIMARY' },
    cardStyle: 'photo-forward cards with text overlay, magazine spread layout', chartStyle: 'clean editorial charts, travel-magazine infographic style',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark charcoal (#222)', background: 'white (#ffffff)' },
  },
  promptTemplate: 'Glossy travel magazine. Large photo areas, elegant typography, magazine spread layout, aspirational and beautiful.',
}
