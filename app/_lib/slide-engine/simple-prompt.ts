/**
 * Simple Slide Prompt Builder
 *
 * Generates clean, direct prompts for OpenAI image generation.
 * Each template is just a style description string — no complex specs.
 */

export interface SimpleSlideInput {
  type: 'cover' | 'content' | 'closing'
  stylePrompt: string
  headline: string
  subtitle?: string
  brandName?: string
  brandColors: { primary: string; secondary: string }
  stats?: { label: string; value: string }[]
  bullets?: { text: string }[]
  contactInfo?: { phone?: string; website?: string; email?: string; calendly?: string }
  narrationContext?: string
  pageNumber: number
  totalPages: number
}

export function buildSimpleSlidePrompt(input: SimpleSlideInput): string {
  const { type, stylePrompt, headline, subtitle, brandName, brandColors, stats, bullets, contactInfo, pageNumber, totalPages } = input

  const contentLines: string[] = []

  if (type === 'cover') {
    contentLines.push(`This is a COVER/TITLE slide — bold, cinematic, first impression.`)
    contentLines.push(`Title: "${headline}"`)
    if (subtitle) contentLines.push(`Subtitle: "${subtitle}"`)
  } else if (type === 'closing') {
    contentLines.push(`Closing slide. "${headline}"`)
    if (brandName) contentLines.push(`"${brandName}"`)
    if (contactInfo?.phone) contentLines.push(`Phone: ${contactInfo.phone}`)
    if (contactInfo?.email) contentLines.push(`Email: ${contactInfo.email?.toLowerCase()}`)
    if (contactInfo?.website) contentLines.push(`Website: ${contactInfo.website?.toLowerCase()}`)
    if (!contactInfo?.phone && !contactInfo?.email && !contactInfo?.website) {
      contentLines.push(`Show brand name large with "Thank You" below.`)
    }
  } else {
    contentLines.push(`Title: "${headline}"`)
    if (subtitle) contentLines.push(`Subtitle: "${subtitle}"`)
    if (stats && stats.length > 0) {
      contentLines.push(`Key stats:`)
      stats.forEach(s => contentLines.push(`- ${s.label}: ${s.value}`))
    }
    if (bullets && bullets.length > 0) {
      contentLines.push(`Key points:`)
      bullets.forEach(b => contentLines.push(`- ${b.text}`))
    }
  }

  if (brandName && type !== 'closing') contentLines.push(`"${brandName}" small at bottom.`)
  if (input.narrationContext) contentLines.push(`CONTEXT: While this slide is showing, the narrator is saying: "${input.narrationContext.slice(0, 200)}". The slide content MUST match this topic.`)
  contentLines.push(`Slide ${pageNumber} of ${totalPages}.`)

  return `Create a professional presentation slide, 1920x1088 pixels.

${stylePrompt}
Colors: primary ${brandColors.primary}, accent ${brandColors.secondary}.
Glossy, polished finish — subtle glass reflections, soft glows behind key elements, depth with layered shadows.

${contentLines.join('\n')}

Rules: Show only the text listed above. Spell everything exactly. 80px padding. No logo. Keep top-right corner clear with a light or white background area (at least 220x140px) so a logo can be overlaid there with good contrast.`
}

/**
 * Style prompts for built-in templates.
 * Each is a concise visual description — no engineering specs.
 */
