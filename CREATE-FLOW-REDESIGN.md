# Create Flow Redesign + Credit System — Complete Implementation Plan

## Overview

Two major changes:
1. Replace single-page create form with a multi-step wizard (6 steps for video, 5 for PPTX/PDF)
2. Add inflated credit system for usage-based billing on top of existing subscriptions

---

## PART A: CREDIT SYSTEM

### Credit Tiers

| Tier | Price | Monthly Credits | ~Standard Videos | ~Quick Videos | Overage Rate |
|------|-------|----------------|-----------------|--------------|--------------|
| Free | $0 | 1,000 | ~2 | ~4 | Cannot buy more |
| Pro | $25/mo | 5,000 | ~10 | ~20 | $5 per 1,000 |
| Business | $99/mo | 25,000 | ~50 | ~100 | $5 per 1,000 |
| Agency | $249/mo | 75,000 | ~150 | ~300 | $4 per 1,000 |
| Enterprise | $499/mo | 200,000 | ~400 | ~800 | $3 per 1,000 |
| Enterprise+ | $799/mo | 500,000 | ~1,000 | ~2,000 | $2 per 1,000 |

Credits do NOT roll over. Reset on billing cycle renewal.

### Credit Costs Per Action

| Action | Credits | Your API Cost | Your Margin |
|--------|---------|--------------|-------------|
| Video — Quick (3-4 slides) | 250 | ~$0.50 | 75%+ |
| Video — Standard (6-10 slides) | 500 | ~$1.07 | 79% |
| Video — Detailed (12+ slides) | 750 | ~$2.00 | 73% |
| Podcast mode add-on | +200 | ~$0.40 | 75% |
| Slide Deck (PPTX) | 400 | ~$0.80 | 75% |
| PDF Document | 300 | ~$0.60 | 75% |
| Style preview (first free per project) | 50 | ~$0.20 | — |
| Script regeneration (first free) | 25 | ~$0.01 | — |
| AI script chat edit | 25 | ~$0.01 | — |

### Credit Top-Up Packs (one-time purchase, don't expire)

| Pack | Price | Credits | Per-Credit Rate |
|------|-------|---------|----------------|
| Starter | $10 | 2,500 | $0.004 |
| Power | $25 | 7,500 | $0.003 |
| Studio | $50 | 18,000 | $0.003 |

Top-up credits don't expire (unlike monthly). Incentivizes buying packs over paying overage.

### Profit Analysis Per Tier

**Average usage scenario:**

| Tier | Revenue | Avg Videos | Your API Cost | Stripe (2.9%) | Profit |
|------|---------|-----------|---------------|---------------|--------|
| Free | $0 | 2 | $2.14 | $0 | -$2.14 (acquisition) |
| Pro | $25 | 8 | $8.56 | $0.73 | $15.71 |
| Business | $99 | 40 | $42.80 | $2.87 | $53.33 |
| Agency | $249 | 120 | $128.40 | $7.22 | $113.38 |
| Enterprise | $499 | 300 | $321.00 | $14.47 | $163.53 |
| Enterprise+ | $799 | 500 | $535.00 | $23.17 | $240.83 |

**With overages (power user buys 50,000 extra credits on Business):**
- Overage revenue: $250
- Overage API cost: ~$107
- Extra profit: $143

### Phase C1: Database — Credit Tables

File: `supabase/migrations/20260524_add_credits.sql`

```sql
-- Credit balances (fast lookup)
CREATE TABLE credit_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  cycle_start TIMESTAMPTZ,
  cycle_credits_granted INTEGER DEFAULT 0,
  cycle_credits_used INTEGER DEFAULT 0,
  topup_balance INTEGER DEFAULT 0,  -- purchased credits (don't expire)
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit transaction log
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,          -- positive = added, negative = spent
  balance_after INTEGER NOT NULL,
  action TEXT NOT NULL,             -- 'monthly_grant', 'video_standard', 'style_preview', 'topup_pack', 'overage'
  video_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_credit_tx_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_balances_low ON credit_balances(balance) WHERE balance < 500;

-- RLS
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own balance" ON credit_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
```

