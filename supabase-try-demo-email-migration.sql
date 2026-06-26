-- Lead nurture for people who ran a landing-page DEMO (which already captures an
-- email in demo_videos) but never created an account. Adds the bookkeeping the
-- nurture cron needs. Run in the Supabase SQL editor (prod does NOT auto-run
-- committed migrations).
--
-- NOTE: demo_videos already has `email` + `phone`. The anonymous /try/[slug]
-- flow (try_demos) ALSO now captures an optional email (see route change), so we
-- add the same columns there too for completeness — but the real lead volume is
-- in demo_videos.

-- demo_videos: nurture bookkeeping + conversion flag.
ALTER TABLE demo_videos ADD COLUMN IF NOT EXISTS nurture_sent jsonb DEFAULT '{}'::jsonb;
ALTER TABLE demo_videos ADD COLUMN IF NOT EXISTS converted_at timestamptz;
CREATE INDEX IF NOT EXISTS demo_videos_email_idx ON demo_videos (email) WHERE email IS NOT NULL;

-- try_demos: optional email capture + same bookkeeping (lower volume path).
ALTER TABLE try_demos ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE try_demos ADD COLUMN IF NOT EXISTS nurture_sent jsonb DEFAULT '{}'::jsonb;
ALTER TABLE try_demos ADD COLUMN IF NOT EXISTS converted_at timestamptz;
CREATE INDEX IF NOT EXISTS try_demos_email_idx ON try_demos (email) WHERE email IS NOT NULL;
