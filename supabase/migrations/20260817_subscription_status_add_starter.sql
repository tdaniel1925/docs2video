-- P0 BILLING FIX — allow 'starter' in profiles.subscription_status.
--
-- 'starter' is a real, sellable tier (app/_lib/pricing.ts:46, STRIPE_PRICE_STARTER
-- in app/_lib/stripe.ts:21). The Stripe webhook writes `subscription_status: tier`
-- (webhooks/stripe/route.ts:226/324/366), so a Starter purchase writes the string
-- 'starter'. The previous CHECK (supabase-fix-subscription-status-check.sql) listed
-- every tier EXCEPT 'starter' — so a Starter checkout/subscription webhook hit a
-- CHECK violation (Postgres 23514), the handler 500'd, the idempotency claim was
-- released, and Stripe retried forever. Net effect: a PAID Starter customer was
-- never provisioned and never received credits.
--
-- This widens the allow-list by one value. It is NON-DESTRUCTIVE: adding an allowed
-- value cannot reject any existing row (live prod currently has zero 'starter' rows).
-- Full list re-stated so this file is the single current source of truth.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (
    subscription_status IS NULL OR subscription_status IN (
      'trial',
      'free',
      'starter',          -- ← the fix: was missing
      'pro',
      'professional',
      'business',
      'enterprise',
      'enterprise_plus',
      'agency',
      'unlimited',
      'active',
      'past_due',
      'unpaid',
      'canceled'
    )
  );

-- Verify (run after applying):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'profiles_subscription_status_check';
--   -- the returned definition must contain 'starter'.