### Phase C2: Credit Engine

File: new `app/_lib/credits.ts`

```typescript
// Core functions:
getBalance(userId: string): Promise<{ monthly: number, topup: number, total: number }>
deductCredits(userId: string, amount: number, action: string, videoId?: string): Promise<{ success: boolean, remaining: number }>
checkCredits(userId: string, needed: number): Promise<{ allowed: boolean, remaining: number, shortfall: number }>
grantMonthlyCredits(userId: string, tierCredits: number): Promise<void>
addTopupCredits(userId: string, amount: number, source: string): Promise<void>
getUsageHistory(userId: string, limit?: number): Promise<CreditTransaction[]>
getCreditCost(action: CreditAction): number
```

Deduction order: monthly credits first, then top-up credits. This way top-ups are truly "extra."

### Phase C3: Update pricing.ts

File: `app/_lib/pricing.ts`

Add to each tier:
```typescript
monthlyCredits: 5000,
overageRate: 0.005,  // $ per credit
creditCosts: {
  videoQuick: 250,
  videoStandard: 500,
  videoDetailed: 750,
  podcastAddon: 200,
  pptx: 400,
  pdf: 300,
  stylePreview: 50,
  scriptRegen: 25,
  aiChatEdit: 25,
}
```

### Phase C4: Stripe Integration

**In Stripe Dashboard (manual):**
1. Add metered billing price on each subscription product: "Credit Overage" at tier-specific rate
2. Create 3 one-time products: Starter Pack ($10), Power Pack ($25), Studio Pack ($50)

**In code:**

File: update `app/api/webhooks/stripe/route.ts`
- On `invoice.paid` (subscription renewal): call `grantMonthlyCredits()`, reset `cycle_credits_used`
- On `checkout.session.completed` (credit pack): call `addTopupCredits()`
- On `customer.subscription.updated` (plan change): adjust credit grant to new tier amount

File: new `app/api/credits/buy/route.ts`
- Creates Stripe Checkout session for credit pack purchase
- Returns checkout URL for redirect

File: update overage reporting
- At end of billing cycle, if `cycle_credits_used > cycle_credits_granted`, report overage to Stripe metered billing
- Stripe adds overage to next invoice automatically

### Phase C5: Credit UI

**Header credit pill:**
- Shows: "12,450 credits" with icon
- Color: green (>25%), yellow (10-25%), red (<10% of monthly)
- Click → opens credit detail dropdown: monthly remaining, top-up balance, "Buy more" button

**Pre-action confirmation:**
- Before any credit-consuming action: "This will use 500 credits (you have 12,450 remaining)"
- Confirm button to proceed
- First style preview per project: no confirmation (free)
- First script regen per project: no confirmation (free)

**Out-of-credits modal:**
- "You need 500 credits but have 200 remaining"
- Options: "Buy credits" (packs) / "Upgrade plan" / "Cancel"

**Settings → Usage page:**
- Credit usage history table: date, action, credits, balance
- Current cycle usage chart
- "Buy more credits" button

**Low balance warning:**
- Banner at top of dashboard when under 10% of monthly credits
- "You have 450 credits remaining this month. Buy more or upgrade."

### Phase C6: Pricing Page Update

File: `app/(public)/pricing/page.tsx` or equivalent

Update each tier card to show:
- Price
- Monthly credits amount (big number: "25,000 credits")
- **Approximate explainers:** "~50 standard videos or ~100 quick videos"
- Feature list
- Overage rate: "Extra credits: $5 per 1,000"

Example card:
```
BUSINESS — $99/mo
25,000 credits/month

Approximately:
- 50 standard explainer videos
- or 100 quick highlight videos  
- or 62 slide decks (PPTX)
- or 83 PDF documents
- or mix and match!

Features:
- All output types (Video, PPTX, PDF)
- Solo + podcast narration
- AI music generation
- Brand kit management
- Style previews
- Script editing with AI chat
- Priority support

Need more? Extra credits at $5/1,000
```

### Phase C7: Migration for Existing Users

