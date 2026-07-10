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
  /** Agent's Stripe Payment Link — shown as a Pay button on share pages. */
  payment_link_url?: string | null
  card_on_file: boolean
  free_videos_remaining: number
  credits_remaining: number
  pack_credits: number
  credits_reset_at: string | null
  referral_code: string | null
  referred_by: string | null
  nurture_sent: Record<string, string> | null
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
  /** Processed transparent variants for video rendering (Sharp/rembg pipeline). */
  logo_light_url?: string | null
  logo_dark_url?: string | null
  logo_chip?: boolean
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
  logo_kit: Record<string, string> | null
  reference_slides: string[] | null
  deck_style_id: string | null
  is_default: boolean
  /** Profile unification: a brand row is either a COMPANY (the classic brand) or
   *  a PERSON (a presenter — name, role, photo, intro line). See presenter.ts. */
  profile_type?: 'company' | 'person'
  person_role?: string | null
  photo_url?: string | null
  intro_line?: string | null
  /** Person: drive brandName/masthead with the person's name (else doc title leads). */
  show_name_on_slides?: boolean
  /** Explicit logo on/off in videos (fixes "logo sometimes shows"). */
  show_logo?: boolean
  /** Where a presenter photo appears; 'auto' = the video style decides. */
  photo_placement?: 'auto' | 'cover' | 'closing' | 'both' | 'none'
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
    sourcePage?: string
  }[]
  surrenderValueProjections: {
    year: number
    guaranteed: number
    current: number
    sourcePage?: string
  }[]
  riders: string[]
  loanRate: number | null
  additionalNotes: string[]
  disclaimers?: string[]
  // Column provenance metadata (added by Claude Opus extraction)
  guaranteed_column_label?: string
  current_column_label?: string
  column_mapping_rationale?: string
  rawColumns?: { label: string; mappedTo: 'guaranteed' | 'current' | 'unmapped' }[]
  maxIllustratedYear?: number
  extractionConfidence?: number
  lowConfidenceFields?: string[]
  // Sanity check flags (added by deterministic validation)
  sanityFlags?: string[]
}

export interface DialogueLine {
  speaker: string
  voice: string
  instructions: string
  text: string
}

export interface SlideData {
  headline: string
  stats?: { label: string; value: string }[]
  bullets?: string[]
}

export interface VideoScene {
  scene: number
  beat: 'hook' | 'disclaimer' | 'disclaimer-close' | 'context' | 'stakes' | 'evidence' | 'implication' | 'action'
  title: string
  narration: string
  dialogue?: DialogueLine[]
  slideData?: SlideData
  slidePrompt: string
  duration: number
  framePrompts?: string[]  // 3 illustrated frame prompts for flipbook mode
  visualMetaphor?: string  // "shield", "tree growing", etc.
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
  /** Per-slide clip duration in seconds, one per slide_url (in order). Lets the
   *  preview/watch pages map thumbnails to exact video timestamps instead of
   *  guessing via equal division. */
  slide_durations: number[] | null
  music_url: string | null
  is_trial: boolean
  status: 'draft' | 'pending' | 'scripting' | 'generating_slides' | 'generating_audio' | 'assembling' | 'completed' | 'failed'
  progress_detail: string | null
  progress_pct: number | null
  error_message: string | null
  output_type: 'video' | 'pptx' | 'pdf'
  detail_level: 'quick' | 'standard' | 'detailed'
  draft_data: WizardDraft | null
  draft_expires_at: string | null
  created_at: string
  updated_at: string
  brand?: Brand
}

