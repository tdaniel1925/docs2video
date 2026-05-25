-- Wizard support columns on videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS output_type TEXT DEFAULT 'video';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS detail_level TEXT DEFAULT 'standard';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS draft_data JSONB DEFAULT '{}';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS draft_expires_at TIMESTAMPTZ;

-- Index for draft cleanup cron
CREATE INDEX IF NOT EXISTS idx_videos_draft_cleanup
  ON videos (status, draft_expires_at)
  WHERE status = 'draft';
