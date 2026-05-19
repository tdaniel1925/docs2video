import type { TemplateSpec } from '../types'

export const indieZine: TemplateSpec = {
  id: 'indie-zine', name: 'Indie Zine', description: 'DIY zine with photocopied punk aesthetic',
  designSpec: {
    background: { base: 'off-white (#f0ece0)', texture: 'photocopy noise/grain texture, slightly dirty' },
    decorativeElements: { primary: 'cut-and-paste collage elements, ransom-note style mixed fonts', secondary: 'Xerox-style halftone photos, tape strips', accents: 'hand-drawn stars, X marks, arrows in black marker' },
    typography: { headline: 'mixed fonts — some typewriter, some bold sans, ransom-note collage style', accent: 'typewriter font in black', numbers: 'cut-out newspaper-style numbers, photocopied aesthetic', body: 'typewriter font in black', labels: 'small typed uppercase with manual underline' },
    cardStyle: 'photocopied paper scraps pasted at angles, tape/staple marks', chartStyle: 'hand-drawn with ruler, photocopied look, rough labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'black (#000000)', background: 'off-white (#f0ece0)' },
  },
  promptTemplate: 'DIY indie zine. Photocopy aesthetic, cut-and-paste collage, typewriter text, punk zine energy.',
}

export const redNeon: TemplateSpec = {
  id: 'red-neon', name: 'Red Neon', description: 'Dark with red neon accents',
  designSpec: {
    background: { base: 'very dark (#0a0505)', gradient: 'subtle dark red vignette from edges' },
    decorativeElements: { primary: 'red neon tube light borders and signs', secondary: 'red glow reflections on dark surfaces', accents: 'small red LED dots, subtle smoke/fog' },
    typography: { headline: 'bold sans-serif in white with red neon glow shadow', accent: 'neon red (#ff1a1a) with tube-light glow effect', numbers: 'large bold numbers in neon red with glow', body: 'clean sans-serif in light gray (#bbb)', labels: 'small uppercase in red at 60%' },
    cardStyle: 'dark panels (#111) with red neon border glow, smoky feel', chartStyle: 'red neon-glowing bars on dark background',
    colorSlots: { primary: 'neon red (#ff1a1a)', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'very dark (#0a0505)' },
  },
  promptTemplate: 'Red neon on dark. Glowing red accents, moody atmosphere, cinematic noir.',
}

export const editorial: TemplateSpec = {
  id: 'editorial', name: 'Editorial', description: 'Modern editorial magazine layout',
  designSpec: {
    background: { base: 'white (#ffffff)' },
    decorativeElements: { primary: 'bold typographic layout — large drop caps, pull quotes, editorial hierarchy', secondary: 'thin rules and dividers, column layouts', accents: 'accent color blocks, highlighted text spans' },
    typography: { headline: 'bold condensed serif in black, large editorial impact', accent: 'medium serif italic in PRIMARY', numbers: 'large condensed serif numbers in black', body: 'serif in dark gray (#333) with reading-optimized spacing', labels: 'small sans-serif uppercase in PRIMARY, letter-spacing' },
    cardStyle: 'clean open layout — no cards, uses whitespace, rules, and typography for hierarchy', chartStyle: 'minimal editorial charts — clean lines, serif labels, accent color highlights',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'black (#000000)', background: 'white (#ffffff)' },
  },
  promptTemplate: 'Modern editorial magazine. Bold typography hierarchy, whitespace, clean rules, sophisticated reading experience.',
}

export const rockPoster: TemplateSpec = {
  id: 'rock-poster', name: 'Rock Poster', description: 'Vintage rock concert poster style',
  designSpec: {
    background: { base: 'dark navy (#0a0a1a)', texture: 'subtle grain/noise texture' },
    decorativeElements: { primary: 'psychedelic swirls and flowing organic shapes in PRIMARY/SECONDARY', secondary: 'vintage poster border with ornamental corners', accents: 'star bursts, lightning bolts, vintage decorative elements' },
    typography: { headline: 'psychedelic/art nouveau display font in white or PRIMARY, fluid and dramatic', accent: 'condensed uppercase in SECONDARY with slight arc/curve', numbers: 'large ornamental numbers with decorative framing', body: 'clean sans-serif in light gray', labels: 'small condensed uppercase in PRIMARY' },
    cardStyle: 'vintage poster sections with ornamental borders, psychedelic accents', chartStyle: 'flowing organic shapes for charts, gradient fills in PRIMARY/SECONDARY',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'dark navy (#0a0a1a)' },
  },
  promptTemplate: 'Vintage rock concert poster. Psychedelic swirls, art nouveau influences, dramatic typography, counterculture aesthetic.',
}

