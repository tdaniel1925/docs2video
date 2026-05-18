# Docs2Video — What This App Does & How Every Workflow Works

**URL:** docs2video.com
**What it is:** A SaaS platform that transforms any document into a professional, narrated video explainer with AI-generated slides, voiceover, and background music.

---

## The Core Value Proposition

A user uploads a document (PDF, PowerPoint, or paste text), tells the system what they want the video to accomplish, and gets back a fully produced video with:
- AI-redesigned slides matching a chosen visual template
- Professional voiceover narration
- Background music
- A branded share page with payment collection, calendar booking, and AI chat

The entire process takes 3-5 minutes. No design skills, no video editing, no recording equipment.

---

## User Journey Overview

```
Sign Up → Set Up Brand → Upload Content → Choose Options → Generate Video → Share with Clients
```

---

## Detailed Workflows

### 1. Account Setup

**URL:** `/signup` then `/setup`

1. User creates account with email/password
2. Setup wizard collects:
   - Full name, company name, role
   - Photo uploads (headshot, standing photo)
   - Phone number
3. User is redirected to dashboard

---

### 2. Brand Creation

**URL:** `/brands/new` then `/brands/[id]`

**Two ways to create a brand:**

**Option A — Website Scraper (Recommended)**
1. User enters their website URL (e.g., `www.mycompany.com`)
2. Click "Analyze brand"
3. System scrapes the website and extracts:
   - Company name, tagline, industry
   - Brand colors (primary, secondary, accent, background, text)
   - Logo image
   - Tone of voice, target audience
   - Services, unique selling points, content themes
4. All fields auto-populate — user reviews and saves

**Option B — Manual Entry**
1. User fills in brand name, tagline, colors manually
2. Uploads logo image
3. Saves brand

**Brand Editing (`/brands/[id]`):**
- Edit any scraped/entered field
- Upload or change logo
- Set as default brand
- Generate brand deck (4 AI slides showcasing the brand)
- Delete brand

---

### 3. Creating a Video (Main Workflow)

**URL:** `/create`

This is the core workflow. It has multiple input methods and a multi-step wizard.

#### Step 1: Set Purpose & Document Type

Before doing anything, the user fills in two required fields:
- **"What should this video accomplish?"** — Free text describing the goal (e.g., "Convince my client to sign the policy", "Train new employees on safety procedures")
- **Document type** — Dropdown selecting the industry (Insurance, Legal, Healthcare, Technology, General, etc.)

These shape everything downstream — what data gets highlighted, narrative tone, terminology, and whether disclaimers are added.

#### Step 2: Input Content

**Six input tabs:**

| Tab | What User Does | What Happens |
|-----|---------------|--------------|
| **Upload PDF** | Drops a PDF or PPTX file | AI extracts all content, metrics, and structure |
| **Narrate Slides** | Uploads existing slide images | Each slide becomes a scene with AI narration |
| **Type or Paste** | Pastes text (notes, emails, reports) | AI structures the text into sections |
| **From URL** | Enters a webpage URL | AI extracts the page content |
| **AI Research** | Types a topic | AI researches and generates content |
| **Start from Idea** | Types a topic + audience | AI generates full content from scratch |

**Upload Mode Options (for PDF/PPTX uploads):**

When a file is uploaded, three options appear:
1. **Add narration only** — Keep slides exactly as-is, just add voiceover and music
2. **Redesign every slide + add narration** — Keep all content but give every slide a new AI-designed look
3. **Summarize, redesign + add narration** — AI condenses the content into key points and creates new slides (default)

#### Step 3: Review Extracted Content

After extraction, the user sees:
- Document title and subtitle
- Key metrics (highlighted data points)
- Sections (content organized by topic)
- Key takeaways (bullet points)
- Edit button to modify any extracted data

User clicks **"Generate Script"** to proceed.

#### Step 4: Review & Edit Script

AI generates a narration script organized into scenes. Each scene has:
- Scene number and title
- Narration text (what the voiceover will say)
- Slide prompt (visual description for AI)