- On deployment: grant all active subscribers their tier's monthly credits
- Set `cycle_start` to their current Stripe billing period start
- Free users get 1,000 credits
- No billing changes — they just see credits in the UI
- Existing in-progress videos are not affected (already paid for via old per-project model)

---

## PART B: CREATE FLOW WIZARD

### Wizard Steps

```
/create                        → Step 1: Output Type + Content + Purpose
/create/brand?id={videoId}     → Step 2: Brand
/create/voice?id={videoId}     → Step 3: Voice + Length (VIDEO only)
/create/style?id={videoId}     → Step 4: Style Preview
/create/script?id={videoId}    → Step 5: Script Review + Edit
/create/generating?id={videoId}→ Step 6: Processing + Download
```

Video = 6 steps. PPTX/PDF = 5 steps (skip voice). Progress bar adapts.

### Phase W1: Database — Wizard Columns

File: `supabase/migrations/20260524_add_wizard_columns.sql`

```sql
ALTER TABLE videos ADD COLUMN IF NOT EXISTS output_type TEXT DEFAULT 'video';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS detail_level TEXT DEFAULT 'standard';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS draft_data JSONB DEFAULT '{}';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS draft_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_videos_draft_cleanup 
  ON videos (status, draft_expires_at) 
  WHERE status = 'draft';
```

### Phase W2: Draft API

File: new `app/api/videos/draft/route.ts`

- `POST` — create draft with `status: 'draft'`, `draft_expires_at: now + 24h`
  - Checks credit balance BEFORE creating (fail early at Step 1)
  - Returns `{ videoId }`
- `PATCH` — update draft with step data, reset expiry
- `GET` — load draft for resuming wizard

File: new `app/api/cron/cleanup-drafts/route.ts`
- Daily Vercel cron: delete drafts where `draft_expires_at < now`

### Phase W3: Shared Components

File: new `app/(dashboard)/create/_components/WizardProgress.tsx`
- Step breadcrumbs with current step highlighted
- Adapts for output type (hides Voice for PPTX/PDF)
- "Step X of Y"

File: new `app/(dashboard)/create/_components/CreditCost.tsx`
- Shows estimated credit cost for current project
- Updates as user changes options (quick→detailed, adds podcast, etc.)

### Phase W4: Step 1 — Output Type + Content

File: `app/(dashboard)/create/page.tsx` (refactor)

- Feature flag: `USE_NEW_CREATE_FLOW` env var
- Output type selector: 3 large cards (Video / PPTX / PDF)
- Purpose input
- Content source (URL / Upload / Paste / AI)
- Credit check before "Next"
- On submit: extract content, create draft, redirect to `/create/brand`

### Phase W5: Step 2 — Brand

File: new `app/(dashboard)/create/brand/page.tsx`

- Saved brands list with "Use this brand" buttons
- OR inline brand creation (name, logo, colors, contact info)
- Auto-detect from URL scrape or PDF
- "Save as my default brand" checkbox
- "Skip — use generic styling" link
- Next → voice (video) or style (PPTX/PDF)

### Phase W6: Step 3 — Voice + Length (VIDEO ONLY)

File: new `app/(dashboard)/create/voice/page.tsx`

- Skip for PPTX/PDF (redirect to style)
- Solo / Podcast selector with audio samples
- Voice grid with play buttons
- Video length: Quick / Standard / Detailed (3 cards)
- Credit cost display updates live: "Quick = 250 credits, Standard = 500, Detailed = 750"
- Background music toggle + genre
- Next → style

File: `public/samples/*.mp3` — 10-second voice samples for each voice + podcast demo

### Phase W7: Step 4 — Style Preview

File: new `app/(dashboard)/create/style/page.tsx`

- Auto-generate 2 preview slides (first preview free, no credit charge)
- "Use this style" / "Try a different style"
- Trying different = 50 credits per preview (show cost)
- Fallback: static thumbnails if VPS is down
- Next → script

### Phase W8: Step 5 — Script Review + Edit

File: `app/(dashboard)/create/script/page.tsx` (EXISTS — update)

