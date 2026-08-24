-- Social Media Campaign Manager tables
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS social_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  business_name text,
  total_posts integer DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'active', 'completed', 'paused')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_campaign_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES social_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  content_type text,
  caption text,
  image_prompt text,
  image_url text,
  hashtags text[],
  scheduled_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'scheduled', 'published', 'failed')),
  ayrshare_post_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON social_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_posts_campaign ON social_campaign_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_posts_status ON social_campaign_posts(status, scheduled_at);

ALTER TABLE social_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_campaign_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns" ON social_campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage campaigns" ON social_campaigns FOR ALL USING (true);
CREATE POLICY "Users can view own campaign posts" ON social_campaign_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage campaign posts" ON social_campaign_posts FOR ALL USING (true);
