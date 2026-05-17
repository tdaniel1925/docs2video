@AGENTS.md

# Project: Docs2Video (docs2video.com)

## CRITICAL RULES

### 1. Read before writing
- ALWAYS read the actual source code before suggesting changes or features
- NEVER assume what exists — grep/read the file first
- NEVER suggest features that already exist in the codebase
- NEVER mention Paddle — this project uses Stripe only

### 2. Keep BUILD-STATE.md updated
- After ANY significant change (new feature, new API route, new page, config change), update `BUILD-STATE.md`
- After fixing bugs, update the "Known Issues" section
- After adding env vars, update the "External Services" table
- This file is the source of truth for project state across sessions

### 3. Payments — Stripe ONLY
- User subscriptions: Stripe (6 tiers from Free to Enterprise+)
- Client payments: Agent's own Stripe via OAuth Connect
- Per-project charges: Stripe
- NO Paddle, NO other payment processors

### 4. Logo generation — images only, never from text
- OpenAI GPT Image (`logo-styler.ts`) styles existing uploaded logos
- NEVER generate logos from a brand name or text
- If no logo image is uploaded, skip logo kit entirely
- Gemini slides must NEVER render brand names or fake logos

### 5. Default voice is female
- Default voice: Sarah (nova) — first in VOICE_OPTIONS array
- Only change if user explicitly selects a different voice

### 6. Code style
- All border-radius: max 10px (never 100px pills, never >10px)
- Use CSS classes from globals.css, not inline Tailwind
- Design system: warm cream (#F4F1EC) + mint (#C7E8A8) palette
- Font: Plus Jakarta Sans + Instrument Serif

### 7. No unnecessary suggestions
- Don't suggest "what to build next" unless asked
- Don't propose new payment processors
- Don't propose alternative AI services unless current ones are broken
- Focus on fixing what's broken, not adding more

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (Turbopack) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI Images | Gemini 3 Pro Image |
| AI Text | Gemini 2.5 Pro/Flash + Anthropic Claude |
| AI Voice | OpenAI TTS-HD |
| AI Music | Suno via Kie.ai |
| AI Logos | OpenAI GPT Image |
| Video | FFmpeg (Hetzner VPS: VIDEO_ASSEMBLY_URL) |
| Payments | Stripe |
| Email | Gmail API, Microsoft Graph, SMTP, Resend |
| SMS | Twilio |
| Hosting | Vercel |

---

## Key Files

| File | Purpose |
|------|---------|
| `BUILD-STATE.md` | Full project state — update after every change |
| `app/_lib/pricing.ts` | Pricing tiers and limits |
| `app/_lib/stripe.ts` | Stripe config |
| `app/_lib/types.ts` | All TypeScript interfaces |
| `app/_lib/gemini.ts` | Image gen + extraction |
| `app/_lib/script-generator.ts` | Video script generation |
| `app/_lib/tts.ts` | OpenAI voice synthesis |
| `app/_lib/music-generator.ts` | Suno/Kie.ai music |
| `app/_lib/logo-styler.ts` | OpenAI logo styling |
| `app/_lib/composite.ts` | Photo/logo overlay on slides |
| `app/_lib/brand-scraper.ts` | Website brand extraction |
| `app/_lib/video.ts` | FFmpeg video assembly |
| `app/_lib/industries.ts` | 12 industry configurations |
| `app/_lib/email.ts` | Email sending (3 providers) |

---

## Pricing (6 tiers)

| Tier | Price | Projects |
|------|-------|----------|
| Free | $0/mo | $10/each |
| Pro | $25/mo | $6/each |
| Business | $99/mo | 50 included |
| Agency | $249/mo | 150 included |
| Enterprise | $499/mo | Unlimited |
| Enterprise+ | $799/mo | Unlimited + API |

---

# Help System Maintenance

When adding, removing, or significantly changing any user-facing feature:
1. Update the corresponding help article in `app/(dashboard)/help/` to reflect the change
2. If a new feature is added, create a new help article for it
3. Help articles should include step-by-step instructions with descriptions of what the user sees at each step
4. Keep the help index page (`app/(dashboard)/help/page.tsx`) up to date with links to all articles
5. Use clear, non-technical language suitable for non-developers
