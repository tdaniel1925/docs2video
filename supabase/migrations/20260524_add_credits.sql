-- Credit system tables for usage-based billing
-- Each subscription tier includes monthly credits; overages billed via Stripe metered billing

-- Credit balances (fast lookup, one row per user)
CREATE TABLE IF NOT EXISTS credit_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  cycle_start TIMESTAMPTZ DEFAULT now(),
  cycle_credits_granted INTEGER DEFAULT 0,
  cycle_credits_used INTEGER DEFAULT 0,
  topup_balance INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit transaction log (audit trail)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  action TEXT NOT NULL,
  video_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_balances_low ON credit_balances(balance) WHERE balance < 500;

-- RLS
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own balance" ON credit_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
