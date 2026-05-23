-- Add nurture_sent jsonb column to profiles table
-- Tracks which nurture emails have been sent to each user
-- Example: { "getting_started": "2026-05-22T14:00:00Z", "how_to_share": "2026-05-23T14:00:00Z" }
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nurture_sent jsonb DEFAULT '{}'::jsonb;
