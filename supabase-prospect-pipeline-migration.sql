CREATE TABLE IF NOT EXISTS public.prospect_demos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  url TEXT NOT NULL,
  company_name TEXT,
  contact_email TEXT,
  contact_name TEXT,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  logo_url TEXT,

  -- Pipeline
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','scraping','scripting','generating','assembling','ready_for_review','approved','sending','sent','watched','converted','rejected','failed')),
  error_message TEXT,
  script JSONB,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,

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

ALTER TABLE public.prospect_demos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage prospect demos" ON public.prospect_demos;
CREATE POLICY "Admins can manage prospect demos" ON public.prospect_demos FOR ALL USING (true);
