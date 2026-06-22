-- ============================================================
-- Prospect Pipeline — COMPLETE setup (run this once in Supabase SQL editor).
-- Creates prospect_demos with the full status set (incl. 'cancelled'),
-- progress columns, RLS, and the polling index. Idempotent / safe to re-run.
-- The base table was never created in production, which is why the whole
-- prospect feature silently no-op'd.
-- ============================================================

-- uuid_generate_v4() needs the uuid-ossp extension (no-op if already enabled).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.prospect_demos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  url TEXT NOT NULL,
  company_name TEXT,
  contact_email TEXT,
  contact_name TEXT,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  logo_url TEXT,

  -- Pipeline
  status TEXT DEFAULT 'queued',
  error_message TEXT,
  script JSONB,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,

  -- Live progress (drives the admin dashboard)
  progress_pct INTEGER DEFAULT 0,
  stage_detail TEXT,

  -- Email
  email_subject TEXT,
  email_body TEXT,
  email_sent_at TIMESTAMPTZ,
  email_opened_at TIMESTAMPTZ,
  video_watched_at TIMESTAMPTZ,
  signed_up_at TIMESTAMPTZ,

  -- Review
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already existed (older partial migration), make sure the new
-- columns are present.
ALTER TABLE public.prospect_demos
  ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_detail TEXT;

-- Status validity: enforce the full set the code uses, INCLUDING 'cancelled'.
-- Drop any prior constraint first so re-runs don't conflict.
ALTER TABLE public.prospect_demos DROP CONSTRAINT IF EXISTS prospect_demos_status_check;
ALTER TABLE public.prospect_demos
  ADD CONSTRAINT prospect_demos_status_check CHECK (status IN (
    'queued','scraping','scripting','generating','assembling',
    'ready_for_review','approved','sending','sent','watched',
    'converted','rejected','failed','cancelled'
  ));

-- Speeds up the live-polling list (newest first, filter by status).
CREATE INDEX IF NOT EXISTS prospect_demos_status_created_idx
  ON public.prospect_demos (status, created_at DESC);

-- RLS: served via the service-role (admin) client, so a permissive policy is fine.
ALTER TABLE public.prospect_demos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage prospect demos" ON public.prospect_demos;
CREATE POLICY "Admins can manage prospect demos" ON public.prospect_demos FOR ALL USING (true);
