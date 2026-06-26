-- Zernio social add-on migration.
-- Run in the Supabase SQL editor (prod does NOT auto-run committed migrations).
--
-- Tenant model: ONE Zernio profile per client, scoped by profileId. Plus a gate
-- flag for the $50/mo "AI Social" add-on (posting only; AI generation uses normal
-- credits). The legacy ayrshare_profile_key column is kept for back-compat but is
-- no longer used (hard switch to Zernio).

-- Per-client Zernio profile id (created lazily on first connect).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zernio_profile_id text;

-- $50/mo AI-Social add-on entitlement. Flipped by the Stripe webhook on
-- add-on purchase/cancel; gates the whole Social area.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_addon_active boolean DEFAULT false;
