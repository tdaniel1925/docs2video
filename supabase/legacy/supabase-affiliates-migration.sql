-- Affiliate program tables
-- Run this in your Supabase SQL editor

-- Affiliate profiles
CREATE TABLE IF NOT EXISTS affiliates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL UNIQUE,
  commission_rate numeric(5,2) DEFAULT 20.00, -- 20% default
  total_earned integer DEFAULT 0, -- cents
  total_paid integer DEFAULT 0, -- cents
  total_referrals integer DEFAULT 0,
  total_conversions integer DEFAULT 0,
  credits_earned integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'suspended')),
  payout_email text,
  created_at timestamptz DEFAULT now()
);

-- Referral tracking
CREATE TABLE IF NOT EXISTS referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'clicked' CHECK (status IN ('clicked', 'signed_up', 'converted', 'paid')),
  signup_at timestamptz,
  conversion_at timestamptz,
  commission_amount integer DEFAULT 0, -- cents
  commission_paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_user ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate ON referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);

-- RLS
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own affiliate" ON affiliates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage affiliates" ON affiliates FOR ALL USING (true);

CREATE POLICY "Affiliates can view own referrals" ON referrals FOR SELECT
  USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Service can manage referrals" ON referrals FOR ALL USING (true);
