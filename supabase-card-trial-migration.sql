-- Add card-on-file trial fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_on_file boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_videos_remaining integer DEFAULT 5;
