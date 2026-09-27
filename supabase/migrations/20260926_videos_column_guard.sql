-- ============================================================
-- videos column guard (audit C1, 2026-09-26)
--
-- WHY. Row-level security lets a signed-in user insert and update their OWN
-- rows in `videos` directly with the public key (20260707_videos_jobs_
-- notifications_rls.sql). That was enough to mint free credits: make a row
-- with status = 'failed' and deducted_cost = 1000000, and the stuck-video cron
-- "refunded" it. The cron now checks the credit ledger before refunding, so
-- the exploit is closed in code already — this trigger closes it at the
-- database too, so no future code path can trust a number a user typed.
--
-- WHAT A USER MAY STILL DO (the app relies on these):
--   * insert a row as 'draft' or 'pending' (never with a charge on it);
--   * move their own not-yet-finished row back to 'pending' (the "Retry" and
--     "Restart Generation" buttons on the video page — Restart now goes
--     through the server, which refunds the stuck run first) or to 'draft';
--   * edit any other column (title, script, draft_data, ...).
-- WHAT THEY MAY NOT DO:
--   * set or change deducted_cost / estimated_cost_cents (billing);
--   * set any other status ('failed', 'completed', 'scripting', ...), or
--     reopen a 'completed' video;
--   * point source_pdf_path (the public "download the original PDF" file) at
--     a file outside their own storage folder.
-- The server (service role) is not limited — every real status change and
-- every charge is written by it.
--
-- Mirrors guard_privileged_profile_columns in 20260620_go_live_security.sql.
-- Idempotent: safe to run more than once.
-- MUST BE RUN MANUALLY IN PROD (Supabase SQL editor) — prod does not run
-- `supabase db push`. The app is safe without it; this is the second lock.
-- ============================================================

-- The trigger reads these columns; make sure they exist (all already added by
-- earlier migrations — repeated here so this file never fails on a database
-- where one of those was skipped). No-ops when the columns are present.
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS deducted_cost INTEGER;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS estimated_cost_cents INTEGER;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS source_pdf_path TEXT;

CREATE OR REPLACE FUNCTION public.guard_video_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := COALESCE(auth.uid()::text, '');
BEGIN
  -- Trusted server-side write (admin client / crons / render service).
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.deducted_cost, 0) <> 0 THEN
      RAISE EXCEPTION 'Not allowed to set billing columns on videos';
    END IF;
    IF NEW.estimated_cost_cents IS NOT NULL AND NEW.estimated_cost_cents <> 0 THEN
      RAISE EXCEPTION 'Not allowed to set billing columns on videos';
    END IF;
    IF NEW.status IS NOT NULL AND NEW.status NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'Not allowed to set video status to %', NEW.status;
    END IF;
    IF NEW.source_pdf_path IS NOT NULL AND NEW.source_pdf_path NOT LIKE v_uid || '/%' THEN
      RAISE EXCEPTION 'source_pdf_path must be inside your own folder';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.deducted_cost IS DISTINCT FROM OLD.deducted_cost
     OR NEW.estimated_cost_cents IS DISTINCT FROM OLD.estimated_cost_cents THEN
    RAISE EXCEPTION 'Not allowed to modify billing columns on videos';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('draft', 'pending') OR OLD.status = 'completed' THEN
      RAISE EXCEPTION 'Not allowed to change video status from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  IF NEW.source_pdf_path IS DISTINCT FROM OLD.source_pdf_path
     AND NEW.source_pdf_path IS NOT NULL
     AND NEW.source_pdf_path NOT LIKE v_uid || '/%' THEN
    RAISE EXCEPTION 'source_pdf_path must be inside your own folder';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_video_billing_columns ON public.videos;
CREATE TRIGGER trg_guard_video_billing_columns
  BEFORE INSERT OR UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.guard_video_billing_columns();
