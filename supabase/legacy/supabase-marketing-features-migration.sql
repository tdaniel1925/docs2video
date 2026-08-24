-- Migration: Marketing automation features
-- Adds referral_prompt_sent flag to profiles table

-- Track whether a referral prompt email has been sent to a user
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_prompt_sent BOOLEAN DEFAULT FALSE;

-- Index for efficient cron queries on referral prompt eligibility
CREATE INDEX IF NOT EXISTS idx_profiles_referral_prompt
  ON profiles (is_admin, referral_prompt_sent)
  WHERE is_admin = false AND (referral_prompt_sent IS NULL OR referral_prompt_sent = false);