export const streetGrunge: TemplateSpec = {
  id: 'street-grunge', name: 'Street Grunge', description: 'Raw grunge with distressed elements',
  designSpec: {
    background: { base: 'dark dirty beige (#2a2420)', texture: 'heavy grunge/distressed texture, scratches and stains' },
    decorativeElements: { primary: 'distressed/torn elements, rust stains, grunge overlays', secondary: 'stencil markings, industrial tape strips', accents: 'paint drips, marker scrawls, stamp marks' },
    typography: { headline: 'distressed bold sans-serif in white, grunge texture bleeding through', accent: 'stencil-spray style in PRIMARY', numbers: 'large distressed stencil numbers in SECONDARY', body: 'clean sans-serif in light gray on dark panels', labels: 'small stencil uppercase in white at 70%' },
    cardStyle: 'dark distressed panels with torn edges, grunge border treatment', chartStyle: 'rough bar charts with distressed fills, grungy labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'white (#ffffff)', background: 'dark dirty beige (#2a2420)' },
  },
  promptTemplate: 'Raw street grunge. Heavy distressed textures, torn edges, stencils, industrial decay aesthetic.',
}

export const stockCertificate: TemplateSpec = {
  id: 'stock-certificate', name: 'Stock Certificate', description: 'Formal engraved certificate style',
  designSpec: {
    background: { base: 'cream parchment (#f5f0e0)', texture: 'fine engraved crosshatch/guilloché pattern at 5%' },
    decorativeElements: { primary: 'ornate engraved border with fine-line decorative corners and edges', secondary: 'guilloché patterns (fine spirograph-like security patterns)', accents: 'small seal/emblem, ornamental dividers, fine rule lines' },
    typography: { headline: 'engraved-style serif in dark navy (#1a1a3a), formal and authoritative', accent: 'elegant script in dark navy for names and titles', numbers: 'formal serif numbers in dark navy with fine decorative underline', body: 'serif in dark gray (#333)', labels: 'small engraved-style uppercase in navy, wide letter-spacing' },
    cardStyle: 'formal panels with fine-line engraved borders, parchment background', chartStyle: 'formal tables and charts with fine engraved lines, serif labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark navy (#1a1a3a)', background: 'cream parchment (#f5f0e0)' },
  },
  promptTemplate: 'Formal stock certificate. Engraved borders, guilloché patterns, parchment, authoritative and official.',
}

export const vintageBond: TemplateSpec = {
  id: 'vintage-bond', name: 'Vintage Bond', description: 'Classic bond/certificate with ornate borders',
  designSpec: {
    background: { base: 'aged ivory (#f0e8d4)', texture: 'fine aged paper with subtle watermark pattern' },
    decorativeElements: { primary: 'ornate Victorian-style borders with scrollwork and flourishes', secondary: 'rosette patterns and fine crosshatch shading', accents: 'wax seal stamps, ribbon elements, small ornamental devices' },
    typography: { headline: 'ornate serif display in dark brown (#2a1a0a), Victorian elegance', accent: 'elegant copperplate script in dark brown', numbers: 'ornamental serif numbers with small decorative flourishes', body: 'serif in dark brown (#3a2a1a)', labels: 'small ornamental uppercase in brown' },
    cardStyle: 'Victorian framed panels with scrollwork borders on aged paper', chartStyle: 'ornamental charts with fine engraved lines, Victorian decorative labels',
    colorSlots: { primary: 'FROM_LOGO_PRIMARY', secondary: 'FROM_LOGO_SECONDARY', text: 'dark brown (#2a1a0a)', background: 'aged ivory (#f0e8d4)' },
  },
  promptTemplate: 'Vintage bond certificate. Victorian scrollwork, ornate borders, aged paper, formal elegance.',
}
