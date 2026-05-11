-- Social shares tracking table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS social_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL, -- 'twitter', 'facebook', 'linkedin', 'instagram'
  creation_id uuid,
  creation_type text, -- 'video', 'infographic', 'logo', etc.
  post_id text, -- AyrShare post ID for verification
  credits_awarded boolean DEFAULT false,
  credits_amount integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for monthly credit lookups
CREATE INDEX IF NOT EXISTS idx_social_shares_user_month
  ON social_shares (user_id, credits_awarded, created_at);

-- RLS
ALTER TABLE social_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shares"
  ON social_shares FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (API handles it)
CREATE POLICY "Service role can insert shares"
  ON social_shares FOR INSERT
  WITH CHECK (true);
