-- Prevent negative credit balances at the database level
-- This is a safety net — the application already checks, but this prevents race conditions

-- Add CHECK constraints to prevent negative balances
ALTER TABLE credit_balances
  ADD CONSTRAINT credit_balances_balance_non_negative CHECK (balance >= 0),
  ADD CONSTRAINT credit_balances_topup_non_negative CHECK (topup_balance >= 0);

-- Index for webhook idempotency lookups
CREATE INDEX IF NOT EXISTS idx_credit_tx_stripe_event
  ON credit_transactions (description)
  WHERE description LIKE 'stripe_event:%';
