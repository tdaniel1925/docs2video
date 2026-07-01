-- ============================================================
-- Review S6 — durable, cross-instance rate limiting.
-- The in-memory limiters on unauthenticated spend endpoints (try-demo,
-- capture-lead, track-view) reset per serverless instance/cold start, so their
-- caps were illusory. One atomic upsert per hit; a window that has expired
-- resets the counter. Returns TRUE while the caller is within p_max hits for
-- the current window.
--
-- App code FAILS OPEN if this hasn't been applied (logged), so running it is
-- what actually turns the caps on.
--
-- MUST BE RUN MANUALLY IN PROD (Supabase SQL editor) — prod does not run
-- `supabase db push`.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- Service-role only (the app calls it with the admin client); no anon access.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key text, p_max integer, p_window_secs integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  INSERT INTO public.rate_limits (key, count, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limits.window_start < now() - make_interval(secs => p_window_secs) THEN 1
      ELSE public.rate_limits.count + 1
    END,
    window_start = CASE
      WHEN public.rate_limits.window_start < now() - make_interval(secs => p_window_secs) THEN now()
      ELSE public.rate_limits.window_start
    END
  RETURNING count <= p_max INTO v_allowed;
  RETURN v_allowed;
END;
$$;

-- Housekeeping helper (optional): purge rows whose window ended long ago.
-- SELECT cron or run ad-hoc: DELETE FROM public.rate_limits WHERE window_start < now() - interval '7 days';
