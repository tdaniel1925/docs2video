-- Demo videos cache table
CREATE TABLE IF NOT EXISTS demo_videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text UNIQUE NOT NULL,
  brand_data jsonb NOT NULL DEFAULT '{}',
  video_url text,
  thumbnail_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'scraping', 'scripting', 'generating_slides', 'generating_audio', 'assembling', 'completed', 'failed')),
  email text,
  phone text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_videos_domain ON demo_videos(domain);
CREATE INDEX IF NOT EXISTS idx_demo_videos_status ON demo_videos(status);

-- Allow public read access to demo_videos (no auth required)
ALTER TABLE demo_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read demo videos" ON demo_videos
  FOR SELECT USING (true);

-- Only service role can insert/update (via admin client)
CREATE POLICY "Service role can manage demo videos" ON demo_videos
  FOR ALL USING (auth.role() = 'service_role');

-- Create a public storage bucket for demo videos
INSERT INTO storage.buckets (id, name, public) VALUES ('demo-videos', 'demo-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for demo video files
CREATE POLICY "Public read demo videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'demo-videos');

CREATE POLICY "Service role upload demo videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'demo-videos');
