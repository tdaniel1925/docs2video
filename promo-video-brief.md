# Docs2Video — Explainer Video Brief

## One-Liner
Turn any document into a professional video explainer — in seconds.

## Elevator Pitch (30 sec)
Docs2Video takes complex documents — insurance illustrations, financial reports, proposals, contracts — and transforms them into polished, branded video explainers your clients actually understand. Upload a PDF, paste text, or just describe what you need. AI extracts the data, generates beautiful slides, adds professional narration with background music, and delivers a shareable video with a built-in payment page, calendar booking, and AI chatbot. Stop sending PDFs nobody reads. Start sending videos that close deals.

---

## KEY FEATURES (verified from codebase)

### 1. Three Ways to Create
- **Upload PDF** — drop any document, AI reads and extracts everything
- **Type or Paste** — paste meeting notes, emails, bullet points, any text
- **Start from Idea** — just describe a topic, AI generates all the content from scratch

### 2. AI-Powered Extraction
- Reads any document type — auto-detects industry (insurance, financial, legal, medical, real estate, etc.)
- 13 industry-specific configurations with specialized terminology
- Extracts key data points, metrics, numbers automatically
- User reviews and approves before generation

### 3. 62 Professional Templates
Built-in styles including:
- Executive, Steampunk, Social Grid, Blue Steps, Isometric, Flat Vector
- Doodle, Watercolor, Neon Cyber, Line Art, Vintage Craft, Flat Cartoon
- Colorful Steps, Timeline, Profile Resume, Anime Pop, Felt Craft
- Botanical Warm, Vintage Editorial, Torn Collage, Chalkboard
- Old Newspaper, Paper Layers, Street Graffiti, Cinematic HUD
- Commercial Pro, Art Deco, Marble & Gold, Comic Book
- Glassmorphism, Neubrutalism, Gradient Mesh, Terminal
- Medical Journal, Legal Brief, Scientific Paper, and many more
- **Custom AI template maker** — describe what you want via chat, AI creates it
- Every template is fully branded with user's colors and logo

### 4. Smart Slide Generation
- AI generates the right number of slides based on content (6-16 scenes)
- Beat-based narrative structure: Hook → Disclaimer → Context → Stakes → Evidence → Implication → Action
- User previews and approves each slide individually
- Regenerate any slide with one click
- Agent's real photo and logo composited onto slides (never AI-generated faces)
- Template reference images used for visual consistency across slides

### 5. Professional AI Narration
- 6 realistic OpenAI TTS-HD voices:
  - Sarah (nova) — Friendly and warm
  - Emily (shimmer) — Gentle and reassuring
  - James (onyx) — Deep and authoritative
  - Michael (echo) — Warm and conversational
  - Alex (alloy) — Professional and balanced
  - Oliver (fable) — Expressive with British accent
- Instant voice preview before choosing
- AI-generated background music via Suno (Kie.ai) — auto-matched to content mood
- Retry logic with fallback silence generation for reliability

### 6. Branded Share Page (docs2video.com/watch/[id])
- Agent's branding throughout (logo, colors, photo, company name)
- Full video player with slide thumbnails and controls
- Built-in quote/invoice with line items and totals
- "Accept & Pay" button — payments go to agent's own Stripe (zero liability for Docs2Video)
- Calendar booking — Calendly integration with iframe embed
- AI chatbot — clients ask questions about their document 24/7, powered by Gemini
- View tracking — agent gets email notification when client watches
- Download as PDF, PPTX, or MP4
- "Request Changes" option for clients

