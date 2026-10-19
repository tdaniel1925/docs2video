-- "Something not working?" reports (owner, 2026-10-19). The slide-out tab on
-- the signed-in screens files one row per report; Claude triages it; a bug
-- starts the self-fix workflow (GitHub), whose signed callbacks move the
-- status on. Screenshots go in the private "support" bucket, never public.
-- Written by the app with the service role only; a person can read their own.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.support_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref              text NOT NULL UNIQUE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'received'
                   CHECK (status IN ('received','triaged','fixing','checked','fixed','answered','needs_human')),
  kind             text CHECK (kind IN ('bug','how_to','account','feature','unclear')),
  description      text NOT NULL,
  steps            text,
  page_url         text,
  browser          text,
  diagnostics      jsonb NOT NULL DEFAULT '{}'::jsonb,
  screenshot_path  text,
  video_id         uuid,
  triage_summary   text,
  pr_url           text,
  dispatched_at    timestamptz,
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_reports_user_created_idx ON public.support_reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_reports_status_idx ON public.support_reports (status, created_at DESC);

ALTER TABLE public.support_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_reports: read own" ON public.support_reports;
CREATE POLICY "support_reports: read own" ON public.support_reports
  FOR SELECT USING (auth.uid() = user_id);
-- No insert/update/delete policies: only the service role writes.

-- The private screenshot bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('support', 'support', false)
ON CONFLICT (id) DO NOTHING;
