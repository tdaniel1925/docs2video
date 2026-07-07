-- ============================================================
-- Row Level Security on videos, jobs, notifications.
--
-- These three tables had RLS DISABLED. Because every public table is exposed
-- via the anon key, a live test with the PUBLIC anon key confirmed anyone on
-- the internet could read them:
--   videos        → 262 rows (user_id, titles, SCRIPTS, brand/infographic ids)
--   jobs          → 291 rows (user_id, type, title, status, progress)
--   notifications →   3 rows (user_id, message content)
--
-- This mirrors the brands fix (20260701_brands_rls.sql). All three tables have a
-- user_id column, so we scope reads/writes to the owner. Service-role (admin
-- client) access BYPASSES RLS — so the public watch page (which reads videos via
-- createAdminClient) and all internal jobs/crons are UNAFFECTED. Dashboard pages
-- read the signed-in user's OWN rows, which the owner policy allows.
--
-- MUST BE RUN MANUALLY IN PROD (Supabase SQL editor) — prod does not run
-- `supabase db push`.
-- ============================================================

-- ── videos ──────────────────────────────────────────────────
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS videos_owner_select ON public.videos;
CREATE POLICY videos_owner_select ON public.videos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS videos_owner_insert ON public.videos;
CREATE POLICY videos_owner_insert ON public.videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS videos_owner_update ON public.videos;
CREATE POLICY videos_owner_update ON public.videos
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS videos_owner_delete ON public.videos;
CREATE POLICY videos_owner_delete ON public.videos
  FOR DELETE USING (auth.uid() = user_id);

-- ── jobs ────────────────────────────────────────────────────
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jobs_owner_select ON public.jobs;
CREATE POLICY jobs_owner_select ON public.jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS jobs_owner_insert ON public.jobs;
CREATE POLICY jobs_owner_insert ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS jobs_owner_update ON public.jobs;
CREATE POLICY jobs_owner_update ON public.jobs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS jobs_owner_delete ON public.jobs;
CREATE POLICY jobs_owner_delete ON public.jobs
  FOR DELETE USING (auth.uid() = user_id);

-- ── notifications ───────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_owner_select ON public.notifications;
CREATE POLICY notifications_owner_select ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_owner_insert ON public.notifications;
CREATE POLICY notifications_owner_insert ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_owner_update ON public.notifications;
CREATE POLICY notifications_owner_update ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_owner_delete ON public.notifications;
CREATE POLICY notifications_owner_delete ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);
