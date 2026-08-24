-- Pipeline reliability hardening (video audit fixes H1/H4/M1-M6)
-- Adds columns the generate-video flow + fix-stuck-videos cron need to:
--  - refund the right amount when force-failing a stuck job (H1)
--  - recover V2 jobs by re-querying Creatomate (H4)
--  - use an activity-staleness window instead of created_at age (M1/M2)
-- Run in the Supabase SQL editor.

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS deducted_cost        INTEGER,        -- credits charged for this job (for accurate refund)
  ADD COLUMN IF NOT EXISTS creatomate_render_id TEXT,           -- V2 render id, so the cron can re-query getRender
  ADD COLUMN IF NOT EXISTS creatomate_render_url TEXT,          -- last known render URL (finalize retry)
  ADD COLUMN IF NOT EXISTS progress_updated_at  TIMESTAMPTZ;    -- bumped on each progress write (staleness signal)

CREATE INDEX IF NOT EXISTS idx_videos_progress_updated ON public.videos (progress_updated_at);