### 7. Brand Intelligence
- **Website scraper** — enter any URL, AI extracts colors, logo, fonts, tone, industry
- Auto-derives secondary/accent colors from primary using color theory (HSL)
- Complete brand guide generation with:
  - Color psychology analysis
  - Tone guidelines (do/don't say)
  - Content themes
  - Social media bio suggestions
  - Competitor notes
  - Unique selling points
- Multiple photo uploads (headshot, mid-level, standing)
- Photos auto-placed on slides: headshot on cover, standing on closing

### 8. Email Integration
- **Gmail** — full OAuth with gmail.send scope
- **Microsoft Outlook/365** — OAuth with Graph API
- **SMTP/IMAP** — manual config for any email provider, with presets for Outlook/Gmail/Yahoo
- Branded HTML email templates with video thumbnail and play button
- Email open tracking via 1px pixel
- Send presentations directly to clients from agent's own email address

### 9. Additional Output Types
- **Video courses** — multi-lesson course builder
- **Slide decks** — PPTX download with deck builder
- **Logo creation** — AI logo generator with style variations
- **Social kits** — branded social media content packages
- **Business cards** — branded business card designs
- **Infographics** — standalone branded infographics
- **Brand decks** — presentation decks showcasing brand identity

### 10. Admin & Operations
- Admin dashboard with user stats, bulk operations, campaign management
- Rate limiting on all API routes
- Credit system with pack purchases and monthly resets
- Referral system with tracking codes
- Notification system for job status and email readiness
- Audit logging

---

## PRICING (from pricing.ts — actual values)

| Plan | Price | What You Get |
|------|-------|-------------|
| **Pay Per Project** | $0/mo | $10 per video, deck, or infographic. Full quality, no watermark. Share pages with AI chat. Download MP4, PDF, PPTX. |
| **Pro** | $25/mo | $6 per video, deck, or infographic. $149 per video course. Priority generation + unlimited brands. |
| **Business** | $99/mo | Up to 50 videos, decks, or infographics/mo. No per-project fees. Courses at $99 each. Priority support. |
| **Agency** | $249/mo | Up to 150 videos, decks, or infographics/mo. 5 video courses/mo included. Team sharing (coming soon). White-label (coming soon). |
| **Enterprise** | Custom | Unlimited projects. Custom integrations. Dedicated support. |

---

## TARGET AUDIENCES

### Primary
- Life insurance agents
- Financial advisors
- Real estate agents
- Mortgage loan officers

### Secondary (14 industry landing pages exist)
- Coaching professionals
- Consultants
- Educators / trainers
- Fitness professionals
- Healthcare / medical professionals
- Human resources
- Legal professionals
- Non-profit organizations
- Property management

---

## COMPETITOR COMPARISON

| Feature | Docs2Video | Canva | Loom | PandaDoc |
|---------|-----------|-------|------|----------|
| AI document extraction | ✅ | ❌ | ❌ | ❌ |
| AI video generation | ✅ | ❌ | ❌ | ❌ |
| AI narration + music | ✅ | ❌ | ❌ | ❌ |
| 62 branded templates | ✅ | ✅ | ❌ | ❌ |
| Custom AI template maker | ✅ | ❌ | ❌ | ❌ |
| Quote/invoice on share page | ✅ | ❌ | ❌ | ✅ |
| Payment collection (agent's Stripe) | ✅ | ❌ | ❌ | ✅ |
| Calendar booking (Calendly) | ✅ | ❌ | ❌ | ❌ |
| AI chatbot on share page | ✅ | ❌ | ❌ | ❌ |
| View tracking + notifications | ✅ | ❌ | ✅ | ✅ |
| Brand website scraper | ✅ | ❌ | ❌ | ❌ |
| PPTX + PDF + MP4 downloads | ✅ | ✅ | ❌ | ✅ |
| Video courses | ✅ | ❌ | ❌ | ❌ |
| Logo + social kit generation | ✅ | ✅ | ❌ | ❌ |
| 13 industry configurations | ✅ | ❌ | ❌ | ❌ |

---

## TECH STACK
- **Frontend:** Next.js 16 (Turbopack)
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **AI Image:** Google Gemini 3 Pro Image
- **AI Text:** Google Gemini 2.5 Pro/Flash
- **AI Voice:** OpenAI TTS-HD (6 voices)
- **AI Music:** Suno via Kie.ai API
- **Video Assembly:** FFmpeg (external VPS)
- **Payments:** Stripe (subscriptions + agent OAuth Connect)
- **Email:** Gmail API, Microsoft Graph API, SMTP/Nodemailer
- **Hosting:** Vercel

---

## SUGGESTED VIDEO STRUCTURE (60-90 sec)

### Scene 1: The Problem (10 sec)
"You spend hours creating presentations that clients never read. PDFs get buried in inboxes. Complex documents confuse instead of clarify."

### Scene 2: The Solution (10 sec)
"Docs2Video turns any document into a professional video explainer — in seconds."

### Scene 3: How It Works (20 sec)
Show the 3-step flow:
1. Upload a PDF, paste text, or describe an idea
2. AI extracts data and generates branded slides from 62 templates
3. Professional narration + background music added automatically

### Scene 4: The Share Page (15 sec)
"Send your client a single link. They watch the video, see the quote, book a meeting, ask the AI chatbot, and pay — all in one place."

### Scene 5: Brand Intelligence (10 sec)
"Enter your website URL. AI extracts your colors, logo, and brand identity. Every video is automatically branded."

### Scene 6: CTA (10 sec)
"Start free — pay $10 per project, no subscription required. Or go Pro for $25/month."
docs2video.com

---

## KEY STATS (verified)
- 62 built-in templates + unlimited custom AI templates
- 6 professional AI voices with instant preview
- 14 industry-specific landing pages
- 13 industry configurations with specialized prompts
- Built-in payment collection via agent's own Stripe
- AI chatbot on every share page
- View tracking with email notifications
- Gmail, Outlook, and SMTP email integration
- PPTX, PDF, and MP4 downloads

---

## BRAND VOICE
- Professional but warm
- Confident, not aggressive
- Focus on saving time and closing deals
- Speak to the agent/professional, not the end client
- Avoid jargon — "documents" not "collateral", "presentations" not "assets"

## TAGLINE OPTIONS
- "Turn documents into deals."
- "Upload. Explain. Get paid."
- "Stop sending PDFs. Start closing deals."
- "The last tool between your document and a closed deal."
- "From PDF to payday."
