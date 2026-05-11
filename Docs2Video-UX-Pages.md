# Docs2Video - Page Map & UX Reference

**App:** Docs2Video (docs2video.com)
**Purpose:** Turn any document into a professional, branded video explainer
**Date:** May 9, 2026

---

## Public Pages (No Login Required)

### `/` - Landing Page / Homepage
**Goal:** Convert visitors into users via a zero-friction demo experience.
- **Hero:** Headline, subheadline, and a single-input demo form ("Enter your website URL"). Submitting scrapes the visitor's website, generates a short branded demo video with watermark, and plays it inline. CTA below video: "Sign up free."
- **Marquee:** Scrolling industry ticker (Financial Services, Healthcare, Real Estate, etc.)
- **How It Works:** 3-step visual (Upload document > AI generates > Share with anyone)
- **Features Grid:** 6 feature cards (PDF upload, AI extraction, branding, narrated video, speed, sharing)
- **Content Rows:** 3 alternating image+text sections (document summaries, narrated video, zero design skills)
- **Email & Follow-up Section:** Email integration pitch with branded email mockup and tracking status
- **Template Gallery:** Horizontal scrolling carousel of 28 slide styles. Clicking opens a full-screen lightbox with keyboard navigation, thumbnail strip, and "Try this style" CTA.
- **Stats Strip:** 10K+ docs, 2,500+ professionals, 4.9/5 rating, 30s generation time
- **Use Cases Grid:** 8 industry cards (Insurance, Real Estate, Financial, Legal, Healthcare, Consulting, Education, Mortgage) each with example transformation
- **Comparison Table:** "Old way vs. new way" side-by-side
- **Testimonials:** 4 testimonial cards with star ratings
- **Pricing:** 4 plan cards (Demo $0, Starter, Professional, Agency) + pay-per-use packs (1, 5, 10, 25 explainers)
- **Trust Badges:** Encryption, SOC 2, data policy, uptime
- **FAQ:** Expandable accordion
- **Final CTA:** Closing section with signup button
- **Footer:** 4-column (Brand, Product, Resources, Company) + social icons

### `/login` - Login
**Goal:** Authenticate returning users.
- Split-screen layout: left side has login form (email + password), right side shows branded mockup/marketing visual
- Error state handling
- Links to signup and forgot-password

### `/signup` - Sign Up
**Goal:** Register new users.
- Same split-screen layout as login
- Email + password registration form
- Success confirmation state
- Link to login

### `/forgot-password` - Password Reset
**Goal:** Help users recover access.
- Email input form
- Sends reset link via Supabase auth

### `/watch/[id]` - Public Share Page
**Goal:** Let clients watch their explainer video and take action.
- Video player with branded header (agent name, company logo)
- Key metrics/data visualization below video
- Action buttons: book a meeting (calendar embed), ask questions (AI chatbot), accept quote & pay (Stripe)
- View tracking (notifies the creator when client watches)
- No login required for viewers

### `/share-demo` - Share Demo Page
**Goal:** Showcase demo content to potential users.
- Simplified version of the share page for marketing/demo purposes

### `/terms` - Terms of Service
**Goal:** Legal compliance.
- 19 sections covering: acceptance, service description, accounts, billing/credits/refunds, user IP, AI content disclaimers, acceptable use, share pages, liability limits, warranties, termination, privacy reference, third-party services, GDPR, indemnification, Texas governing law, changes, general provisions, contact

### `/privacy` - Privacy Policy
**Goal:** Legal compliance / transparency.
- 14 sections covering: data collection, usage, AI processing disclosure (Gemini/OpenAI), third-party sharing, retention, user rights, children's privacy, security, international transfers, CCPA, GDPR, shared videos, demo scraping, changes, contact

### `/cookies` - Cookie Policy
**Goal:** Legal compliance.
- What cookies are, essential cookies (Supabase auth), functional cookies, explicit "no tracking cookies" statement, browser management, contact

### `/for/[industry]` - Industry Landing Pages
**Goal:** SEO + targeted conversion for specific verticals.
- 8 pages: insurance, real-estate, financial-services, healthcare, legal, consulting, education, mortgage
- Each tailored with industry-specific copy, example transformations, and CTAs
- Shared layout wrapper

---

## Onboarding (Login Required, First-Time Setup)

### `/setup` - Account Setup Wizard
**Goal:** Get new users configured and ready to create their first video.
- **Step 1 - Profile:** Name, title, phone number
- **Step 2 - Photos:** Upload headshot photo and optional standing photo (used in video slides)
- **Step 3 - Colors:** Pick or auto-detect brand colors (primary, secondary, accent, background, text)
- **Step 4 - Brand:** Enter website URL for auto-scraping, or manually set company name, logo, tagline, description, industry, tone
- Progressive step indicator at top
- Can be revisited from settings

---

## Dashboard (Login Required)

### `/dashboard` - Main Dashboard
**Goal:** Central hub showing user's work and recent activity.
- Welcome header with user name
- Quick stats (total videos, total views, credits remaining)
- Recent videos grid with thumbnails
- Quick-action buttons (Create new, View all videos)
- Server-side data fetching

