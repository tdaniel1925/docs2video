-- Video view tracking
CREATE TABLE IF NOT EXISTS public.video_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  viewer_device TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  watch_duration INTEGER DEFAULT 0
);

ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert video views" ON public.video_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Video owners can view" ON public.video_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.videos WHERE videos.id = video_views.video_id AND videos.user_id = auth.uid())
);

-- Chat messages on share pages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('client', 'assistant')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert chat messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view chat messages for a video" ON public.chat_messages FOR SELECT USING (true);

-- Quotes/invoices
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  line_items JSONB DEFAULT '[]',
  subtotal INTEGER DEFAULT 0,
  tax INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','accepted','paid','declined')),
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own quotes" ON public.quotes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view sent quotes" ON public.quotes FOR SELECT USING (status != 'draft');

-- Add calendly_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendly_url TEXT;

-- Add Stripe OAuth fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_user_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_access_token TEXT;

-- Add multiple photo types to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_midlevel_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_standing_url TEXT;