User can:
- Edit any scene's narration inline
- Add or remove scenes
- Reorder scenes
- Click "Continue" when satisfied

#### Step 5: Choose Options

- **Visual template** — Pick from 65+ slide styles (Executive, Steampunk, Neon, Watercolor, etc.)
- **Voice** — Pick from 6 AI voices (Sarah, Emily, James, Michael, Alex, Oliver)
- **Video length** — Standard (2-3 min) or Detailed (5-7 min)

#### Step 6: Generate Video

System runs the pipeline:
1. **Script generation** — AI writes narration based on purpose, industry, and content
2. **Audio generation** — Gemini TTS converts each scene's narration to speech
3. **Slide generation** — Gemini creates visual slides for each scene in the chosen template
4. **Logo compositing** — Sharp overlays the real brand logo on every slide
5. **Photo compositing** — Agent headshot on cover, standing photo on closing
6. **Music generation** — Lyria 2 creates background music matching the content mood
7. **Video assembly** — FFmpeg on VPS combines slides + audio + music into MP4
8. **Upload** — Final video uploaded to Supabase storage

Progress is shown in real-time with percentage, current step, and elapsed time.

---

### 4. Video Detail & Management

**URL:** `/videos/[id]`

**What the user sees:**
- Video player with playback controls
- Slide thumbnails strip (click to jump to any slide)
- Scene timeline with chapter markers and timestamps
- Slide list on the right side with "Redo" buttons

**Actions available:**

| Action | What It Does |
|--------|-------------|
| **Share with Client** | Opens modal with shareable link, email send option |
| **Copy Link** | Copies the public watch page URL |
| **MP4** | Downloads the video file |
| **PDF** | Generates and downloads slides as a PDF document |
| **PPTX** | Generates and downloads slides as a PowerPoint file |
| **Duplicate** | Creates a new video with the same content |
| **Email to Client** | Sends branded email with video link via connected email |
| **Translate** | (Future feature) |
| **Edit Video** | Re-enters the wizard to modify and regenerate |
| **Delete** | Permanently removes the video |
| **Redo (per slide)** | Regenerates a single slide with AI |

---

### 5. Share Page (Client-Facing)

**URL:** `/watch/[id]` (public, no login required)

This is what clients see when they receive a video link.

