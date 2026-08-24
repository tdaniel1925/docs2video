-- ============================================================
-- Missing-tables backfill (run once in Supabase SQL editor).
-- These tables are referenced by app code but were never created in production
-- (their migration files exist in supabase/migrations/ but prod isn't running
-- `supabase db push`). Each insert/select against them was silently failing.
-- Idempotent / safe to re-run.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) script_revisions — stores script edit/revision history (generate-video,
--    script-chat, script-revisions). Without it, every revision insert errored.
CREATE TABLE IF NOT EXISTS public.script_revisions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  revision_number INTEGER NOT NULL DEFAULT 1,
  scenes JSONB NOT NULL,
  prompt_versions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_script_revisions_video ON public.script_revisions(video_id, revision_number);
ALTER TABLE public.script_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own script revisions" ON public.script_revisions;
CREATE POLICY "Users can view own script revisions" ON public.script_revisions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.videos WHERE videos.id = script_revisions.video_id AND videos.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert own script revisions" ON public.script_revisions;
CREATE POLICY "Users can insert own script revisions" ON public.script_revisions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.videos WHERE videos.id = script_revisions.video_id AND videos.user_id = auth.uid())
);

-- 2) try_demos — lead capture for the public "try it free" demo flow
--    (app/api/try-demo). Served via service-role; permissive policy.
CREATE TABLE IF NOT EXISTS public.try_demos (
  id UUID PRIMARY KEY,
  source_url TEXT,
  company_name TEXT,
  brand_data JSONB,
  status TEXT DEFAULT 'processing',
  is_trial BOOLEAN DEFAULT TRUE,
  detail_level TEXT DEFAULT 'quick',
  video_url TEXT,
  thumbnail_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.try_demos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages try demos" ON public.try_demos;
CREATE POLICY "Service role manages try demos" ON public.try_demos FOR ALL USING (true);

-- 3) daily_user_spend — cost-ceiling tracking (cost-estimator). Dormant unless
--    COST_CEILINGS_ENABLED=true, but create it so it's ready + stops errors.
CREATE TABLE IF NOT EXISTS public.daily_user_spend (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  spend_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cents INTEGER NOT NULL DEFAULT 0,
  video_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, spend_date)
);
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS estimated_cost_cents INTEGER;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS actual_cost_cents INTEGER;
