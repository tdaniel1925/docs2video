-- Prospect pipeline: granular progress for the management dashboard.
-- progress_pct: 0-100 overall completion; stage_detail: human label for the
-- current step (e.g. "Generating slide 2 of 4"). Both nullable/back-compatible.
ALTER TABLE public.prospect_demos
  ADD COLUMN IF NOT EXISTS progress_pct integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_detail text;

-- Speeds up the live-polling list (newest first, filter by status).
CREATE INDEX IF NOT EXISTS prospect_demos_status_created_idx
  ON public.prospect_demos (status, created_at DESC);