export interface WizardDraft {
  step: number
  outputType: 'video' | 'pptx' | 'pdf'
  purpose?: string
  contentMethod?: 'url' | 'file' | 'text' | 'ai'
  extractedData?: Record<string, unknown>
  /** Multi-file uploads: one extracted-data object per uploaded document, in
   *  upload order. When >1, the user's `purpose` instruction (e.g. "compare
   *  these three") drives a combine pass that produces a unified brief. The
   *  single `extractedData` above mirrors the first/primary doc for back-compat. */
  extractedDocs?: { fileName?: string; data: Record<string, unknown> }[]
  /** Free-text instruction for what to DO across multiple files ("compare these",
   *  "merge into one overview"). Mirrors/augments `purpose` for the multi-doc case. */
  combineInstruction?: string
  brandId?: string
  inlineBrand?: {
    name: string
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
    phone?: string
    email?: string
    website?: string
  }
  voiceId?: string
  narrationStyle?: 'solo' | 'podcast'
  detailLevel?: 'quick' | 'standard' | 'detailed'
  aiMusic?: boolean
  musicPrompt?: string
  styleId?: string
  customStylePrompt?: string
  styleReferenceUrl?: string
  classification?: Record<string, unknown>
  recipientName?: string
  clientId?: string
  script?: VideoScene[]
  // Personalization (presenter) — chosen on the profile/brand step.
  presenterIntro?: string
  introduceInOpening?: boolean
  showContactClosing?: boolean
  photoPlacement?: 'auto' | 'cover' | 'closing' | 'both' | 'none'
  // Theme chosen on the Theme step (per-video; overrides global default).
  videoStyle?: 'slides' | 'cinematic' | 'editorial' | 'time' | 'explainer' | 'aurora'
  // The "Review brief" step: what the AI understood + plans to cover. The user
  // approves or redirects it; the approved brief steers the script generator.
  brief?: VideoBrief
  briefChat?: { role: 'user' | 'assistant'; text: string }[]
}

/**
 * What the video will COVER and how to frame it — shown for approval right after
 * extraction. Grounded in the document; the user can redirect it via chat. Fed
 * to the script generator as strong direction (not invented content).
 */
export interface VideoBrief {
  docType: string                              // e.g. "Life insurance illustration"
  summary: string                              // 1-2 plain-language sentences
  keyPoints: string[]                          // the points the video will feature
  figures: { label: string; value: string }[] // real numbers it will show
  angle: string                                // the intended takeaway / framing
  tone?: string                                // e.g. "reassuring, plain-language"
  emphasis?: string[]                          // what to lean into (user direction)
  avoid?: string[]                             // what to skip (user direction)
  approved?: boolean
  // Confidence-gated clarifying questions: the AI only populates these when it
  // is genuinely unsure about a dimension that would change the script (who the
  // video is for/from, audience, goal/CTA, emphasis, tone). Empty = confident.
  clarifyingQuestions?: ClarifyingQuestion[]
}

