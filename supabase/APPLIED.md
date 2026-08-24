# Legacy SQL Ledger (`supabase/legacy/`)

These files were historically kept at the repo root and run **by hand** in the
Supabase SQL editor at unknown times (prod has never run `supabase db push`).
They are preserved verbatim in `supabase/legacy/` as an audit record. They were
deliberately **not** renamed into `supabase/migrations/` — fabricating
timestamps would corrupt migration ordering for `supabase db push`.

Applied-to-prod status for every row below: **assumed applied (pre-ledger, hand-run)**.

| File | What it does | Prod status |
|---|---|---|
| migration-nurture-sent.sql | Adds `profiles.nurture_sent` jsonb tracking which nurture emails were sent | assumed applied (pre-ledger, hand-run) |
| security-fixes.sql | Multi-step security remediation script (policy/RLS cleanup, run section-by-section) | assumed applied (pre-ledger, hand-run) |
| supabase-admin-migration.sql | Adds `profiles.is_admin` / `is_beta` flags; seeds admin emails | assumed applied (pre-ledger, hand-run) |
| supabase-affiliate-migration.sql | Affiliate v1: extends `affiliates`; adds `affiliate_commissions`, `affiliate_clicks` (RLS-deny) | assumed applied (pre-ledger, hand-run) |
| supabase-affiliates-migration.sql | Creates original `affiliates` table with referral codes | assumed applied (pre-ledger, hand-run) |
| supabase-apex-integration.sql | Adds `affiliates.payout_via` for Apex MLM comp-plan payouts | assumed applied (pre-ledger, hand-run) |
| supabase-api-migration.sql | Public API v1: `api_keys`, `api_credit_balances`, `api_usage_log` (RLS-deny) | assumed applied (pre-ledger, hand-run) |
| supabase-app-settings-migration.sql | Key/value `app_settings` table for DB-backed feature flags | assumed applied (pre-ledger, hand-run) |
| supabase-assets-migration.sql | `creation_assets` table for uploaded product/logo/lifestyle assets | assumed applied (pre-ledger, hand-run) |
| supabase-brand-deck-migration.sql | Adds `brands.reference_slides` + `deck_style_id` for Brand Deck Builder | assumed applied (pre-ledger, hand-run) |
| supabase-brand-guide-migration.sql | Expanded brand-guide columns on `brands` (tagline, tone, fonts, values, ...) | assumed applied (pre-ledger, hand-run) |
| supabase-campaign-failed-status.sql | Allows `failed` in campaign `video_status` CHECK (drops/re-adds constraint) | assumed applied (pre-ledger, hand-run) |
| supabase-campaigns-migration.sql | `campaigns` + contact tables for discount campaign marketing | assumed applied (pre-ledger, hand-run) |
| supabase-card-trial-migration.sql | Adds `profiles.card_on_file` + `free_videos_remaining` | assumed applied (pre-ledger, hand-run) |
| supabase-clients-migration.sql | `clients` table + RLS | assumed applied (pre-ledger, hand-run) |
| supabase-company-context-migration.sql | Adds `videos.company_context` (scraped site content for share-page chatbot) | assumed applied (pre-ledger, hand-run) |
| supabase-creations-migration.sql | Unified `creations` log table (video/flyer/card/infographic/ad/brand-deck) | assumed applied (pre-ledger, hand-run) |
| supabase-credits-migration.sql | Adds `profiles.pack_credits` + `credits_reset_at` | assumed applied (pre-ledger, hand-run) |
| supabase-demo-migration.sql | `demo_videos` cache table for landing-page demos | assumed applied (pre-ledger, hand-run) |
| supabase-disclaimers-migration.sql | Adds `videos.disclaimers` jsonb (extracted insurance disclaimers) | assumed applied (pre-ledger, hand-run) |
| supabase-email-campaigns-migration.sql | Extends `campaigns` with email template/subject/industry columns | assumed applied (pre-ledger, hand-run) |
| supabase-email-migration.sql | `email_connections` (Gmail/Outlook OAuth tokens) + email integration tables | assumed applied (pre-ledger, hand-run) |
| supabase-feedback-migration.sql | `slide_feedback` ratings table | assumed applied (pre-ledger, hand-run) |
| supabase-fix-rls.sql | Drops over-permissive "Anyone can view completed videos" policy | assumed applied (pre-ledger, hand-run) |
| supabase-fix-subscription-status-check.sql | Rebuilds `profiles.subscription_status` CHECK (adds enterprise/past_due/unpaid; note: omits `starter` — see BILLING-CREDITS-AUDIT-REPORT.md) | assumed applied (pre-ledger, hand-run) |
| supabase-followup-migration.sql | `follow_up_plans` table (AI follow-up suggestions per video) | assumed applied (pre-ledger, hand-run) |
| supabase-free-trial-migration.sql | Adds `videos.is_trial` flag + partial index (watermarked trial videos) | assumed applied (pre-ledger, hand-run) |
| supabase-intelligence-migration.sql | `client_profiles` engagement-aggregation table | assumed applied (pre-ledger, hand-run) |
| supabase-logo-kit-migration.sql | Adds `brands.logo_kit` jsonb + `brand-assets` storage bucket | assumed applied (pre-ledger, hand-run) |
| supabase-logo-migration.sql | Adds `logo` to `creations` type CHECK | assumed applied (pre-ledger, hand-run) |
| supabase-logo-variants-migration.sql | Adds `brands.logo_light_url` / `logo_dark_url` / `logo_chip` for rendering | assumed applied (pre-ledger, hand-run) |
| supabase-marketing-features-migration.sql | Adds `profiles.referral_prompt_sent` + cron index | assumed applied (pre-ledger, hand-run) |
| supabase-migration.sql | Base schema FRESH INSTALL (drops + recreates core tables, triggers, RLS) | assumed applied (pre-ledger, hand-run) |
| supabase-MISSING-TABLES-2026-06-22.sql | Backfills tables referenced by code but never created in prod (idempotent) | assumed applied (pre-ledger, hand-run) |
| supabase-music-migration.sql | `music_tracks` background-music table | assumed applied (pre-ledger, hand-run) |
| supabase-music-url-migration.sql | Adds `videos.music_url` | assumed applied (pre-ledger, hand-run) |
| supabase-notifications-migration.sql | `notifications` + jobs tracking tables | assumed applied (pre-ledger, hand-run) |
| supabase-onboarding-migration.sql | Onboarding profile extensions (phone, etc.) | assumed applied (pre-ledger, hand-run) |
| supabase-pipeline-hardening-migration.sql | Adds `videos.deducted_cost`, `creatomate_render_id/url`, `progress_updated_at` | assumed applied (pre-ledger, hand-run) |
| supabase-profile-migration.sql | Extends `brands` into Person-or-Company profiles (`profile_type`, presenter fields) | assumed applied (pre-ledger, hand-run) |
| supabase-progress-preview-migration.sql | Adds `videos.preview_thumbs` + `total_scenes` for generating-UI filmstrip | assumed applied (pre-ledger, hand-run) |
| supabase-prospect-pipeline-FULL.sql | COMPLETE `prospect_demos` setup (full status set, RLS, polling index); supersedes the two partial prospect files | assumed applied (pre-ledger, hand-run) |
| supabase-prospect-pipeline-migration.sql | Original `prospect_demos` table (superseded by -FULL) | assumed applied (pre-ledger, hand-run) |
| supabase-prospect-progress-migration.sql | Adds `prospect_demos.progress_pct` + `stage_detail` + index | assumed applied (pre-ledger, hand-run) |
| supabase-prospects-migration.sql | Adds prospect columns on `videos` (is_trial, progress_detail, progress_pct, updated_at) | assumed applied (pre-ledger, hand-run) |
| supabase-referral-migration.sql | Adds `profiles.referral_code` / `referred_by` + `referrals` table | assumed applied (pre-ledger, hand-run) |
| supabase-rls-security-fix.sql | Drops over-permissive anon-key RLS policies that exposed customer PII | assumed applied (pre-ledger, hand-run) |
| supabase-sharelink-migration.sql | `video_views` share-link view tracking table | assumed applied (pre-ledger, hand-run) |
| supabase-slide-durations-migration.sql | Adds `videos.slide_durations` jsonb (per-slide clip durations) | assumed applied (pre-ledger, hand-run) |
| supabase-social-campaigns-migration.sql | `social_campaigns` tables for the social campaign manager | assumed applied (pre-ledger, hand-run) |
| supabase-social-hub-migration.sql | Ayrshare social-hub fields on `profiles` (profile key, voice, topics, schedule) | assumed applied (pre-ledger, hand-run) |
| supabase-social-shares-migration.sql | `social_shares` tracking table | assumed applied (pre-ledger, hand-run) |
| supabase-system-monitoring-migration.sql | `error_logs` (deduped) + health-check history for admin System Status | assumed applied (pre-ledger, hand-run) |
| supabase-templates-migration.sql | `custom_templates` table | assumed applied (pre-ledger, hand-run) |
| supabase-trial-subscription-migration.sql | Trial-then-auto-bill columns (`profiles.selected_plan`, ...) | assumed applied (pre-ledger, hand-run) |
| supabase-try-demo-email-migration.sql | Lead-nurture bookkeeping columns on `demo_videos` / `try_demos` | assumed applied (pre-ledger, hand-run) |
| supabase-video-analytics-migration.sql | `video_analytics` events table (view/play/chat/download/book) | assumed applied (pre-ledger, hand-run) |
| supabase-video-migration.sql | Video-explainer additions (e.g. `infographics.policy_data`) | assumed applied (pre-ledger, hand-run) |
| supabase-webhook-idempotency-migration.sql | Unique index making the Stripe-event marker insert the idempotency guard | assumed applied (pre-ledger, hand-run) |
| supabase-zernio-social-migration.sql | Zernio social add-on: per-client profile scoping + AI Social gate flag | assumed applied (pre-ledger, hand-run) |

## Change-management rule (effective 2026-08-24)

1. **All schema changes from now on go through `supabase/migrations/`** as
   timestamped migration files, reviewed via pull request before being applied.
   No more hand-run root-level SQL files; `supabase/legacy/` is frozen history.
2. **Pending, NOT yet applied to prod:**
   `supabase/migrations/20260824_social_rls_hardening.sql`. Do not assume it is
   live until it has been applied through the reviewed process and this ledger
   (or the migration history) records it.