**Elements:**
- **Video player** — Branded, auto-plays the video
- **Slide thumbnails** — Visual navigation strip below the player
- **Chapter markers** — Clickable timeline showing each scene's title and timestamp
- **Quote/Invoice** — If the agent attached a quote, client sees line items, subtotal, tax, total
- **Accept & Pay** — Stripe payment button (charges to the agent's connected Stripe account)
- **Calendar booking** — Calendly widget for scheduling a meeting
- **AI Chatbot** — Client can ask questions about the video content
- **Download buttons** — PDF, PPTX, MP4 downloads
- **View tracking** — Agent gets notified when client watches the video

---

### 6. Dashboard

**URL:** `/dashboard`

**New users see:**
- Welcome message with setup prompts
- "Create a Video Explainer" CTA
- Quick start shortcuts (Upload PDF, Type or Paste, Start from Idea)

**Returning users see:**
- Stats (videos created, credits remaining)
- Trial/subscription status
- Recent activity (last 5 creations with thumbnails)
- Quick create button

---

### 7. Library

**URL:** `/videos`

**Content types in one unified library:**
- Videos (narrated explainers)
- Slide decks (PPTX without audio)
- Logos (generated logo kits)
- Business cards
- Flyers
- Infographics
- Social media kits

**Filter tabs** across the top to view by type. Each item shows:
- Thumbnail
- Title
- Type badge
- Creation date
- Click to view/edit

---

### 8. Clients

**URL:** `/clients`

Track engagement per client:
- Client name, email, status (new, watched, engaged)
- Videos sent to each client
- View count, play count, chat messages
- Last activity timestamp
- Device preference
- Conversion status

Searchable and sortable list.

---

### 9. Analytics

**URL:** `/analytics`

Performance metrics:
- **Views:** Total views, daily views chart, top-performing videos
- **Quotes:** Total sent, viewed, accepted, conversion rate
- **Emails:** Sent count, open count, open rate
- **Benchmarks:** Watch-through rate, time to first view vs. platform averages

---

### 10. Settings

**URL:** `/settings`

**Four tabs:**

| Tab | Contents |
|-----|----------|
| **Profile** | Name, company, email, photo, phone, role. Re-run setup wizard. |
| **Brand** | Default brand selection, colors, logo management |
| **Integrations** | Email connections (Gmail, Outlook, SMTP), Stripe Connect, Calendar (Calendly, Cal.com, Google Calendar), Referral program |
| **Subscription** | Current plan, billing, upgrade/downgrade, cancel |

---

### 11. Templates

**URL:** `/templates`

**Browse:** Gallery of 65+ built-in visual styles plus user-created custom templates.

**Create custom template (3-step process):**
1. **Describe** — Set mood using sliders (Tone, Layout, Energy, Focus), upload a reference image, or type a description
2. **Choose** — Pick from 4 AI-generated preview options
3. **Save** — Name and save to personal template library

---

### 12. Brand Kit (Sofia AI)

**URL:** `/brand-kit`

Interactive brand discovery guided by Sofia, an AI brand director:
1. Sofia asks questions about your company, audience, personality
2. User answers conversationally
3. When ready, Sofia generates:
   - 3 color palette options (user picks one)
   - Complete brand guide with tone, values, content themes
   - High-resolution logo upscaling
4. Brand saved to database for use across all videos

---

### 13. Admin Panel

**URL:** `/admin` (admin users only)

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Platform-wide stats: total users, subscriptions, video counts |
| **Users** | Search/manage users, adjust credits, toggle admin/beta flags |
| **Videos** | View all platform videos, retry failed generations |
| **Billing** | Subscription records |
| **Access** | Permission management |
| **Audit** | Action log (who changed what, when) |

---

### 14. Communications

**Email sending:**
- Connect Gmail (OAuth), Outlook (OAuth), or custom SMTP
- Send branded HTML emails with video links
- Email open tracking
- Templates auto-branded with agent's colors and logo

**SMS notifications:**
- Twilio integration
- Notify clients when videos are ready

---

### 15. Industry Landing Pages

**URL:** `/for/[industry]`

14 industry-specific marketing pages:
Insurance, Real Estate, Financial Services, Mortgage, Healthcare, Legal, Consulting, Education, Human Resources, Coaching, Fitness, Medical, Non-Profit, Property Management

Each page includes:
- Hero with industry-specific headline
- Pain points section ("The Problem")
- How it works (3 steps)
- Before/after comparison table
- Features section
- Final CTA with signup link

---

## Pricing

| Tier | Monthly | Videos Included | Per-Video Cost |
|------|---------|----------------|----------------|
| Free | $0 | Pay per video | $10/each |
| Pro | $25 | Pay per video | $6/each |
| Business | $99 | 50 included | — |
| Agency | $249 | 150 included | — |
| Enterprise | $499 | Unlimited | — |
| Enterprise+ | $799 | Unlimited + API | — |

---

## AI Models Used

| Model | Purpose |
|-------|---------|
| Gemini 2.5 Pro | Document extraction, script writing, brand scraping |
| Gemini 3 Pro Image | Slide generation, slide editing, logo upscaling |
| Gemini 2.5 Flash TTS | Voice narration (6 voices) |
| Lyria 2 | Background music generation |
| Claude Sonnet 4 | Sofia brand kit chat |

---

## Infrastructure

| Component | Service |
|-----------|---------|
| Frontend + API | Next.js 16 on Vercel |
| Database + Auth + Storage | Supabase |
| Video Assembly | FFmpeg on Hetzner VPS |
| Slide Conversion (PPTX) | LibreOffice on Hetzner VPS |
| Payments | Stripe (subscriptions + agent OAuth Connect) |
| Email | Gmail API, Microsoft Graph, SMTP, Resend |
| SMS | Twilio |
