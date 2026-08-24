-- Fix: profiles.subscription_status CHECK constraint was out of sync with the
-- application code, silently 500-ing critical Stripe webhooks in production.
--
-- Discovered 2026-06-26 during end-to-end Stripe test-mode payment testing:
--   * 'enterprise' was REJECTED  -> Enterprise subscribers could not be
--     provisioned (webhook checkout/subscription.updated sets status=tier),
--     and the admin "promo to enterprise" action failed.
--   * 'past_due' / 'unpaid' were REJECTED -> failed-payment dunning 500'd, so
--     delinquent users were NEVER blocked (defeats the H2 dunning guard).
--   * 'free' was REJECTED (code uses NULL for free, so lower impact, but allow
--     it for safety since older paths reference it).
--
-- Values the codebase legitimately writes to subscription_status:
--   NULL, 'trial', 'free', 'pro', 'professional', 'business', 'enterprise',
--   'active', 'past_due', 'unpaid', 'canceled'
-- (statusToTier() also normalizes 'unlimited' and 'enterprise_plus'/'agency';
--  include them so any historical/admin write cannot trip the constraint.)

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (
    subscription_status IS NULL OR subscription_status IN (
      'trial',
      'free',
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
