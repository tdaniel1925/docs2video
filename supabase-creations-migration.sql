-- Unified creations log table
CREATE TABLE IF NOT EXISTS creations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('video', 'flyer', 'business-card', 'infographic', 'ad', 'brand-deck')),
  title text,
  thumbnail_url text,
  file_url text,
  metadata jsonb DEFAULT '{}',
  credits_used integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creations_user ON creations(user_id);
CREATE INDEX IF NOT EXISTS idx_creations_type ON creations(type);
CREATE INDEX IF NOT EXISTS idx_creations_created ON creations(created_at DESC);

ALTER TABLE creations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own creations" ON creations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages creations" ON creations
  FOR ALL USING (auth.role() = 'service_role');
