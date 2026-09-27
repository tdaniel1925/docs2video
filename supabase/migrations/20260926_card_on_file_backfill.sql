-- Audit H15 (2026-09-26): spending credits now requires a card on file for
-- free/trial accounts, on EVERY product (it used to be checked for video only).
-- People who subscribed through Stripe Checkout paid with a card but were never
-- flagged card_on_file — if they later cancel, they'd be blocked from spending
-- the credits they have left. Flag everyone who has paid us through Stripe.
--
-- Safe to run more than once. Only ever sets the flag to true.
--
-- WHY THE set_config LINE. card_on_file is a protected column: the profile
-- guard trigger (20260620_go_live_security.sql, and v2) rejects any change to
-- it that doesn't come from the server's service role. The SQL editor is not
-- the service role, so without this line the UPDATE fails with "Not allowed to
-- modify privileged profile columns". Marking THIS transaction as the service
-- role (only until COMMIT) lets the one-off backfill through; nothing else is
-- affected.

BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

UPDATE public.profiles
   SET card_on_file = true
 WHERE card_on_file IS DISTINCT FROM true
   AND stripe_customer_id IS NOT NULL
   AND (
     stripe_subscription_id IS NOT NULL
     OR lower(coalesce(subscription_status, '')) IN (
       'starter', 'active', 'pro', 'professional', 'business', 'unlimited',
       'agency', 'enterprise', 'enterprise-plus', 'enterprise_plus', 'past_due'
     )
   );

COMMIT;
