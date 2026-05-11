-- Notifications + Jobs tracking tables
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'video_complete', 'video_failed', 'course_progress', 'social_kit_ready', 'campaign_ready', 'credits_low', 'system'
  title text NOT NULL,
  message text,
  link text, -- URL to navigate to when clicked
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'video', 'course', 'social-kit', 'campaign', 'logo', 'infographic', 'flyer', 'business-card'
  title text,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  progress integer DEFAULT 0, -- 0-100
  metadata jsonb DEFAULT '{}', -- type-specific data (e.g., episode count, platform list)
  result_url text, -- URL to the finished result
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, status, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can manage notifications" ON notifications FOR ALL USING (true);

CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage jobs" ON jobs FOR ALL USING (true);