### `/create` - Create Explainer (Main Wizard)
**Goal:** The core product flow - turn a document into a video.
- **Tab 1 - Input:** 4 input methods:
  - Upload PDF (drag & drop)
  - Type/Paste text
  - Start from Idea (describe what you want)
  - AI Proposal (chat interview that builds a proposal from scratch - Professional+ only)
- **Step 2 - Review:** AI-extracted data shown in editable form. User can correct values before proceeding.
- **Step 3 - Style:** Choose from 28 slide styles (visual grid). Brand dropdown to select which brand profile to use.
- **Step 4 - Slides:** Preview generated slides. Approve or regenerate individual slides.
- **Step 5 - Voice:** Choose from 6 AI voices (with audio previews). Duration toggle: Standard (2-3 min, 1 credit) vs Detailed (5-7 min, 2 credits).
- **Step 6 - Generate:** Progress indicator showing pipeline stages (scripting > audio > slides > assembling). Final video preview when complete.

### `/videos` - Video Library
**Goal:** Browse and manage all created videos.
- Grid of video cards with thumbnails, titles, dates
- Status badges (completed, processing, failed)
- Search/filter capabilities

### `/videos/[id]` - Video Detail
**Goal:** View, share, and manage a specific video.
- Video player
- Share modal (copy link, email to client)
- Download options (MP4 video, PDF slides, PowerPoint)
- Follow-up plan (Professional+)
- Quote builder (Professional+)
- View tracking metrics
- Delete option

### `/brands` - Brand Library
**Goal:** Manage multiple brand profiles.
- List/grid of saved brands with logo thumbnails
- "Add new brand" button
- Each card shows brand name, colors, creation date

### `/brands/new` - Create Brand
**Goal:** Add a new brand profile.
- Website URL input for auto-scraping (recommended)
- Manual entry: company name, logo upload, colors, tagline, description, industry, tone, target audience
- Color picker for primary/secondary/accent/background/text

### `/brands/[id]` - Edit Brand
**Goal:** Update an existing brand profile.
- Same form as create, pre-filled with saved values
- Delete brand option

### `/brands/[id]/guide` - Brand Style Guide
**Goal:** View a generated brand guide.
- Visual summary of brand colors, fonts, tone, values
- Content themes and social media suggestions
- Generated from the brand scraping analysis

### `/templates` - Custom Templates
**Goal:** Create personalized slide styles beyond the 28 built-in ones.
- Gallery of user-created custom templates
- 3-step creation flow:
  1. Describe your style (text input or upload reference image)
  2. Choose from AI-generated options
  3. Save with a name
- Chat-based refinement option

### `/infographics` - Infographics Library
**Goal:** Browse saved infographic outputs.
- Grid of infographic cards

### `/infographics/[id]` - Infographic Detail
**Goal:** View and export a specific infographic.
- Full-size infographic viewer
- Download as PNG

### `/settings` - Account Settings
**Goal:** Manage account, profile, and integrations.
- **Profile Tab:** Name, email, photo, title, phone
- **Brand Tab:** Default brand settings
- **Email Tab:** Email integration setup (Microsoft 365, Gmail, SMTP)
- **SMTP Tab:** Custom SMTP server configuration
- File upload handling for photos

### `/admin` - Admin Dashboard
**Goal:** Internal admin view of platform stats.
- Access restricted (403 for non-admins)
- User counts, video counts, system metrics

---

## API Routes (Backend - Not User-Facing)

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| Auth | `/api/auth/microsoft/*`, `/api/auth/callback` | OAuth flows |
| Generation | `/api/generate-video`, `/api/generate-script`, `/api/generate-slide` | AI pipeline |
| Demo | `/api/demo-video`, `/api/demo-video/[id]` | Public demo flow |
| Upload | `/api/upload-logo`, `/api/upload-photo` | File uploads |
| Brand | `/api/scrape-brand` | Website scraping |
| Export | `/api/download-pdf`, `/api/download-pptx` | File exports |
| Payments | `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook` | Stripe billing |
| Email | `/api/send-email`, `/api/email-connections/*`, `/api/email-track` | Email sending & tracking |
| AI | `/api/chat`, `/api/extract*`, `/api/pre-generate-audio`, `/api/voice-preview` | AI features |
| Templates | `/api/templates/*`, `/api/template-chat` | Custom template creation |

---

## Key UX Patterns

- **Color palette:** Warm cream background, mint green accents, dark ink text. CSS variables: `--bg`, `--mint`, `--ink`, `--surface`, `--border`, `--peach`, `--lilac`, `--sky`
- **Border radius:** Max 10px everywhere (strict rule)
- **Typography:** System fonts + Instrument Serif for italic accents
- **Buttons:** `.btn-primary` (dark), `.btn-mint` (green), `.btn-soft` (subtle), `.btn-outlined` (border only)
- **Auth gate:** Dashboard layout checks auth server-side, redirects to `/login`
- **Plan gating:** Features like proposals, quotes, payments, follow-ups are locked behind Professional+ plans. UI shows upgrade prompts.
- **Credit system:** Each video costs 1 credit (standard) or 2 credits (detailed mode). Credits come from subscription plans or pay-per-use packs.
- **Responsive:** Mobile nav hamburger menu, stacked layouts on small screens
