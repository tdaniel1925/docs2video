-- Referral tracking columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by text;

-- Set up Phil Resch
UPDATE profiles SET referral_code = 'vfs', subscription_status = 'agency' WHERE email = 'phil@valorfs.com';
