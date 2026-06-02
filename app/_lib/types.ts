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
  script?: VideoScene[]
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
    id: 'apex-corporate',
    name: 'Corporate Infographic',
    description: 'Geometric shapes, diagonal cuts, icon circles, professional',
    prompt: 'Modern corporate infographic presentation style. Clean white background with bold geometric accent shapes — diagonal color blocks cutting across corners, large circles and rounded rectangles as content containers. Flat vector icons inside colored circles. Strong visual hierarchy with large bold sans-serif headlines and organized grid sections. Footer bar spanning full width with contact info. Decorative star/burst accents and dot patterns for visual interest. Color blocks use the brand primary and secondary colors. Professional, structured, data-forward. Feels like a premium internal corporate report or investor deck — polished, authoritative, organized. IMPORTANT: Leave the top-left corner area (approximately 300x100 pixels) EMPTY with just the white background — no text, no logo, no graphics in that zone. A logo will be composited there afterward.',
  },
] as const

// All style references resolve to apex-corporate (the only active style).
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
