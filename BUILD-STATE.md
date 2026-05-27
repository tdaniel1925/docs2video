# Docs2Video — Build State

**Last updated:** 2026-05-17
**Branch:** main
**Build:** ✅ Compiles, 1 TS error (Video.updated_at — already fixed, needs redeploy)
**Deploy:** Vercel (docs2video.com)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (Turbopack) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI Images | Google Gemini 3 Pro Image |
| AI Text | Google Gemini 2.5 Pro/Flash + Anthropic Claude |
| AI Voice | OpenAI TTS-HD (6 voices) |
| AI Music | Suno via Kie.ai API |
| AI Logos | OpenAI GPT Image (cover-overlay.ts — logo+title on cover/closing slides) |
| Video Assembly | FFmpeg (external Hetzner VPS) |
| Payments | Stripe (subscriptions + agent OAuth Connect) |
| Email | Gmail API, Microsoft Graph, SMTP/Nodemailer, Resend |
| SMS | Twilio |
| Hosting | Vercel |

---

## Pricing (from pricing.ts)

| Tier | Monthly | Projects | Courses |
|------|---------|----------|---------|
| Free | $0 | $10/each | $249/each |
| Pro | $25 | $6/each | $149/each |
| Business | $99 | 50 included | $99/each |
| Agency | $249 | 150 included | 5 included |
| Enterprise | $499 | Unlimited | 20 included |
| Enterprise+ | $799 | Unlimited | Unlimited |

---

## Codebase Stats

| Metric | Count |
|--------|-------|
| Source files | 253 |
| API routes | 116 |
| Pages | 50+ |
| Components | 23 |
| Lib files | 32 |
| Slide templates | 65 |
| Voice options | 6 |
| Industry configs | 12 |
| Migration files | 31 |
| E2E test files | 12 |

---

## External Services & API Keys

| Service | Env Var | Purpose |
|---------|---------|---------|
| Gemini | `GEMINI_API_KEY` | Image gen, text extraction, script writing |
| OpenAI | `OPENAI_API_KEY` | TTS voices, logo styling (GPT Image) |
| Anthropic | `ANTHROPIC_API_KEY` | Claude for brand-kit chat (Sofia AI) |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | DB, auth, storage |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Subscriptions, payments |
| Stripe Prices | `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_AGENCY`, `STRIPE_PRICE_ENTERPRISE`, `STRIPE_PRICE_ENTERPRISE_PLUS` | Plan price IDs |
| Stripe Projects | `STRIPE_PRICE_PROJECT`, `STRIPE_PRICE_PROJECT_PRO`, `STRIPE_PRICE_COURSE`, `STRIPE_PRICE_COURSE_PRO`, `STRIPE_PRICE_COURSE_BIZ` | Per-project prices |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Gmail, Google Calendar |
| Microsoft OAuth | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`, `MICROSOFT_TENANT_ID` | Outlook/365 email |
| Kie.ai | `KIE_API_KEY` | Suno music generation |
| Resend | `RESEND_API_KEY` | Email delivery |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS notifications |
| Video VPS | `VIDEO_ASSEMBLY_URL`, `VIDEO_ASSEMBLY_SECRET` | External FFmpeg server |
| App Config | `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAIL`, `IMAGE_MODEL` | App settings |

---

## Auth Providers

1. **Supabase Auth** — email/password signup/login
2. **Google OAuth** — Gmail send + Google Calendar
3. **Microsoft OAuth** — Outlook/365 email send
4. **Stripe OAuth** — agents connect their own Stripe for client payments

---

## Key Features (verified working)

### Content Creation
- Upload PDF → AI extraction (any document type, 12 industry configs)
- Type/paste text → AI structuring
- Start from idea → AI content generation
- URL extraction
- AI Research mode

### Output Types
- Video explainers (script → slides → audio → music → assembly)
- Infographics
- Slide decks (PPTX)
- PDF downloads
- Logo generation + styling
- Social media kits
- Business cards
- Flyers
- Video courses
- Brand decks

### Branding
- Website scraper (URL → colors, logo, fonts, tone, industry)
- Brand guide generation (color psychology, tone guide, content themes)
- Cover/closing overlay system (Gemini decorative background + GPT logo+title overlay + Sharp composite)
- Multiple photo uploads (headshot, mid-level, standing)
- Photo compositing on slides

### Share Page (/watch/[id])
- Branded video player with slide thumbnails
- Quote/invoice with line items
- Accept & Pay (agent's Stripe)
- Calendar booking (Calendly)
- AI chatbot (Gemini)
- View tracking + agent notifications
- PDF/PPTX/MP4 downloads

### Communications
- Gmail, Outlook, SMTP email sending
- Branded HTML email templates
- Email open tracking
- SMS notifications (Twilio)

### Admin
- Dashboard with stats
- Bulk operations
- Campaign management
- User management
- Music library management

---

## Database Tables (Supabase)

Core: profiles, videos, brands, infographics, custom_templates
Content: creations, video_analytics, chat_messages
Commerce: quotes, email_connections, sent_emails
CRM: clients, client_activities (+ videos.client_id FK)
Social: social_shares, affiliates, referrals
Admin: campaigns, notifications, jobs, feedback
Auth: managed by Supabase Auth

### Client Management System (added 2026-05-25)
- **clients** table: full CRM with name, email, company, phone, industry, tags, status (lead/active/engaged/converted/inactive), source tracking, revenue/video/view counters
- **client_activities** table: unified timeline (email_sent, video_viewed, video_played, note_added, client_created, quote_sent, etc.)
- **videos.client_id**: FK to clients table for direct assignment
- **API routes**: `/api/clients` (list+create), `/api/clients/[id]` (detail+update+delete), `/api/clients/[id]/activities` (timeline+notes), `/api/clients/[id]/videos` (assigned+sent videos), `/api/clients/import` (CSV), `/api/clients/export` (CSV)
- **Pages**: `/clients` (list with stats, search, status filters, add form, CSV import/export), `/clients/[id]` (detail with tabs: activity, videos, emails, payments)
- **Activity wiring**: send-video-email and send-email routes auto-create/update client records and log activities; track-view logs video_viewed/video_played activities to matching clients
- **Migration**: `supabase-clients-migration.sql` (run against Supabase to create tables + RLS)

---

## Known Issues

1. Video `updated_at` type fixed in types.ts but verify on next deploy
2. Some E2E test selectors may not match current UI (ongoing)
3. Logo kit generation is async — may not complete before user navigates away