export interface ClarifyingQuestion {
  id: string                 // stable key, e.g. "audience"
  question: string           // the question to show the user
  why?: string               // 1-line reason it matters (optional)
  options?: string[]         // quick-pick chips (optional; free-text always allowed)
  answer?: string            // the user's chosen/typed answer (filled in by UI)
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

// OpenAI TTS voices — used by VPS for video narration
export const VOICE_OPTIONS = [
  { id: 'nova', name: 'Sarah', gender: 'Female', description: 'Friendly and natural — most popular' },
  { id: 'shimmer', name: 'Emily', gender: 'Female', description: 'Warm and gentle' },
  { id: 'onyx', name: 'James', gender: 'Male', description: 'Deep and authoritative' },
  { id: 'echo', name: 'Michael', gender: 'Male', description: 'Warm and conversational' },
  { id: 'alloy', name: 'Alex', gender: 'Neutral', description: 'Balanced and neutral' },
  { id: 'fable', name: 'Oliver', gender: 'Male', description: 'British and expressive' },
] as const

// Presentation styles
export const SLIDE_STYLES = [
  {
    id: 'isometric-3d',
    name: 'Isometric 3D',
    description: 'Colorful 3D objects, data as visual elements, modern and playful',
    prompt: 'Isometric 3D infographic design on a clean white background. Data and concepts visualized as colorful 3D isometric objects — stacked coins for money, shield towers for protection, growing plants for growth, bar charts as 3D blocks, circular gauges as floating rings. Each metric gets its own 3D element with a short label below it. Bold sans-serif headline at the top. Soft realistic shadows under each element. Vibrant but professional color palette using the brand colors. Isometric grid layout with generous spacing. Clean footer bar at bottom with contact info. Feels like Slack/Asana marketing illustrations meets a financial dashboard — playful yet corporate, data-forward, premium. IMPORTANT: Leave the top-left corner area (approximately 300x100 pixels) EMPTY with just the white background — a logo will be composited there afterward.',
  },
  {
    id: 'apex-corporate',
    name: 'Corporate Infographic',
    description: 'Geometric shapes, diagonal cuts, icon circles, professional',
    prompt: 'Modern corporate infographic presentation style. Clean white background with bold geometric accent shapes — diagonal color blocks cutting across corners, large circles and rounded rectangles as content containers. Flat vector icons inside colored circles. Strong visual hierarchy with large bold sans-serif headlines and organized grid sections. Footer bar spanning full width with contact info. Decorative star/burst accents and dot patterns for visual interest. Color blocks use the brand primary and secondary colors. Professional, structured, data-forward. Feels like a premium internal corporate report or investor deck — polished, authoritative, organized. IMPORTANT: Leave the top-left corner area (approximately 300x100 pixels) EMPTY with just the white background — no text, no logo, no graphics in that zone. A logo will be composited there afterward.',
  },
  {
    id: 'warm-story',
    name: 'Warm Story',
    description: 'Cozy storybook illustration, golden light, friendly and human',
    prompt: 'Warm, cozy illustration style. Soft golden lighting, nature scenes, families, organic shapes. Rich earth tones built around the brand primary and secondary colors with warm amber, terracotta, and cream. Characters have friendly, simple features. Scenes feel like a storybook — inviting, safe, hopeful. Subtle textures like watercolor wash or soft grain. Headline in a warm rounded sans-serif at the top. Key metrics shown in soft rounded cards. Clean footer bar at the bottom with contact info. Feels emotional and human — ideal for life and family-focused topics. IMPORTANT: Leave the top-left corner area (approximately 300x100 pixels) EMPTY with just the background — a logo will be composited there afterward.',
  },
  {
    id: 'dark-cinematic',
    name: 'Dark Cinematic',
    description: 'Navy and gold, dramatic lighting, premium and prestigious',
    prompt: 'Cinematic dark illustration style. Deep navy (#0A1628) and charcoal backgrounds with rich gold (#C5A55A) and champagne accents drawn from the brand colors. Dramatic lighting with glows and light rays. Elegant serif typography for headings. Key metrics in large gold numbers inside sophisticated cards with thin gold borders. Scenes feel like movie posters — epic scale, dramatic composition. Subtle texture and depth. Full-width footer bar at the bottom with contact info. Feels luxurious, prestigious, powerful — ideal for high-net-worth, real estate, and premium offerings. IMPORTANT: Leave the top-left corner area (approximately 300x100 pixels) EMPTY with just the background — a logo will be composited there afterward.',
  },
  {
    id: 'bold-infographic',
    name: 'Bold Infographic',
    description: 'Massive numbers, high contrast, impossible to ignore',
    prompt: 'Bold high-contrast infographic style. Dark navy or black background with vibrant accent colors drawn from the brand primary and secondary. Massive numbers that dominate the frame. Strong visual hierarchy with thick borders and color blocks. Data visualization as art — oversized stats, bold percentage callouts, chunky bar charts. Headline in heavy uppercase sans-serif. Full-width footer bar at the bottom with contact info. Feels powerful, impactful, impossible to ignore — ideal for sales pitches and big-number reveals. IMPORTANT: Leave the top-left corner area (approximately 300x100 pixels) EMPTY with just the background — a logo will be composited there afterward.',
  },
] as const

// All style references fall back to isometric-3d (the default style).
// Legacy style IDs (corporate-clean, warm-story, etc.) are accepted as strings
// so existing DB records and code don't break — they all use the apex-corporate prompt.
export type SlideStyleId = string

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
