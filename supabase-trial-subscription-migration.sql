-- Free-trial-then-auto-bill: at signup the user picks a plan + saves a card; a
-- Stripe subscription is created with a long trial. When their 2,000 free credits
-- hit zero we end the trial so Stripe charges the saved card and the plan begins.
--
-- Run in the Supabase SQL editor (prod does NOT auto-run committed migrations).

-- The plan the user chose at signup (the tier their trial converts to).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selected_plan text;

-- The trialing subscription id (so the depletion trigger can end its trial).
-- (Most installs already have stripe_subscription_id; this is a safety net.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Card-on-file fields (from supabase-card-trial-migration.sql) — re-assert in case
-- that migration was never applied in prod (see migration-drift notes).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_on_file boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_videos_remaining integer DEFAULT 5;

-- The base schema had a CHECK limiting subscription_status to a small set; the app
-- now writes 'starter'/'pro'/'business'/'enterprise'/'past_due'/'trial'/null. Drop
-- any such constraint so those writes don't fail.
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'profiles'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%subscription_status%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', c); END IF;
END $$;