export const STYLE_PROMPTS: Record<string, string> = {
  'executive': 'Executive corporate style — deep navy gradient background, gold accent lines, elegant serif headlines, premium boardroom feel.',
  'steampunk': 'Steampunk style — aged dark metal background with brass gears and mechanical elements, ornate copper frames, riveted panels, warm amber lighting, vintage industrial feel.',
  'urban-friday': 'Urban nightlife style — dark backgrounds with bold neon text, street art influences, gritty textures, club poster energy.',
  'profile-resume': 'Professional resume layout — clean white background, sidebar accent, headshot area, structured sections, corporate typography.',
  'neon-cyber': 'Cyberpunk neon style — dark background with vibrant neon glows (pink, blue, green), circuit patterns, futuristic grid lines, high-tech sci-fi feel.',
  'glassmorphism': 'Glassmorphism style — frosted glass panels with blur effect over colorful gradient background, subtle transparency, modern floating card aesthetic.',
  'watercolor': 'Watercolor art style — soft painted washes, organic flowing shapes, delicate brush strokes, artistic hand-crafted feel, pastel tones.',
  'chalkboard': 'Chalkboard style — dark green/black chalk surface, hand-drawn chalk text and illustrations, chalk dust effects, classroom nostalgia feel.',
  'art-deco': 'Art Deco style — geometric symmetry, gold and black palette, ornate fan/sunburst patterns, 1920s luxury, Gatsby-era elegance.',
  'medical-journal': 'Medical journal style — clean white layout, blue/teal accents, clinical typography, anatomical line drawings, professional healthcare feel.',
  'legal-brief': 'Legal document style — off-white parchment, serif typography, formal structured layout, court document aesthetic, authoritative and serious.',
  'commercial-pro': 'Commercial real estate style — sleek dark background, bold white text, property showcase layout, luxury real estate marketing feel.',
  'comic-book': 'Comic book style — bold outlines, halftone dots, POW/BAM energy, speech bubbles, vibrant primary colors, action-packed panels.',
  'marble-gold': 'Luxury marble and gold style — white/gray marble texture background, gold foil accents and borders, elegant serif typography, high-end boutique feel.',
  'neubrutalism': 'Neubrutalism style — bold black outlines, offset colored shadows, raw typography, intentionally rough aesthetic, anti-design modern.',
  'terminal': 'Terminal/hacker style — black background, green monospace text, command line aesthetic, matrix-style data, retro computing feel.',
  'social-grid': 'Social media grid style — Instagram-inspired card layout, rounded corners, gradient accents, modern influencer aesthetic, mobile-first design.',
  'blue-steps': 'Step-by-step process style — numbered circles connected by lines, blue gradient accents, clean corporate progression layout.',
  'isometric': 'Isometric 3D style — geometric 3D shapes and blocks, depth perspective, modern tech illustration, clean data visualization.',
  'flat-vector': 'Flat vector style — clean minimal design, bold flat colors, geometric shapes, modern illustration, no shadows.',
  'doodle': 'Hand-drawn doodle style — sketched elements on white, notebook paper feel, marker color accents, playful and approachable.',
  'line-art': 'Line art style — elegant single-weight line illustrations, minimal color, sophisticated simplicity, architectural drawing feel.',
  'vintage-craft': 'Vintage craft style — aged paper textures, stamp/letterpress typography, muted earthy colors, handmade artisanal aesthetic.',
  'flat-cartoon': 'Flat cartoon style — colorful character illustrations, rounded shapes, friendly approachable feel, children\'s book aesthetic.',
  'colorful-steps': 'Colorful steps style — vibrant multi-colored step cards, rainbow progression, bold numbers, energetic and dynamic.',
  'timeline': 'Timeline style — horizontal or vertical timeline with dated milestones, connecting lines, chronological progression layout.',
  'anime-pop': 'Anime pop style — bold vibrant colors, manga-inspired typography, dynamic angles, speed lines, Japanese pop culture energy.',
  'felt-craft': 'Felt craft style — textured felt/fabric backgrounds, stitched borders, button decorations, cozy handmade warmth.',
  'botanical-warm': 'Botanical warm style — illustrated leaves and flowers, warm earth tones, organic natural frames, garden-inspired elegance.',
  'vintage-editorial': 'Vintage editorial style — magazine layout, large serif headlines, column layout, old-world print aesthetic, sepia tones.',
  'torn-collage': 'Torn collage style — ripped paper layers, mixed media, overlapping textures, scrapbook aesthetic, raw creative energy.',
  'inventor-box': 'Inventor blueprint style — technical drawing on blue grid paper, schematic diagrams, patent illustration feel, engineering precision.',
  'cafe-realistic': 'Cafe realistic style — warm coffee shop ambiance, wooden textures, chalkboard menus, cozy warm lighting, lifestyle photography feel.',
  'old-newspaper': 'Old newspaper style — yellowed newsprint, column layout, vintage headlines, typewriter font, breaking news aesthetic.',
  'paper-layers': 'Paper layers style — stacked cut paper depth effect, subtle shadows between layers, origami-inspired, clean dimensional design.',
  'street-graffiti': 'Street graffiti style — spray paint textures, brick wall background, bold tag-style text, urban street art energy.',
  'urban-chaos': 'Urban chaos style — layered city textures, gritty overlapping elements, concrete and steel, raw metropolitan energy.',
  'urban-canvas': 'Urban canvas style — street art on clean walls, curated graffiti aesthetic, gallery-quality urban art, refined street culture.',
  'neon-nightclub': 'Neon nightclub style — dark venue with vivid neon lights, DJ booth energy, pulsing color gradients, nightlife atmosphere.',
  'brick-blocks': 'Brick blocks style — LEGO-inspired pixel blocks, solid bright colors, playful construction aesthetic, building-block fun.',
  'cinematic-hud': 'Cinematic HUD style — sci-fi heads-up display, transparent data overlays, targeting brackets, military tech interface aesthetic.',
  'americana-poster': 'Americana poster style — vintage US propaganda poster aesthetic, bold stars and stripes, patriotic colors, retro illustration.',
  'black-label': 'Black label style — premium dark background, minimalist white/gold typography, luxury brand aesthetic, exclusive high-end feel.',
  'fire-vibes': 'Fire vibes style — dark background with flame effects, ember particles, warm orange/red gradients, intense energy.',
  'summer-fest': 'Summer festival style — bright sunny colors, palm trees, tropical patterns, beach party energy, outdoor event poster.',
  'indie-zine': 'Indie zine style — DIY cut-and-paste layout, xerox texture, punk typography, underground publication aesthetic.',
  'red-neon': 'Red neon style — dark background with red neon glow effects, moody atmosphere, red-light district aesthetic, dramatic lighting.',
  'editorial': 'Editorial style — high-fashion magazine layout, bold typography hierarchy, generous whitespace, sophisticated print design.',
  'rock-poster': 'Rock poster style — concert poster aesthetic, distressed textures, bold band-name typography, skull/lightning motifs, rebellion energy.',
  'street-grunge': 'Street grunge style — dirty textures, torn edges, spray paint, distressed typography, 90s alternative aesthetic.',
  'stock-certificate': 'Stock certificate style — ornate border engraving, formal certificate layout, embossed seal, financial document elegance.',
  'vintage-bond': 'Vintage bond style — classic financial document, ornate scrollwork borders, copperplate engraving, treasury aesthetic.',
  'nightclub-flyer': 'Nightclub flyer style — flashy dark design, bold event typography, DJ name placement, party atmosphere, VIP energy.',
  'concert-poster': 'Concert poster style — dramatic band imagery, bold stacked text, venue/date layout, rock show energy.',
  'movie-poster': 'Movie poster style — cinematic hero shot composition, dramatic lighting, tagline placement, Hollywood blockbuster feel.',
  'festival': 'Festival style — vibrant psychedelic patterns, multi-act lineup layout, bohemian colors, outdoor music event energy.',
  'scientific-paper': 'Scientific paper style — clean academic layout, figure/table numbering, citation style, peer-review journal aesthetic.',
  'collage-scrapbook': 'Collage scrapbook style — layered photos and cutouts, washi tape, stickers, handwritten notes, personal memory book feel.',
  'gradient-mesh': 'Gradient mesh style — smooth flowing color gradients, abstract organic shapes, modern generative art, liquid color transitions.',
  'newspaper': 'Newspaper style — broadsheet column layout, bold headlines, article format, black and white with spot color, daily news aesthetic.',
  'travel-magazine': 'Travel magazine style — stunning destination imagery, elegant typography overlay, wanderlust aesthetic, luxury travel editorial.',
  'luxury': 'Luxury style — premium dark background, gold foil accents, elegant serif typography, high-end brand aesthetic, exclusive feel.',
  'warm-story': 'Warm, cozy illustration style. Soft golden lighting, nature scenes, families, organic shapes. Rich earth tones with warm amber, terracotta, and cream. Characters have friendly, simple features. Scenes feel like a storybook — inviting, safe, hopeful. Subtle textures like watercolor wash or soft grain.',
  'corporate-clean': 'Clean corporate flat vector illustration style. Professional blue (#1B365D) and teal palette on white/light gray backgrounds. Simple geometric shapes, clean icons, organized grid layouts. Characters are minimal, faceless silhouettes or simple figures. Data-forward with clean typography. Feels polished, trustworthy, Fortune 500.',
  'bold-infographic': 'Bold high-contrast infographic style. Dark navy or black background with vibrant accent colors — electric blue, bright orange, vivid green. Massive numbers that dominate the frame. Strong visual hierarchy with thick borders and color blocks. Data visualization as art. Feels powerful, impactful, impossible to ignore.',
  'dark-cinematic': 'Cinematic dark illustration style. Deep navy (#0A1628) and charcoal backgrounds with rich gold (#C5A55A) and champagne accents. Dramatic lighting with glows and light rays. Elegant serif typography for headings. Scenes feel like movie posters — epic scale, dramatic composition. Subtle texture and depth. Feels luxurious, prestigious, powerful.',
  'playful-cartoon': 'Bright playful cartoon illustration style. Vibrant primary colors — red, blue, yellow, green on white backgrounds. Friendly round characters with big expressions. Fun shapes, speech bubbles, stars, confetti. Simple but engaging compositions. Data presented in colorful cards and badges. Feels young, energetic, approachable, fun.',
  'apex-corporate': 'Modern corporate infographic presentation style. Clean white background with bold geometric accent shapes — diagonal color blocks cutting across corners, large circles and rounded rectangles as content containers. Flat vector icons inside colored circles. Strong visual hierarchy with large bold sans-serif headlines and organized grid sections. Decorative star/burst accents and dot patterns for visual interest. Color blocks use the brand primary and secondary colors. Professional, structured, data-forward. Feels like a premium internal corporate report or investor deck — polished, authoritative, organized. IMPORTANT: Leave the top-left corner area (approximately 300x100 pixels) EMPTY with just the white background — no text, no logo, no graphics in that zone. A logo will be composited there afterward. NEVER invent or display any phone numbers, email addresses, website URLs, or contact information on any slide. If no contact info is explicitly provided in the prompt, leave the bottom bar empty or use it for decorative elements only.',
  'isometric-3d': 'Isometric 3D infographic design on a clean white background. Data and concepts visualized as colorful 3D isometric objects — stacked coins for money, shield towers for protection, growing plants for growth, bar charts as 3D blocks, circular gauges as floating rings. Each metric gets its own 3D element with a short label below it. Bold sans-serif headline at the top. Soft realistic shadows under each element. Vibrant but professional color palette using the brand colors. Isometric grid layout with generous spacing. Feels like Slack/Asana marketing illustrations meets a financial dashboard — playful yet corporate, data-forward, premium. IMPORTANT: Leave the top-left corner area (approximately 300x100 pixels) EMPTY with just the white background — a logo will be composited there afterward. NEVER invent or display any phone numbers, email addresses, website URLs, or contact information on any slide. If no contact info is explicitly provided in the prompt, leave the bottom area empty or use it for decorative elements only.',
}

/**
 * Get the style prompt for a template ID.
 * Falls back to isometric-3d style (the default active style).
 */
export function getStylePrompt(id: string): string {
  return STYLE_PROMPTS[id] || STYLE_PROMPTS['isometric-3d']
}