- Trigger script generation on load (first gen free, regen = 25 credits)
- Scene-by-scene editable cards
- Video: editable narration + read-only slide description
- PPTX: editable headlines + bullets + speaker notes
- PDF: editable headlines + bullets
- Drag to reorder, delete scenes, add scenes
- AI chat sidebar (25 credits per edit)
- Summary: estimated duration/pages, scene count, total credit cost
- "Generate" button shows final credit cost + confirms

### Phase W9: Step 6 — Processing + Download

File: `app/(dashboard)/create/generating/page.tsx` (EXISTS — update)

- Video: progress bar → video player → download MP4 + share link
- PPTX: progress bar → download PPTX + slide preview + "Also generate video" upsell
- PDF: progress bar → download PDF + preview + "Also generate video" upsell

### Phase W10: PPTX + PDF Generation

File: new `app/api/generate-pptx/route.ts`
- Generate slide images with gpt-image-2
- Build PPTX with existing `pptx-generator.ts`
- Narration → speaker notes
- Brand logo on title + closing slides
- Upload to Supabase, update video record

File: new `app/api/generate-pdf/route.ts`
- Same slide generation as PPTX
- Render as PDF (Sharp or jsPDF)
- Upload to Supabase, update video record

### Phase W11: Dashboard — Continue Drafts

File: update `app/(dashboard)/page.tsx`

- Show "Continue draft" cards for `status: 'draft'` videos
- Shows: purpose, output type, which step, when started
- "Continue" → correct step page
- "Discard" → delete draft

### Phase W12: Update generate-video API

File: `app/api/generate-video/route.ts`

- Accept `detailLevel` as string (not boolean)
- Accept `outputType`
- Force `narrationStyle: 'solo'` for PPTX/PDF
- Deduct credits before starting generation
- Route to correct generation path (VPS for video, server-side for PPTX/PDF)

---

## PART C: EDGE CASES

### Handled in implementation:

1. **Abandoned drafts** → auto-delete after 24h via cron
2. **Back button** → each step reads from DB, survives refresh
3. **Output type change** → going back clears incompatible selections (voice/music)
4. **No brand + PDF upload** → "Skip brand" option, generic defaults
5. **Credit check at Step 1** → fail early, don't waste API calls
6. **Style preview fails** → fallback to static thumbnails
7. **Script generation fails** → retry button, draft data preserved
8. **Multiple tabs** → both create drafts, no conflict
9. **Empty content extraction** → error at Step 1, block progress
10. **Very long documents** → collapsible scene cards in script review
11. **Non-English** → store detected language, narrate in English for V1
12. **PPTX + podcast combo** → forced to solo for PPTX/PDF
13. **PDF definition** → slides rendered as PDF pages (same as PPTX but non-editable)
14. **PPTX speaker notes** → narration text becomes speaker notes
15. **Concurrent generation** → disable button + inFlightVideos check
16. **Multiple brands (agency)** → show all brands, let them pick
17. **No logo brand** → skip logo composite, works fine
18. **International phone** → store as-is, TTS handles separately
19. **Duplicate generation** → button disabled after click
20. **Draft data schema changes** → JSONB is forward-compatible
21. **Supabase RLS** → policies on all new tables
22. **"Clone video" for different client** → future: copy draft with new brand (credits apply)
23. **Video + PPTX combo** → upsell on completion page, separate credit charge
24. **Wizard analytics** → track step enter/complete for drop-off analysis

---

## COMPLETE BUILD ORDER

