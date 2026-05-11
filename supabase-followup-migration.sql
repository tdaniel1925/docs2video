CREATE TABLE IF NOT EXISTS public.follow_up_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  client_name TEXT,
  client_email TEXT,
  suggestions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.follow_up_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own follow up plans" ON public.follow_up_plans;
CREATE POLICY "Users can manage own follow up plans" ON public.follow_up_plans FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.follow_up_emails (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  plan_id UUID REFERENCES public.follow_up_plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  day_offset INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.follow_up_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own follow up emails" ON public.follow_up_emails;
CREATE POLICY "Users can manage own follow up emails" ON public.follow_up_emails FOR ALL USING (auth.uid() = user_id);
