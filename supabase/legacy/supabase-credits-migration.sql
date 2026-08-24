ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pack_credits integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_reset_at timestamptz;
