-- Free trial system: add is_trial flag to videos
-- Trial videos get a watermark applied by the VPS during assembly

ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT false;

-- Index for quick trial video lookups per user
CREATE INDEX IF NOT EXISTS idx_videos_user_trial ON videos (user_id, is_trial) WHERE is_trial = true;
