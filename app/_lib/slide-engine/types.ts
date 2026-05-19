/**
 * Slide Engine Types — JSON-driven slide generation system.
 * Templates define design DNA, brand colors fill the palette,
 * content data fills the layout. OpenAI renders the final image.
 */

/** Colors extracted from brand logo */
export interface BrandColors {
  primary: string      // dominant color (e.g. navy blue)
  secondary: string    // accent color (e.g. red)
  tertiary?: string    // optional third color
  neutral?: string     // background neutral if detected
}

/** Template design specification */
export interface TemplateSpec {
  id: string
  name: string
  description: string
  designSpec: {
    background: {
      base: string           // "dark charcoal/black", "cream/off-white", etc.
      texture?: string       // "gritty urban texture", "brushed metal", etc.
      gradient?: string      // "radial gradient lighter in center", etc.
    }
    decorativeElements: {
      primary: string        // main decorative style
      secondary?: string     // additional decorative elements
      accents?: string       // small accent details
    }
    typography: {
      headline: string       // style for main headline
      accent?: string        // style for accent/cursive text
      numbers: string        // style for big stats/numbers
      body: string           // style for body text
      labels: string         // style for small labels
    }
    cardStyle?: string       // how data cards look
    chartStyle?: string      // how charts look
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY' | 'FROM_LOGO_SECONDARY' | string
      secondary: 'FROM_LOGO_PRIMARY' | 'FROM_LOGO_SECONDARY' | string
      text: string
      background: string
      highlight?: string
    }
  }
  /** The full visual description for the AI — uses {PRIMARY}, {SECONDARY}, {LOGO_DESC} placeholders */
  promptTemplate: string
}

/** Slide content layouts */
export type SlideLayout = 'title' | 'stats' | 'bullets' | 'chart' | 'comparison' | 'table' | 'closing'

/** Content for a single slide */
export interface SlideContent {
  layout: SlideLayout
  headline: string
  subtitle?: string
  accentText?: string
  stats?: { value: string; label: string; sublabel?: string }[]
  bullets?: { text: string; highlight?: boolean; tag?: string }[]
  tableData?: { headers: string[]; rows: string[][] }
  chartData?: {
    type: 'bar' | 'grouped-bar' | 'line' | 'donut'
    title: string
    series: { name: string; data: { label: string; value: string }[] }[]
  }
  leftColumn?: { text: string }[]
  rightColumn?: { text: string }[]
  leftLabel?: string
  rightLabel?: string
  brandName?: string
  contactInfo?: { phone?: string; website?: string; email?: string; calendly?: string }
  pageNumber?: number
  totalPages?: number
}

/** Full input for generating a slide */
export interface SlideGenerationInput {
  template: TemplateSpec
  brandColors: BrandColors
  logoDescription?: string   // "APEX in navy blue bold text with red star burst, AFFINITY GROUP below"
  content: SlideContent
}
