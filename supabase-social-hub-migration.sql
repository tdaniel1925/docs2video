-- Social Hub Migration
-- Adds Ayrshare profile linking + social media hub fields

-- Add social fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ayrshare_profile_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_voice TEXT DEFAULT 'professional';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_topics TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posting_schedule JSONB DEFAULT '{"frequency": "3x/week", "preferred_times": ["09:00", "12:00", "17:00"]}';

-- Add engagement tracking to social_campaign_posts
ALTER TABLE social_campaign_posts ADD COLUMN IF NOT EXISTS engagement JSONB DEFAULT '{"likes": 0, "shares": 0, "comments": 0, "clicks": 0}';
