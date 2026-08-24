CREATE TABLE IF NOT EXISTS public.creation_assets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  tag TEXT DEFAULT 'product' CHECK (tag IN ('product', 'logo', 'lifestyle', 'background')),
  display_name TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.creation_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own assets" ON public.creation_assets;
CREATE POLICY "Users can manage own assets" ON public.creation_assets FOR ALL USING (auth.uid() = user_id);

-- Storage bucket for product assets
INSERT INTO storage.buckets (id, name, public) VALUES ('creation-assets', 'creation-assets', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload creation assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view creation assets" ON storage.objects;
CREATE POLICY "Users can upload creation assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'creation-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Anyone can view creation assets" ON storage.objects FOR SELECT USING (bucket_id = 'creation-assets');
