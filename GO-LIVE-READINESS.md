# Docs2Video — Go-Live Readiness Report

_Last updated: 2026-06-21_

## Verdict: 🟢 GO (once the deploy/verify checklist below is green)

The launch-blocking security holes from the earlier audit are fixed and live (migrations applied + VPS redeployed). The customer-facing surfaces, payments, credits, and admin controls have been audited and the high-severity issues remediated.

---

## What shipped this cycle

### Security (5 blockers + 5 high — all fixed & live)
- **B1** profiles RLS `WITH CHECK` + trigger blocks client edits to admin/billing/stripe columns.
- **B2** Stripe Connect OAuth: signed per-session `state` cookie + `auth.getUser()` verification (payout-takeover closed); raw token no longer stored.
- **B3** removed dual billing — credits are the single paywall.
- **B4** removed the never-decremented free-video gate.
- **B5** atomic `processed_stripe_events` webhook idempotency (no double-grant).
- **H1** refund/chargeback now revokes credit-pack credits.
- **H2** `subscription.updated` keeps `past_due` (delinquents stay blocked).
- **H3** public watch endpoint column allowlist + sanitized `_pipeline_input`.
- **H4** atomic, idempotent refund (`refund_video` unique index).
- **H5** balance + ledger commit together via RPC.

### Video / slide quality
- Phone renders as `1-936-641-7130` on the contact line + closing card.
- Cover holds ≥4.5s, every scene ≥3s (no flash-by slides).
- Slide-panel text auto-fits + can't overflow the box.
- Editorial render no longer falls back to the placeholder clip; explainer pages use full-bleed accent colors; "THE SPECIAL REPORT" boilerplate removed.
- Insurance disclosures extracted verbatim → full-width accordion on the share page.

### App / UX
- Tools hidden from nav; Library trimmed to Videos/Decks; Style & Branding tab removed; empty chat-card hidden.
- Library is a dense paginated table (25/50/100) with recipient/status/credits + delete.
- Notifications: delete + clear-all.
- Settings Integrations: Stripe **Payment Link** field (+ share-page Pay button); stale parallel referral UI removed → links to `/affiliate`.
- All `alert()` popups replaced with inline toasts app-wide.
- Help chatbot: accurate current knowledge, HTML output, stays on topic.
- Help index pricing corrected to the credit model.

### Money / admin
- Analytics fixed (`video_views.opened_at` column bug) — 30-day chart, MoM, time-to-first-view now real.
- Clients: Emails tab route created; Payments tab filters by client.
- Affiliate: credit-pack checkout applies the referrer's promo from the `d2v_ref` cookie.
- Admin: campaign table-collision filter; user-detail video link → `/watch/{id}`.
- **New Admin → Billing & Sales**: live customer/subscription list, MRR/active/past-due/paused stats, cancel/pause/resume.

---

## Status: 🟢 LIVE — live Stripe keys set; first customers onboarded.

## Launch checklist (operator) — complete
- [x] Apply migrations (`supabase db push`)
- [x] VPS redeploy (`redeploy.sh`)
- [x] Vercel env values cleaned; `/api/health` → `status: ok`, `missingRequiredEnvCount: 0`
- [x] Stripe in **live** mode; platform webhook at `/api/webhooks/stripe` with live signing secret

## Payment model — payment LINKS only (no Stripe Connect)
We do NOT process users' clients' payments. A user pastes their own **Stripe
Payment Link / Square / PayPal** URL in Settings → Integrations; the share-page
Pay button (and quote-card Pay button) opens it in a new tab. We're never in
that money flow. The Stripe Connect "process client payments" path was removed.
**Our** Stripe (subscriptions + credit packs) is unaffected — that's our revenue.

## Admin controls — verified in place
Impersonate · plan change · add/reset credits · admin/beta toggle · retry video
(re-triggers generation) · API keys · affiliates (approve/export/mark-paid) ·
system status · logs · **Billing & Sales (cancel/pause/resume)** · revenue
charts · API costs.

## Known non-blocking follow-ups (post-launch backlog)
- Analytics date-range/export not implemented (intentionally minimal).
- `increment_client_revenue` migration is applied but now unused (Connect removed) — harmless.

_Earlier backlog items (watch-through tracking, prospects reject/regenerate,
retry-video, campaign audit log, affiliate signup-attribution, admin help
accuracy) have been completed._
