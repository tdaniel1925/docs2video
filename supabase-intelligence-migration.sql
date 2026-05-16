-- Client profiles (aggregated from video views)
CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_email TEXT,
  client_name TEXT,
  total_views INTEGER DEFAULT 0,
  total_videos_sent INTEGER DEFAULT 0,
  avg_watch_pct FLOAT DEFAULT 0,
  preferred_device TEXT,
  preferred_time TEXT,
  last_viewed_at TIMESTAMPTZ,
  converted BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own client profiles" ON public.client_profiles FOR ALL USING (auth.uid() = user_id);

-- Index for fast lookups by user + client email
CREATE INDEX IF NOT EXISTS idx_client_profiles_user_email ON public.client_profiles(user_id, client_email);
