export interface Profile {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  role: string | null
  photo_url: string | null
  photo_midlevel_url: string | null
  photo_standing_url: string | null
  onboarding_completed: boolean
  default_style: string
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired' | 'agency' | 'pro' | 'business' | 'professional' | 'starter' | 'enterprise' | 'enterprise-plus' | 'enterprise_plus' | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_user_id: string | null
  stripe_access_token: string | null
  calendly_url: string | null
  card_on_file: boolean
  free_videos_remaining: number
  credits_remaining: number
  pack_credits: number
  credits_reset_at: string | null
  referral_code: string | null
  referred_by: string | null
  is_admin: boolean
  is_beta: boolean
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  user_id: string
  video_id: string | null
  client_name: string | null
  client_email: string | null
  line_items: { description: string; amount: number }[]
  subtotal: number
  tax: number
  total: number
  currency: string
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'paid' | 'declined'
  stripe_payment_intent_id: string | null
  paid_at: string | null
  notes: string | null
  due_date: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  video_id: string
  role: 'client' | 'assistant'
  message: string
  created_at: string
}

export interface Brand {
  id: string
  user_id: string
  name: string
  logo_url: string | null
  logo_file_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  text_color: string
  tagline: string | null
  description: string | null
  industry: string | null
  tone: string | null
  target_audience: string | null
  fonts: string[]
  brand_values: string[]
  services: string[]
  social_links: Record<string, string>
  content_themes: string[]
  competitor_notes: string | null
  unique_selling_points: string[]
  brand_guide_data: Record<string, unknown> | null
  reference_slides: string[] | null
  deck_style_id: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Infographic {
  id: string
  user_id: string
  brand_id: string | null
  title: string | null
  source_pdf_url: string | null
  source_pdf_name: string | null
  image_url: string | null
  image_size: string
  policy_data: ExtractedPolicyData | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
  brand?: Brand
}

export interface ExtractedPolicyData {
  policyType: string
  carrier: string
  insuredName: string
  insuredAge: number | null
  deathBenefit: number
  annualPremium: number
  paymentMode: string
  cashValueProjections: {
    year: number
    guaranteed: number
    current: number
  }[]
  surrenderValueProjections: {
    year: number
    guaranteed: number
    current: number
  }[]
  riders: string[]
  loanRate: number | null
  additionalNotes: string[]
  disclaimers?: string[]
}

export interface VideoScene {
  scene: number
  beat: 'hook' | 'disclaimer' | 'disclaimer-close' | 'context' | 'stakes' | 'evidence' | 'implication' | 'action'
  title: string
  narration: string
  slidePrompt: string
  duration: number
}

export interface Video {
  id: string
  user_id: string
  brand_id: string | null
  infographic_id: string | null
  title: string | null
  script: VideoScene[] | null
  voice_id: string
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  slide_urls: string[] | null
  is_trial: boolean
  status: 'pending' | 'scripting' | 'generating_slides' | 'generating_audio' | 'assembling' | 'completed' | 'failed'
  progress_detail: string | null
  progress_pct: number | null
  error_message: string | null
  created_at: string
  brand?: Brand
}

export interface EmailConnection {
  id: string
  user_id: string
  provider: 'google' | 'microsoft' | 'smtp'
  email_address: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_pass: string | null
  imap_host: string | null
  imap_port: number | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface SentEmail {
  id: string
  user_id: string
  video_id: string | null
  infographic_id: string | null
  connection_id: string | null
  to_email: string
  to_name: string | null
  subject: string
  opened_at: string | null
  created_at: string
}

// OpenAI TTS voices — these voices support automatic language detection
// They will speak in whatever language the text is written in
export const VOICE_OPTIONS = [
  { id: 'nova', name: 'Sarah', gender: 'Female', description: 'Friendly and warm — most popular' },
  { id: 'shimmer', name: 'Emily', gender: 'Female', description: 'Gentle and reassuring' },
  { id: 'onyx', name: 'James', gender: 'Male', description: 'Deep and authoritative' },
  { id: 'echo', name: 'Michael', gender: 'Male', description: 'Warm and conversational' },
  { id: 'alloy', name: 'Alex', gender: 'Neutral', description: 'Professional and balanced' },
  { id: 'fable', name: 'Oliver', gender: 'Male', description: 'Expressive with British accent' },
] as const

// Presentation styles
export const SLIDE_STYLES = [
  {
    id: 'executive',
    name: 'Executive',
    description: 'Charcoal and gold, authoritative',
    prompt: 'Executive presentation style. Dark background, metallic accent lines, clean data layout with large numbers, sophisticated serif headings, minimal but authoritative. Looks like a premium Wall Street presentation.',
  },
  {
    id: 'steampunk',
    name: 'Steampunk',
    description: 'Bronze 3D objects, mechanical feel',
    prompt: 'Dark background with warm metallic 3D rendered objects. Mechanical steampunk aesthetic with gears, vintage instruments, ornate metallic frames. Numbered sections with metallic badges. Rich textures, dramatic lighting on metallic elements. Feels sophisticated, vintage-industrial, premium.',
  },
  {
    id: 'social-grid',
    name: 'Social Grid',
    description: 'Photo cards, lifestyle, trendy',
    prompt: 'Modern social media card grid layout with real lifestyle photography in each card. Warm neutral header bar, white card backgrounds, numbered circles, clean sans-serif typography. Each section has a vibrant photo with descriptive labels underneath. Feels trendy, lifestyle-oriented, Instagram-ready.',
  },
  {
    id: 'blue-steps',
    name: 'Blue Steps',
    description: 'Teal, educational, step-by-step',
    prompt: 'Cool-toned color scheme on white background. Step-by-step numbered cards with rounded corners. Cheerful cartoon-style icons and illustrations (characters, lightbulbs, gears, books). Clean educational infographic style with numbered step badges. Feels friendly, educational, approachable.',
  },
  {
    id: 'isometric',
    name: 'Isometric',
    description: '3D isometric, modern, structured',
    prompt: 'White/light gray background with colorful isometric 3D illustrations. Each section features isometric objects (computers, buildings, charts, people). Numbered sections with clean typography. Vibrant color accents. Grid layout with clear visual hierarchy. Feels modern, structured, tech-forward.',
  },
  {
    id: 'flat-vector',
    name: 'Flat Vector',
    description: 'Clean icons, bold colors, professional',
    prompt: 'Clean white background with flat vector illustrations and icons. Simple geometric shapes, bold solid colors. Step-by-step numbered flow with arrows connecting sections. Minimal shadows, clean lines. Professional sans-serif typography. Feels accessible, professional, corporate-friendly.',
  },
  {
    id: 'doodle',
    name: 'Doodle',
    description: 'Hand-drawn, playful, creative',
    prompt: 'White/cream background with hand-drawn doodle-style illustrations. Sketchy lines, playful handwritten-style fonts, thought bubbles, arrows, and squiggles. Colorful but casual. Icons look hand-sketched. Question marks, lightbulbs, sticky notes. Feels creative, brainstormy, approachable, fun.',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    description: 'Soft pastels, artistic, gentle',
    prompt: 'Soft watercolor gradient backgrounds in pastel tones. Flowing organic shapes, gentle color bleeds between sections. Elegant serif headings mixed with clean body text. Botanical watercolor accents. Feels artistic, gentle, natural, premium.',
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    description: 'Dark mode, glowing neon, futuristic',
    prompt: 'Pure black or very dark background with electric neon glow effects. Circuit board patterns, holographic elements, glowing borders on cards. Futuristic monospace and sans-serif fonts. Data feels like its on a HUD display. Feels cutting-edge, tech, cyberpunk, futuristic.',
  },
  {
    id: 'line-art',
    name: 'Line Art',
    description: 'Clean outlines, teal, professional',
    prompt: 'Clean white background with thin line-art icons and illustrations. Minimal color palette — mostly outlines with occasional color fills. Numbered sections with clean borders. Professional data layout with charts and diagrams in line-art style. Feels clean, technical, trustworthy, corporate.',
  },
  {
    id: 'vintage-craft',
    name: 'Vintage Craft',
    description: 'Dark textured, hand-drawn, warm',
    prompt: 'Dark textured background with vintage hand-drawn illustrations in warm cream and metallic tones. Craft paper textures, retro badge labels, ornamental borders. Stars, rockets, and vintage-style characters. Hashtag footer bar. Feels nostalgic, artisanal, warm, characterful.',
  },
  {
    id: 'flat-cartoon',
    name: 'Flat Cartoon',
    description: 'Cheerful illustrations, bright colors',
    prompt: 'White background with cheerful flat cartoon illustrations of people, objects, and scenes. Bright vivid colors. Each section is a card with its own mini-scene illustration. Characters have simple faces and poses. Clean sans-serif typography. Pie charts, bar graphs as simple illustrations. Feels friendly, cheerful, engaging.',
  },
  {
    id: 'colorful-steps',
    name: 'Colorful Steps',
    description: 'Multi-color sections, energetic, playful',
    prompt: 'White background with bright multi-colored numbered sections (each section a different vibrant color). Cartoon character illustrations showing people working, thinking, presenting. Bold sans-serif headings, clear numbered flow. Rocket and growth metaphors. Feels energetic, playful, startup-friendly.',
  },
  {
    id: 'timeline',
    name: 'Timeline',
    description: 'Process flow, teal gradient, clean',
    prompt: 'Clean light gray/white background with a horizontal gradient timeline line running across the center. White rounded cards with subtle shadows float above and below the timeline, connected by dotted lines and circle nodes. Each card has a clean flat icon. Professional sans-serif typography. Numbered step labels on accent-colored badges. Feels corporate, organized, process-oriented, clean.',
  },
  {
    id: 'profile-resume',
    name: 'Profile Resume',
    description: 'Bold metrics, executive, data-rich',
    prompt: 'Cream/off-white background with a bold profile/resume infographic style. Bold contrasting accent colors for headings. Mixed typography — bold uppercase slab-serif for key stats, clean sans-serif for body. Large percentage numbers and metrics prominently displayed. Business icons (charts, shields, graduation caps, coins). Section dividers with dotted lines. Feels professional, data-rich, executive, impactful.',
  },
  {
    id: 'anime-pop',
    name: 'Anime Pop',
    description: 'Manga panels, neon colors, explosive',
    prompt: 'Vibrant anime pop-art style with bold black outlines, bright neon colors, halftone dot patterns, dynamic geometric shapes (triangles, zigzags), manga-style speed lines and action effects. Dark background with explosive color bursts. Bold chunky typography with comic-style impact text. Each data section framed in sharp angular panels like manga panels. High energy, visually explosive, Japanese pop-art meets data visualization.',
  },
  {
    id: 'felt-craft',
    name: 'Felt Craft',
    description: 'Handmade felt, fabric, tactile DIY',
    prompt: 'Handmade felt and fabric craft style. Light gray paper/canvas background with visible texture. All visual elements made from cut felt, fabric, yarn, and craft materials — felt shapes for icons, yarn/string for connecting lines and arrows, cotton balls for clouds, burlap texture for earth tones. Bold uppercase labels with a hand-stamped stenciled font look. Numbered steps with felt badges. Warm, tactile, educational, DIY aesthetic. Shadows cast by felt pieces giving 3D depth.',
  },
  {
    id: 'botanical-warm',
    name: 'Botanical Warm',
    description: 'Ornamental florals, parchment, vintage',
    prompt: 'Warm ethnic botanical style. Cream/warm beige parchment background with aged texture. Rich warm header bar with ornamental floral borders (flowers, leaves, vines). Semi-realistic vintage illustrations for icons (quills, scales, books, plants). Dark numbered circles for steps with connecting arrows. Warm earthy color palette. Serif and bold sans-serif mix. Feels warm, traditional, handcrafted, instructional, like a beautiful artisanal guide.',
  },
  {
    id: 'vintage-editorial',
    name: 'Vintage Editorial',
    description: 'Old-world newspaper, engraved art, green & gold',
    prompt: 'Vintage editorial newspaper style. Aged cream/parchment background with yellowed paper texture. Ornate double-line borders with decorative corner flourishes. Engraved-style detailed illustrations in circular medallion frames like old stock certificates or currency engravings. Classic serif typography with bold impactful headlines. Dark rich color scheme with metallic accents. Bottom section with quotes, stats, and key metrics in separated columns. Ornamental divider lines. Feels like a prestigious old-world financial newspaper.',
  },
  {
    id: 'torn-collage',
    name: 'Torn Collage',
    description: 'Ripped paper, orange & black, punk-zine energy',
    prompt: 'Edgy torn-paper collage style. Crumpled white/gray paper background. Torn paper edges, scotch tape pieces, ripped edges revealing layers underneath. Bold high-contrast color scheme. Chunky bold uppercase sans-serif headlines on paint-stroke backgrounds. Mixed media: code snippets, sticky notes, torn magazine clippings layered on top of each other. Grunge texture overlays. High contrast with bold accent color. Raw, energetic, punk-zine aesthetic. Each data section on a different torn/taped paper piece.',
  },
  {
    id: 'inventor-box',
    name: 'Inventor Box',
    description: 'Victorian curiosity cabinet, brass & wood',
    prompt: 'Victorian inventor specimen box style. Aged parchment/cream background with old paper texture. Data presented as if inside an open wooden display case or shadow box with metallic hinges, clasps, and fittings. Miniature 3D diorama-style scenes in compartments. Handwritten cursive annotations with arrows. Technical blueprint sketches in margins. Metallic pipes, gears, and instruments as decorative elements. Patent certificate style header with ornate border. Warm wood, metallic, and parchment tones. Feels like opening a Victorian curiosity cabinet.',
  },
  {
    id: 'chalkboard',
    name: 'Chalkboard',
    description: 'Chalk on blackboard, colorful, educational',
    prompt: 'Dark chalkboard background with realistic chalk texture and chalk dust. All text and drawings in colorful chalk. Hand-drawn chalk diagrams with arrows, flow charts, boxes. Chalk-drawn icons. Playful chalk doodles like stars and underlines. Bright chalk highlights for emphasis. Chalk eraser smudges adding authenticity. Feels like a brilliant professors whiteboard lecture — educational, approachable, nerdy-cool.',
  },
  {
    id: 'cafe-realistic',
    name: 'Café Guide',
    description: 'Warm realistic illustrations, cookbook style',
    prompt: 'Warm cafe/kitchen realistic illustration style. Warm neutral wooden counter or cafe background with soft warm lighting. Semi-realistic detailed illustrations of objects, tools, and processes — like a beautiful cookbook or barista guide. Numbered steps in a horizontal flow with realistic depicted objects. Clean serif headlines. Warm earthy and metallic tones. Feels like a premium illustrated guide from a high-end coffee table book — warm, inviting, detailed.',
  },
  {
    id: 'old-newspaper',
    name: 'Old Newspaper',
    description: 'Aged broadsheet, torn edges, newsprint',
    prompt: 'Old weathered newspaper broadsheet style. Aged yellowed paper with coffee stains, creased folds, torn edges, and worn corners. Bold black serif masthead headline at the top. Thin horizontal rule dividers. News article layout with columns. A realistic photograph or illustration in the center as the main story. Bold serif headlines for each section. Small classified-ad style boxes with data. Visible paper grain, slightly blurred ink, aged patina. Looks like a photograph of an actual old newspaper.',
  },
  {
    id: 'paper-layers',
    name: 'Paper Layers',
    description: 'Paper cutout craft, iceberg depth, blue ocean',
    prompt: 'Paper cutout layered craft style with an iceberg/depth metaphor. Kraft paper/cardboard textured header bar with bold white stencil text. Upper section has light sky with fluffy paper clouds and colorful paper cutout icons with sticker-style tape labels. Wavy torn paper ocean waterline divides the slide into two halves. Below the waterline is deep dark water with darker paper textures. Paper cutout illustrations float in both zones with label tags. Layered paper edges with slight shadows giving 3D depth. Warm, educational, tactile paper-craft aesthetic.',
  },
  {
    id: 'street-graffiti',
    name: 'Street Graffiti',
    description: 'Spray paint, concrete wall, urban energy',
    prompt: 'Street art graffiti style on a concrete/brick wall. Weathered gray concrete wall background with cracks, stains, and peeling poster remnants. Bold spray-paint style text with dripping paint effects. Bright vivid spray paint colors. Stencil-style icons and illustrations. Speech bubble and banner shapes for labels. Bar charts with dripping spray paint. Simple line-art icons in spray paint style. Paint splatter accents and overspray effects. Urban, raw, energetic street art aesthetic meets data visualization.',
  },
  {
    id: 'urban-chaos',
    name: 'Urban Chaos',
    description: 'Dark 90s zine collage, raw grit, bold rebellion',
    prompt: 'Dark urban chaos 90s zine collage style. Dark charcoal/black textured background with grain, dust particles, and noise. Bold mixed typography — massive white and bright distressed block letters combined with chaotic hand-scrawled script. Lightning bolt and arrow graphic elements slashing across the layout. Black and white halftone/grain-filtered imagery as collage pieces, layered and overlapping at angles. Bold accent bars and highlight strips. Hand-drawn arrows and circle doodles as annotations. Data displayed in bold blocky stencil-style type. Charts rendered as rough cut-out collage pieces. Numbers in massive impact font with distress texture. Raw, unpolished, rebellious — like a punk zine or underground magazine layout meets data presentation. High contrast palette with bold accent colors.',
  },
  {
    id: 'urban-canvas',
    name: 'Urban Canvas',
    description: 'Yellow brick wall, bold brushstrokes, festival energy',
    prompt: 'Urban canvas graffiti festival style. Bright painted brick wall background with visible brick texture. Bold dark brushstroke lettering — thick, aggressive, hand-painted feel with ink splatter and drip effects. Crown and tag motifs as decorative elements. Sweeping diagonal brush lines across corners. Data displayed in bold block banners with dripping edges. Charts use thick brush-painted bars. Numbers in massive impact-style brushstroke font. Ink splatter accents, paint drips from text edges. Raw, energetic, festival poster aesthetic — like a gallery show meets street art. High contrast two-tone palette with occasional accent pops.',
  },
  {
    id: 'neon-nightclub',
    name: 'Neon Nightclub',
    description: 'Electric blue glow, hot pink accents, event flyer energy',
    prompt: 'Neon nightclub event flyer style. Deep dark background with dramatic lighting effects — lens flares, light streaks, bokeh glow. Bold slanted/italic sans-serif typography with neon glow effects on key text and numbers. Diagonal layout with overlapping elements and dynamic angles. Data displayed in glowing neon-bordered cards and panels. Bar charts with neon gradient fills. Key numbers in massive bold italic font with outer glow. Accent elements: light rays, sparkle particles, gradient color bands. High energy, premium nightlife aesthetic — like a VIP event poster meets data presentation.',
  },
  {
    id: 'brick-blocks',
    name: 'Brick Blocks',
    description: 'Colorful toy bricks, 3D photorealistic',
    prompt: 'Realistic interlocking plastic brick construction style. Baseplate as the background surface. All data visualizations built from colorful stacked plastic bricks — bar charts are towers of bright multi-colored bricks. Title text embossed into a long flat brick plate at the top. Labels printed on flat tile pieces. Photorealistic 3D rendering with realistic plastic sheen, visible studs and connection points. Warm studio lighting with soft shadows. Looks like a real photograph of data built from toy bricks.',
  },
  {
    id: 'cinematic-hud',
    name: 'Cinematic HUD',
    description: 'Dramatic sunset, tactical UI, glowing data',
    prompt: 'Cinematic video game concept art style. Dramatic golden hour sunset lighting with volumetric god rays and atmospheric haze. Photorealistic environment background — overgrown urban landscape with nature reclaiming buildings, dramatic clouds, warm sky. Data overlaid using sleek military/tactical HUD interface — translucent dark panels with glowing text, thin neon outlines, radar-style circular elements, progress bars with glow effects. Semi-transparent data cards floating over the cinematic background. Film grain texture. Warm and dramatic tones. Epic, dramatic, immersive.',
  },
  {
    id: 'commercial-pro',
    name: 'Commercial Pro',
    description: 'Deep blue gradient, gold accents, bold sales energy',
    prompt: 'Commercial advertising flyer style. Deep rich gradient background. Bold white sans-serif headline text — large, impactful, sales-forward. Metallic script accent text for emphasis words. Bright circular badge callouts for key numbers and stats (like sale stickers). Curved wave section divider separating content areas. Layered abstract geometric shapes and translucent hexagon patterns in the background for depth. Data displayed in bold text with key metrics inside highlight badges. Bar charts with gradient fills. Bottom section with warm accent background for CTA area. Professional, high-energy, commercial aesthetic — like a premium services advertisement meets data presentation.',
  },
  {
    id: 'americana-poster',
    name: 'Americana Poster',
    description: 'Vintage patriotic, aged parchment, bold distressed type',
    prompt: 'Vintage patriotic Americana poster style. Aged parchment/kraft paper texture background with subtle creases and wear. Bold distressed serif and sans-serif typography — large impactful headlines with weathered texture. Iconic American imagery as decorative elements — stylized landmarks, stars, eagles rendered as vintage illustrations (NOT photographs). Halftone dot patterns for shading. Bold circular badge elements for key statistics. Retro poster aesthetic from the 1940s-60s mixed with modern data presentation. Weathered, textured, confident. Data displayed in bold block sections with vintage label styling. Charts use thick retro bar styles. Numbers in massive display font with distress overlay.',
  },
  {
    id: 'black-label',
    name: 'Black Label',
    description: 'Luxury black & silver, VIP elegance, premium nightlife',
    prompt: 'Luxury black label VIP event style. Deep black background with subtle diagonal stripe texture. Silver and chrome metallic accents — glittering, reflective, premium. Bold serif and sans-serif typography in white and silver with metallic sheen effects. Sparkle and glitter particle effects scattered throughout. Champagne glass and disco ball inspired decorative elements (abstract/stylized, NOT photos). Dramatic spotlight lighting from above creating depth and atmosphere. Data displayed in elegant bordered frames with silver outlines. Key numbers in massive bold font with metallic silver gradient fill. Charts use sleek silver bar designs on black background. Black label/badge shapes for section headers. Everything feels exclusive, high-end, and VIP — like an invitation to the most elite event. Monochrome black, silver, white, and chrome palette.',
  },
  {
    id: 'fire-vibes',
    name: 'Fire Vibes',
    description: 'Intense flames, bold orange glow, extreme nightlife energy',
    prompt: 'Extreme nightlife fire party style. Deep black background with intense orange and amber flame effects — real fire glow, ember particles, heat distortion. Bold ultra-condensed sans-serif typography in white and bright orange with outer glow and fire reflection effects. Cursive/script accent text in warm gold for emphasis words. Orange and red neon light streaks and lens flares cutting across the layout. Fiery gradient overlays from black to deep orange to bright amber. Data displayed in bold block sections with fire-glow borders. Key numbers in massive condensed impact font with orange gradient fill and glow. Charts use flame-gradient bar fills on dark background. Badge elements with orange borders and ember particle effects. Lightning bolt and flame decorative accents. Everything feels extreme, high-energy, and intense — like the hottest party of the year. Deep black, bright orange, amber, warm gold palette.',
  },
  {
    id: 'urban-friday',
    name: 'Urban Friday',
    description: 'Gold splatter, brushstroke text, street party energy',
    prompt: 'Urban street party flyer style. Dark charcoal/black background with gold and yellow paint splatter effects — drips, splatters, and brushstroke textures. Bold mixed typography — massive white condensed block letters for the main headline, overlapping and layered at angles. Bright yellow/gold hand-painted cursive script text for accent words like "Vibes" or "Edition". White directional arrows as graphic accents pointing to key info. Gold metallic splatter and spray paint accents scattered around text. Event details in clean white sans-serif at the bottom. Gritty urban texture overlay on the background. Everything feels raw, energetic, and street — like a hip-hop club night flyer. Data displayed in bold stacked text blocks. Numbers in massive condensed font. Dark black, bright gold/yellow, white palette.',
  },
  {
    id: 'summer-fest',
    name: 'Summer Fest',
    description: 'Pink-to-blue gradient, tropical vibes, playful starburst badges',
    prompt: 'Summer festival tropical flyer style. Soft gradient background blending from warm pink/peach at the top to sky blue at the bottom — sunset-to-ocean feel. Subtle palm leaf silhouettes as decorative overlays. Bold playful mixed typography — large condensed sans-serif for headlines, flowing italic script for accent words. Yellow starburst/sunburst badge shapes for dates and times. Illustrated tropical drink or fruit elements (stylized, NOT photos). Sparkle and shine effects scattered subtly. Contact info section at the bottom in clean layout. Data displayed in colorful badge callouts and rounded cards. Numbers in bold playful font inside starburst shapes. Bright, warm, inviting, carefree — like a beach party or summer music festival. Soft pink, sky blue, bright yellow, white palette.',
  },
  {
    id: 'indie-zine',
    name: 'Indie Zine',
    description: 'DIY newsprint, torn paper, green & orange punk collage',
    prompt: 'Indie DIY zine flyer style. Off-white/cream newsprint textured background with visible paper grain and subtle halftone dot pattern. Bold mixed typography — massive black condensed block letters rotated vertically and horizontally, overlapping and layered. Bright green torn paper strip accents with white text. Large orange/amber block letter words as feature headlines. Torn and ripped paper edge effects on photo placeholder areas (gray halftone rectangles, NOT real photos). Small eye/icon illustrations as decorative punk accents. Event details in small typewriter-style monospace font. Rough, handmade, photocopied aesthetic — like a DIY music venue poster stapled to a telephone pole. Data displayed in bold stacked rotated text. Numbers in massive condensed black font. Off-white, black, bright green, warm orange palette.',
  },
  {
    id: 'red-neon',
    name: 'Red Neon',
    description: 'Dark red neon glow, gold script, grunge nightlife',
    prompt: 'Red neon nightlife event style. Deep black background with red and crimson neon glow effects — light streaks, lens flares, and flowing wave lines in red. Massive bold block headline text with neon red outer glow and white/yellow stroke outlines. Elegant gold cursive script text for accent words and dates. Halftone dot pattern overlay in dark red. Distressed grunge border frame — scratched white edges like an aged photo. Corner date badges in bold white condensed type. Side text rotated vertically for age restrictions and pricing. Bottom info bar with venue details and contact in clean sans-serif. Abstract red silk wave and sparkle effects in the background. Everything feels premium nightlife, seductive, and exclusive. Deep black, neon red, crimson, gold script, white palette.',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Bold angles, CMYK accents, Swiss-Japanese design',
    prompt: 'Modern Swiss-Japanese editorial design. Light silver-gray (#E8E8EC) background. Bold black text at dramatic angles — some text rotated 90 degrees vertically, some at 15-30 degree angles. Use CMYK-inspired accent colors: cyan (#00AEEF), magenta (#EC008C), yellow (#FFF200), and black. Text blocks overlap and intersect at angles. Mix of very large bold condensed sans-serif headings with small body text. Some text runs vertically along edges. Clean horizontal layout for data. Overall feels like a high-end design exhibition poster — asymmetric, dynamic, intentionally breaking grid rules.',
  },
  {
    id: 'rock-poster',
    name: 'Rock Poster',
    description: 'Grunge texture, bold block type, vintage poster feel',
    prompt: 'Vintage rock concert poster style presentation. Bold solid color background (red, blue, or green) with distressed grunge paper texture overlay. Massive bold condensed block uppercase headline text with hard drop shadows. White star decorations between sections. Scratched distressed white border frame around the edges. Secondary text in white condensed sans-serif on dark semi-transparent bars. Halftone dot pattern visible in the background. Faded duotone photo silhouette blended into the background. Footer bar with bold white text badges. Everything feels like a vintage letterpress-printed gig poster — raw, bold, high contrast.',
  },
  {
    id: 'street-grunge',
    name: 'Street Grunge',
    description: 'Torn paper, teal & cream, urban street art energy',
    prompt: 'Urban street art flyer style. Teal/dark cyan (#0d7377) background with cream/off-white (#f5f0e1) torn paper shapes layered on top — ripped edges, overlapping paper scraps at angles. Bold graffiti-style mixed typography — some words in massive bold condensed sans-serif, others in handwritten script italics. Hand-drawn crown doodles and star scribbles as decorations. Dark brush stroke text effects. White torn tape strips with text. Badge elements with dates/numbers. Scattered diagonal text elements. Everything feels like a hand-assembled urban collage — layered, energetic, raw. Mix of dark teal, cream, white, and black.',
  },
  {
    id: 'stock-certificate',
    name: 'Stock Certificate',
    description: 'Ornate parchment, engraved borders, old-world finance',
    prompt: 'Ornate stock certificate design. Cream/ivory parchment background, elaborate engraved border patterns in dark green and gold, classical serif typography, embossed seal effects, fine line engravings of allegorical figures in corners, guilloché patterns, old-world financial document aesthetic. Feels prestigious, official, valuable.',
  },
  {
    id: 'vintage-bond',
    name: 'Vintage Bond',
    description: 'Aged antique paper, copper-plate engravings, historical',
    prompt: 'Aged government bond document style. Yellowed antique paper texture, intricate copper-plate engraving illustrations, classical Roman typography, wax seal marks, decorative rosette patterns, aged ink effects. Feels historical, authoritative, collectible.',
  },
  {
    id: 'art-deco',
    name: 'Art Deco',
    description: 'Black & gold geometric, 1920s Gatsby glamour',
    prompt: 'Art Deco poster design from 1920s. Black background with bold geometric gold patterns, symmetrical sunburst motifs, tall elegant typefaces, chrome and gold metallic accents, Gatsby-era luxury. Sharp angles, chevrons, and fan shapes. Feels glamorous, sophisticated, timeless.',
  },
  {
    id: 'marble-gold',
    name: 'Marble & Gold',
    description: 'White Carrara marble, gold veins, luxury brochure',
    prompt: 'White Carrara marble texture background with thin gold vein lines running through. Elegant gold leaf accents, premium serif typography, generous whitespace, subtle embossed effects. Luxury real estate brochure aesthetic. Feels opulent, refined, high-end.',
  },
  {
    id: 'nightclub-flyer',
    name: 'Nightclub Flyer',
    description: 'Neon pink & cyan glow, dark DJ energy',
    prompt: 'Nightclub event flyer design. Pure black background with electric neon pink, cyan, and purple glow effects. Bold condensed sans-serif typography, lens flare effects, smoke/fog atmosphere, DJ booth silhouette elements. High energy, high contrast. Feels exciting, vibrant, party-ready.',
  },
  {
    id: 'concert-poster',
    name: 'Concert Poster',
    description: 'Grungy dark texture, punk rock, halftone dots',
    prompt: 'Rock concert poster design. Dark grungy textured background with distressed effects, bold blocky typography in red and white, torn paper edges, halftone dot patterns, vintage microphone and guitar silhouettes. Punk/indie rock aesthetic. Feels raw, energetic, underground.',
  },
  {
    id: 'movie-poster',
    name: 'Movie Poster',
    description: 'Cinematic blue-black, orange/teal grading, blockbuster',
    prompt: 'Cinematic movie poster design. Deep blue-black background with dramatic orange/teal color grading, large cinematic title treatment, film grain texture, dramatic spotlight lighting from below, silhouetted figures, aspect ratio bars. Hollywood blockbuster feel. Feels epic, dramatic, premium.',
  },
  {
    id: 'festival',
    name: 'Festival',
    description: 'Psychedelic sunset gradients, retro 70s, dreamy',
    prompt: 'Music festival poster design. Psychedelic flowing gradients in sunset colors (pink, orange, purple, gold), wavy organic typography, fluid blob shapes, retro 70s psychedelic patterns, peace symbols, flower motifs. Feels free-spirited, colorful, dreamy.',
  },
  {
    id: 'medical-journal',
    name: 'Medical Journal',
    description: 'Clinical white, teal accents, scientific precision',
    prompt: 'Medical journal article layout. Clean white background, clinical teal/green accent color, anatomical line drawings, precise data tables, clean sans-serif body text with serif headings, subtle grid lines, pill capsule and DNA helix decorative elements. Feels scientific, trustworthy, precise.',
  },
  {
    id: 'legal-brief',
    name: 'Legal Brief',
    description: 'Formal cream paper, navy serif text, institutional',
    prompt: 'Legal document style. Off-white/cream paper background, dark navy text, thin formal borders, section numbering (I, II, III), serif fonts throughout (like Times New Roman but elegant), paragraph indentation, footnote markers, scales of justice watermark at 5% opacity. Feels authoritative, formal, institutional.',
  },
  {
    id: 'scientific-paper',
    name: 'Scientific Paper',
    description: 'Academic poster, navy headers, scatter plots, scholarly',
    prompt: 'Scientific research poster design. White background with navy/dark blue headers, multi-column layout, embedded scatter plots and bar charts in muted colors, citation numbers, Greek letter symbols (α, β, Σ), molecular structure diagrams as decorative elements. Academic conference poster aesthetic. Feels rigorous, scholarly, data-driven.',
  },
  {
    id: 'collage-scrapbook',
    name: 'Collage Scrapbook',
    description: 'Kraft paper, washi tape, polaroids, handmade',
    prompt: 'Mixed media scrapbook collage style. Kraft paper background, torn paper edges revealing layers underneath, washi tape strips in pastel colors, polaroid-style photo frames, hand-written annotations, sticker effects, pushpin graphics, string connecting elements. Feels creative, personal, handmade.',
  },
  {
    id: 'comic-book',
    name: 'Comic Book',
    description: 'Bold outlines, Ben-Day dots, POW bursts, pop-art',
    prompt: 'Comic book page design. Bold black outlines, halftone Ben-Day dots pattern, speech bubble shapes for data callouts, action lines radiating from key numbers, POW/BAM style burst shapes for highlights, primary colors (red, blue, yellow) on white. Panel grid layout. Feels fun, dynamic, pop-art.',
  },
  {
    id: 'chalkboard-v2',
    name: 'Chalkboard V2',
    description: 'Green chalkboard, colored chalk, wooden frame',
    prompt: 'Classroom chalkboard design. Dark green/black chalkboard texture background, chalk-style hand-drawn text in white and colored chalk (yellow, pink, blue), chalk dust effects, sketchy arrows and underlines, eraser smudge marks, wooden frame border at edges. Feels educational, nostalgic, approachable.',
  },
  {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    description: 'Frosted glass cards, vibrant gradient, Apple-inspired',
    prompt: 'Glassmorphism UI design. Vibrant gradient background (purple to blue to pink), frosted glass cards with 40% transparency and blur backdrop, thin white 1px borders on cards, subtle shadow beneath each card, rounded corners, modern SF Pro style typography in white. Feels futuristic, clean, Apple-inspired.',
  },
  {
    id: 'neubrutalism',
    name: 'Neubrutalism',
    description: 'Thick black borders, harsh shadows, raw primary colors',
    prompt: 'Neubrutalist web design. Off-white background, thick 3-4px black borders on every element, harsh drop shadows offset to bottom-right, raw primary colors (bright yellow, electric blue, hot pink), deliberately clunky typography mixing serif and sans-serif, no rounded corners — all sharp edges. Feels bold, raw, anti-corporate.',
  },
  {
    id: 'gradient-mesh',
    name: 'Gradient Mesh',
    description: 'Black with flowing color blobs, Apple marketing style',
    prompt: 'Flowing gradient mesh design inspired by Apple marketing. Deep black background with flowing colorful gradient blobs — vibrant purple, blue, teal, green transitioning smoothly. Clean white sans-serif typography floating over the gradients. Minimal layout, maximum visual impact. Feels premium, modern, Silicon Valley.',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Black CLI, green monospace text, hacker aesthetic',
    prompt: 'Hacker terminal / CLI aesthetic. Pure black background (#000000), monospace green text (#00FF00) like a Linux terminal, command prompt characters ($ > _), matrix-style falling characters faintly in background, scan line effects, slight CRT monitor curvature, terminal window chrome at top. Feels technical, hacker, cybersecurity.',
  },
  {
    id: 'newspaper',
    name: 'Newspaper',
    description: 'Vintage newsprint, multi-column, classic masthead',
    prompt: 'Vintage newspaper front page design. Cream/newsprint texture background, multi-column layout with thin vertical rules between columns, large bold serif headline (like The New York Times), smaller serif body text, dateline, article bylines, halftone photo placeholder areas, classic newspaper masthead style. Feels journalistic, classic, informative.',
  },
  {
    id: 'travel-magazine',
    name: 'Travel Magazine',
    description: 'Exotic landscape, elegant white text, glossy editorial',
    prompt: 'Luxury travel magazine spread design. Large background photography of an exotic beach/mountain landscape (slightly blurred), white text overlays with elegant thin sans-serif typography, magazine-style pull quotes, thin gold accent lines, page number in corner, glossy premium feel. Feels aspirational, wanderlust, premium editorial.',
  },
] as const

export type SlideStyleId = typeof SLIDE_STYLES[number]['id']

// Slide structure is dynamic — generated by the script generator based on policy content.
// No fixed structure. The system decides how many slides are needed.

export interface CustomTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  prompt: string
  preview_url: string | null
  is_default: boolean
  created_at: string
}