| # | Phase | What | New Files | Updated Files |
|---|-------|------|-----------|---------------|
| 1 | C1 | Credit DB tables | `migrations/20260524_add_credits.sql` | — |
| 2 | C2 | Credit engine | `app/_lib/credits.ts` | — |
| 3 | C3 | Update pricing | — | `app/_lib/pricing.ts` |
| 4 | W1 | Wizard DB columns | `migrations/20260524_add_wizard_columns.sql` | — |
| 5 | C4 | Stripe integration | `app/api/credits/buy/route.ts` | `app/api/webhooks/stripe/route.ts` |
| 6 | C5 | Credit UI (header pill) | — | Layout component, header |
| 7 | W2 | Draft API | `app/api/videos/draft/route.ts`, `app/api/cron/cleanup-drafts/route.ts` | — |
| 8 | W3 | Shared wizard components | `WizardProgress.tsx`, `CreditCost.tsx` | — |
| 9 | C6 | Pricing page update | — | Pricing page |
| 10 | W4 | Step 1: Content | — | `create/page.tsx` |
| 11 | W5 | Step 2: Brand | `create/brand/page.tsx` | — |
| 12 | W6 | Step 3: Voice | `create/voice/page.tsx`, `public/samples/*.mp3` | — |
| 13 | W7 | Step 4: Style | `create/style/page.tsx` | — |
| 14 | W8 | Step 5: Script | — | `create/script/page.tsx` |
| 15 | W9 | Step 6: Processing | — | `create/generating/page.tsx` |
| 16 | W10 | PPTX + PDF gen | `api/generate-pptx/route.ts`, `api/generate-pdf/route.ts` | `videos/[id]/page.tsx` |
| 17 | W11 | Dashboard drafts | — | Dashboard page |
| 18 | W12 | Update generate API | — | `api/generate-video/route.ts` |
| 19 | C7 | Migrate existing users | One-time script | — |
| 20 | — | Edge cases | Across all phases | — |
| 21 | — | Help docs update | — | `help/` articles |
| 22 | — | Remove feature flag | — | `create/page.tsx` |

---

## FILES SUMMARY

### New Files (17)

| File | Purpose |
|------|---------|
| `supabase/migrations/20260524_add_credits.sql` | Credit tables + RLS |
| `supabase/migrations/20260524_add_wizard_columns.sql` | Draft + output_type columns |
| `app/_lib/credits.ts` | Credit engine (balance, deduct, check, grant) |
| `app/api/videos/draft/route.ts` | Draft CRUD API |
| `app/api/cron/cleanup-drafts/route.ts` | Daily draft cleanup |
| `app/api/credits/buy/route.ts` | Stripe checkout for credit packs |
| `app/api/generate-pptx/route.ts` | PPTX generation |
| `app/api/generate-pdf/route.ts` | PDF generation |
| `app/(dashboard)/create/_components/WizardProgress.tsx` | Step progress bar |
| `app/(dashboard)/create/_components/CreditCost.tsx` | Live credit cost display |
| `app/(dashboard)/create/brand/page.tsx` | Step 2: Brand |
| `app/(dashboard)/create/voice/page.tsx` | Step 3: Voice + Length |
| `app/(dashboard)/create/style/page.tsx` | Step 4: Style Preview |
| `public/samples/solo-nova.mp3` | Voice sample |
| `public/samples/solo-onyx.mp3` | Voice sample |
| `public/samples/podcast-sample.mp3` | Podcast sample |
| (+ more voice samples) | |

### Updated Files (10)

| File | Changes |
|------|---------|
| `app/_lib/pricing.ts` | Add credit amounts, costs, overage rates per tier |
| `app/_lib/types.ts` | Add WizardDraft, output_type, detail_level to Video |
| `app/api/generate-video/route.ts` | detailLevel string, outputType routing, credit deduction |
| `app/api/webhooks/stripe/route.ts` | Credit grants on renewal, pack purchases |
| `app/(dashboard)/create/page.tsx` | Simplify to Step 1 behind feature flag |
| `app/(dashboard)/create/script/page.tsx` | Load from draft, output-type-aware editing |
| `app/(dashboard)/create/generating/page.tsx` | PPTX/PDF download support |
| `app/(dashboard)/videos/[id]/page.tsx` | Output-type-aware detail page |
| `app/(dashboard)/page.tsx` | Continue draft cards |
| Pricing page | Credits, approximate explainers per tier |

---

## MIGRATION STRATEGY

1. Build all behind feature flag `USE_NEW_CREATE_FLOW=true`
2. Old create flow works unchanged for all users
3. Deploy credit tables + engine (invisible until new flow activates)
4. Test new flow on admin accounts
5. Grant existing users their tier credits
6. Enable new flow for all users
7. Monitor for 1 week
8. Remove feature flag + old create page
