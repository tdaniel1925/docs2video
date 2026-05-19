import type { TemplateSpec } from '../types'

export const colorfulSteps: TemplateSpec = {
  id: 'colorful-steps', name: 'Colorful Steps', description: 'Vibrant step-by-step with rainbow accents',
  designSpec: {
    background: { base: 'white (#ffffff)' },
    decorativeElements: { primary: 'colorful numbered circles connected by gradient lines — each step a different color from a rainbow palette', secondary: 'subtle colored dots pattern in background', accents: 'small colored arrows between steps' },
    typography: { headline: 'bold sans-serif in dark charcoal (#222)', accent: 'bold sans-serif in current step color', numbers: 'large bold white numbers inside colorful circles', body: 'clean sans-serif in gray (#555)', labels: 'small bold uppercase in current accent color' },
    cardStyle: 'white cards with colored top border (different color per card), subtle shadow', chartStyle: 'rainbow-colored bars — each bar a different bright color',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark charcoal (#222)', background: 'white (#ffffff)' },
  },
  promptTemplate: 'Colorful step-by-step progression. Rainbow accents, numbered circles, vibrant and organized.',
}

export const timeline: TemplateSpec = {
  id: 'timeline', name: 'Timeline', description: 'Chronological timeline with connected events',
  designSpec: {
    background: { base: 'light gray (#f8f8fa)' },
    decorativeElements: { primary: 'vertical or horizontal timeline line in PRIMARY color with event dots', secondary: 'date/year labels along the timeline', accents: 'small connector lines from events to timeline, milestone markers' },
    typography: { headline: 'bold sans-serif in dark navy (#1a1a3a)', accent: 'medium sans-serif in PRIMARY for dates and milestones', numbers: 'bold year/date numbers in PRIMARY inside timeline circles', body: 'clean sans-serif in dark gray (#444)', labels: 'small uppercase in muted gray' },
    cardStyle: 'white event cards connected to timeline, subtle shadow, left or alternating layout', chartStyle: 'timeline-based charts, progression indicators',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark navy (#1a1a3a)', background: 'light gray (#f8f8fa)' },
  },
  promptTemplate: 'Chronological timeline layout. Connected events, progression markers, organized and clear.',
}

export const animePop: TemplateSpec = {
  id: 'anime-pop', name: 'Anime Pop', description: 'Japanese anime-inspired pop art style',
  designSpec: {
    background: { base: 'bright pink-white gradient (#fff0f5 to #ffffff)', texture: 'subtle screentone dots at 3%' },
    decorativeElements: { primary: 'anime-style speed lines, action bursts, and sparkle effects in PRIMARY', secondary: 'kawaii decorative elements — stars, hearts, sparkles', accents: 'manga panel borders, chibi-style accent characters' },
    typography: { headline: 'extra bold sans-serif in dark (#1a1a1a) with slight outline, anime title style', accent: 'bold italic in PRIMARY color with slight glow', numbers: 'massive bold numbers with colored outline and sparkle effects', body: 'clean sans-serif in dark gray', labels: 'small bold uppercase in PRIMARY' },
    cardStyle: 'panels with thick dark borders, slightly angled, manga panel style', chartStyle: 'bold colorful bars with thick outlines, sparkle effects on highest values',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark (#1a1a1a)', background: 'light pink-white (#fff0f5)' },
  },
  promptTemplate: 'Anime pop art style. Speed lines, sparkles, bold outlines, manga panels, kawaii aesthetic.',
}

export const feltCraft: TemplateSpec = {
  id: 'felt-craft', name: 'Felt Craft', description: 'Handmade felt and fabric textures',
  designSpec: {
    background: { base: 'light beige felt (#f0e8d8)', texture: 'realistic felt/fabric texture with visible fibers' },
    decorativeElements: { primary: 'stitched borders — visible thread stitch lines in PRIMARY color', secondary: 'felt cut-out shapes — circles, letters, icons in various colors', accents: 'small buttons, pins, and thread elements' },
    typography: { headline: 'stitched/embroidered text effect in dark brown, bold and handcrafted', accent: 'felt letter cut-out style in PRIMARY color', numbers: 'large felt cut-out numbers in PRIMARY, textured', body: 'clean sans-serif in dark brown (#3a2a1a)', labels: 'small stitched uppercase in brown' },
    cardStyle: 'felt patch cards with stitched borders, slightly raised texture effect', chartStyle: 'fabric strip bar charts, felt cut-out shapes for data points',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark brown (#3a2a1a)', background: 'light beige felt (#f0e8d8)' },
  },
  promptTemplate: 'Handmade felt craft style. Fabric textures, stitched borders, cut-out letters, warm and tactile.',
}

export const botanicalWarm: TemplateSpec = {
  id: 'botanical-warm', name: 'Botanical Warm', description: 'Warm tones with botanical illustrations',
  designSpec: {
    background: { base: 'warm cream (#faf5ee)', texture: 'subtle linen texture' },
    decorativeElements: { primary: 'watercolor botanical illustrations — leaves, ferns, eucalyptus in muted greens and warm tones', secondary: 'gold foil thin line accents and frames', accents: 'small botanical corner ornaments, delicate leaf sprigs' },
    typography: { headline: 'elegant serif in dark charcoal (#2a2a2a), weight 600', accent: 'cursive script in gold (#b8963e) for accent phrases', numbers: 'serif numbers in dark charcoal with gold underline accent', body: 'clean serif in medium brown (#5a4a3a)', labels: 'small uppercase sans-serif in muted green, letter-spacing' },
    cardStyle: 'cream cards with gold foil thin border, botanical corner decoration, soft shadow', chartStyle: 'muted earth-tone bars — greens, golds, warm browns',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'gold (#b8963e)', text: 'dark charcoal (#2a2a2a)', background: 'warm cream (#faf5ee)' },
  },
  promptTemplate: 'Warm botanical style. Watercolor leaves, gold accents, elegant serif typography, organic and sophisticated.',
}

export const vintageEditorial: TemplateSpec = {
  id: 'vintage-editorial', name: 'Vintage Editorial', description: 'Classic magazine editorial layout',
  designSpec: {
    background: { base: 'off-white (#f4f0e8)', texture: 'aged paper texture at low opacity' },
    decorativeElements: { primary: 'thin decorative rules and dividers, drop caps on first paragraphs', secondary: 'ornamental flourishes and small editorial icons', accents: 'pull quotes with large quotation marks, column layouts' },
    typography: { headline: 'bold high-contrast serif in black, classic magazine cover style', accent: 'italic serif in PRIMARY color for pull quotes', numbers: 'large condensed serif numbers in black, editorial stat style', body: 'serif in dark gray (#333) with classic column width', labels: 'small caps serif in gray, wide letter-spacing' },
    cardStyle: 'no cards — open editorial layout with columns, rules, and whitespace', chartStyle: 'classic editorial infographic style — clean lines, serif labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'black (#000000)', background: 'off-white (#f4f0e8)' },
  },
  promptTemplate: 'Classic magazine editorial. High-contrast serif typography, drop caps, pull quotes, column layouts, sophisticated.',
}

export const tornCollage: TemplateSpec = {
  id: 'torn-collage', name: 'Torn Collage', description: 'Mixed media collage with torn paper edges',
  designSpec: {
    background: { base: 'muted teal (#2a4a4a)' },
    decorativeElements: { primary: 'torn paper pieces layered at angles — white, cream, colored scraps', secondary: 'tape strips, paper clips, and pins holding elements', accents: 'washi tape strips in PRIMARY/SECONDARY, small stamps and stickers' },
    typography: { headline: 'mixed fonts — some typed, some handwritten, collage style in white or black', accent: 'typewriter font in PRIMARY color', numbers: 'cut-out newspaper-style numbers, mixed sizes', body: 'clean sans-serif on white paper scraps', labels: 'small typewriter text on torn paper strips' },
    cardStyle: 'torn paper cards at slight angles, layered with tape and shadow', chartStyle: 'collage-style infographics — cut-out shapes, layered paper elements',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'muted teal (#2a4a4a)' },
  },
  promptTemplate: 'Mixed media torn paper collage. Layered paper scraps, tape, pins, typewriter text, textured and artistic.',
}
