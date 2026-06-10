# 10-Item Feature Plan

## Status Summary

| # | Item | Status | Effort |
|---|------|--------|--------|
| 1 | Remove logo, use company name only | Quick fix | 30 min |
| 2 | Video opens with recipient name | Quick fix | 30 min |
| 3 | Recipient name input field | Quick fix | 20 min |
| 4 | Music not generating | Bug fix | 1 hr |
| 5 | Detailed cost/analytics dashboard | New feature | 4-6 hrs |
| 6 | Stripe sales dashboard | New feature | 3-4 hrs |
| 7 | Admin section UX polish | Polish | 2-3 hrs |
| 8 | Detailed user section | Enhancement | 2 hrs |
| 9 | Video preview page audit | Audit + fix | 1-2 hrs |
| 10 | Script review editing | Already done | 0 |

---

## Item 1: Remove Logo, Use Company Name Only

**What to do:**
- Remove logo upload from brand page (`create/brand/page.tsx`)
- Remove logo scraping from brand scraper (`brand-scraper.ts`)
- Remove logo composite from VPS slide generation
- Remove logo composite from Vercel generate-slide route
- All slides show company/org name as text in top-left instead
- Keep logo field in DB (don't migrate) — just stop using it

**Files to change:**
- `app/(dashboard)/create/brand/page.tsx` — remove logo upload section
- `app/api/generate-video/route.ts` — remove logoUrl from VPS payload
- VPS server.js — remove logoBase64 handling from generateOneSlide

---

## Item 2: Video Opens with Recipient Name

**What to do:**
- If recipient name provided: "Hello [First Last], thank you for your time today."
- If no name: "Thank you for your time today."
- Source: new `recipientName` field from create flow

**Files to change:**
- `app/api/generate-video/route.ts` — update coverNarration (line 608-611)
- `app/api/generate-script/route.ts` — pass recipientName to generateScript
- `app/_lib/script-generator.ts` — add recipientName parameter, inject into prompt

---

## Item 3: Recipient Name Input Field

**What to do:**
- Add "Who is this for?" text input ABOVE the purpose textarea on Step 1
- Label: "Recipient name (optional)"
- Placeholder: "e.g. John Smith"
- Save to draft data, pass through to script generation

**Files to change:**
- `app/(dashboard)/create/_components/Step1Content.tsx` — add input field
- `app/api/videos/draft/route.ts` — store recipientName in draft_data
- `app/(dashboard)/create/script/page.tsx` — pass recipientName to generate-script

---

## Item 4: Music Not Generating

**What to do:**
- Diagnose: VPS Lyria calls return empty (0 parts). Could be API key, model change, or prompt issue
- Check if `aiMusic` is being sent from frontend (voice page toggle)
- Check VPS Lyria code for errors
- Fix or add fallback (royalty-free music library)

**Files to check:**
- VPS server.js — Lyria generation section
- `app/(dashboard)/create/voice/page.tsx` — aiMusic toggle state
- `app/api/generate-video/route.ts` — musicPrompt sent to VPS

---

## Item 5: Detailed Cost/Analytics Dashboard

**What to build:**
- New admin page: `/admin/costs`
- Track per-video costs:
  - Extraction: ~$0.01 (gpt-4o-mini)
  - Script generation: ~$0.05 (Claude Sonnet)
  - Slide generation: ~$0.03-0.05/slide × N slides (Gemini)
  - TTS: ~$0.015/1K chars (OpenAI TTS-HD)
  - Music: ~$0.01 (Lyria)
  - Total per video estimate
- Dashboard sections:
  - Total spend this month (estimated from usage)
  - Average cost per video
  - Cost breakdown by API provider (OpenAI, Anthropic, Google)
  - Cost per user (top spenders)
  - Daily cost trend chart
  - Credit revenue vs API cost (profit margin)

**Files to create:**
- `app/(dashboard)/admin/costs/page.tsx` — cost dashboard UI
- `app/api/admin/costs/route.ts` — aggregates from credit_transactions + video counts
- May need new `api_costs` table or derive from existing data

---

## Item 6: Stripe Sales Dashboard

**What to build:**
- New admin page: `/admin/revenue`
- Fetch directly from Stripe API:
  - Total revenue (MRR, total)
  - Active subscriptions by tier
  - Recent payments
  - Churn rate
  - Credit pack sales
  - Revenue trend chart
- No Stripe dashboard login needed — all data via Stripe API

**Files to create:**
- `app/(dashboard)/admin/revenue/page.tsx` — revenue dashboard UI
- `app/api/admin/revenue/route.ts` — calls Stripe API for metrics

---

## Item 7: Admin Section UX Polish

**What to do:**
- Audit all admin pages for usability
- Fix navigation — clear sidebar/tabs
- Consistent card layouts, loading states
- Quick actions (ban user, add credits, change plan) should be 1-click
- Mobile responsive
- Search/filter on all list pages

**Files to check:**
- `app/(dashboard)/admin/page.tsx` — main admin dashboard
- All sub-pages under admin/

---

## Item 8: Detailed User Section

**What to enhance:**
- Already exists at `/admin/users/[id]`
- Add:
  - Video history with thumbnails + status
  - Credit usage timeline
  - Login history / last active
  - Revenue from this user (subscription + packs)
  - Quick actions: add credits, change plan, send email

**Files to change:**
- `app/(dashboard)/admin/users/[id]/page.tsx`
- `app/api/admin/user-detail/route.ts`

---

## Item 9: Video Preview Page Audit

**Status: All 17 buttons/features exist and are wired.**
- Share, Copy Link, MP4, PDF, PPTX, Script download
- Duplicate, Email, Translate, Social Posts
- Edit Video (scene/narration/slide editing)
- Delete, Music control, Slide thumbnails, Chapter markers
- Follow-up plan, Quote builder

**What to do:**
- Test each button end-to-end
- Fix any that fail silently
- Verify PDF/PPTX downloads use Gemini (not old OpenAI)

---

## Item 10: Script Review Editing — ALREADY DONE

- Edit mode toggle exists
- Editable: narration, headlines, bullets, slide prompts
- Drag to reorder, delete, add scenes
- AI chat sidebar for edits
- Quick preview
- No work needed

---

## Recommended Build Order

**Phase 1 — Quick fixes (1-2 hours):**
1. Item 1: Remove logo
2. Item 3: Add recipient name field
3. Item 2: Video opens with name

**Phase 2 — Bug fix (1 hour):**
4. Item 4: Fix music generation

**Phase 3 — Admin dashboards (6-8 hours):**
5. Item 5: Cost analytics
6. Item 6: Stripe revenue
7. Item 8: Enhanced user section
8. Item 7: Admin UX polish

**Phase 4 — Verification (1-2 hours):**
9. Item 9: Video preview audit
