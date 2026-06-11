-- Webhook idempotency hardening.
-- The Stripe webhook checks credit_transactions for an existing
-- "stripe_event:{id}" marker before processing, but two concurrent
-- deliveries of the same event could both pass the check. This unique
-- index makes the marker insert itself the idempotency guard.
--
-- If this fails with a duplicate-key error, dedupe first:
--   DELETE FROM credit_transactions a USING credit_transactions b
--   WHERE a.id > b.id AND a.description = b.description
--     AND a.description LIKE '%stripe_event:%';

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_stripe_event
  ON credit_transactions (description)
  WHERE description LIKE '%stripe_event:%';
